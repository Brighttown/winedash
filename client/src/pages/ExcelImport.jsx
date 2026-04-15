import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { UploadCloud, FileSpreadsheet, CheckCircle, ArrowRight, RefreshCw, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WINE_FIELDS = [
    { key: 'name', label: 'Wijn Naam', required: true },
    { key: 'type', label: 'Type (rood/wit/rosé/bruisend/dessert)', required: false },
    { key: 'region', label: 'Regio', required: false },
    { key: 'country', label: 'Land', required: false },
    { key: 'vintage', label: 'Oogstjaar', required: false },
    { key: 'grape', label: 'Druivenras', required: false },
    { key: 'supplier', label: 'Leverancier', required: false },
    { key: 'purchase_price', label: 'Inkoopprijs (€)', required: false },
    { key: 'sell_price', label: 'Verkoopprijs (€)', required: false },
    { key: 'stock_count', label: 'Aantal op voorraad', required: false },
    { key: 'min_stock_alert', label: 'Minimale alert', required: false },
];

const downloadTemplate = () => {
    const header = ['Wijn Naam', 'Type', 'Regio', 'Land', 'Oogstjaar', 'Druivenras', 'Leverancier', 'Inkoopprijs', 'Verkoopprijs', 'Aantal', 'Minimum Alert'];
    const example = ['Château Margaux', 'rood', 'Bordeaux', 'Frankrijk', '2018', 'Cabernet Sauvignon', 'Mijn Leverancier', '25.00', '65.00', '12', '3'];
    const csv = [header, example].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'winedash_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
};

const ExcelImport = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null); // { columns, preview, totalRows, sessionId }
    const [mapping, setMapping] = useState({});
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const onDrop = useCallback(accepted => {
        if (accepted?.length > 0) {
            setFile(accepted[0]);
            setPreviewData(null);
            setResult(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv'],
        },
        maxFiles: 1,
    });

    const handlePreview = async () => {
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data } = await api.post('/excel/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setPreviewData(data);
            // Auto-map columns that match wine field labels (case-insensitive)
            const autoMap = {};
            for (const field of WINE_FIELDS) {
                const match = data.columns.find(col =>
                    col.toLowerCase().includes(field.key.toLowerCase()) ||
                    col.toLowerCase().includes(field.label.toLowerCase().split(' ')[0])
                );
                if (match) autoMap[field.key] = match;
            }
            setMapping(autoMap);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Fout bij verwerken bestand');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        const cleanMapping = Object.fromEntries(
            Object.entries(mapping).filter(([, v]) => v && v.trim() !== '')
        );
        if (!cleanMapping.name) {
            toast.error('Koppel eerst de kolom "Wijn Naam" aan een kolom uit het bestand.');
            return;
        }
        if (!previewData?.sessionId) {
            toast.error('Upload je bestand opnieuw — sessie verlopen.');
            return;
        }
        setImporting(true);
        try {
            // Admin → write to global WineCatalog; User → write to personal inventory
            const endpoint = isAdmin ? '/excel/confirm-catalog' : '/excel/confirm';
            const { data } = await api.post(endpoint, {
                sessionId: previewData.sessionId,
                mapping: cleanMapping
            });
            setResult(data);
            toast.success(`${data.importedCount} wijnen geïmporteerd!`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Fout bij importeren');
        } finally {
            setImporting(false);
        }
    };

    const reset = () => {
        setFile(null);
        setPreviewData(null);
        setMapping({});
        setResult(null);
    };

    if (result) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
                    <div className="flex justify-center"><CheckCircle className="text-emerald-500" size={64} /></div>
                    <h2 className="text-3xl font-black text-slate-800">Import Voltooid!</h2>
                    <p className="text-slate-500 text-lg">{result.importedCount} wijnen zijn succesvol {isAdmin ? 'toegevoegd aan de Wijn Database' : 'toegevoegd aan je voorraad'}.</p>
                    {result.errors?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                            <p className="font-bold text-red-700 mb-2">{result.errors.length} rij(en) overgeslagen:</p>
                            {result.errors.map((e, i) => <p key={i} className="text-sm text-red-600">• {e.row}: {e.error}</p>)}
                        </div>
                    )}
                    <div className="flex justify-center gap-3 pt-4">
                        <button onClick={reset} className="px-5 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50">
                            Nog een import
                        </button>
                        <button onClick={() => navigate('/wines')} className="flex items-center gap-2 bg-[#0D2B4E] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#1A4A7A]">
                            Ga naar Voorraad <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700"><FileSpreadsheet size={30} /></div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">Excel Import</h1>
                        <p className="text-slate-500">
                            {isAdmin
                                ? 'Importeer wijnen in bulk naar de globale Wijn Database (catalogus).'
                                : 'Importeer wijnen in bulk naar je persoonlijke voorraad.'}
                        </p>
                        {isAdmin && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                                📋 Bestemming: Wijn Database (catalogus)
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm font-semibold text-[#4A9FD4] border border-[#4A9FD4]/30 px-4 py-2 rounded-xl hover:bg-[#4A9FD4]/10 transition-colors">
                    <Download size={15} /> Download sjabloon
                </button>
            </div>

            {/* Step 1: Upload */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="bg-[#0D2B4E] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">1</span>
                    Bestand uploaden
                </h2>
                <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-[#4A9FD4] bg-[#4A9FD4]/5' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-[#4A9FD4]'}`}>
                    <input {...getInputProps()} />
                    {file ? (
                        <div className="space-y-1">
                            <FileSpreadsheet size={40} className="mx-auto text-emerald-600" />
                            <p className="font-bold text-emerald-700 text-lg">{file.name}</p>
                            <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <UploadCloud size={40} className={`mx-auto ${isDragActive ? 'text-[#4A9FD4]' : 'text-slate-400'}`} />
                            <p className="font-bold text-slate-700">Sleep hier je Excel of CSV bestand</p>
                            <p className="text-sm text-slate-400">Ondersteunde formaten: .xlsx, .xls, .csv</p>
                        </div>
                    )}
                </div>
                {file && !previewData && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={handlePreview} disabled={loading} className="flex items-center gap-2 bg-[#0D2B4E] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#1A4A7A] disabled:opacity-50">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight size={18} />}
                            Verwerk bestand
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Column mapping */}
            {previewData && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                            <span className="bg-[#0D2B4E] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">2</span>
                            Kolommen koppelen
                        </h2>
                        <button onClick={reset} className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
                            <RefreshCw size={13} /> Opnieuw
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">Bestand bevat <strong>{previewData.totalRows}</strong> rijen. Koppel de kolommen uit je bestand aan de wijn-velden.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {WINE_FIELDS.filter(f => !isAdmin || !['purchase_price', 'sell_price', 'stock_count', 'min_stock_alert', 'supplier'].includes(f.key)).map(field => (
                            <div key={field.key} className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    value={mapping[field.key] || ''}
                                    onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}
                                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4A9FD4]/40"
                                >
                                    <option value="">— Niet koppelen —</option>
                                    {previewData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>

                    {/* Preview table */}
                    <div>
                        <p className="text-sm font-bold text-slate-500 mb-2">Voorbeeld (eerste 5 rijen):</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="min-w-full text-xs">
                                <thead className="bg-slate-50">
                                    <tr>{previewData.columns.map(c => <th key={c} className="px-3 py-2 text-left font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {previewData.preview.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            {previewData.columns.map(c => <td key={c} className="px-3 py-2 text-slate-600 whitespace-nowrap">{String(row[c] ?? '')}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end items-center gap-4 pt-2">
                        {mapping.name ? (
                            <p className="text-sm text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                                ✓ Wijn Naam → <strong>{mapping.name}</strong>
                            </p>
                        ) : (
                            <p className="text-sm text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                                ⚠ Koppel eerst de kolom "Wijn Naam"
                            </p>
                        )}
                        <button onClick={handleConfirm} disabled={importing || !mapping.name} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors">
                            {importing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={18} />}
                            Importeer {previewData.totalRows} wijnen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExcelImport;
