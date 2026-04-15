import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { ArrowLeft, PackagePlus, Globe, Grape, MapPin, Droplets, FlaskConical } from 'lucide-react';
import AddToStockModal from '../components/AddToStockModal';

const CatalogDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [wine, setWine] = useState(null);
    const [loading, setLoading] = useState(true);
    const [addModalOpen, setAddModalOpen] = useState(false);

    useEffect(() => {
        const fetchWine = async () => {
            try {
                const { data } = await api.get(`/catalog/${id}`);
                setWine(data);
            } catch (err) {
                toast.error('Kan wijndetails niet laden.');
                navigate('/catalog');
            } finally {
                setLoading(false);
            }
        };
        fetchWine();
    }, [id, navigate]);

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#4A9FD4] border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (!wine) return null;

    let parsedHarmonize = [];
    try {
        if (wine.harmonize) {
            parsedHarmonize = wine.harmonize.split(',').map(s => s.trim());
        }
    } catch (e) { }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <Link to="/catalog" className="inline-flex items-center text-slate-500 hover:text-[#0D2B4E] transition-colors font-medium">
                <ArrowLeft size={18} className="mr-2" /> Terug naar Wijn Database
            </Link>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="md:flex">
                    <div className={`md:w-1/3 p-10 flex flex-col justify-center items-center relative
                        ${wine.type === 'red' && 'bg-red-50 text-red-900'}
                        ${wine.type === 'white' && 'bg-amber-50 text-amber-900'}
                        ${wine.type === 'rose' && 'bg-pink-50 text-pink-900'}
                        ${wine.type === 'sparkling' && 'bg-emerald-50 text-emerald-900'}
                        ${wine.type === 'dessert' && 'bg-purple-50 text-purple-900'}
                    `}>
                        <div className="w-48 h-64 border-4 border-white/40 rounded-2xl flex items-center justify-center bg-white/20 backdrop-blur-sm shadow-xl">
                            <span className="text-6xl font-black opacity-30 capitalize tracking-widest -rotate-90 block">{wine.type}</span>
                        </div>
                    </div>

                    <div className="p-10 md:w-2/3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-4xl font-black text-slate-800 mb-2 leading-tight">
                                    {wine.name} {wine.vintage && <span className="text-slate-400 font-light">({wine.vintage})</span>}
                                </h1>
                                <div className="flex items-center text-slate-500 font-medium space-x-2 text-lg">
                                    <MapPin size={18} /><span>{wine.region}, {wine.country}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="flex items-center space-x-2 bg-[#0D2B4E] text-white hover:bg-[#1A4A7A] font-semibold py-3 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all"
                            >
                                <PackagePlus size={20} />
                                <span>In Voorraad</span>
                            </button>
                        </div>

                        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {wine.grape && (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <Grape className="text-[#4A9FD4] mb-2" size={24} />
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Druiven</p>
                                    <p className="font-semibold text-slate-700">{wine.grape}</p>
                                </div>
                            )}
                            {wine.abv && (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <FlaskConical className="text-[#4A9FD4] mb-2" size={24} />
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Alcohol (ABV)</p>
                                    <p className="font-semibold text-slate-700">{wine.abv}%</p>
                                </div>
                            )}
                            {wine.body && (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <Droplets className="text-[#4A9FD4] mb-2" size={24} />
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Body</p>
                                    <p className="font-semibold text-slate-700 capitalize">{wine.body}</p>
                                </div>
                            )}
                            {wine.acidity && (
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="text-[#4A9FD4] font-black text-xl mb-2">pH</div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Zuurgraad</p>
                                    <p className="font-semibold text-slate-700 capitalize">{wine.acidity}</p>
                                </div>
                            )}
                        </div>

                        {(wine.elaborate || parsedHarmonize.length > 0 || wine.winery) && (
                            <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                                {wine.elaborate && (
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-2">Omschrijving / Elaboratie</h3>
                                        <p className="text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100">{wine.elaborate}</p>
                                    </div>
                                )}

                                {parsedHarmonize.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-3">Harmonieert goed met</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {parsedHarmonize.map((item, i) => (
                                                <span key={i} className="bg-white border border-[#4A9FD4]/30 text-[#1A4A7A] px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(wine.winery || wine.website) && (
                                    <div className="flex items-center justify-between bg-slate-800 text-white p-5 rounded-2xl mt-4">
                                        <div>
                                            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Wijnhuis</p>
                                            <p className="text-xl font-bold">{wine.winery || 'Onbekend'}</p>
                                        </div>
                                        {wine.website && (
                                            <a href={wine.website} target="_blank" rel="noreferrer" className="flex items-center text-[#4A9FD4] hover:text-white transition-colors">
                                                <Globe size={20} className="mr-2" /> <span className="font-medium">Bezoek Website</span>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AddToStockModal
                wine={wine}
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={() => {
                    toast.success(`${wine.name} toegevoegd aan je voorraad!`);
                    setAddModalOpen(false);
                    navigate('/wines');
                }}
            />
        </div>
    );
};

export default CatalogDetail;
