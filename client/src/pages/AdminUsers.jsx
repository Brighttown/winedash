import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Users, ShieldCheck, User, Trash2 } from 'lucide-react';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/admin/users');
            setUsers(data);
        } catch (err) {
            toast.error('Kan gebruikerslijst niet ophalen');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const toggleRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            await api.patch(`/admin/users/${userId}/role`, { role: newRole });
            toast.success(`Rol gewijzigd naar ${newRole}`);
            fetchUsers();
        } catch (err) {
            toast.error('Fout bij wijzigen rol');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-3">
                <div className="bg-amber-100 p-3 rounded-2xl text-amber-700"><Users size={30} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Gebruikersbeheer</h1>
                    <p className="text-slate-500">Bekijk en beheer alle geregistreerde gebruikers.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_auto] px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 bg-slate-50">
                    <span>Gebruiker</span>
                    <span>Gebruikersnaam</span>
                    <span>Rol</span>
                    <span>Acties</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-4 border-[#4A9FD4] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {users.map(u => (
                            <div key={u.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] items-center px-5 py-4 hover:bg-slate-50 transition-colors">
                                <div>
                                    <p className="font-bold text-slate-800">{u.name}</p>
                                    <p className="text-xs text-slate-400">{u.email}</p>
                                </div>
                                <div className="text-sm text-slate-600 font-mono">@{u.username}</div>
                                <div>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {u.role === 'admin' ? <ShieldCheck size={12} /> : <User size={12} />}
                                        {u.role === 'admin' ? 'Admin' : 'Gebruiker'}
                                    </span>
                                </div>
                                <div>
                                    <button
                                        onClick={() => toggleRole(u.id, u.role)}
                                        className="text-sm font-semibold text-[#4A9FD4] hover:text-[#0D2B4E] transition-colors"
                                    >
                                        {u.role === 'admin' ? 'Maak gebruiker' : 'Maak admin'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUsers;
