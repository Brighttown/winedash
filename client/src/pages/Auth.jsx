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

    const inputClass = "w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:ring-2 focus:ring-[#7B2D3A] focus:border-transparent outline-none transition-all placeholder-white/40 text-white backdrop-blur-sm";

    return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">

            {/* Achtergrond: vineyard afbeelding met blur 50px */}
            <div
                className="absolute inset-0 scale-110"
                style={{
                    backgroundImage: "url('/vineyard.avif')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(50px)',
                }}
            />

            {/* Zwart overlay 30% */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Formulierkaart */}
            <div className="w-full max-w-md relative z-10">
                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/15 p-8">

                    {/* Logo & titel */}
                    <div className="text-center mb-8">
                        <div className="bg-[#7B2D3A] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl transform -rotate-6 border border-white/10">
                            <Wine className="text-white" size={32} />
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">
                            Wine<span className="text-[#C4758A]">Dash</span>
                        </h1>
                        <p className="text-white/50 mt-2 text-sm italic">
                            {isLogin ? 'Log in op uw account' : 'Maak een nieuw account aan'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <AtSign className="absolute top-3 left-3 text-white/40" size={20} />
                            <input required type="text" name="username" placeholder="Gebruikersnaam" value={formData.username} onChange={handleChange} className={inputClass} autoComplete="username" />
                        </div>

                        {!isLogin && (
                            <>
                                <div className="relative">
                                    <User className="absolute top-3 left-3 text-white/40" size={20} />
                                    <input required type="text" name="name" placeholder="Volledige naam" value={formData.name} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="relative">
                                    <Mail className="absolute top-3 left-3 text-white/40" size={20} />
                                    <input required type="email" name="email" placeholder="E-mailadres" value={formData.email} onChange={handleChange} className={inputClass} />
                                </div>
                                <div className="relative">
                                    <Building className="absolute top-3 left-3 text-white/40" size={20} />
                                    <input type="text" name="companyName" placeholder="Bedrijfsnaam (optioneel)" value={formData.companyName} onChange={handleChange} className={inputClass} />
                                </div>
                            </>
                        )}

                        <div className="relative">
                            <Lock className="absolute top-3 left-3 text-white/40" size={20} />
                            <input required type="password" name="password" placeholder="Wachtwoord" value={formData.password} onChange={handleChange} className={inputClass} autoComplete="current-password" />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#7B2D3A] hover:bg-[#6A2433] text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center mt-2 border border-white/10"
                        >
                            {loading
                                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <span className="tracking-wide">{isLogin ? 'Inloggen' : 'Registreren'}</span>
                            }
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-white/40">
                        {isLogin ? 'Nog geen account?' : 'Heb je al een account?'}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setFormData({ username: '', email: '', password: '', name: '', companyName: '' }); }}
                            className="ml-1 text-[#C4758A] hover:text-white font-semibold transition-colors focus:outline-none"
                        >
                            {isLogin ? 'Registreer nu' : 'Log in'}
                        </button>
                    </p>

                    {isLogin && (
                        <p className="mt-3 text-center text-xs text-white/25 italic">
                            De eerste geregistreerde gebruiker krijgt automatisch admin-rechten.
                        </p>
                    )}
                </div>

                <p className="text-center mt-6 text-white/20 text-xs tracking-widest uppercase">
                    built by Brighttown
                </p>
            </div>
        </div>
    );
};

export default Auth;
