import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { UploadCloud, CheckCircle, AlertTriangle, Sparkles, Search, X, Save, Trash2, Loader2, Wine } from 'lucide-react';

const TYPE_OPTIONS = [
    { value: 'red', label: 'Rood' }, { value: 'white', label: 'Wit' },
    { value: 'rose', label: 'Rosé' }, { value: 'sparkling', label: 'Bruisend' },
    { value: 'dessert', label: 'Dessert' }
];

const InputField = ({ label, value, onChange, type = 'text', step, options, className, placeholder, disabled }) => (
    <div className={className}>
        <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-wide mb-1">{label}</label>
        {type === 'select' ? (
            <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className="select-glass py-1.5 text-sm disabled:opacity-40">
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        ) : (
            <input type={type} step={step} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                disabled={disabled} className="input-glass py-1.5 px-2 text-sm disabled:opacity-40" />
        )}
    </div>
);

const WijnkaartImportPage = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const [restaurant, setRestaurant] = useState('');
    const [rows, setRows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [searchingIndex, setSearchingIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const onDrop = useCallback(accepted => {
        if (accepted?.length > 0) { setFile(accepted[0]); setReady(false); setRows([]); }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv']
        },
        maxFiles: 1
    });

    const handleExtract = async () => {
        if (!file) return;
        setLoading(true);
        const toastId = toast.loading('Wijnkaart verwerken… (kan even duren)', { duration: Infinity });
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post('/wijnkaart/extract', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 180000
            });
            setRestaurant(data.restaurant || '');
            setRows(data.lines.map(line => ({
                ...line,
                action: line.match?.fromInventory && line.match?.matched ? 'update-stock'
                    : line.match?.matched ? 'link-existing' : 'create-catalog',
                selected: true,
                newCatalog: {
                    name: line.name || '',
                    type: line.type_hint && line.type_hint !== 'unknown' ? line.type_hint : 'red',
                    region: '', subregion: '', country: '', grape: '',
                    winery: line.producer || '', bottle_size: line.bottle_size || ''
                },
                overrides: {
                    sell_price: line.sell_price || '',
                    sell_price_glass: line.sell_price_glass || '',
                    purchase_price: '',
                    vintage: line.vintage || '',
                    non_vintage: !line.vintage,
                    quantity: 0
                },
                suggesting: false
            })));
            setReady(true);
            toast.success(`Wijnkaart gelezen: ${data.lines.length} wijnen`, { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.error || 'Fout bij verwerken wijnkaart.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const updateRow = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    const updateOverride = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, overrides: { ...r.overrides, ...patch } } : r));
    const updateNewCatalog = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, newCatalog: { ...r.newCatalog, ...patch } } : r));
    const removeRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i));

    const handleSuggest = async (i) => {
        const row = rows[i];
        if (!row) return;
        updateRow(i, { suggesting: true });
        try {
            const { data } = await api.post('/invoice/suggest', { name: row.name, vintage: row.vintage, producer: row.producer });
            updateNewCatalog(i, {
                type: data.type || rows[i].newCatalog.type,
                region: data.region || '', subregion: data.subregion || '',
                country: data.country || '', grape: data.grape || '',
                winery: data.winery || rows[i].newCatalog.winery
            });
            toast.success(`AI-suggestie ingevuld (${data.confidence || 'n/b'})`);
        } catch {
            toast.error('AI-suggestie mislukt.');
        } finally {
            updateRow(i, { suggesting: false });
        }
    };

    const openSearch = (i) => {
        setSearchingIndex(i); setSearchQuery(rows[i].name || ''); setSearchResults([]);
        if (rows[i].name) runSearch(rows[i].name);
    };
    const runSearch = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        try { const { data } = await api.get(`/catalog?search=${encodeURIComponent(q)}`); setSearchResults(data); } catch {}
    };
    const pickCatalog = (catalog) => {
        if (searchingIndex == null) return;
        setRows(rs => rs.map((r, idx) => idx === searchingIndex
            ? { ...r, action: 'link-existing', match: { ...(r.match || {}), matched: catalog } } : r));
        setSearchingIndex(null);
    };

    const handleConfirm = async () => {
        setSaving(true);
        const toastId = toast.loading('Import uitvoeren...');
        try {
            const decisions = rows.map(r => {
                const line = { name: r.name, producer: r.producer, vintage: r.vintage, type_hint: r.type_hint, quantity: 1, unit_price: 0 };
                const wineOverrides = {
                    sell_price: r.overrides.sell_price !== '' ? Number(r.overrides.sell_price) : null,
                    purchase_price: r.overrides.purchase_price !== '' ? Number(r.overrides.purchase_price) : 0,
                    vintage: r.overrides.non_vintage ? null : (r.overrides.vintage ? Number(r.overrides.vintage) : null),
                    quantity: Number(r.overrides.quantity) || 0
                };
                if (!r.selected) return { action: 'skip', line };
                if (r.action === 'update-stock') return { action: 'update-stock', line, wineId: r.match?.matched?.id, wineOverrides };
                if (r.action === 'link-existing') return { action: 'link-existing', line, catalogId: r.match?.matched?.id, wineOverrides };
                return { action: 'create-catalog', line, newCatalog: r.newCatalog, wineOverrides };
            });

            const { data } = await api.post('/invoice/confirm', { supplier: restaurant || 'Wijnkaart Import', decisions });
            toast.success(`Import klaar: ${data.createdWines} nieuw, ${data.updatedWines} bijgewerkt, ${data.createdCatalog} catalogus-entries`, { id: toastId });
            setFile(null); setReady(false); setRows([]); setRestaurant('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Import mislukt.', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const selectedCount = rows.filter(r => r.selected).length;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Wijnkaart importeren</h1>
                <p className="text-white/50">Upload een wijnkaart (PDF, Word of Excel). AI extraheert de wijnen inclusief verkoopprijs.</p>
            </div>

            {!ready && (
                <div className="glass rounded-2xl shadow-xl p-6 space-y-4">
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${isDragActive ? 'border-[#C4758A] bg-white/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}>
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto mb-3 text-white/30" size={48} />
                        {file ? (
                            <p className="text-white font-medium">{file.name}</p>
                        ) : (
                            <>
                                <p className="text-white/50">{isDragActive ? 'Laat los om te uploaden...' : 'Sleep een wijnkaart hierheen of klik om te kiezen'}</p>
                                <p className="text-white/30 text-xs mt-1">PDF · Word (.docx) · Excel (.xlsx)</p>
                            </>
                        )}
                    </div>
                    <button onClick={handleExtract} disabled={!file || loading}
                        className="w-full py-3 bg-[#7B2D3A] text-white font-bold rounded-xl hover:bg-[#6A2433] disabled:opacity-50 flex items-center justify-center gap-2 border border-white/10 transition-colors">
                        <Wine size={18} /> {loading ? 'Bezig met analyseren...' : 'Analyseer wijnkaart met AI'}
                    </button>
                </div>
            )}

            {ready && (
                <>
                    <div className="glass rounded-2xl shadow-xl p-5">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-white/40 mb-1">Restaurant / Establishment</label>
                                <input type="text" value={restaurant} onChange={e => setRestaurant(e.target.value)} className="input-glass" placeholder="Naam restaurant" />
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm text-white/40">Geselecteerd</p>
                                <p className="text-2xl font-black text-white">{selectedCount} / {rows.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {rows.map((row, i) => {
                            const isInventoryMatch = row.action === 'update-stock' && row.match?.matched;
                            const isCatalogMatch = row.action === 'link-existing' && row.match?.matched;
                            const isMatched = isInventoryMatch || isCatalogMatch;
                            const catalogReady = row.action === 'create-catalog' && row.newCatalog.region && row.newCatalog.country;
                            const color = (isMatched || catalogReady) ? 'green' : 'amber';

                            return (
                                <div key={i} className={`relative glass rounded-xl border-l-4 p-4 ${color === 'green' ? 'border-green-500/60' : 'border-amber-500/60'} ${!row.selected ? 'opacity-50' : ''}`}>
                                    {row.suggesting && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10 backdrop-blur-sm">
                                            <Loader2 size={24} className="animate-spin text-white" />
                                            <span className="ml-2 text-sm font-medium text-white">AI bezig...</span>
                                        </div>
                                    )}
                                    <div className="flex items-start gap-3">
                                        <input type="checkbox" checked={row.selected} onChange={e => updateRow(i, { selected: e.target.checked })} className="mt-1 w-5 h-5 accent-[#7B2D3A]" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                {isMatched ? <CheckCircle size={18} className="text-green-400 shrink-0" /> : <AlertTriangle size={18} className="text-amber-400 shrink-0" />}
                                                <p className="font-bold text-white truncate">{row.name}</p>
                                                {row.producer && <span className="text-xs text-white/40 hidden sm:inline">· {row.producer}</span>}
                                                <button onClick={() => removeRow(i)} className="ml-auto text-white/20 hover:text-red-400 transition-colors shrink-0"><X size={16} /></button>
                                            </div>

                                            {isInventoryMatch && (
                                                <div className="text-xs bg-green-500/15 border border-green-500/25 rounded px-3 py-2 mb-3 text-green-300">
                                                    Al in voorraad: <strong>{row.match.matched.name}</strong> · verkoopprijs wordt bijgewerkt
                                                    <button onClick={() => updateRow(i, { action: 'create-catalog' })} className="ml-3 underline hover:text-white">Losmaken</button>
                                                </div>
                                            )}
                                            {isCatalogMatch && (
                                                <div className="text-xs bg-green-500/15 border border-green-500/25 rounded px-3 py-2 mb-3 text-green-300">
                                                    Catalogus: <strong>{row.match.matched.name}</strong>{row.match.matched.region && ` — ${row.match.matched.region}`}
                                                    <button onClick={() => updateRow(i, { action: 'create-catalog' })} className="ml-3 underline hover:text-white">Losmaken</button>
                                                </div>
                                            )}
                                            {!isMatched && !catalogReady && (
                                                <div className="text-xs bg-amber-500/15 border border-amber-500/25 rounded px-3 py-2 mb-3 text-amber-300">
                                                    <p className="mb-2">Geen automatische match gevonden</p>
                                                    <button onClick={() => openSearch(i)} className="flex items-center gap-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white/70 hover:bg-white/20 transition-colors">
                                                        <Search size={12} /> Zoek in catalogus
                                                    </button>
                                                </div>
                                            )}

                                            {row.action === 'create-catalog' && (
                                                <>
                                                    {catalogReady && (
                                                        <div className="text-xs text-green-300 bg-green-500/15 border border-green-500/25 rounded px-3 py-1.5 mb-2 flex items-center justify-between">
                                                            <span>Nieuwe catalogus-entry aanmaken</span>
                                                            <button onClick={() => openSearch(i)} className="underline ml-2 hover:text-white">Zoek bestaande</button>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-3">
                                                        <InputField label="Type" value={row.newCatalog.type} onChange={v => updateNewCatalog(i, { type: v })} type="select" options={TYPE_OPTIONS} />
                                                        <InputField label="Regio" value={row.newCatalog.region} onChange={v => updateNewCatalog(i, { region: v })} />
                                                        <InputField label="Streek" value={row.newCatalog.subregion} onChange={v => updateNewCatalog(i, { subregion: v })} />
                                                        <InputField label="Land" value={row.newCatalog.country} onChange={v => updateNewCatalog(i, { country: v })} />
                                                        <InputField label="Druif" value={row.newCatalog.grape} onChange={v => updateNewCatalog(i, { grape: v })} className="md:col-span-2" />
                                                        <InputField label="Producent" value={row.newCatalog.winery} onChange={v => updateNewCatalog(i, { winery: v })} />
                                                    </div>
                                                </>
                                            )}

                                            {/* Verkoopprijs + overige velden */}
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                                <InputField label="Verkoop fles (€)" value={row.overrides.sell_price} onChange={v => updateOverride(i, { sell_price: v })} type="number" step="0.01" placeholder="0.00" />
                                                <InputField label="Verkoop glas (€)" value={row.overrides.sell_price_glass} onChange={v => updateOverride(i, { sell_price_glass: v })} type="number" step="0.01" placeholder="optioneel" />
                                                <InputField label="Inkoop (€)" value={row.overrides.purchase_price} onChange={v => updateOverride(i, { purchase_price: v })} type="number" step="0.01" placeholder="optioneel" />
                                                <div>
                                                    <InputField label="Jaar" value={row.overrides.non_vintage ? '' : row.overrides.vintage} onChange={v => updateOverride(i, { vintage: v })} type="number" disabled={row.overrides.non_vintage} placeholder={row.overrides.non_vintage ? 'NV' : ''} />
                                                    <label className="flex items-center gap-1 mt-1 cursor-pointer">
                                                        <input type="checkbox" checked={!!row.overrides.non_vintage} onChange={e => updateOverride(i, { non_vintage: e.target.checked, vintage: e.target.checked ? '' : row.overrides.vintage })} className="w-3 h-3 accent-[#7B2D3A]" />
                                                        <span className="text-[10px] text-white/40 uppercase tracking-wide">NV</span>
                                                    </label>
                                                </div>
                                                <InputField label="Voorraad toevoegen" value={row.overrides.quantity} onChange={v => updateOverride(i, { quantity: v })} type="number" placeholder="0" />
                                            </div>

                                            {!isMatched && (
                                                <button onClick={() => handleSuggest(i)} disabled={row.suggesting}
                                                    className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#7B2D3A]/40 border border-[#7B2D3A]/60 rounded-lg text-white/70 hover:bg-[#7B2D3A]/60 transition-colors disabled:opacity-50">
                                                    <Sparkles size={12} /> AI-suggestie ophalen
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => { setReady(false); setRows([]); setFile(null); }}
                            className="px-4 py-3 border border-white/20 rounded-xl text-white/60 hover:bg-white/10 transition-colors flex items-center gap-1">
                            <Trash2 size={16} /> Annuleer
                        </button>
                        <button onClick={handleConfirm} disabled={saving || selectedCount === 0}
                            className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 border border-white/10 transition-colors">
                            <Save size={18} /> {saving ? 'Importeren...' : `Bevestig import (${selectedCount} wijnen)`}
                        </button>
                    </div>
                </>
            )}

            {searchingIndex != null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setSearchingIndex(null)}>
                    <div className="glass rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] flex flex-col border border-white/15" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-white">Zoek in catalogus</h3>
                            <button onClick={() => setSearchingIndex(null)} className="text-white/40 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-4">
                            <input autoFocus type="text" value={searchQuery} onChange={e => runSearch(e.target.value)} placeholder="Wijnnaam..." className="input-glass" />
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            {searchResults.length === 0 ? (
                                <p className="text-sm text-white/30 text-center py-6">Geen resultaten.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {searchResults.map(c => (
                                        <li key={c.id}>
                                            <button onClick={() => pickCatalog(c)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 border border-white/10 transition-colors">
                                                <p className="font-semibold text-sm text-white">{c.name}</p>
                                                <p className="text-xs text-white/40">{[c.region, c.country, c.vintage].filter(Boolean).join(' · ')}</p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/10">
                            <button onClick={() => { const idx = searchingIndex; setSearchingIndex(null); handleSuggest(idx); }} disabled={rows[searchingIndex]?.suggesting}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#7B2D3A] text-white rounded-xl hover:bg-[#6A2433] disabled:opacity-50 text-sm font-medium border border-white/10 transition-colors">
                                <Sparkles size={14} /> {rows[searchingIndex]?.suggesting ? 'Bezig...' : 'AI-suggestie'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WijnkaartImportPage;
