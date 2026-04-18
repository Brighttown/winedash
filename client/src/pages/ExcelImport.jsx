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
    a.href = url; a.download = 'winedash_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
};

const ExcelImport = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [mapping, setMapping] = useState({});
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    const onDrop = useCallback(accepted => {
        if (accepted?.length > 0) { setFile(accepted[0]); setPreviewData(null); setResult(null); }
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
            const autoMap = {};
            for (const field of WINE_FIELDS) {
                const match = data.columns.find(col => col.toLowerCase().includes(field.key.toLowerCase()) || col.toLowerCase().includes(field.label.toLowerCase().split(' ')[0]));
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
        const cleanMapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v && v.trim() !== ''));
        if (!cleanMapping.name) { toast.error('Koppel eerst de kolom "Wijn Naam".'); return; }
        if (!previewData?.sessionId) { toast.error('Upload je bestand opnieuw — sessie verlopen.'); return; }
        setImporting(true);
        try {
            const endpoint = isAdmin ? '/excel/confirm-catalog' : '/excel/confirm';
            const { data } = await api.post(endpoint, { sessionId: previewData.sessionId, mapping: cleanMapping });
            setResult(data);
            toast.success(`${data.importedCount} wijnen geïmporteerd!`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Fout bij importeren');
        } finally {
            setImporting(false);
        }
    };

    const reset = () => { setFile(null); setPreviewData(null); setMapping({}); setResult(null); };

    if (result) {
        return (
            <div className="max-w-2xl mx-auto">
                <div className="glass rounded-3xl shadow-xl p-10 text-center space-y-4">
                    <div className="flex justify-center"><CheckCircle className="text-emerald-400" size={64} /></div>
                    <h2 className="text-3xl font-bold text-white">Import Voltooid!</h2>
                    <p className="text-white/60 text-lg">{result.importedCount} wijnen zijn succesvol {isAdmin ? 'toegevoegd aan de Wijn Database' : 'toegevoegd aan je voorraad'}.</p>
                    {result.errors?.length > 0 && (
                        <div className="bg-red-500/15 border border-red-500/25 rounded-xl p-4 text-left">
                            <p className="font-bold text-red-300 mb-2">{result.errors.length} rij(en) overgeslagen:</p>
                            {result.errors.map((e, i) => <p key={i} className="text-sm text-red-400">• {e.row}: {e.error}</p>)}
                        </div>
                    )}
                    <div className="flex justify-center gap-3 pt-4">
                        <button onClick={reset} className="px-5 py-2.5 border border-white/20 rounded-xl font-semibold text-white/60 hover:bg-white/10 transition-colors">Nog een import</button>
                        <button onClick={() => navigate('/wines')} className="flex items-center gap-2 bg-[#7B2D3A] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#6A2433] border border-white/10">
                            Ga naar Voorraad <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-3 rounded-2xl text-white"><FileSpreadsheet size={30} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Excel Import</h1>
                        <p className="text-white/50">{isAdmin ? 'Importeer wijnen in bulk naar de Wijn Database.' : 'Importeer wijnen in bulk naar je persoonlijke voorraad.'}</p>
                        {isAdmin && <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg">Bestemming: Wijn Database</span>}
                    </div>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm font-semibold text-white/60 border border-white/20 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors shrink-0">
                    <Download size={15} /> Sjabloon
                </button>
            </div>

            {/* Step 1 */}
            <div className="glass rounded-2xl shadow-xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="bg-[#7B2D3A] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">1</span>
                    Bestand uploaden
                </h2>
                <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-[#C4758A] bg-white/10' : file ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}>
                    <input {...getInputProps()} />
                    {file ? (
                        <div className="space-y-1">
                            <FileSpreadsheet size={40} className="mx-auto text-emerald-400" />
                            <p className="font-bold text-emerald-300 text-lg">{file.name}</p>
                            <p className="text-sm text-white/40">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <UploadCloud size={40} className={`mx-auto ${isDragActive ? 'text-[#C4758A]' : 'text-white/30'}`} />
                            <p className="font-bold text-white/70">Sleep hier je Excel of CSV bestand</p>
                            <p className="text-sm text-white/30">Ondersteunde formaten: .xlsx, .xls, .csv</p>
                        </div>
                    )}
                </div>
                {file && !previewData && (
                    <div className="mt-4 flex justify-end">
                        <button onClick={handlePreview} disabled={loading} className="flex items-center gap-2 bg-[#7B2D3A] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#6A2433] disabled:opacity-50 border border-white/10">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight size={18} />}
                            Verwerk bestand
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2 */}
            {previewData && (
                <div className="glass rounded-2xl shadow-xl p-6 space-y-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="bg-[#7B2D3A] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">2</span>
                            Kolommen koppelen
                        </h2>
                        <button onClick={reset} className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors">
                            <RefreshCw size={13} /> Opnieuw
                        </button>
                    </div>
                    <p className="text-sm text-white/50">Bestand bevat <strong className="text-white">{previewData.totalRows}</strong> rijen.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {WINE_FIELDS.filter(f => !isAdmin || !['purchase_price', 'sell_price', 'stock_count', 'min_stock_alert', 'supplier'].includes(f.key)).map(field => (
                            <div key={field.key} className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">
                                    {field.label} {field.required && <span className="text-[#C4758A]">*</span>}
                                </label>
                                <select value={mapping[field.key] || ''} onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })} className="select-glass text-sm">
                                    <option value="">— Niet koppelen —</option>
                                    {previewData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div>
                        <p className="text-sm font-bold text-white/40 mb-2">Voorbeeld (eerste 5 rijen):</p>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="min-w-full text-xs">
                                <thead className="bg-white/10">
                                    <tr>{previewData.columns.map(c => <th key={c} className="px-3 py-2 text-left font-bold text-white/40 uppercase tracking-wider whitespace-nowrap">{c}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {previewData.preview.map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            {previewData.columns.map(c => <td key={c} className="px-3 py-2 text-white/60 whitespace-nowrap">{String(row[c] ?? '')}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end items-center gap-4 pt-2">
                        {mapping.name ? (
                            <p className="text-sm text-emerald-300 font-semibold bg-emerald-500/15 border border-emerald-500/25 px-3 py-1.5 rounded-xl">
                                ✓ Wijn Naam → <strong>{mapping.name}</strong>
                            </p>
                        ) : (
                            <p className="text-sm text-amber-300 font-semibold bg-amber-500/15 border border-amber-500/25 px-3 py-1.5 rounded-xl">
                                ⚠ Koppel eerst de kolom "Wijn Naam"
                            </p>
                        )}
                        <button onClick={handleConfirm} disabled={importing || !mapping.name} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-colors border border-white/10">
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
