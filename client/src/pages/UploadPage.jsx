import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import {
    UploadCloud, CheckCircle, Save, FileImage, Type,
    Search, Plus, Check, AlertCircle, RefreshCw, X
} from 'lucide-react';

const UploadPage = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [saving, setSaving] = useState(false);

    // Search matching state
    const [matchingIndex, setMatchingIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles?.length > 0) {
            setFile(acceptedFiles[0]);
            setResults(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png'],
            'application/pdf': ['.pdf']
        },
        maxFiles: 1
    });

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        const toastId = toast.loading('Factuur scannen... dit kan even duren ivm OCR.', { duration: 10000 });

        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/upload/invoice', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Enrich results with an "action" field: 'match', 'create', or 'manual'
            const enriched = data.extractedWines.map(w => ({
                ...w,
                action: w.matchFound ? 'match' : 'create',
                selectedMatch: w.matchFound || null
            }));
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
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const { data } = await api.get(`/catalog?search=${val}`);
            setSearchResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
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

                // If user wants to create a new one, push to catalog first
                if (item.action === 'create' || !catalogId) {
                    const { data: newCatalog } = await api.post('/catalog', {
                        name: item.name,
                        vintage: item.vintage,
                        type: 'red', // Default
                        region: 'Onbekend',
                        country: 'Onbekend'
                    });
                    catalogId = newCatalog.id;
                }

                // Add to personal inventory
                await api.post('/wines', {
                    name: item.name,
                    vintage: item.vintage,
                    stock_count: item.quantity,
                    purchase_price: item.purchase_price,
                    sell_price: item.sell_price,
                    supplier: 'Factuur Import',
                    region: item.selectedMatch?.region || 'Onbekend',
                    country: item.selectedMatch?.country || 'Onbekend',
                    grape: item.selectedMatch?.grape || 'Onbekend',
                    type: item.selectedMatch?.type || 'red',
                    min_stock_alert: 5
                });
                successCount++;
            }
            toast.success(`${successCount} wijnen toegevoegd!`);
            setFile(null);
            setResults(null);
        } catch (err) {
            toast.error('Fout bij opslaan.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-800">Factuur Scanner</h1>
                    <p className="text-slate-500">Scan je factuur en koppel de wijnen direct aan de database.</p>
                </div>
            </div>

            {!results ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all ${isDragActive ? 'border-blue-500 bg-blue-50' : (file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-blue-400')}`}
                    >
                        <input {...getInputProps()} />
                        <div className="flex justify-center mb-6">
                            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100">
                                {file ? <FileImage size={56} className="text-emerald-600" /> : <UploadCloud size={56} className="text-slate-300" />}
                            </div>
                        </div>
                        {file ? (
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">{file.name}</h3>
                                <p className="text-slate-500 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB — Klaar voor analyse</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-2xl font-bold text-slate-700">Sleep hier een factuur</h3>
                                <p className="text-slate-400 mt-2">PDF, JPG of PNG. Wij scannen automisch de wijnen en prijzen.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        {file && (
                            <button onClick={() => setFile(null)} className="px-6 py-3 font-semibold text-slate-400 hover:text-slate-600 transition-colors">Wissen</button>
                        )}
                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className="bg-[#0D2B4E] hover:bg-[#1A4A7A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-8 rounded-2xl shadow-md transition-all flex items-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
                            Scan en Automatisch Koppelen
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-700"><CheckCircle size={24} /></div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Scan Resultaten</h2>
                                <p className="text-sm text-slate-500">Koppel de herkende wijnen aan de database.</p>
                            </div>
                        </div>
                        <button onClick={() => setResults(null)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24} /></button>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {results.map((item, idx) => (
                            <div key={idx} className="p-6 hover:bg-slate-50/50 transition-colors group">
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-6 items-start">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Naam op factuur</label>
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={e => updateResultList(idx, 'name', e.target.value)}
                                                className="text-lg font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-full py-1"
                                            />
                                        </div>

                                        <div className="flex flex-wrap gap-4">
                                            <div className="w-24">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Jaar</label>
                                                <input type="number" value={item.vintage} onChange={e => updateResultList(idx, 'vintage', parseInt(e.target.value))} className="w-full bg-slate-100 border-none rounded-lg p-2 text-center" />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Aantal</label>
                                                <input type="number" value={item.quantity} onChange={e => updateResultList(idx, 'quantity', parseInt(e.target.value))} className="w-full bg-slate-100 border-none rounded-lg p-2 text-center font-bold text-blue-600" />
                                            </div>
                                            <div className="w-32">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Inkoop (€)</label>
                                                <input type="number" step="0.01" value={item.purchase_price} onChange={e => updateResultList(idx, 'purchase_price', parseFloat(e.target.value))} className="w-full bg-slate-100 border-none rounded-lg p-2 text-center" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:border-l border-slate-200 lg:pl-6 min-w-[300px]">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Database Koppeling</label>

                                        {item.action === 'match' && item.selectedMatch ? (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 relative group">
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-emerald-500 text-white p-1 rounded-lg"><Check size={16} /></div>
                                                    <div>
                                                        <h4 className="font-bold text-emerald-900 text-sm">{item.selectedMatch.name}</h4>
                                                        <p className="text-xs text-emerald-700">{item.selectedMatch.region}, {item.selectedMatch.country}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setMatchingIndex(idx);
                                                        setSearchQuery(item.name);
                                                        handleSearch(item.name);
                                                    }}
                                                    className="mt-3 text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                                                >
                                                    <RefreshCw size={12} /> Wijzigen
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="bg-amber-500 text-white p-1 rounded-lg"><AlertCircle size={16} /></div>
                                                    <div>
                                                        <h4 className="font-bold text-amber-900 text-sm">Geen match gevonden</h4>
                                                        <p className="text-xs text-amber-700">Nieuw toevoegen aan catalogus?</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setMatchingIndex(idx);
                                                            setSearchQuery(item.name);
                                                            handleSearch(item.name);
                                                        }}
                                                        className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100"
                                                    >
                                                        Zoeken
                                                    </button>
                                                    <div className="text-xs text-slate-400 flex items-center italic">of voeg handmatig toe</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-8 bg-slate-50 flex items-center justify-between border-t border-slate-200">
                        <div className="flex items-center gap-3 text-slate-500">
                            <AlertCircle size={18} />
                            <span className="text-sm font-medium">Controleer alle items voordat je ze opslaat in je voorraad.</span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setResults(null)} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-200 rounded-2xl transition-all">Annuleren</button>
                            <button
                                disabled={saving}
                                onClick={handleConfirmAll}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg transition-all flex items-center gap-2"
                            >
                                {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                {saving ? 'Verwerken...' : 'Alles Bevestigen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Matching Modal */}
            {matchingIndex !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="p-6 bg-[#0D2B4E] text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Wijn Koppelen</h3>
                                <p className="text-blue-200 text-sm">Zoek de juiste wijn in de database voor: <strong>{results[matchingIndex].name}</strong></p>
                            </div>
                            <button onClick={() => setMatchingIndex(null)} className="text-white/70 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="p-6 border-b border-slate-100">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                                    placeholder="Zoek op wijnnaam of regio..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {searching ? (
                                <div className="py-20 flex justify-center"><RefreshCw className="animate-spin text-blue-500" size={32} /></div>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => applyMatch(w)}
                                        className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-between group"
                                    >
                                        <div>
                                            <h4 className="font-bold text-slate-800">{w.name}</h4>
                                            <p className="text-sm text-slate-500">{w.region}, {w.country} — {w.type}</p>
                                        </div>
                                        <div className="hidden group-hover:block transition-all"><Plus className="text-blue-500" /></div>
                                    </button>
                                ))
                            ) : searchQuery.length > 2 ? (
                                <div className="py-12 text-center text-slate-400">Geen resultaten gevonden voor "{searchQuery}"</div>
                            ) : null}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                            <p className="text-sm text-slate-500 italic">Niet gevonden? Voeg hem als nieuw item toe.</p>
                            <button
                                onClick={applyAsNew}
                                className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"
                            >
                                <Plus size={18} /> Voeg toe als nieuwe wijn
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadPage;
