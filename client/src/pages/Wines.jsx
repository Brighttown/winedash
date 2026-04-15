import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, FileDown, X } from 'lucide-react';

const Wines = () => {
    const [wines, setWines] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '', region: '', country: '', vintage: '', grape: '', type: 'red',
        supplier: '', purchase_price: 0, sell_price: 0, stock_count: 0, min_stock_alert: 0
    });
    const [editId, setEditId] = useState(null);

    const fetchWines = async () => {
        try {
            const { data } = await api.get('/wines');
            setWines(data);
            setFiltered(data);
        } catch (err) {
            toast.error('Kan wijnen niet laden');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWines();
    }, []);

    useEffect(() => {
        const lower = search.toLowerCase();
        setFiltered(wines.filter(w =>
            w.name.toLowerCase().includes(lower) ||
            w.region.toLowerCase().includes(lower) ||
            w.type.toLowerCase().includes(lower) ||
            w.country.toLowerCase().includes(lower)
        ));
    }, [search, wines]);

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
        } catch (err) {
            toast.error('Fout bij maken PDF');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Weet je zeker dat je deze wijn wilt verwijderen?')) return;
        try {
            await api.delete(`/wines/${id}`);
            toast.success('Wijn verwijderd');
            fetchWines();
        } catch (err) {
            toast.error('Kan wijn niet verwijderen');
        }
    };

    const openAddModal = () => {
        setEditId(null);
        setFormData({ name: '', region: '', country: '', vintage: new Date().getFullYear(), grape: '', type: 'red', supplier: '', purchase_price: 0, sell_price: 0, stock_count: 0, min_stock_alert: 5 });
        setIsModalOpen(true);
    };

    const openEditModal = (wine) => {
        setEditId(wine.id);
        setFormData({ ...wine });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                vintage: parseInt(formData.vintage),
                purchase_price: parseFloat(formData.purchase_price),
                sell_price: parseFloat(formData.sell_price),
                stock_count: parseInt(formData.stock_count),
                min_stock_alert: parseInt(formData.min_stock_alert)
            };

            if (editId) {
                await api.put(`/wines/${editId}`, payload);
                toast.success('Wijn bijgewerkt');
            } else {
                await api.post('/wines', payload);
                toast.success('Wijn toegevoegd');
            }
            setIsModalOpen(false);
            fetchWines();
        } catch (err) {
            toast.error('Fout bij opslaan');
        }
    };

    const getStockColor = (stock, min) => {
        if (stock <= 0) return 'bg-red-100 text-red-800';
        if (stock < min) return 'bg-orange-100 text-orange-800';
        return 'bg-emerald-100 text-emerald-800';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Voorraadbeheer</h1>
                    <p className="text-slate-500">Beheer al je wijnen op één plek.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button onClick={handleGeneratePDF} className="bg-white border border-[#4A9FD4] text-[#4A9FD4] hover:bg-[#4A9FD4] hover:text-white transition-colors font-semibold py-2 px-4 rounded-lg flex items-center shadow-sm">
                        <FileDown size={18} className="mr-2" /> Wijnkaart PDF
                    </button>
                    <button onClick={openAddModal} className="bg-[#0D2B4E] hover:bg-[#1A4A7A] text-white font-semibold py-2 px-4 rounded-lg flex items-center shadow-md transition-colors">
                        <Plus size={18} className="mr-2" /> Nieuwe Wijn
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center bg-slate-50/50">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute top-2.5 left-3 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Zoek op naam, regio, type..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4A9FD4]/50 focus:border-[#4A9FD4] transition-all bg-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="text-center p-12"><div className="w-8 h-8 border-4 border-[#4A9FD4] border-t-transparent rounded-full animate-spin mx-auto" /></div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                                    <th className="p-4">Naam / Regio</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Voorraad</th>
                                    <th className="p-4">Inkoopprijs</th>
                                    <th className="p-4">Verkoopprijs</th>
                                    <th className="p-4 text-right">Acties</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filtered.map(wine => (
                                    <tr key={wine.id} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{wine.name} {wine.vintage && <span className="text-slate-400 font-normal">({wine.vintage})</span>}</div>
                                            <div className="text-slate-500 text-xs mt-0.5">{wine.region}, {wine.country}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="capitalize px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md font-medium text-xs">{wine.type}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md font-bold text-xs ${getStockColor(wine.stock_count, wine.min_stock_alert)}`}>
                                                {wine.stock_count} fles{wine.stock_count !== 1 && 'sen'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium">€{wine.purchase_price?.toFixed(2)}</td>
                                        <td className="p-4 font-bold text-[#0D2B4E]">€{wine.sell_price?.toFixed(2)}</td>
                                        <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal(wine)} className="p-2 text-slate-400 hover:text-[#4A9FD4] transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDelete(wine.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors ml-1"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">Geen wijnen gevonden</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{editId ? 'Wijn Bewerken' : 'Nieuwe Wijn Toevoegen'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Naam</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none bg-white">
                                        <option value="red">Rood</option>
                                        <option value="white">Wit</option>
                                        <option value="rose">Rosé</option>
                                        <option value="sparkling">Bubbels</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Regio</label>
                                    <input required type="text" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Land</label>
                                    <input required type="text" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Jaargang</label>
                                    <input type="number" value={formData.vintage} onChange={e => setFormData({ ...formData, vintage: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Druivensoort</label>
                                    <input type="text" value={formData.grape} onChange={e => setFormData({ ...formData, grape: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Leverancier</label>
                                    <input type="text" value={formData.supplier} onChange={e => setFormData({ ...formData, supplier: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Inkoop (€)</label>
                                    <input required type="number" step="0.01" value={formData.purchase_price} onChange={e => setFormData({ ...formData, purchase_price: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Verkoop (€)</label>
                                    <input required type="number" step="0.01" value={formData.sell_price} onChange={e => setFormData({ ...formData, sell_price: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Voorraad</label>
                                    <input required type="number" value={formData.stock_count} onChange={e => setFormData({ ...formData, stock_count: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Alertering min.</label>
                                    <input required type="number" value={formData.min_stock_alert} onChange={e => setFormData({ ...formData, min_stock_alert: e.target.value })} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4A9FD4] outline-none" />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">Annuleren</button>
                                <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0D2B4E] text-white font-semibold hover:bg-[#1A4A7A] transition-colors shadow-md">{editId ? 'Opslaan' : 'Toevoegen'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wines;
