import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wine, Upload, LogOut, Database, FileSpreadsheet, Users, ShieldCheck, CheckSquare, Sparkles } from 'lucide-react';

const Layout = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

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

    return (
        <div className="flex bg-slate-50 min-h-screen font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-white shadow-xl flex flex-col justify-between">
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
                            /* === ADMIN NAVIGATION === */
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
                            /* === USER NAVIGATION === */
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
                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
