import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import {
    UploadCloud, CheckCircle, AlertTriangle, Sparkles, Search,
    X, Save, Plus, FileText, Trash2
} from 'lucide-react';

const TYPE_OPTIONS = [
    { value: 'red', label: 'Rood' },
    { value: 'white', label: 'Wit' },
    { value: 'rose', label: 'Rosé' },
    { value: 'sparkling', label: 'Bruisend' },
    { value: 'dessert', label: 'Dessert' }
];

const InvoiceImportPage = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState(null);
    const [supplier, setSupplier] = useState('');
    const [rows, setRows] = useState([]);
    const [saving, setSaving] = useState(false);

    // modal state for catalog search on amber rows
    const [searchingIndex, setSearchingIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const onDrop = useCallback(accepted => {
        if (accepted?.length > 0) {
            setFile(accepted[0]);
            setSession(null);
            setRows([]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] },
        maxFiles: 1
    });

    // ─── Step 1: extract ──────────────────────────────────────────────────────
    const handleExtract = async () => {
        if (!file) return;
        setLoading(true);
        const toastId = toast.loading('Factuur scannen… (kan 1-2 min duren bij grote PDF)', { duration: Infinity });
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/invoice/extract', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 180000  // 3 minuten
            });
            setSession({ sessionId: data.sessionId });
            setSupplier(data.supplier || '');
            setRows(data.lines.map(line => ({
                ...line,
                action: line.match?.matched ? 'link-existing' : 'create-catalog',
                selected: true,
                newCatalog: {
                    name: line.name || '',
                    type: line.type_hint && line.type_hint !== 'unknown' ? line.type_hint : 'red',
                    region: '',
                    country: '',
                    grape: '',
                    winery: line.producer || ''
                },
                overrides: {
                    quantity: line.quantity || 1,
                    purchase_price: line.unit_price || 0,
                    sell_price: line.unit_price ? +(line.unit_price * 2.5).toFixed(2) : 0,
                    vintage: line.vintage || ''
                },
                suggesting: false
            })));
            toast.success(`Factuur uitgelezen: ${data.lines.length} regels`, { id: toastId });
        } catch (err) {
            const msg = err.response?.data?.error || 'Fout bij verwerken factuur.';
            toast.error(msg, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const updateRow = (i, patch) => {
        setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    };
    const updateOverride = (i, patch) => {
        setRows(rs => rs.map((r, idx) => idx === i ? { ...r, overrides: { ...r.overrides, ...patch } } : r));
    };
    const updateNewCatalog = (i, patch) => {
        setRows(rs => rs.map((r, idx) => idx === i ? { ...r, newCatalog: { ...r.newCatalog, ...patch } } : r));
    };
    const removeRow = (i) => {
        setRows(rs => rs.filter((_, idx) => idx !== i));
    };

    // ─── AI suggestion on-demand ──────────────────────────────────────────────
    const handleSuggest = async (i) => {
        const row = rows[i];
        if (!row) return;
        updateRow(i, { suggesting: true });
        try {
            const { data } = await api.post('/invoice/suggest', {
                name: row.name,
                vintage: row.vintage,
                producer: row.producer
            });
            updateNewCatalog(i, {
                type: data.type || rows[i].newCatalog.type,
                region: data.region || '',
                country: data.country || '',
                grape: data.grape || '',
                winery: data.winery || rows[i].newCatalog.winery
            });
            toast.success(`AI-suggestie ingevuld (${data.confidence || 'n/b'})`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'AI-suggestie mislukt.');
        } finally {
            updateRow(i, { suggesting: false });
        }
    };

    // ─── Catalog search modal ─────────────────────────────────────────────────
    const openSearch = (i) => {
        setSearchingIndex(i);
        setSearchQuery(rows[i].name || '');
        setSearchResults([]);
        if (rows[i].name) runSearch(rows[i].name);
    };

    const runSearch = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        try {
            const { data } = await api.get(`/catalog?search=${encodeURIComponent(q)}`);
            setSearchResults(data);
        } catch (err) {
            console.error(err);
        }
    };

    const pickCatalog = (catalog) => {
        if (searchingIndex == null) return;
        setRows(rs => rs.map((r, idx) => idx === searchingIndex ? {
            ...r,
            action: 'link-existing',
            match: { ...(r.match || {}), matched: catalog }
        } : r));
        setSearchingIndex(null);
    };

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (!session) return;

        // Validate: every selected row needs a vintage
        const missingVintage = rows.findIndex(r => r.selected && !r.overrides.vintage);
        if (missingVintage !== -1) {
            toast.error(`Vul een jaartal in voor "${rows[missingVintage].name}"`);
            return;
        }

        const decisions = rows.map((r) => {
            const line = {
                name: r.name,
                producer: r.producer,
                vintage: r.vintage,
                quantity: r.quantity,
                unit_price: r.unit_price,
                type_hint: r.type_hint
            };
            if (!r.selected) return { action: 'skip', line };
            if (r.action === 'link-existing') {
                return {
                    action: 'link-existing',
                    line,
                    catalogId: r.match?.matched?.id,
                    wineOverrides: r.overrides
                };
            }
            return {
                action: 'create-catalog',
                line,
                newCatalog: r.newCatalog,
                wineOverrides: r.overrides
            };
        });

        setSaving(true);
        const toastId = toast.loading('Import uitvoeren...');
        try {
            const { data } = await api.post('/invoice/confirm', {
                supplier,
                decisions
            });
            toast.success(
                `Import klaar: ${data.createdWines} nieuw, ${data.updatedWines} bijgewerkt, ${data.createdCatalog} catalog-entries`,
                { id: toastId }
            );
            setFile(null);
            setSession(null);
            setRows([]);
            setSupplier('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Import mislukt.', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    const selectedCount = rows.filter(r => r.selected).length;

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-3xl font-black text-[#0D2B4E] mb-2">Factuur-import (AI)</h1>
            <p className="text-slate-500 mb-6">Upload een factuur (PDF/JPG/PNG). AI extraheert de wijnen en matcht ze met de catalogus.</p>

            {/* Upload zone */}
            {!session && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
                            isDragActive ? 'border-[#1A4A7A] bg-blue-50' : 'border-slate-300 hover:border-slate-400'
                        }`}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className="mx-auto mb-3 text-slate-400" size={48} />
                        {file ? (
                            <p className="text-slate-700 font-medium">{file.name}</p>
                        ) : (
                            <p className="text-slate-500">
                                {isDragActive ? 'Laat los om te uploaden...' : 'Sleep een factuur hierheen of klik om te kiezen'}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleExtract}
                        disabled={!file || loading}
                        className="mt-4 w-full py-3 bg-[#1A4A7A] text-white font-bold rounded-lg hover:bg-[#0D2B4E] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <FileText size={18} /> {loading ? 'Bezig met scannen...' : 'Scan factuur met AI'}
                    </button>
                </div>
            )}

            {/* Results / checklist */}
            {session && (
                <>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Leverancier</label>
                                <input
                                    type="text"
                                    value={supplier}
                                    onChange={e => setSupplier(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                />
                            </div>
                            <div className="ml-6 text-right">
                                <p className="text-sm text-slate-500">Geselecteerd</p>
                                <p className="text-2xl font-black text-[#0D2B4E]">{selectedCount} / {rows.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        {rows.map((row, i) => {
                            const isMatched = row.action === 'link-existing' && row.match?.matched;
                            const color = isMatched ? 'green' : 'amber';
                            return (
                                <div
                                    key={i}
                                    className={`bg-white rounded-xl border-l-4 shadow-sm p-4 ${
                                        color === 'green' ? 'border-green-500' : 'border-amber-500'
                                    } ${!row.selected ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={row.selected}
                                            onChange={e => updateRow(i, { selected: e.target.checked })}
                                            className="mt-1 w-5 h-5"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {isMatched ? (
                                                    <CheckCircle size={18} className="text-green-600" />
                                                ) : (
                                                    <AlertTriangle size={18} className="text-amber-600" />
                                                )}
                                                <p className="font-bold text-slate-800">{row.name}</p>
                                                {row.producer && <span className="text-xs text-slate-500">· {row.producer}</span>}
                                                <button
                                                    onClick={() => removeRow(i)}
                                                    className="ml-auto text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Verwijder regel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            {isMatched && (
                                                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-3">
                                                    Match: <strong>{row.match.matched.name}</strong>
                                                    {row.match.matched.region && ` — ${row.match.matched.region}`}
                                                    {row.match.matched.country && `, ${row.match.matched.country}`}
                                                    <span className="ml-2 text-green-600">
                                                        (score {row.match.score != null ? row.match.score.toFixed(2) : '?'})
                                                    </span>
                                                    <button
                                                        onClick={() => updateRow(i, { action: 'create-catalog' })}
                                                        className="ml-3 underline text-green-800 hover:text-green-900"
                                                    >
                                                        Losmaken
                                                    </button>
                                                </div>
                                            )}

                                            {!isMatched && (
                                                <div className="text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                                                    <p className="text-amber-800 mb-2">
                                                        Geen match in catalogus — voeg toe als nieuwe wijn of zoek handmatig.
                                                    </p>
                                                    <div className="flex gap-2 flex-wrap">
                                                        <button
                                                            onClick={() => openSearch(i)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50"
                                                        >
                                                            <Search size={12} /> Zoek in catalogus
                                                        </button>
                                                        <button
                                                            onClick={() => handleSuggest(i)}
                                                            disabled={row.suggesting}
                                                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                                                        >
                                                            <Sparkles size={12} /> {row.suggesting ? 'Bezig...' : 'AI-suggestie'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* New-catalog fields (editable when action === create-catalog) */}
                                            {row.action === 'create-catalog' && (
                                                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
                                                    <InputField label="Type" value={row.newCatalog.type} onChange={v => updateNewCatalog(i, { type: v })} type="select" options={TYPE_OPTIONS} />
                                                    <InputField label="Regio" value={row.newCatalog.region} onChange={v => updateNewCatalog(i, { region: v })} />
                                                    <InputField label="Land" value={row.newCatalog.country} onChange={v => updateNewCatalog(i, { country: v })} />
                                                    <InputField label="Druif" value={row.newCatalog.grape} onChange={v => updateNewCatalog(i, { grape: v })} className="md:col-span-2" />
                                                    <InputField label="Producent" value={row.newCatalog.winery} onChange={v => updateNewCatalog(i, { winery: v })} />
                                                </div>
                                            )}

                                            {/* Always-editable stock fields */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <InputField label="Aantal" value={row.overrides.quantity} onChange={v => updateOverride(i, { quantity: +v })} type="number" />
                                                <InputField label="Jaar" value={row.overrides.vintage} onChange={v => updateOverride(i, { vintage: +v })} type="number" />
                                                <InputField label="Inkoop (€)" value={row.overrides.purchase_price} onChange={v => updateOverride(i, { purchase_price: +v })} type="number" step="0.01" />
                                                <InputField label="Verkoop (€)" value={row.overrides.sell_price} onChange={v => updateOverride(i, { sell_price: +v })} type="number" step="0.01" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => { setSession(null); setRows([]); setFile(null); }}
                            className="px-4 py-3 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                        >
                            <Trash2 size={16} className="inline mr-1" /> Annuleer
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={saving || selectedCount === 0}
                            className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Save size={18} /> {saving ? 'Importeren...' : `Bevestig import (${selectedCount})`}
                        </button>
                    </div>
                </>
            )}

            {/* Search modal */}
            {searchingIndex != null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSearchingIndex(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Zoek in catalogus</h3>
                            <button onClick={() => setSearchingIndex(null)}><X size={20} /></button>
                        </div>
                        <div className="p-4">
                            <input
                                autoFocus
                                type="text"
                                value={searchQuery}
                                onChange={e => runSearch(e.target.value)}
                                placeholder="Wijnnaam..."
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            {searchResults.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">Geen resultaten.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {searchResults.map(c => (
                                        <li key={c.id}>
                                            <button
                                                onClick={() => pickCatalog(c)}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 border border-slate-200"
                                            >
                                                <p className="font-semibold text-sm text-slate-800">{c.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {[c.region, c.country, c.vintage].filter(Boolean).join(' · ')}
                                                </p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const InputField = ({ label, value, onChange, type = 'text', step, options, className }) => (
    <div className={className}>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
        {type === 'select' ? (
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
            >
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        ) : (
            <input
                type={type}
                step={step}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded"
            />
        )}
    </div>
);

export default InvoiceImportPage;
