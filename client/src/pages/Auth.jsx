import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Wine, Lock, AtSign, User, Building, Mail } from 'lucide-react';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({ username: '', email: '', password: '', name: '', companyName: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const endpoint = isLogin ? '/auth/login' : '/auth/register';
            const { data } = await api.post(endpoint, formData);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success(isLogin ? 'Welkom terug!' : 'Account succesvol aangemaakt!');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Er is een fout opgetreden');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const inputClass = "w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#4A9FD4] focus:border-transparent outline-none transition-all placeholder-slate-400";

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D2B4E] via-[#1A4A7A] to-[#4A9FD4] p-4 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#4A9FD4]/20 rounded-full blur-3xl" />

            <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 relative z-10 border border-white/20">
                <div className="text-center mb-8">
                    <div className="bg-[#0D2B4E] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform -rotate-6">
                        <Wine className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">WineDash</h1>
                    <p className="text-slate-500 mt-2">{isLogin ? 'Log in op je account' : 'Maak een nieuw account aan'}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Username – always visible */}
                    <div className="relative">
                        <AtSign className="absolute top-3 left-3 text-slate-400" size={20} />
                        <input required type="text" name="username" placeholder="Gebruikersnaam" value={formData.username} onChange={handleChange} className={inputClass} autoComplete="username" />
                    </div>

                    {/* Register-only fields */}
                    {!isLogin && (
                        <>
                            <div className="relative">
                                <User className="absolute top-3 left-3 text-slate-400" size={20} />
                                <input required type="text" name="name" placeholder="Volledige naam" value={formData.name} onChange={handleChange} className={inputClass} />
                            </div>
                            <div className="relative">
                                <Mail className="absolute top-3 left-3 text-slate-400" size={20} />
                                <input required type="email" name="email" placeholder="E-mailadres" value={formData.email} onChange={handleChange} className={inputClass} />
                            </div>
                            <div className="relative">
                                <Building className="absolute top-3 left-3 text-slate-400" size={20} />
                                <input type="text" name="companyName" placeholder="Bedrijfsnaam (optioneel)" value={formData.companyName} onChange={handleChange} className={inputClass} />
                            </div>
                        </>
                    )}

                    <div className="relative">
                        <Lock className="absolute top-3 left-3 text-slate-400" size={20} />
                        <input required type="password" name="password" placeholder="Wachtwoord" value={formData.password} onChange={handleChange} className={inputClass} autoComplete="current-password" />
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-[#0D2B4E] hover:bg-[#1A4A7A] text-white font-bold py-3 px-4 rounded-xl shadow-lg transform transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center">
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>{isLogin ? 'Inloggen' : 'Registreren'}</span>}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                    {isLogin ? 'Nog geen account?' : 'Heb je al een account?'}
                    <button onClick={() => { setIsLogin(!isLogin); setFormData({ username: '', email: '', password: '', name: '', companyName: '' }); }} className="ml-1 text-[#4A9FD4] hover:text-[#1A4A7A] font-semibold transition-colors focus:outline-none">
                        {isLogin ? 'Registreer nu' : 'Log in'}
                    </button>
                </p>

                {isLogin && (
                    <p className="mt-3 text-center text-xs text-slate-400">
                        De eerste geregistreerde gebruiker krijgt automatisch admin-rechten.
                    </p>
                )}
            </div>
        </div>
    );
};

export default Auth;
