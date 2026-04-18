import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { ShieldCheck, Check, Edit3 } from 'lucide-react';

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
                <div className="bg-white/10 p-3 rounded-2xl text-white"><ShieldCheck size={30} /></div>
                <div>
                    <h1 className="text-3xl font-bold text-white">Catalogus Goedkeuring</h1>
                    <p className="text-white/50">Wijnen die door gebruikers zijn toegevoegd en nog geverifieerd moeten worden.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            ) : pending.length === 0 ? (
                <div className="glass rounded-3xl p-12 text-center text-white/40 shadow-xl">
                    Geen wijnen in de wachtlijst. Alles is geverifieerd!
                </div>
            ) : (
                <div className="grid gap-4">
                    {pending.map(wine => (
                        <div key={wine.id} className="glass rounded-2xl p-5 shadow-xl flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-white text-lg">{wine.name}</h3>
                                <p className="text-sm text-white/50">{wine.region}, {wine.country} ({wine.vintage || 'NV'})</p>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-xs bg-white/10 text-white/60 border border-white/10 px-2 py-0.5 rounded-lg">{wine.type}</span>
                                    {wine.grape && <span className="text-xs bg-white/10 text-white/60 border border-white/10 px-2 py-0.5 rounded-lg">{wine.grape}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleVerify(wine.id)}
                                    className="p-3 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-xl transition-colors border border-emerald-500/30"
                                    title="Goedkeuren"
                                >
                                    <Check size={20} />
                                </button>
                                <button
                                    className="p-3 bg-white/10 text-white/50 hover:bg-white/20 rounded-xl transition-colors border border-white/10"
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
