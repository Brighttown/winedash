import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { X, Plus, Edit2, RotateCcw, Download, ChevronUp, ChevronDown } from 'lucide-react';

const TYPE_LABELS = {
    purchase: { label: 'Inkoop', color: 'bg-emerald-100 text-emerald-800' },
    sale: { label: 'Verkoop', color: 'bg-blue-100 text-blue-800' },
    adjustment: { label: 'Aanpassing', color: 'bg-orange-100 text-orange-800' },
};

const emptyForm = { type: 'purchase', quantity: '', note: '' };

const StockMutationsModal = ({ wine, onClose, onStockChanged }) => {
    const [movements, setMovements] = useState([]);
    const [currentStock, setCurrentStock] = useState(wine.stock_count);
    const [loading, setLoading] = useState(true);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);

    const fetchMovements = useCallback(async () => {
        try {
            const { data } = await api.get(`/wines/${wine.id}/movements`);
            setMovements(data.movements);
            setCurrentStock(data.wine.stock_count);
        } catch {
            toast.error('Kan mutaties niet laden');
        } finally {
            setLoading(false);
        }
    }, [wine.id]);

    useEffect(() => {
        fetchMovements();
    }, [fetchMovements]);

    const openAddForm = () => {
        setEditId(null);
        setFormData(emptyForm);
        setShowForm(true);
    };

    const openEditForm = (movement) => {
        setEditId(movement.id);
        setFormData({
            type: movement.type,
            quantity: Math.abs(movement.quantity),
            note: movement.note || '',
        });
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditId(null);
        setFormData(emptyForm);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const qty = parseInt(formData.quantity, 10);
        if (!qty || qty <= 0) {
            toast.error('Voer een geldig aantal in (groter dan 0)');
            return;
        }
        setSaving(true);
        try {
            if (editId) {
                await api.put(`/wines/${wine.id}/movements/${editId}`, {
                    type: formData.type,
                    quantity: qty,
                    note: formData.note || undefined,
                });
                toast.success('Mutatie bijgewerkt');
            } else {
                await api.post(`/wines/${wine.id}/movements`, {
                    type: formData.type,
                    quantity: qty,
                    note: formData.note || undefined,
                });
                toast.success('Mutatie toegevoegd');
            }
            cancelForm();
            await fetchMovements();
            onStockChanged();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Fout bij opslaan');
        } finally {
            setSaving(false);
        }
    };

    const handleRevert = async (movement) => {
        const label = TYPE_LABELS[movement.type]?.label ?? movement.type;
        if (!window.confirm(`Wil je de mutatie "${label} ${Math.abs(movement.quantity)} fles(sen)" terugdraaien? De voorraad wordt hersteld.`)) return;
        try {
            await api.delete(`/wines/${wine.id}/movements/${movement.id}`);
            toast.success('Mutatie teruggedraaid');
            await fetchMovements();
            onStockChanged();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Fout bij terugdraaien');
        }
    };

    const handleExportCSV = () => {
        if (movements.length === 0) {
            toast.error('Geen mutaties om te exporteren');
            return;
        }
        const header = ['Datum', 'Type', 'Aantal', 'Notitie'];
        const rows = movements.map(m => [
            new Date(m.created_at).toLocaleString('nl-NL'),
            TYPE_LABELS[m.type]?.label ?? m.type,
            m.quantity > 0 ? `+${m.quantity}` : m.quantity,
            m.note ?? '',
        ]);
        const csv = [header, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
            .join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mutaties-${wine.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('CSV gedownload');
    };

    const formattedDate = (iso) =>
        new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-start rounded-t-2xl z-10">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Voorraadmutaties</h2>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {wine.name} {wine.vintage ? `(${wine.vintage})` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full ml-4 shrink-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Stock summary */}
                <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-lg font-bold text-sm ${currentStock <= 0 ? 'bg-red-100 text-red-800' : currentStock < wine.min_stock_alert ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {currentStock} fles{currentStock !== 1 ? 'sen' : ''} in voorraad
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#4A9FD4] border border-[#4A9FD4] rounded-lg hover:bg-[#4A9FD4] hover:text-white transition-colors"
                        >
                            <Download size={15} /> Exporteer CSV
                        </button>
                        <button
                            onClick={showForm ? cancelForm : openAddForm}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-[#0D2B4E] text-white rounded-lg hover:bg-[#1A4A7A] transition-colors"
                        >
                            {showForm ? <><X size={15} /> Annuleren</> : <><Plus size={15} /> Nieuwe mutatie</>}
                        </button>
                    </div>
                </div>

                {/* Add / Edit form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="mx-6 mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <h3 className="font-bold text-slate-700 text-sm">{editId ? 'Mutatie bewerken' : 'Nieuwe mutatie'}</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A9FD4] outline-none bg-white"
                                >
                                    <option value="purchase">Inkoop (+)</option>
                                    <option value="sale">Verkoop (−)</option>
                                    <option value="adjustment">Aanpassing (±)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Aantal flessen
                                    {formData.type === 'adjustment' && <span className="text-slate-400 font-normal"> (negatief = min)</span>}
                                </label>
                                <input
                                    type="number"
                                    min={formData.type === 'adjustment' ? undefined : 1}
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                    placeholder={formData.type === 'adjustment' ? 'bijv. -3 of +5' : 'bijv. 12'}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Notitie (optioneel)</label>
                            <input
                                type="text"
                                maxLength={500}
                                value={formData.note}
                                onChange={e => setFormData({ ...formData, note: e.target.value })}
                                placeholder="bijv. Levering leverancier X"
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={cancelForm} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors">
                                Annuleren
                            </button>
                            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-[#0D2B4E] text-white font-semibold hover:bg-[#1A4A7A] transition-colors disabled:opacity-60">
                                {saving ? 'Opslaan...' : editId ? 'Bijwerken' : 'Toevoegen'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Mutations list */}
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {loading ? (
                        <div className="text-center py-10">
                            <div className="w-7 h-7 border-4 border-[#4A9FD4] border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 italic">Nog geen mutaties geregistreerd</div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                                    <th className="pb-2 pr-3">Datum</th>
                                    <th className="pb-2 pr-3">Type</th>
                                    <th className="pb-2 pr-3">Aantal</th>
                                    <th className="pb-2 pr-3">Notitie</th>
                                    <th className="pb-2 text-right">Acties</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {movements.map(m => {
                                    const typeMeta = TYPE_LABELS[m.type] ?? { label: m.type, color: 'bg-slate-100 text-slate-700' };
                                    const isPositive = m.quantity > 0;
                                    return (
                                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors group">
                                            <td className="py-3 pr-3 text-slate-500 whitespace-nowrap text-xs">{formattedDate(m.created_at)}</td>
                                            <td className="py-3 pr-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${typeMeta.color}`}>
                                                    {typeMeta.label}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 font-bold whitespace-nowrap">
                                                <span className={`flex items-center gap-0.5 ${isPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                                                    {isPositive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    {Math.abs(m.quantity)} fles{Math.abs(m.quantity) !== 1 ? 'sen' : ''}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 text-slate-500 max-w-[160px] truncate">{m.note || <span className="italic text-slate-300">—</span>}</td>
                                            <td className="py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditForm(m)}
                                                    title="Bewerken"
                                                    className="p-1.5 text-slate-400 hover:text-[#4A9FD4] transition-colors rounded"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleRevert(m)}
                                                    title="Terugdraaien"
                                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded ml-1"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockMutationsModal;
