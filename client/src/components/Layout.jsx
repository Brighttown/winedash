import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Wine, Upload, LogOut, Database, FileSpreadsheet,
    Users, ShieldCheck, CheckSquare, Sparkles, Plus, X,
    Package, BookOpen
} from 'lucide-react';

const Layout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const navClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-all duration-150 ${
            isActive
                ? 'bg-[#7B2D3A] text-white font-semibold shadow-lg shadow-black/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
        }`;

    const mobileNavClass = (path) => {
        const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        return `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${isActive ? 'text-[#C4758A]' : 'text-white/40'}`;
    };

    const SectionLabel = ({ children }) => (
        <p className="px-4 pt-5 pb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 select-none">
            {children}
        </p>
    );

    return (
        <div className="flex min-h-screen relative" style={{ fontFamily: "'Inria Sans', sans-serif" }}>

            {/* ── Volledige app achtergrond: vineyard afbeelding met blur ── */}
            <div
                className="fixed inset-0 -z-10 scale-110"
                style={{
                    backgroundImage: "url('/vineyard.avif')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(50px)',
                }}
            />
            {/* 30% zwart overlay over de hele app */}
            <div className="fixed inset-0 -z-10 bg-black/30" />

            {/* ── Sidebar (desktop) ── */}
            <div className="hidden md:flex w-64 flex-col relative shadow-2xl overflow-hidden">

                {/* Sidebar: zelfde vineyard + extra blur + extra zwart overlay */}
                <div
                    className="absolute inset-0 scale-110"
                    style={{
                        backgroundImage: "url('/vineyard.avif')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(18px)',
                    }}
                />
                {/* Extra zwart overlay bovenop: 70% totaal */}
                <div className="absolute inset-0 bg-black/70" />

                {/* Inhoud boven de overlays */}
                <div className="relative z-10 flex flex-col h-full">

                    {/* Logo */}
                    <div className="p-6 pb-4 border-b border-white/10">
                        <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Inria Serif', serif" }}>
                            Wine<span className="text-[#C4758A]">Dash</span>
                        </h1>
                        <p className="text-[10px] text-white/25 tracking-widest uppercase mt-0.5">by Brighttown</p>
                        {isAdmin && (
                            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#C4758A] bg-[#7B2D3A]/30 border border-[#7B2D3A]/40 px-2.5 py-1 rounded-lg w-fit">
                                <ShieldCheck size={11} /> Administrator
                            </div>
                        )}
                    </div>

                    {/* Navigatie */}
                    <nav className="flex-1 px-3 py-2 overflow-y-auto">
                        {isAdmin ? (
                            <>
                                <SectionLabel>Overzicht</SectionLabel>
                                <NavLink to="/" end className={navClass}>
                                    <LayoutDashboard size={18} className="shrink-0" />
                                    <span>Dashboard</span>
                                </NavLink>

                                <SectionLabel>Catalogus</SectionLabel>
                                <NavLink to="/catalog" className={navClass}>
                                    <Database size={18} className="shrink-0" />
                                    <span>Wijn Database</span>
                                </NavLink>
                                <NavLink to="/excel-import" className={navClass}>
                                    <FileSpreadsheet size={18} className="shrink-0" />
                                    <span>Excel → Catalogus</span>
                                </NavLink>
                                <NavLink to="/admin/approval" className={navClass}>
                                    <CheckSquare size={18} className="shrink-0" />
                                    <span>Goedkeuring</span>
                                </NavLink>

                                <SectionLabel>Beheer</SectionLabel>
                                <NavLink to="/admin/users" className={navClass}>
                                    <Users size={18} className="shrink-0" />
                                    <span>Gebruikersbeheer</span>
                                </NavLink>
                            </>
                        ) : (
                            <>
                                <SectionLabel>Overzicht</SectionLabel>
                                <NavLink to="/" end className={navClass}>
                                    <LayoutDashboard size={18} className="shrink-0" />
                                    <span>Dashboard</span>
                                </NavLink>

                                <SectionLabel>Mijn Wijnkelder</SectionLabel>
                                <NavLink to="/wines" className={navClass}>
                                    <Package size={18} className="shrink-0" />
                                    <span>Mijn Voorraad</span>
                                </NavLink>
                                <NavLink to="/catalog" className={navClass}>
                                    <BookOpen size={18} className="shrink-0" />
                                    <span>Wijn Catalogus</span>
                                </NavLink>

                                <SectionLabel>Facturen & Import</SectionLabel>
                                <NavLink to="/upload" className={navClass}>
                                    <Upload size={18} className="shrink-0" />
                                    <span>Facturen uploaden</span>
                                </NavLink>
                                <NavLink to="/invoice-import" className={navClass}>
                                    <Sparkles size={18} className="shrink-0" />
                                    <span>Factuur via AI</span>
                                </NavLink>
                                <NavLink to="/excel-import" className={navClass}>
                                    <FileSpreadsheet size={18} className="shrink-0" />
                                    <span>Excel Import</span>
                                </NavLink>
                            </>
                        )}
                    </nav>

                    {/* Gebruiker onderaan */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-8 h-8 rounded-full bg-[#7B2D3A]/60 border border-[#C4758A]/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(user.name || user.username || '?')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{user.name || user.username}</p>
                                <p className="text-[10px] text-white/30 truncate">@{user.username}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                title="Uitloggen"
                                className="text-white/30 hover:text-[#C4758A] transition-colors p-1 rounded-lg hover:bg-white/10 shrink-0"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Hoofdinhoud ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile header */}
                <header className="md:hidden flex items-center justify-between px-4 py-3 shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0" style={{ backgroundImage: "url('/vineyard.avif')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div className="absolute inset-0 bg-black/60" />
                    <h1 className="text-xl font-bold text-white tracking-tight relative z-10" style={{ fontFamily: "'Inria Serif', serif" }}>
                        Wine<span className="text-[#C4758A]">Dash</span>
                    </h1>
                    {isAdmin && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-[#C4758A] bg-[#7B2D3A]/30 border border-[#7B2D3A]/40 px-2 py-0.5 rounded-md relative z-10">
                            <ShieldCheck size={10} /> Admin
                        </div>
                    )}
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
                    <Outlet />
                </main>
            </div>

            {/* ── Mobiele bottom navigation ── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 shadow-2xl overflow-hidden">
                <div className="absolute inset-0" style={{ backgroundImage: "url('/vineyard.avif')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div className="absolute inset-0 bg-black/60 border-t border-white/10" />
                <nav className="relative z-10 flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
                    <NavLink to="/" end className={() => mobileNavClass('/')}>
                        <LayoutDashboard size={22} />
                        <span>Home</span>
                    </NavLink>

                    {isAdmin ? (
                        <NavLink to="/catalog" className={() => mobileNavClass('/catalog')}>
                            <Database size={22} />
                            <span>Database</span>
                        </NavLink>
                    ) : (
                        <NavLink to="/wines" className={() => mobileNavClass('/wines')}>
                            <Package size={22} />
                            <span>Voorraad</span>
                        </NavLink>
                    )}

                    {/* Plus knop */}
                    <button
                        onClick={() => setAddMenuOpen(!addMenuOpen)}
                        className={`flex flex-col items-center justify-center -mt-5 transition-transform ${addMenuOpen ? 'rotate-45' : ''}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-colors ${addMenuOpen ? 'bg-stone-700 border-stone-500' : 'bg-[#7B2D3A] border-white/10'}`}>
                            <Plus size={26} className="text-white" />
                        </div>
                    </button>

                    {isAdmin ? (
                        <NavLink to="/admin/users" className={() => mobileNavClass('/admin/users')}>
                            <Users size={22} />
                            <span>Gebruikers</span>
                        </NavLink>
                    ) : (
                        <NavLink to="/catalog" className={() => mobileNavClass('/catalog')}>
                            <BookOpen size={22} />
                            <span>Catalogus</span>
                        </NavLink>
                    )}

                    <button onClick={handleLogout} className={mobileNavClass('__none__')}>
                        <LogOut size={22} />
                        <span>Uitloggen</span>
                    </button>
                </nav>
            </div>

            {/* ── Add menu overlay (mobiel) ── */}
            {addMenuOpen && (
                <>
                    <div className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setAddMenuOpen(false)} />
                    <div className="md:hidden fixed bottom-20 left-4 right-4 rounded-2xl shadow-2xl z-50 p-4 animate-slide-up overflow-hidden">
                        <div className="absolute inset-0" style={{ backgroundImage: "url('/vineyard.avif')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div className="absolute inset-0 bg-black/70 rounded-2xl" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>Toevoegen</h3>
                                <button onClick={() => setAddMenuOpen(false)} className="text-white/40 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="space-y-1">
                                {isAdmin ? (
                                    <>
                                        <button onClick={() => { navigate('/excel-import'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/10 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-full bg-[#1B4332]/80 border border-white/10 flex items-center justify-center shrink-0"><FileSpreadsheet size={20} className="text-green-300" /></div>
                                            <div><p className="text-sm font-semibold text-white">Excel → Catalogus</p><p className="text-xs text-white/40">Importeer wijnen via Excel</p></div>
                                        </button>
                                        <button onClick={() => { navigate('/admin/approval'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/10 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-full bg-[#7B2D3A]/50 border border-white/10 flex items-center justify-center shrink-0"><CheckSquare size={20} className="text-[#C4758A]" /></div>
                                            <div><p className="text-sm font-semibold text-white">Catalogus Goedkeuring</p><p className="text-xs text-white/40">Beoordeel ingediende wijnen</p></div>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { navigate('/upload'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/10 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-full bg-[#1B4332]/80 border border-white/10 flex items-center justify-center shrink-0"><Upload size={20} className="text-green-300" /></div>
                                            <div><p className="text-sm font-semibold text-white">Facturen</p><p className="text-xs text-white/40">Upload factuur handmatig</p></div>
                                        </button>
                                        <button onClick={() => { navigate('/invoice-import'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/10 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-full bg-[#7B2D3A]/50 border border-white/10 flex items-center justify-center shrink-0"><Sparkles size={20} className="text-[#C4758A]" /></div>
                                            <div><p className="text-sm font-semibold text-white">Factuur AI</p><p className="text-xs text-white/40">Automatisch herkennen via AI</p></div>
                                        </button>
                                        <button onClick={() => { navigate('/excel-import'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-white/10 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-full bg-[#1B4332]/80 border border-white/10 flex items-center justify-center shrink-0"><FileSpreadsheet size={20} className="text-green-300" /></div>
                                            <div><p className="text-sm font-semibold text-white">Excel Import</p><p className="text-xs text-white/40">Importeer via spreadsheet</p></div>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Layout;
