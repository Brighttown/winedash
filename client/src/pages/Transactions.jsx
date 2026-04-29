import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import {
    Receipt, ShoppingCart, Wine as WineIcon, SlidersHorizontal, Search, X,
    ChevronUp, ChevronDown, FileText, Package
} from 'lucide-react';

const TYPE_META = {
    purchase:   { label: 'Inkoop',     color: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' },
    sale:       { label: 'Verkoop',    color: 'bg-blue-500/20 text-blue-200 border-blue-400/30' },
    adjustment: { label: 'Aanpassing', color: 'bg-orange-500/20 text-orange-200 border-orange-400/30' },
};

const KIND_META = {
    invoice:  { label: 'Inkoopfactuur',     icon: FileText,    color: 'text-[#C4758A]' },
    mutation: { label: 'Voorraadmutatie',   icon: Package,     color: 'text-white/70' },
};

const FILTERS = [
    { value: 'all',        label: 'Alles' },
    { value: 'invoice',    label: 'Facturen' },
    { value: 'purchase',   label: 'Inkoop' },
    { value: 'sale',       label: 'Verkoop / Afschrijving' },
    { value: 'adjustment', label: 'Aanpassingen' },
];

const fmtDate = (iso) => new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const fmtMoney = (n) => `€ ${Number(n || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Transactions = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filter !== 'all') params.type = filter;
            if (from) params.from = new Date(from).toISOString();
            if (to) {
                const d = new Date(to);
                d.setHours(23, 59, 59, 999);
                params.to = d.toISOString();
            }
            if (search.trim()) params.search = search.trim();
            const { data } = await api.get('/transactions', { params });
            setTransactions(data.transactions || []);
        } catch {
            toast.error('Kan transacties niet laden');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTransactions(); /* eslint-disable-next-line */ }, [filter, from, to]);
    useEffect(() => {
        const t = setTimeout(fetchTransactions, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line
    }, [search]);

    const totals = useMemo(() => {
        let inkoop = 0, verkoop = 0, facturen = 0, mutaties = 0;
        for (const t of transactions) {
            if (t.kind === 'invoice') facturen++;
            else mutaties++;
            if (t.type === 'purchase') inkoop += t.total_value || 0;
            if (t.type === 'sale')     verkoop += Math.abs(t.total_value || 0);
        }
        return { inkoop, verkoop, facturen, mutaties };
    }, [transactions]);

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>Transacties</h1>
                    <p className="text-white/50 mt-1 text-sm">Alle facturen, voorraadmutaties en afschrijvingen op één plek.</p>
                </div>
                <button
                    onClick={() => setShowFilters(s => !s)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-white text-sm transition-colors"
                >
                    <SlidersHorizontal size={16} /> Filters
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={FileText}    label="Facturen"          value={totals.facturen}                color="text-[#C4758A]" />
                <StatCard icon={Package}     label="Mutaties"          value={totals.mutaties}                color="text-white" />
                <StatCard icon={ShoppingCart} label="Totaal ingekocht" value={fmtMoney(totals.inkoop)}        color="text-emerald-300" />
                <StatCard icon={Receipt}     label="Totaal verkocht"   value={fmtMoney(totals.verkoop)}       color="text-blue-300" />
            </div>

            {/* Search + Filters */}
            <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <Search size={16} className="text-white/40 shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Zoek op leverancier, wijn of notitie…"
                        className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="text-white/40 hover:text-white">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {FILTERS.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                filter === f.value
                                    ? 'bg-[#7B2D3A] text-white border-[#7B2D3A]'
                                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {showFilters && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Van</label>
                            <input
                                type="date" value={from} onChange={e => setFrom(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C4758A]"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Tot</label>
                            <input
                                type="date" value={to} onChange={e => setTo(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C4758A]"
                            />
                        </div>
                        {(from || to) && (
                            <button
                                onClick={() => { setFrom(''); setTo(''); }}
                                className="col-span-2 text-xs text-white/50 hover:text-white text-left"
                            >
                                ✕ datumfilter wissen
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="glass rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="py-16 flex items-center justify-center">
                        <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="py-16 text-center text-white/40 italic">
                        Geen transacties gevonden voor deze filters.
                    </div>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {transactions.map(t => (
                            <TransactionRow key={t.id} tx={t} onClick={() => setSelected(t)} />
                        ))}
                    </ul>
                )}
            </div>

            {selected && (
                <TransactionDetail tx={selected} onClose={() => setSelected(null)} />
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white/10 shrink-0">
            <Icon size={20} className={color} />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
            <p className="text-lg font-bold text-white truncate">{value}</p>
        </div>
    </div>
);

const TransactionRow = ({ tx, onClick }) => {
    const kind = KIND_META[tx.kind] || KIND_META.mutation;
    const KindIcon = kind.icon;
    const typeMeta = TYPE_META[tx.type] || { label: tx.type, color: 'bg-white/10 text-white border-white/20' };

    const isPositive = tx.total_quantity > 0;
    const title = tx.kind === 'invoice'
        ? (tx.supplier || 'Onbekende leverancier')
        : (tx.lines[0]?.wine_name || '—');

    const subtitle = tx.kind === 'invoice'
        ? `${tx.lines.length} regel${tx.lines.length !== 1 ? 's' : ''} · ${Math.abs(tx.total_quantity)} fles${Math.abs(tx.total_quantity) !== 1 ? 'sen' : ''}`
        : (tx.lines[0]?.wine_vintage ? `Jaargang ${tx.lines[0].wine_vintage}` : '');

    return (
        <li>
            <button
                onClick={onClick}
                className="w-full flex items-center gap-4 px-4 md:px-5 py-4 hover:bg-white/5 transition-colors text-left"
            >
                <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0 ${kind.color}`}>
                    <KindIcon size={18} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white truncate">{title}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${typeMeta.color}`}>
                            {typeMeta.label}
                        </span>
                        {tx.kind === 'invoice' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-[#7B2D3A]/30 text-[#C4758A] border-[#7B2D3A]/40">
                                Factuur
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                        {fmtDate(tx.created_at)}{subtitle && ` · ${subtitle}`}
                    </p>
                </div>

                <div className="text-right shrink-0">
                    <div className={`flex items-center justify-end gap-0.5 text-sm font-bold ${isPositive ? 'text-emerald-300' : 'text-red-300'}`}>
                        {isPositive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {Math.abs(tx.total_quantity)}
                    </div>
                    {tx.total_value > 0 && (
                        <p className="text-[11px] text-white/40 mt-0.5">{fmtMoney(tx.total_value)}</p>
                    )}
                </div>
            </button>
        </li>
    );
};

const TransactionDetail = ({ tx, onClose }) => {
    const kind = KIND_META[tx.kind] || KIND_META.mutation;
    const typeMeta = TYPE_META[tx.type] || { label: tx.type, color: 'bg-white/10 text-white' };
    const KindIcon = kind.icon;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#1a1118] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-3 rounded-xl bg-white/5 border border-white/10 shrink-0 ${kind.color}`}>
                            <KindIcon size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-white/40">{kind.label}</p>
                            <h2 className="text-xl font-bold text-white truncate" style={{ fontFamily: "'Inria Serif', serif" }}>
                                {tx.kind === 'invoice' ? (tx.supplier || 'Onbekende leverancier') : (tx.lines[0]?.wine_name || '—')}
                            </h2>
                            <p className="text-xs text-white/50 mt-0.5">{fmtDate(tx.created_at)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/10 shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-3 border-b border-white/10 flex flex-wrap gap-2 items-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${typeMeta.color}`}>
                        {typeMeta.label}
                    </span>
                    <span className="text-xs text-white/50">
                        {Math.abs(tx.total_quantity)} fles{Math.abs(tx.total_quantity) !== 1 ? 'sen' : ''}
                    </span>
                    {tx.total_value > 0 && (
                        <span className="text-xs text-white/50">· {fmtMoney(tx.total_value)} totaal</span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                        {tx.lines.length} regel{tx.lines.length !== 1 ? 's' : ''}
                    </p>
                    {tx.lines.map(line => (
                        <div key={line.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-[#7B2D3A]/30 border border-[#7B2D3A]/30 shrink-0">
                                <WineIcon size={14} className="text-[#C4758A]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                    {line.wine_name}
                                    {line.wine_vintage && <span className="text-white/50 font-normal"> · {line.wine_vintage}</span>}
                                </p>
                                {line.note && (
                                    <p className="text-xs text-white/40 mt-0.5 truncate">{line.note}</p>
                                )}
                                <div className="flex gap-3 mt-1 text-[11px] text-white/50">
                                    {line.purchase_price > 0 && <span>Inkoop: {fmtMoney(line.purchase_price)}</span>}
                                    {line.sell_price > 0 && <span>Verkoop: {fmtMoney(line.sell_price)}</span>}
                                </div>
                            </div>
                            <div className={`text-sm font-bold whitespace-nowrap ${line.quantity > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                {line.quantity > 0 ? `+${line.quantity}` : line.quantity}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Transactions;
