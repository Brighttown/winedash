import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    ArrowLeft, BookOpen, Package, Tag, Truck, Plug, RefreshCw,
    Save, Loader2, ClipboardList, TrendingUp, TrendingDown, BarChart3,
} from 'lucide-react';
import api from '../api/axios';
import StockMutationsModal from '../components/StockMutationsModal';

const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bubbels', dessert: 'Dessert' };
const UNIT_LABELS = { bottle: 'Fles', glass: 'Glas', half_bottle: 'Halve fles' };
const PERIOD_OPTIONS = [
    { days: 7,   label: '7 dagen' },
    { days: 30,  label: '30 dagen' },
    { days: 90,  label: '90 dagen' },
    { days: 365, label: '1 jaar' },
];

const fmtEur = (n) => `€${(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

const StatsSection = ({ wineId }) => {
    const [period, setPeriod] = useState(30);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get(`/wines/${wineId}/stats`, { params: { days: period } })
            .then(r => { if (!cancelled) setStats(r.data); })
            .catch(() => { if (!cancelled) setStats(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [wineId, period]);

    const maxBar = useMemo(() => {
        if (!stats) return 1;
        return Math.max(1, ...stats.series.map(s => s.units));
    }, [stats]);

    return (
        <div className="glass rounded-2xl p-6 mb-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#7B2D3A]/40 border border-[#C4758A]/30 flex items-center justify-center shrink-0">
                        <BarChart3 size={18} className="text-[#C4758A]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>Verkoopstatistieken</h2>
                        <p className="text-xs text-white/50">Hoe presteert deze wijn?</p>
                    </div>
                </div>
                <div className="flex gap-1 glass-sm rounded-xl p-1">
                    {PERIOD_OPTIONS.map(opt => (
                        <button key={opt.days} onClick={() => setPeriod(opt.days)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                period === opt.days ? 'bg-[#7B2D3A] text-white' : 'text-white/60 hover:text-white'
                            }`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="h-32 flex items-center justify-center text-white/50">
                    <Loader2 className="animate-spin" size={18} />
                </div>
            ) : !stats ? (
                <p className="text-center text-sm text-white/40 py-6">Geen statistieken beschikbaar.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        <Kpi label="Verkocht" value={`${stats.units_sold}×`}
                            delta={stats.prev_units_sold > 0 ? stats.delta_pct : null} />
                        <Kpi label="Omzet" value={fmtEur(stats.revenue)} />
                        <Kpi label="Winst" value={fmtEur(stats.profit)}
                            sub={stats.revenue > 0 ? `marge ${Math.round((stats.profit / stats.revenue) * 100)}%` : null} />
                        <Kpi label="Gemiddeld/dag" value={stats.avg_per_day.toFixed(1)}
                            sub={stats.days_until_empty != null ? `nog ~${stats.days_until_empty} dagen voorraad` : 'voldoende voorraad'} />
                    </div>

                    {/* Bar chart */}
                    <div className="glass-sm rounded-xl p-4">
                        <div className="flex items-end gap-[2px] h-24">
                            {stats.series.map((d, i) => {
                                const h = (d.units / maxBar) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col justify-end group relative" title={`${fmtDate(d.date)}: ${d.units}`}>
                                        <div
                                            className={`rounded-sm transition-colors ${d.units > 0 ? 'bg-[#C4758A] group-hover:bg-[#d68aa0]' : 'bg-white/5'}`}
                                            style={{ height: `${Math.max(h, 2)}%` }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between text-[10px] text-white/40 mt-2">
                            <span>{fmtDate(stats.series[0]?.date)}</span>
                            {stats.best_day && <span className="text-[#C4758A]">Beste dag: {fmtDate(stats.best_day.date)} ({stats.best_day.units}×)</span>}
                            <span>{fmtDate(stats.series[stats.series.length - 1]?.date)}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const Kpi = ({ label, value, sub, delta }) => (
    <div className="glass-sm rounded-xl p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-xl font-black text-white mt-0.5">{value}</p>
        {delta != null && (
            <p className={`text-[11px] mt-1 flex items-center gap-1 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {fmtPct(delta)} t.o.v. vorige periode
            </p>
        )}
        {sub && delta == null && <p className="text-[11px] text-white/40 mt-1">{sub}</p>}
    </div>
);

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

            {/* Verkoopstatistieken */}
            <StatsSection wineId={id} />

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
