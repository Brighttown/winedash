import React, { useState, useEffect } from 'react';
import { X, PackagePlus } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';

const AddToStockModal = ({ wine, isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        vintage: '',
        supplier: 'Geïmporteerd uit Database',
        purchase_price: 0,
        sell_price: 0,
        stock_count: 0,
        min_stock_alert: 5
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (wine) {
            setFormData({
                vintage: wine.vintage || new Date().getFullYear(),
                supplier: 'Geïmporteerd uit Database',
                purchase_price: 0,
                sell_price: 0,
                stock_count: 0,
                min_stock_alert: 5
            });
        }
    }, [wine]);

    if (!isOpen || !wine) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/wines', {
                name: wine.name,
                region: wine.region,
                country: wine.country,
                vintage: parseInt(formData.vintage, 10),
                grape: wine.grape || '',
                type: wine.type,
                supplier: formData.supplier,
                purchase_price: parseFloat(formData.purchase_price),
                sell_price: parseFloat(formData.sell_price),
                stock_count: parseInt(formData.stock_count, 10),
                min_stock_alert: parseInt(formData.min_stock_alert, 10)
            });
            onSuccess();
        } catch (err) {
            toast.error('Kan deze wijn niet toevoegen aan je voorraad.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-[#0D2B4E] text-white">
                    <h2 className="text-xl font-bold">Voorraad toevoegen</h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{wine.name}</h3>
                    <p className="text-sm text-slate-500">{wine.region}, {wine.country}</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Aantal op voorraad *</label>
                            <input
                                type="number"
                                required min="0"
                                value={formData.stock_count}
                                onChange={e => setFormData({ ...formData, stock_count: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Minimum Alert</label>
                            <input
                                type="number"
                                required min="0"
                                value={formData.min_stock_alert}
                                onChange={e => setFormData({ ...formData, min_stock_alert: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Inkoopprijs (€) *</label>
                            <input
                                type="number"
                                step="0.01" required min="0"
                                value={formData.purchase_price}
                                onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Verkoopprijs (€) *</label>
                            <input
                                type="number"
                                step="0.01" required min="0"
                                value={formData.sell_price}
                                onChange={e => setFormData({ ...formData, sell_price: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Leverancier</label>
                            <input
                                type="text"
                                value={formData.supplier}
                                onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Oogstjaar</label>
                            <input
                                type="number"
                                value={formData.vintage}
                                onChange={e => setFormData({ ...formData, vintage: e.target.value })}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors">
                            Annuleren
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center space-x-2 bg-[#0D2B4E] hover:bg-[#1A4A7A] text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PackagePlus size={18} />}
                            <span>Opslaan in voorraad</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddToStockModal;
