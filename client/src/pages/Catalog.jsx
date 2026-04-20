import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Search, Database, PackagePlus, ChevronRight, X, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AddToStockModal from '../components/AddToStockModal';

const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bruisend', dessert: 'Dessert' };
const TYPE_COLORS = {
    red:      'bg-red-500/25 text-red-200 border border-red-500/30',
    white:    'bg-amber-500/25 text-amber-200 border border-amber-500/30',
    rose:     'bg-pink-500/25 text-pink-200 border border-pink-500/30',
    sparkling:'bg-emerald-500/25 text-emerald-200 border border-emerald-500/30',
    dessert:  'bg-purple-500/25 text-purple-200 border border-purple-500/30',
};

const FilterSelect = ({ label, value, onChange, options, all = 'Alle' }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="select-glass text-sm font-medium">
            <option value="">{all}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

const Catalog = () => {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addModalWine, setAddModalWine] = useState(null);
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterCountry, setFilterCountry] = useState('');
    const [filterGrape, setFilterGrape] = useState('');
    const [filterVintageMin, setFilterVintageMin] = useState('');
    const [filterVintageMax, setFilterVintageMax] = useState('');

    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const { data } = await api.get('/catalog');
                setCatalog(data);
            } catch (err) {
                toast.error('Kan Wijn Database niet openen');
            } finally {
                setLoading(false);
            }
        };
        fetchCatalog();
    }, []);

    const countries  = useMemo(() => [...new Set(catalog.map(w => w.country).filter(Boolean))].sort(), [catalog]);
    const grapes     = useMemo(() => { const all = catalog.flatMap(w => w.grape ? w.grape.split(',').map(g => g.trim()) : []); return [...new Set(all)].filter(Boolean).sort(); }, [catalog]);
    const activeFilterCount = [filterType, filterCountry, filterGrape, filterVintageMin, filterVintageMax].filter(Boolean).length;

    const clearFilters = () => { setSearch(''); setFilterType(''); setFilterCountry(''); setFilterGrape(''); setFilterVintageMin(''); setFilterVintageMax(''); };

    const filtered = useMemo(() => {
        const lower = search.toLowerCase();
        return catalog.filter(w => {
            if (search && !w.name.toLowerCase().includes(lower) && !w.region?.toLowerCase().includes(lower) && !w.country?.toLowerCase().includes(lower)) return false;
            if (filterType && w.type !== filterType) return false;
            if (filterCountry && w.country !== filterCountry) return false;
            if (filterGrape && !(w.grape || '').includes(filterGrape)) return false;
            if (filterVintageMin && w.vintage < parseInt(filterVintageMin)) return false;
            if (filterVintageMax && w.vintage > parseInt(filterVintageMax)) return false;
            return true;
        });
    }, [catalog, search, filterType, filterCountry, filterGrape, filterVintageMin, filterVintageMax]);

    return (
        <div className="max-w-7xl mx-auto space-y-5">
            <div className="flex items-center space-x-3">
                <div className="bg-white/10 p-3 rounded-2xl text-white"><Database size={30} /></div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Wijn Database</h1>
                    <p className="text-white/50">Ontdek wijnen en voeg ze direct toe aan je eigen voorraad.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-2xl shadow-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute top-2.5 left-3 text-white/40" size={17} />
                        <input
                            type="text"
                            placeholder="Zoek op naam, regio of land..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input-glass pl-9"
                        />
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

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <FilterSelect label="Type" value={filterType} onChange={setFilterType} options={Object.keys(TYPE_LABELS)} all="Alle types" />
                    <FilterSelect label="Land" value={filterCountry} onChange={setFilterCountry} options={countries} all="Alle landen" />
                    <FilterSelect label="Druif" value={filterGrape} onChange={setFilterGrape} options={grapes} all="Alle druiven" />
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-white/40">Jaar vanaf</label>
                        <input type="number" placeholder="bv. 2010" value={filterVintageMin} onChange={e => setFilterVintageMin(e.target.value)} className="input-glass py-2 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-white/40">Jaar t/m</label>
                        <input type="number" placeholder="bv. 2023" value={filterVintageMax} onChange={e => setFilterVintageMax(e.target.value)} className="input-glass py-2 text-sm" />
                    </div>
                </div>
                <p className="text-xs text-white/30">{filtered.length} van de {catalog.length} wijnen zichtbaar</p>
            </div>

            {/* List */}
            <div className="glass rounded-2xl shadow-xl overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white/30 border-b border-white/10 bg-white/5">
                    <span>Naam</span><span>Type</span><span>Land / Regio</span><span>Druif</span><span>Oogstjaar</span><span></span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-white/30 font-medium">Geen wijnen gevonden met deze filters.</div>
                ) : (
                    <div className="divide-y divide-white/10">
                        {filtered.map(wine => (
                            <div
                                key={wine.id}
                                onClick={() => navigate(`/catalog/${wine.id}`)}
                                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center px-5 py-4 hover:bg-white/5 cursor-pointer transition-colors group"
                            >
                                <div>
                                    <p className="font-bold text-white group-hover:text-[#C4758A] transition-colors leading-tight">{wine.name}</p>
                                    {wine.winery && <p className="text-xs text-white/30 mt-0.5">{wine.winery}</p>}
                                </div>
                                <div>
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg capitalize ${TYPE_COLORS[wine.type] || 'bg-white/10 text-white/60'}`}>
                                        {TYPE_LABELS[wine.type] || wine.type}
                                    </span>
                                </div>
                                <div className="text-sm text-white/60">
                                    <span>{wine.country}</span>
                                    {wine.region && wine.region !== 'Unknown' && <span className="text-white/30"> / {wine.region}</span>}
                                </div>
                                <div className="text-sm text-white/50 truncate max-w-[160px]">
                                    {wine.grape || <span className="text-white/20">—</span>}
                                </div>
                                <div className="text-sm font-semibold text-white/70">
                                    {wine.vintage || <span className="text-white/20">—</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={e => { e.stopPropagation(); setAddModalWine(wine); }}
                                        className="flex items-center gap-1.5 bg-[#7B2D3A] text-white hover:bg-[#6A2433] text-xs font-bold py-2 px-3 rounded-xl transition-colors whitespace-nowrap border border-white/10"
                                    >
                                        <PackagePlus size={14} /> Toevoegen
                                    </button>
                                    <ChevronRight size={16} className="text-white/20 group-hover:text-[#C4758A] transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AddToStockModal
                wine={addModalWine}
                isOpen={!!addModalWine}
                onClose={() => setAddModalWine(null)}
                onSuccess={() => {
                    toast.success(`${addModalWine?.name} toegevoegd aan je voorraad!`);
                    setAddModalWine(null);
                    navigate('/wines');
                }}
            />
        </div>
    );
};

export default Catalog;
