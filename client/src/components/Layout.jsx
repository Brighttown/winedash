import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wine, Upload, LogOut, Database, FileSpreadsheet, Users, ShieldCheck, CheckSquare, Sparkles, Plus, Settings, X, Package } from 'lucide-react';

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
        `flex items-center px-4 py-3 text-sm rounded-lg transition-colors ${isActive
            ? 'bg-[#1A4A7A] text-white font-semibold shadow-md'
            : 'text-[#0f172a] hover:bg-slate-200'
        }`;

    const mobileNavClass = (path) => {
        const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        return `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${isActive ? 'text-[#1A4A7A]' : 'text-slate-400'}`;
    };

    return (
        <div className="flex bg-slate-50 min-h-screen font-sans">
            {/* Sidebar – hidden on mobile */}
            <div className="hidden md:flex w-64 bg-white shadow-xl flex-col justify-between">
                <div>
                    <div className="p-6">
                        <h1 className="text-3xl font-black text-[#0D2B4E] tracking-tight">
                            Wine<span className="text-[#4A9FD4]">Dash</span>
                        </h1>
                        {isAdmin && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg w-fit">
                                <ShieldCheck size={12} /> Admin
                            </div>
                        )}
                    </div>

                    <nav className="px-4 space-y-1 mt-2">
                        {isAdmin ? (
                            <>
                                <p className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Beheer</p>
                                <NavLink to="/" className={navClass}>
                                    <LayoutDashboard size={20} className="mr-3" /> Dashboard
                                </NavLink>
                                <NavLink to="/catalog" className={navClass}>
                                    <Database size={20} className="mr-3" /> Wijn Database
                                </NavLink>
                                <NavLink to="/excel-import" className={navClass}>
                                    <FileSpreadsheet size={20} className="mr-3" /> Excel → Catalogus
                                </NavLink>
                                <NavLink to="/admin/users" className={navClass}>
                                    <Users size={20} className="mr-3" /> Gebruikersbeheer
                                </NavLink>
                                <NavLink to="/admin/approval" className={navClass}>
                                    <CheckSquare size={20} className="mr-3" /> Catalogus Goedkeuring
                                </NavLink>
                            </>
                        ) : (
                            <>
                                <p className="px-4 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Mijn account</p>
                                <NavLink to="/" className={navClass}>
                                    <LayoutDashboard size={20} className="mr-3" /> Dashboard
                                </NavLink>
                                <NavLink to="/catalog" className={navClass}>
                                    <Database size={20} className="mr-3" /> Wijn Database
                                </NavLink>
                                <NavLink to="/wines" className={navClass}>
                                    <Wine size={20} className="mr-3" /> Mijn Voorraad
                                </NavLink>
                                <NavLink to="/upload" className={navClass}>
                                    <Upload size={20} className="mr-3" /> Facturen
                                </NavLink>
                                <NavLink to="/invoice-import" className={navClass}>
                                    <Sparkles size={20} className="mr-3" /> Factuur AI
                                </NavLink>
                                <NavLink to="/excel-import" className={navClass}>
                                    <FileSpreadsheet size={20} className="mr-3" /> Excel Import
                                </NavLink>
                            </>
                        )}
                    </nav>
                </div>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center justify-between px-2 pb-2">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">{user.name || user.username}</p>
                            <p className="text-xs text-slate-400">@{user.username}</p>
                        </div>
                        <button onClick={handleLogout} className="text-slate-500 hover:text-red-500 transition-colors">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile header */}
                <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white shadow-sm">
                    <h1 className="text-xl font-black text-[#0D2B4E] tracking-tight">
                        Wine<span className="text-[#4A9FD4]">Dash</span>
                    </h1>
                    {isAdmin && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <ShieldCheck size={10} /> Admin
                        </div>
                    )}
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
                    <Outlet />
                </main>
            </div>

            {/* Mobile bottom navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
                <nav className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
                    {/* Home */}
                    <NavLink to="/" end className={() => mobileNavClass('/')}>
                        <LayoutDashboard size={22} />
                        <span>Home</span>
                    </NavLink>

                    {/* Voorraad / Database */}
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

                    {/* Plus button */}
                    <button
                        onClick={() => setAddMenuOpen(!addMenuOpen)}
                        className={`flex flex-col items-center justify-center -mt-5 transition-transform ${addMenuOpen ? 'rotate-45' : ''}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${addMenuOpen ? 'bg-slate-600' : 'bg-[#1A4A7A]'}`}>
                            <Plus size={26} className="text-white" />
                        </div>
                    </button>

                    {/* Catalog / Users */}
                    {isAdmin ? (
                        <NavLink to="/admin/users" className={() => mobileNavClass('/admin/users')}>
                            <Users size={22} />
                            <span>Gebruikers</span>
                        </NavLink>
                    ) : (
                        <NavLink to="/catalog" className={() => mobileNavClass('/catalog')}>
                            <Database size={22} />
                            <span>Catalogus</span>
                        </NavLink>
                    )}

                    {/* Settings */}
                    <button onClick={handleLogout} className={mobileNavClass('__none__')}>
                        <Settings size={22} />
                        <span>Menu</span>
                    </button>
                </nav>
            </div>

            {/* Add menu overlay */}
            {addMenuOpen && (
                <>
                    <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setAddMenuOpen(false)} />
                    <div className="md:hidden fixed bottom-20 left-4 right-4 bg-white rounded-2xl shadow-2xl z-50 p-4 animate-slide-up">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-700">Toevoegen</h3>
                            <button onClick={() => setAddMenuOpen(false)} className="text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {isAdmin ? (
                                <>
                                    <button onClick={() => { navigate('/excel-import'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><FileSpreadsheet size={20} className="text-emerald-600" /></div>
                                        <div><p className="text-sm font-semibold text-slate-700">Excel → Catalogus</p><p className="text-xs text-slate-400">Importeer wijnen via Excel</p></div>
                                    </button>
                                    <button onClick={() => { navigate('/admin/approval'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"><CheckSquare size={20} className="text-amber-600" /></div>
                                        <div><p className="text-sm font-semibold text-slate-700">Catalogus Goedkeuring</p><p className="text-xs text-slate-400">Beoordeel ingediende wijnen</p></div>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => { navigate('/upload'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><Upload size={20} className="text-blue-600" /></div>
                                        <div><p className="text-sm font-semibold text-slate-700">Facturen</p><p className="text-xs text-slate-400">Upload factuur handmatig</p></div>
                                    </button>
                                    <button onClick={() => { navigate('/invoice-import'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center"><Sparkles size={20} className="text-purple-600" /></div>
                                        <div><p className="text-sm font-semibold text-slate-700">Factuur AI</p><p className="text-xs text-slate-400">Automatisch herkennen via AI</p></div>
                                    </button>
                                    <button onClick={() => { navigate('/excel-import'); setAddMenuOpen(false); }} className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><FileSpreadsheet size={20} className="text-emerald-600" /></div>
                                        <div><p className="text-sm font-semibold text-slate-700">Excel Import</p><p className="text-xs text-slate-400">Importeer via spreadsheet</p></div>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Layout;
