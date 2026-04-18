import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { UploadCloud, CheckCircle, Save, FileImage, Search, Plus, Check, AlertCircle, RefreshCw, X } from 'lucide-react';

const UploadPage = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [saving, setSaving] = useState(false);
    const [matchingIndex, setMatchingIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles?.length > 0) { setFile(acceptedFiles[0]); setResults(null); }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] },
        maxFiles: 1
    });

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        const toastId = toast.loading('Factuur scannen...', { duration: 10000 });
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post('/upload/invoice', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const enriched = data.extractedWines.map(w => ({ ...w, action: w.matchFound ? 'match' : 'create', selectedMatch: w.matchFound || null }));
            setResults(enriched);
            toast.success('Factuur succesvol uitgelezen!', { id: toastId });
        } catch (error) {
            toast.error('Fout bij verwerken factuur.', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const { data } = await api.get(`/catalog?search=${val}`);
            setSearchResults(data);
        } catch (err) {} finally { setSearching(false); }
    };

    const applyMatch = (wine) => {
        const updated = [...results];
        updated[matchingIndex].selectedMatch = wine;
        updated[matchingIndex].action = 'match';
        updated[matchingIndex].name = wine.name;
        setResults(updated);
        setMatchingIndex(null);
    };

    const applyAsNew = () => {
        const updated = [...results];
        updated[matchingIndex].selectedMatch = null;
        updated[matchingIndex].action = 'create';
        setResults(updated);
        setMatchingIndex(null);
    };

    const updateResultList = (index, field, value) => {
        const updated = [...results];
        updated[index][field] = value;
        setResults(updated);
    };

    const handleConfirmAll = async () => {
        setSaving(true);
        let successCount = 0;
        try {
            for (let item of results) {
                let catalogId = item.selectedMatch?.id;
                if (item.action === 'create' || !catalogId) {
                    const { data: newCatalog } = await api.post('/catalog', { name: item.name, vintage: item.vintage, type: 'red', region: 'Onbekend', country: 'Onbekend' });
                    catalogId = newCatalog.id;
                }
                await api.post('/wines', {
                    name: item.name, vintage: item.vintage, stock_count: item.quantity,
                    purchase_price: item.purchase_price, sell_price: item.sell_price,
                    supplier: 'Factuur Import',
                    region: item.selectedMatch?.region || 'Onbekend',
                    country: item.selectedMatch?.country || 'Onbekend',
                    grape: item.selectedMatch?.grape || 'Onbekend',
                    type: item.selectedMatch?.type || 'red', min_stock_alert: 5
                });
                successCount++;
            }
            toast.success(`${successCount} wijnen toegevoegd!`);
            setFile(null); setResults(null);
        } catch (err) {
            toast.error('Fout bij opslaan.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Factuur Scanner</h1>
                <p className="text-white/50">Scan je factuur en koppel de wijnen direct aan de database.</p>
            </div>

            {!results ? (
                <div className="glass rounded-2xl shadow-xl p-6 md:p-8">
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-3xl p-12 md:p-16 text-center cursor-pointer transition-all ${isDragActive ? 'border-[#C4758A] bg-white/10' : file ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
                    >
                        <input {...getInputProps()} />
                        <div className="flex justify-center mb-6">
                            <div className="p-5 glass-sm rounded-2xl">
                                {file ? <FileImage size={56} className="text-emerald-400" /> : <UploadCloud size={56} className="text-white/30" />}
                            </div>
                        </div>
                        {file ? (
                            <div>
                                <h3 className="text-2xl font-bold text-white">{file.name}</h3>
                                <p className="text-white/40 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB — Klaar voor analyse</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-white/70">Sleep hier een factuur</h3>
                                <p className="text-white/30 mt-2">PDF, JPG of PNG</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        {file && <button onClick={() => setFile(null)} className="px-6 py-3 font-semibold text-white/40 hover:text-white transition-colors">Wissen</button>}
                        <button onClick={handleUpload} disabled={!file || loading} className="bg-[#7B2D3A] hover:bg-[#6A2433] disabled:opacity-50 text-white font-bold py-3 px-6 md:px-8 rounded-2xl shadow-md transition-all flex items-center gap-2 border border-white/10">
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
                            <span className="hidden sm:inline">Scan en Automatisch Koppelen</span>
                            <span className="sm:hidden">Scan</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="glass rounded-3xl shadow-xl overflow-hidden">
                    <div className="glass-sm border-b border-white/10 p-5 md:p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-300"><CheckCircle size={24} /></div>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold text-white">Scan Resultaten</h2>
                                <p className="text-sm text-white/40">Koppel de herkende wijnen aan de database.</p>
                            </div>
                        </div>
                        <button onClick={() => setResults(null)} className="p-2 text-white/30 hover:text-white transition-colors"><X size={24} /></button>
                    </div>

                    <div className="divide-y divide-white/10">
                        {results.map((item, idx) => (
                            <div key={idx} className="p-4 md:p-6 hover:bg-white/5 transition-colors">
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 md:gap-6 items-start">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1 block">Naam op factuur</label>
                                            <input type="text" value={item.name} onChange={e => updateResultList(idx, 'name', e.target.value)}
                                                className="text-lg font-bold text-white bg-transparent border-b border-white/10 focus:border-[#C4758A] outline-none w-full py-1 transition-colors" />
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {[
                                                { label: 'Jaar', key: 'vintage', type: 'number', w: 'w-20' },
                                                { label: 'Aantal', key: 'quantity', type: 'number', w: 'w-20' },
                                                { label: 'Inkoop (€)', key: 'purchase_price', type: 'number', w: 'w-28' },
                                            ].map(f => (
                                                <div key={f.key} className={f.w}>
                                                    <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1 block">{f.label}</label>
                                                    <input type={f.type} value={item[f.key]} onChange={e => updateResultList(idx, f.key, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                                        className="input-glass py-1.5 px-2 text-sm text-center" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="lg:border-l border-white/10 lg:pl-6 min-w-0 lg:min-w-[260px]">
                                        <label className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2 block">Database Koppeling</label>
                                        {item.action === 'match' && item.selectedMatch ? (
                                            <div className="bg-emerald-500/15 border border-emerald-500/25 rounded-xl p-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-emerald-500/30 text-emerald-300 p-1 rounded-lg shrink-0"><Check size={16} /></div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{item.selectedMatch.name}</h4>
                                                        <p className="text-xs text-emerald-300/70">{item.selectedMatch.region}, {item.selectedMatch.country}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => { setMatchingIndex(idx); setSearchQuery(item.name); handleSearch(item.name); }}
                                                    className="mt-3 text-xs font-bold text-emerald-400 hover:text-white flex items-center gap-1 transition-colors">
                                                    <RefreshCw size={12} /> Wijzigen
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-amber-500/15 border border-amber-500/25 rounded-xl p-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-amber-500/30 text-amber-300 p-1 rounded-lg shrink-0"><AlertCircle size={16} /></div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">Geen match gevonden</h4>
                                                        <p className="text-xs text-amber-300/70">Nieuw toevoegen aan catalogus?</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => { setMatchingIndex(idx); setSearchQuery(item.name); handleSearch(item.name); }}
                                                    className="mt-3 text-xs bg-white/10 border border-white/20 text-white/70 px-3 py-1.5 rounded-lg font-bold hover:bg-white/20 transition-colors">
                                                    Zoeken
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-5 md:p-8 glass-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/10">
                        <div className="flex items-center gap-3 text-white/40">
                            <AlertCircle size={18} />
                            <span className="text-sm font-medium">Controleer alle items voor opslaan.</span>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={() => setResults(null)} className="px-4 md:px-6 py-3 font-bold text-white/50 hover:bg-white/10 rounded-2xl transition-all border border-white/10">Annuleren</button>
                            <button disabled={saving} onClick={handleConfirmAll}
                                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 md:px-8 py-3 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2 border border-white/10">
                                {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                {saving ? 'Verwerken...' : 'Alles Bevestigen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Matching Modal */}
            {matchingIndex !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="glass rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/15">
                        <div className="p-5 md:p-6 bg-[#7B2D3A]/40 border-b border-white/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">Wijn Koppelen</h3>
                                <p className="text-white/50 text-sm">Zoek de juiste wijn voor: <strong className="text-white">{results[matchingIndex]?.name}</strong></p>
                            </div>
                            <button onClick={() => setMatchingIndex(null)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-5 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                                <input autoFocus type="text" className="input-glass pl-12 text-base" placeholder="Zoek op wijnnaam of regio..." value={searchQuery} onChange={e => handleSearch(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {searching ? (
                                <div className="py-16 flex justify-center"><RefreshCw className="animate-spin text-white/40" size={32} /></div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(w => (
                                    <button key={w.id} onClick={() => applyMatch(w)}
                                        className="w-full text-left p-4 rounded-2xl border border-white/10 hover:border-[#C4758A]/50 hover:bg-white/5 transition-all flex items-center justify-between group">
                                        <div>
                                            <h4 className="font-bold text-white">{w.name}</h4>
                                            <p className="text-sm text-white/40">{w.region}, {w.country} — {w.type}</p>
                                        </div>
                                        <Plus className="text-white/20 group-hover:text-[#C4758A] transition-colors" size={20} />
                                    </button>
                                ))
                            ) : searchQuery.length > 2 ? (
                                <div className="py-12 text-center text-white/30">Geen resultaten voor "{searchQuery}"</div>
                            ) : null}
                        </div>
                        <div className="p-5 glass-sm border-t border-white/10 flex justify-between items-center">
                            <p className="text-sm text-white/30 italic">Niet gevonden?</p>
                            <button onClick={applyAsNew} className="bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white/20 transition-colors">
                                <Plus size={18} /> Voeg toe als nieuw
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadPage;
