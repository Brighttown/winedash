import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { ShieldCheck, Check, Edit3, Trash2, Clock } from 'lucide-react';

const AdminApproval = () => {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        try {
            const { data } = await api.get('/catalog/admin/unverified');
            setPending(data);
        } catch (err) {
            toast.error('Kan wachtlijst niet ophalen');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPending(); }, []);

    const handleVerify = async (id) => {
        try {
            await api.patch(`/catalog/admin/verify/${id}`);
            toast.success('Wijn geverifieerd!');
            fetchPending();
        } catch (err) {
            toast.error('Fout bij verifiëren');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-3 rounded-2xl text-blue-700"><ShieldCheck size={30} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Catalogus Goedkeuring</h1>
                    <p className="text-slate-500">Wijnen die door gebruikers zijn toegevoegd en nog geverifieerd moeten worden.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : pending.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
                    Geen wijnen in de wachtlijst. Alles is geverifieerd!
                </div>
            ) : (
                <div className="grid gap-4">
                    {pending.map(wine => (
                        <div key={wine.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">{wine.name}</h3>
                                <p className="text-sm text-slate-500">{wine.region}, {wine.country} ({wine.vintage || 'NV'})</p>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{wine.type}</span>
                                    {wine.grape && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{wine.grape}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleVerify(wine.id)}
                                    className="p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors shadow-sm border border-emerald-100"
                                    title="Goedkeuren"
                                >
                                    <Check size={20} />
                                </button>
                                <button
                                    className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                                    title="Bewerken"
                                >
                                    <Edit3 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminApproval;
