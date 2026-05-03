import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ArrowLeft, BookOpen, Package, Tag, Truck, Plug, RefreshCw,
    Save, Loader2, ClipboardList,
} from 'lucide-react';
import api from '../api/axios';
import StockMutationsModal from '../components/StockMutationsModal';

const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bubbels', dessert: 'Dessert' };
const UNIT_LABELS = { bottle: 'Fles', glass: 'Glas', half_bottle: 'Halve fles' };

const Section = ({ icon: Icon, title, subtitle, action, children }) => (
    <div className="glass rounded-2xl p-6 mb-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#7B2D3A]/40 border border-[#C4758A]/30 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#C4758A]" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white truncate" style={{ fontFamily: "'Inria Serif', serif" }}>{title}</h2>
                    {subtitle && <p className="text-xs text-white/50 truncate">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
        {children}
    </div>
);

const Field = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5">{label}</span>
        {children}
    </label>
);

const WineDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [wine, setWine] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [catalogItemsByIntegration, setCatalogItemsByIntegration] = useState({});
    const [mappings, setMappings] = useState([]);
    const [savingField, setSavingField] = useState(false);
    const [showMutations, setShowMutations] = useState(false);
    const [syncingId, setSyncingId] = useState(null);

    const [form, setForm] = useState({
        vintage: '', supplier: '', purchase_price: '', sell_price: '', sell_price_glass: '',
        stock_count: '', min_stock_alert: '',
    });

    const refresh = async () => {
        try {
            const [wineRes, intRes, mapRes] = await Promise.all([
                api.get(`/wines/${id}`),
                api.get('/integrations'),
                api.get(`/wines/${id}/mappings`),
            ]);
            setWine(wineRes.data);
            setForm({
                vintage: wineRes.data.vintage ?? '',
                supplier: wineRes.data.supplier ?? '',
                purchase_price: wineRes.data.purchase_price ?? '',
                sell_price: wineRes.data.sell_price ?? '',
                sell_price_glass: wineRes.data.sell_price_glass ?? '',
                stock_count: wineRes.data.stock_count ?? '',
                min_stock_alert: wineRes.data.min_stock_alert ?? '',
            });
            const active = intRes.data.filter(i => i.is_active);
            setIntegrations(active);
            setMappings(mapRes.data);

            const lists = await Promise.all(
                active.map(i => api.get(`/integrations/${i.id}/catalog-items`).then(r => [i.id, r.data]))
            );
            setCatalogItemsByIntegration(Object.fromEntries(lists));
        } catch (e) {
            toast.error('Kon wijn niet laden');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);

    const onSave = async () => {
        setSavingField(true);
        try {
            const payload = {
                vintage: form.vintage === '' ? null : Number(form.vintage),
                supplier: form.supplier || null,
                purchase_price: form.purchase_price === '' ? 0 : Number(form.purchase_price),
                sell_price: form.sell_price === '' ? null : Number(form.sell_price),
                sell_price_glass: form.sell_price_glass === '' ? null : Number(form.sell_price_glass),
                stock_count: form.stock_count === '' ? 0 : Number(form.stock_count),
                min_stock_alert: form.min_stock_alert === '' ? 0 : Number(form.min_stock_alert),
            };
            const { data } = await api.put(`/wines/${id}`, payload);
            setWine(data);
            toast.success('Wijn opgeslagen');
        } catch (e) {
            toast.error(e.response?.data?.error || 'Opslaan mislukt');
        } finally { setSavingField(false); }
    };

    const onSyncCatalog = async (integrationId) => {
        setSyncingId(integrationId);
        try {
            await api.post(`/integrations/${integrationId}/sync-catalog`);
            const { data } = await api.get(`/integrations/${integrationId}/catalog-items`);
            setCatalogItemsByIntegration(s => ({ ...s, [integrationId]: data }));
            toast.success(`${data.length} artikelen opgehaald`);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Sync mislukt');
        } finally { setSyncingId(null); }
    };

    const onMappingChange = async (integrationId, unit, externalId) => {
        const existing = mappings.find(m => m.integration_id === integrationId && m.unit === unit);

        if (!externalId) {
            if (!existing) return;
            try {
                await api.delete(`/wines/${id}/mappings/${existing.id}`);
                setMappings(mappings.filter(m => m.id !== existing.id));
            } catch { toast.error('Verwijderen mislukt'); }
            return;
        }

        try {
            const { data } = await api.put(`/wines/${id}/mappings`, {
                integration_id: integrationId,
                external_id: externalId,
                unit,
                units_per_sale: unit === 'glass' ? 0.2 : unit === 'half_bottle' ? 0.5 : 1,
            });
            setMappings(prev => {
                const filtered = prev.filter(m => !(m.integration_id === integrationId && m.unit === unit));
                return [...filtered, data];
            });
        } catch (e) { toast.error(e.response?.data?.error || 'Opslaan mislukt'); }
    };

    const findMapping = (integrationId, unit) =>
        mappings.find(m => m.integration_id === integrationId && m.unit === unit);

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-white/60"><Loader2 className="animate-spin mr-2" size={20} /> Laden…</div>;
    }
    if (!wine) {
        return <div className="text-center text-white/50 py-12">Wijn niet gevonden.</div>;
    }

    return (
        <div className="max-w-3xl mx-auto">
            <button onClick={() => navigate('/wines')}
                className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4">
                <ArrowLeft size={16} /> Terug naar voorraad
            </button>

            {/* Kop met catalogus-info (read-only) */}
            <div className="glass rounded-2xl p-6 mb-6 animate-slide-up">
                <div className="flex items-start gap-4 flex-wrap">
                    {wine.image_url && (
                        <img src={wine.image_url} alt="" className="w-16 h-24 rounded-lg object-cover bg-black/20 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>{wine.name}</h1>
                        <p className="text-sm text-white/60 mt-0.5">
                            {[wine.winery, wine.region, wine.country].filter(Boolean).join(' · ')}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                            {wine.type && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">{TYPE_LABELS[wine.type] || wine.type}</span>}
                            {wine.grape && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">{wine.grape}</span>}
                            {wine.bottle_size && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70">{wine.bottle_size}</span>}
                        </div>
                    </div>
                    <button onClick={() => navigate(`/catalog/${wine.catalog_id}`)}
                        className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white shrink-0">
                        <BookOpen size={14} /> Ga naar catalogus
                    </button>
                </div>
            </div>

            {/* Voorraad + prijzen + leverancier */}
            <Section icon={Package} title="Mijn voorraad & prijzen" subtitle="Per-restaurant gegevens">
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Voorraad (flessen)">
                        <input type="number" min="0" className="input-glass" value={form.stock_count}
                            onChange={e => setForm({ ...form, stock_count: e.target.value })} />
                    </Field>
                    <Field label="Voorraad-alarm bij">
                        <input type="number" min="0" className="input-glass" value={form.min_stock_alert}
                            onChange={e => setForm({ ...form, min_stock_alert: e.target.value })} />
                    </Field>
                    <Field label="Inkoopprijs (€)">
                        <input type="number" step="0.01" min="0" className="input-glass" value={form.purchase_price}
                            onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
                    </Field>
                    <Field label="Verkoopprijs fles (€)">
                        <input type="number" step="0.01" min="0" className="input-glass" value={form.sell_price}
                            onChange={e => setForm({ ...form, sell_price: e.target.value })} />
                    </Field>
                    <Field label="Verkoopprijs glas (€)">
                        <input type="number" step="0.01" min="0" className="input-glass" value={form.sell_price_glass}
                            onChange={e => setForm({ ...form, sell_price_glass: e.target.value })} />
                    </Field>
                    <Field label="Jaargang">
                        <input type="number" min="1800" className="input-glass" value={form.vintage}
                            onChange={e => setForm({ ...form, vintage: e.target.value })} />
                    </Field>
                    <Field label="Leverancier">
                        <input className="input-glass sm:col-span-2" value={form.supplier}
                            onChange={e => setForm({ ...form, supplier: e.target.value })} />
                    </Field>
                </div>
                <div className="flex items-center justify-between mt-5">
                    <button onClick={() => setShowMutations(true)}
                        className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white">
                        <ClipboardList size={14} /> Voorraadmutaties
                    </button>
                    <button onClick={onSave} disabled={savingField}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B2D3A] hover:bg-[#8c3845] text-white font-semibold text-sm shadow-lg disabled:opacity-50">
                        <Save size={14} /> {savingField ? 'Opslaan…' : 'Opslaan'}
                    </button>
                </div>
            </Section>

            {/* Kassakoppelingen */}
            <Section icon={Plug} title="Kassakoppeling" subtitle="Hoe heet deze wijn op de kassa?">
                {integrations.length === 0 && (
                    <div className="text-center py-6 text-sm text-white/40 border border-dashed border-white/10 rounded-xl">
                        Nog geen actieve kassakoppelingen.{' '}
                        <button onClick={() => navigate('/account')} className="text-[#C4758A] hover:underline">Toevoegen</button>
                    </div>
                )}

                <div className="space-y-4">
                    {integrations.map(integration => {
                        const items = catalogItemsByIntegration[integration.id] || [];
                        const empty = items.length === 0;
                        return (
                            <div key={integration.id} className="glass-sm rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3 gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{integration.display_name}</p>
                                        <p className="text-[11px] text-white/40">
                                            {empty ? 'Geen artikelen — synchroniseer eerst' : `${items.length} artikelen beschikbaar`}
                                        </p>
                                    </div>
                                    <button onClick={() => onSyncCatalog(integration.id)} disabled={syncingId === integration.id}
                                        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white disabled:opacity-50">
                                        <RefreshCw size={12} className={syncingId === integration.id ? 'animate-spin' : ''} />
                                        Sync
                                    </button>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {['bottle', 'glass'].map(unit => {
                                        const m = findMapping(integration.id, unit);
                                        return (
                                            <Field key={unit} label={UNIT_LABELS[unit]}>
                                                <select className="select-glass" value={m?.external_id || ''}
                                                    disabled={empty}
                                                    onChange={e => onMappingChange(integration.id, unit, e.target.value)}>
                                                    <option value="">— niet gekoppeld —</option>
                                                    {items.map(item => (
                                                        <option key={item.id} value={item.external_id}>
                                                            {item.name}{item.price ? ` (€${item.price.toFixed(2)})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Section>

            {showMutations && (
                <StockMutationsModal
                    wine={wine}
                    onClose={() => setShowMutations(false)}
                    onStockChanged={refresh}
                />
            )}
        </div>
    );
};

export default WineDetail;
