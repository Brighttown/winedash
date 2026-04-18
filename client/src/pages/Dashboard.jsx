import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Wine, LineChart, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="glass rounded-2xl p-6 flex items-center space-x-4 hover:-translate-y-1 transition-transform duration-300 shadow-xl">
        <div className="p-4 rounded-xl bg-white/10 text-white shrink-0">
            <Icon size={28} />
        </div>
        <div>
            <p className="text-sm font-medium text-white/50">{label}</p>
            <p className="text-3xl font-black tracking-tight text-white">{value}</p>
        </div>
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/dashboard/stats');
                setStats(data);
            } catch (err) {
                toast.error('Kan statistieken niet laden');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return (
        <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
    );
    if (!stats) return null;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-white/50 mt-1">Welkom terug bij WineDash. Hier is je overzicht.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={Wine} label="Totaal Wijnen" value={stats.totalWines} color="blue" />
                <StatCard icon={LineChart} label="Voorraadwaarde" value={`€${stats.inventoryValue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`} color="emerald" />
                <StatCard icon={AlertTriangle} label="Lage Voorraad" value={stats.lowStockAlerts.length} color="rose" />
                <StatCard icon={Clock} label="Trage Lopers" value={stats.slowMovers.length} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Low Stock Alerts */}
                <div className="glass rounded-2xl shadow-xl p-6">
                    <div className="flex items-center space-x-2 mb-6">
                        <AlertTriangle className="text-red-400" />
                        <h2 className="text-xl font-bold text-white">Lage Voorraad Waarschuwingen</h2>
                    </div>
                    {stats.lowStockAlerts.length === 0 ? (
                        <p className="text-white/50 italic">Alle voorraden zijn op peil.</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.lowStockAlerts.map(wine => (
                                <div key={wine.id} className="flex items-center justify-between p-4 bg-red-500/15 border border-red-500/25 rounded-xl">
                                    <div>
                                        <h3 className="font-semibold text-white">{wine.name}</h3>
                                        <p className="text-sm text-white/50">{wine.min_stock_alert} vereist</p>
                                    </div>
                                    <div className="text-xl font-black text-red-300 bg-red-500/20 px-3 py-1 rounded-lg">
                                        {wine.stock_count}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Margin Wines */}
                <div className="glass rounded-2xl shadow-xl p-6">
                    <div className="flex items-center space-x-2 mb-6">
                        <TrendingUp className="text-emerald-400" />
                        <h2 className="text-xl font-bold text-white">Top Marges</h2>
                    </div>
                    <div className="space-y-3">
                        {stats.topMarginWines.map((wine, i) => (
                            <div key={wine.id} className="flex items-center p-4 glass-sm rounded-xl">
                                <div className="w-8 font-black text-white/20 text-xl shrink-0">{i + 1}</div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white">{wine.name}</h3>
                                    <div className="flex justify-between mt-1 text-sm">
                                        <span className="text-white/50">In: €{wine.purchase_price} | Uit: €{wine.sell_price}</span>
                                        <span className="font-bold text-emerald-400">+{Math.round(wine.marginPct * 100)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
