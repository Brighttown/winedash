import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, FileDown, X, ClipboardList, ChevronRight, SlidersHorizontal } from 'lucide-react';
import StockMutationsModal from '../components/StockMutationsModal';
import { useNavigate } from 'react-router-dom';

const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bubbels', dessert: 'Dessert' };

const FilterSelect = ({ label, value, onChange, options, all = 'Alle' }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="select-glass text-sm font-medium">
            <option value="">{all}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

const Wines = () => {
    const [wines, setWines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mutationsWine, setMutationsWine] = useState(null);
    const [formData, setFormData] = useState({
        name: '', region: '', country: '', vintage: '', grape: '', type: 'red',
        supplier: '', winery: '', purchase_price: 0, sell_price: 0, stock_count: 0, min_stock_alert: 0
    });
    const [editId, setEditId] = useState(null);
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterCountry, setFilterCountry] = useState('');
    const [filterGrape, setFilterGrape] = useState('');
    const [filterWinery, setFilterWinery] = useState('');
    const [filterVintageMin, setFilterVintageMin] = useState('');
    const [filterVintageMax, setFilterVintageMax] = useState('');

    const fetchWines = async () => {
        try {
            const { data } = await api.get('/wines');
            setWines(data);
        } catch (err) {
            toast.error('Kan wijnen niet laden');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchWines(); }, []);

    const countries = useMemo(() => [...new Set(wines.map(w => w.country).filter(Boolean))].sort(), [wines]);
    const grapes    = useMemo(() => { const all = wines.flatMap(w => w.grape ? w.grape.split(',').map(g => g.trim()) : []); return [...new Set(all)].filter(Boolean).sort(); }, [wines]);
    const wineries  = useMemo(() => [...new Set(wines.map(w => w.winery).filter(Boolean))].sort(), [wines]);

    const activeFilterCount = [filterType, filterCountry, filterGrape, filterWinery, filterVintageMin, filterVintageMax].filter(Boolean).length;

    const clearFilters = () => { setSearch(''); setFilterType(''); setFilterCountry(''); setFilterGrape(''); setFilterWinery(''); setFilterVintageMin(''); setFilterVintageMax(''); };

    const filtered = useMemo(() => {
        const lower = search.toLowerCase();
        return wines.filter(w => {
            if (search && !w.name.toLowerCase().includes(lower) && !w.region?.toLowerCase().includes(lower) && !w.country?.toLowerCase().includes(lower) && !w.winery?.toLowerCase().includes(lower)) return false;
            if (filterType && w.type !== filterType) return false;
            if (filterCountry && w.country !== filterCountry) return false;
            if (filterGrape && !(w.grape || '').includes(filterGrape)) return false;
            if (filterWinery && w.winery !== filterWinery) return false;
            if (filterVintageMin && w.vintage < parseInt(filterVintageMin)) return false;
            if (filterVintageMax && w.vintage > parseInt(filterVintageMax)) return false;
            return true;
        });
    }, [wines, search, filterType, filterCountry, filterGrape, filterWinery, filterVintageMin, filterVintageMax]);

    const navigateToCatalog = async (wine) => {
        try {
            const { data } = await api.get(`/catalog?search=${encodeURIComponent(wine.name)}`);
            if (data.length > 0) {
                navigate(`/catalog/${data[0].id}`);
            } else {
                toast('Geen catalogusentry gevonden voor deze wijn', { icon: 'ℹ️' });
            }
        } catch {
            toast.error('Kon cataloguspagina niet openen');
        }
    };

    const handleGeneratePDF = async () => {
        try {
            const toastId = toast.loading('PDF wordt gegenereerd...');
            const response = await api.post('/pdf/winelist', {}, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `wijnkaart-${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            toast.success('PDF succesvol gedownload!', { id: toastId });
        } catch { toast.error('Fout bij maken PDF'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Weet je zeker dat je deze wijn wilt verwijderen?')) return;
        try {
            await api.delete(`/wines/${id}`);
            toast.success('Wijn verwijderd');
            fetchWines();
        } catch { toast.error('Kan wijn niet verwijderen'); }
    };

    const openAddModal = () => {
        setEditId(null);
        setFormData({ name: '', region: '', country: '', vintage: new Date().getFullYear(), grape: '', type: 'red', supplier: '', winery: '', purchase_price: 0, sell_price: 0, stock_count: 0, min_stock_alert: 5 });
        setIsModalOpen(true);
    };

    const openEditModal = (wine, e) => {
        e.stopPropagation();
        setEditId(wine.id);
        setFormData({ ...wine, winery: wine.winery ?? '' });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, vintage: parseInt(formData.vintage), purchase_price: parseFloat(formData.purchase_price), sell_price: parseFloat(formData.sell_price), stock_count: parseInt(formData.stock_count), min_stock_alert: parseInt(formData.min_stock_alert) };
            if (editId) { await api.put(`/wines/${editId}`, payload); toast.success('Wijn bijgewerkt'); }
            else { await api.post('/wines', payload); toast.success('Wijn toegevoegd'); }
            setIsModalOpen(false);
            fetchWines();
        } catch { toast.error('Fout bij opslaan'); }
    };

    const getStockColor = (stock, min) => {
        if (stock <= 0) return 'bg-red-500/25 text-red-300 border border-red-500/30';
        if (stock < min) return 'bg-orange-500/25 text-orange-300 border border-orange-500/30';
        return 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30';
    };

    const labelClass = "block text-sm font-semibold text-white/70 mb-1";

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Voorraadbeheer</h1>
                    <p className="text-white/50">Klik op een wijn om de cataloguspagina te openen.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button onClick={handleGeneratePDF} className="flex-1 sm:flex-none glass border border-white/20 text-white hover:bg-white/10 transition-colors font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2">
                        <FileDown size={18} /> <span className="whitespace-nowrap">Wijnkaart</span>
                    </button>
                    <button onClick={openAddModal} className="flex-1 sm:flex-none bg-[#7B2D3A] hover:bg-[#6A2433] text-white font-semibold py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-white/10 shadow-lg transition-colors">
                        <Plus size={18} /> <span className="whitespace-nowrap">Nieuwe Wijn</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-2xl shadow-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute top-2.5 left-3 text-white/40" size={17} />
                        <input type="text" placeholder="Zoek op naam, regio, land of wijnhuis..." value={search} onChange={e => setSearch(e.target.value)} className="input-glass pl-9" />
                    </div>
                    <div className="flex items-center gap-2 text-white/50 text-sm font-semibold shrink-0">
                        <SlidersHorizontal size={16} />
                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="flex items-center gap-1 bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-500/30 transition-colors">
                                <X size={12} /> {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} wissen
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <FilterSelect label="Type" value={filterType} onChange={setFilterType} options={Object.keys(TYPE_LABELS)} all="Alle types" />
                    <FilterSelect label="Land" value={filterCountry} onChange={setFilterCountry} options={countries} all="Alle landen" />
                    <FilterSelect label="Druif" value={filterGrape} onChange={setFilterGrape} options={grapes} all="Alle druiven" />
                    <FilterSelect label="Wijnhuis" value={filterWinery} onChange={setFilterWinery} options={wineries} all="Alle wijnhuizen" />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-white/40">Jaar vanaf</label>
                        <input type="number" placeholder="bv. 2010" value={filterVintageMin} onChange={e => setFilterVintageMin(e.target.value)} className="input-glass py-2 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-white/40">Jaar t/m</label>
                        <input type="number" placeholder="bv. 2023" value={filterVintageMax} onChange={e => setFilterVintageMax(e.target.value)} className="input-glass py-2 text-sm" />
                    </div>
                </div>
                <p className="text-xs text-white/30">{filtered.length} van de {wines.length} wijnen zichtbaar</p>
            </div>

            {/* Tabel */}
            <div className="glass rounded-2xl shadow-xl overflow-hidden">
                {loading ? (
                    <div className="text-center p-12"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" /></div>
                ) : (
                    <>
                        {/* Desktop tabel */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 text-white/30 text-xs uppercase tracking-wider font-semibold border-b border-white/10">
                                        <th className="p-4">Naam / Regio</th>
                                        <th className="p-4">Wijnhuis</th>
                                        <th className="p-4">Type</th>
                                        <th className="p-4">Voorraad</th>
                                        <th className="p-4">Inkoop</th>
                                        <th className="p-4">Verkoop</th>
                                        <th className="p-4 text-right">Acties</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10 text-sm">
                                    {filtered.map(wine => (
                                        <tr key={wine.id} onClick={() => navigateToCatalog(wine)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                                            <td className="p-4">
                                                <div className="font-bold text-white group-hover:text-[#C4758A] transition-colors">{wine.name} {wine.vintage && <span className="text-white/30 font-normal">({wine.vintage})</span>}</div>
                                                <div className="text-white/40 text-xs mt-0.5">{wine.region}, {wine.country}</div>
                                            </td>
                                            <td className="p-4 text-white/60 text-sm">{wine.winery || <span className="text-white/20">—</span>}</td>
                                            <td className="p-4">
                                                <span className="capitalize px-2.5 py-1 bg-white/10 text-white/60 rounded-md font-medium text-xs border border-white/10">{TYPE_LABELS[wine.type] || wine.type}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${getStockColor(wine.stock_count, wine.min_stock_alert)}`}>
                                                    {wine.stock_count} fles{wine.stock_count !== 1 && 'sen'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-white/60 font-medium">€{wine.purchase_price?.toFixed(2)}</td>
                                            <td className="p-4 font-bold text-white">€{wine.sell_price?.toFixed(2)}</td>
                                            <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                                <button onClick={e => { e.stopPropagation(); setMutationsWine(wine); }} title="Mutaties" className="p-2 text-white/30 hover:text-[#C4758A] transition-colors"><ClipboardList size={16} /></button>
                                                <button onClick={e => openEditModal(wine, e)} title="Bewerken" className="p-2 text-white/30 hover:text-white transition-colors ml-1"><Edit2 size={16} /></button>
                                                <button onClick={e => { e.stopPropagation(); handleDelete(wine.id); }} title="Verwijderen" className="p-2 text-white/30 hover:text-red-400 transition-colors ml-1"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && <tr><td colSpan="7" className="p-8 text-center text-white/30 italic">Geen wijnen gevonden</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobiele kaartjes */}
                        <div className="md:hidden divide-y divide-white/10">
                            {filtered.length === 0 && <p className="p-8 text-center text-white/30 italic">Geen wijnen gevonden</p>}
                            {filtered.map(wine => (
                                <div key={wine.id} onClick={() => navigateToCatalog(wine)} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 cursor-pointer transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm leading-tight truncate">
                                            {wine.name} {wine.vintage && <span className="text-white/40 font-normal">({wine.vintage})</span>}
                                        </p>
                                        {wine.winery && <p className="text-xs text-white/40 truncate">{wine.winery}</p>}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="capitalize text-[10px] px-1.5 py-0.5 bg-white/10 text-white/50 rounded border border-white/10">{TYPE_LABELS[wine.type] || wine.type}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getStockColor(wine.stock_count, wine.min_stock_alert)}`}>{wine.stock_count} fl.</span>
                                            <span className="text-[10px] text-white/40">€{wine.purchase_price?.toFixed(2)} · €{wine.sell_price?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                        <button onClick={e => { e.stopPropagation(); setMutationsWine(wine); }} className="p-2 text-white/30 hover:text-[#C4758A] transition-colors"><ClipboardList size={16} /></button>
                                        <button onClick={e => openEditModal(wine, e)} className="p-2 text-white/30 hover:text-white transition-colors"><Edit2 size={16} /></button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(wine.id); }} className="p-2 text-white/30 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {mutationsWine && <StockMutationsModal wine={mutationsWine} onClose={() => setMutationsWine(null)} onStockChanged={fetchWines} />}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="glass rounded-2xl shadow-2xl w-full max-w-2xl border border-white/15 flex flex-col" style={{ maxHeight: '90dvh' }}>
                        <div className="border-b border-white/10 p-5 flex justify-between items-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                            <h2 className="text-xl font-bold text-white">{editId ? 'Wijn Bewerken' : 'Nieuwe Wijn Toevoegen'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white bg-white/10 p-2 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { label: 'Naam', key: 'name', type: 'text', required: true },
                                    { label: 'Regio', key: 'region', type: 'text', required: true },
                                    { label: 'Land', key: 'country', type: 'text', required: true },
                                    { label: 'Jaargang', key: 'vintage', type: 'number' },
                                    { label: 'Druivensoort', key: 'grape', type: 'text' },
                                    { label: 'Leverancier', key: 'supplier', type: 'text' },
                                    { label: 'Wijnhuis', key: 'winery', type: 'text' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className={labelClass}>{f.label}</label>
                                        <input required={f.required} type={f.type} value={formData[f.key] ?? ''} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} className="input-glass" />
                                    </div>
                                ))}
                                <div>
                                    <label className={labelClass}>Type</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="select-glass">
                                        <option value="red">Rood</option><option value="white">Wit</option>
                                        <option value="rose">Rosé</option><option value="sparkling">Bubbels</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-4 glass-sm rounded-xl">
                                {[
                                    { label: 'Inkoop (€)', key: 'purchase_price', step: '0.01' },
                                    { label: 'Verkoop (€)', key: 'sell_price', step: '0.01' },
                                    { label: 'Voorraad', key: 'stock_count' },
                                    { label: 'Min. alert', key: 'min_stock_alert' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className={labelClass}>{f.label}</label>
                                        <input required type="number" step={f.step} value={formData[f.key]} onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} className="input-glass" />
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-white/20 text-white/60 font-semibold hover:bg-white/10 transition-colors">Annuleren</button>
                                <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#7B2D3A] text-white font-semibold hover:bg-[#6A2433] transition-colors shadow-lg border border-white/10">{editId ? 'Opslaan' : 'Toevoegen'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wines;
