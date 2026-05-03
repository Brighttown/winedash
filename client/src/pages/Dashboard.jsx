import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Wine, AlertTriangle, Clock, TrendingUp, Receipt, Euro, Loader2 } from 'lucide-react';

const fmtEur = (n) => `€${(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StatCard = ({ icon: Icon, label, value, sub }) => (
    <div className="glass rounded-2xl p-6 flex items-center gap-4 hover:-translate-y-0.5 transition-transform shadow-xl">
        <div className="p-3 rounded-xl bg-[#7B2D3A]/30 border border-[#C4758A]/30 text-[#C4758A] shrink-0">
            <Icon size={22} />
        </div>
        <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{label}</p>
            <p className="text-2xl font-black tracking-tight text-white truncate">{value}</p>
            {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
        </div>
    </div>
);

const Panel = ({ icon: Icon, title, accent, children }) => (
    <div className="glass rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-2 mb-5">
            <Icon className={accent} size={20} />
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>{title}</h2>
        </div>
        {children}
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/dashboard/stats');
                setStats(data);
            } catch {
                toast.error('Kan statistieken niet laden');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return (
        <div className="h-64 flex items-center justify-center text-white/60">
            <Loader2 className="animate-spin mr-2" size={20} /> Laden…
        </div>
    );
    if (!stats) return null;

    const goToWine = (id) => navigate(`/wines/${id}`);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>Dashboard</h1>
                <p className="text-white/50 mt-1">Welkom terug — hier is je overzicht.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Wine}     label="Wijnen"          value={stats.totalWines} />
                <StatCard icon={Euro}     label="Voorraadwaarde"  value={fmtEur(stats.inventoryValue)} />
                <StatCard icon={Receipt}  label="Verkocht (30d)"  value={stats.totalUnitsSold30d} sub={fmtEur(stats.totalRevenue30d)} />
                <StatCard icon={AlertTriangle} label="Lage voorraad" value={stats.lowStockAlerts.length} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel icon={TrendingUp} accent="text-emerald-400" title="Best verkocht (30d)">
                    {stats.topSellers.length === 0 ? (
                        <p className="text-white/40 text-sm italic">Nog geen verkopen geregistreerd.</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.topSellers.map((w, i) => (
                                <button key={w.id} onClick={() => goToWine(w.id)}
                                    className="w-full flex items-center gap-3 p-3 glass-sm rounded-xl hover:bg-white/10 transition-colors text-left">
                                    <span className="w-6 text-center text-xs font-black text-white/30">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-white truncate">{w.name}</p>
                                        <p className="text-[11px] text-white/40">{w.region || '—'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-emerald-400">{w.units_sold_30d}×</p>
                                        <p className="text-[11px] text-white/40">{fmtEur(w.revenue_30d)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel icon={AlertTriangle} accent="text-red-400" title="Lage voorraad">
                    {stats.lowStockAlerts.length === 0 ? (
                        <p className="text-white/40 text-sm italic">Alle voorraden zijn op peil.</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.lowStockAlerts.map(w => (
                                <button key={w.id} onClick={() => goToWine(w.id)}
                                    className="w-full flex items-center justify-between p-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-xl text-left transition-colors">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{w.name}</p>
                                        <p className="text-[11px] text-white/40">alarm bij {w.min_stock_alert}</p>
                                    </div>
                                    <span className="text-lg font-black text-red-300 bg-red-500/20 px-3 py-1 rounded-lg ml-3 shrink-0">
                                        {w.stock_count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel icon={TrendingUp} accent="text-amber-400" title="Top marges">
                    {stats.topMarginWines.length === 0 ? (
                        <p className="text-white/40 text-sm italic">Nog geen marges berekend.</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.topMarginWines.map((w, i) => (
                                <button key={w.id} onClick={() => goToWine(w.id)}
                                    className="w-full flex items-center gap-3 p-3 glass-sm rounded-xl hover:bg-white/10 transition-colors text-left">
                                    <span className="w-6 text-center text-xs font-black text-white/30">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-white truncate">{w.name}</p>
                                        <p className="text-[11px] text-white/40">In {fmtEur(w.purchase_price)} · Uit {fmtEur(w.sell_price)}</p>
                                    </div>
                                    <span className="font-bold text-emerald-400 shrink-0">+{Math.round(w.marginPct * 100)}%</span>
                                </button>
                            ))}
                        </div>
                    )}
                </Panel>

                <Panel icon={Clock} accent="text-yellow-400" title="Trage lopers">
                    {stats.slowMovers.length === 0 ? (
                        <p className="text-white/40 text-sm italic">Geen trage lopers.</p>
                    ) : (
                        <div className="space-y-2">
                            {stats.slowMovers.map(w => (
                                <button key={w.id} onClick={() => goToWine(w.id)}
                                    className="w-full flex items-center justify-between p-3 glass-sm rounded-xl hover:bg-white/10 transition-colors text-left">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{w.name}</p>
                                        <p className="text-[11px] text-white/40">{w.stock_count} op voorraad</p>
                                    </div>
                                    <span className="text-sm font-bold text-yellow-300 shrink-0">{w.days_in_stock}d</span>
                                </button>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    );
};

export default Dashboard;
