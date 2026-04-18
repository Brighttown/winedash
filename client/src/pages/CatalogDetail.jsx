import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { ArrowLeft, PackagePlus, Globe, Grape, MapPin, Droplets, FlaskConical } from 'lucide-react';
import AddToStockModal from '../components/AddToStockModal';

const TYPE_TINT = {
    red:      'bg-red-500/20 border-red-500/20',
    white:    'bg-amber-500/20 border-amber-500/20',
    rose:     'bg-pink-500/20 border-pink-500/20',
    sparkling:'bg-emerald-500/20 border-emerald-500/20',
    dessert:  'bg-purple-500/20 border-purple-500/20',
};

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

    if (loading) return (
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
    );
    if (!wine) return null;

    let parsedHarmonize = [];
    try {
        if (wine.harmonize) parsedHarmonize = wine.harmonize.split(',').map(s => s.trim());
    } catch (e) {}

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <Link to="/catalog" className="inline-flex items-center text-white/50 hover:text-white transition-colors font-medium">
                <ArrowLeft size={18} className="mr-2" /> Terug naar Wijn Database
            </Link>

            <div className="glass rounded-3xl shadow-2xl overflow-hidden">
                <div className="md:flex">
                    {/* Wine type panel */}
                    <div className={`md:w-1/3 p-10 flex flex-col justify-center items-center relative border-r border-white/10 ${TYPE_TINT[wine.type] || 'bg-white/5'}`}>
                        <div className="w-48 h-64 border border-white/20 rounded-2xl flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl">
                            <span className="text-6xl font-black opacity-20 capitalize tracking-widest -rotate-90 block text-white">{wine.type}</span>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="p-8 md:p-10 md:w-2/3">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
                                    {wine.name} {wine.vintage && <span className="text-white/30 font-light">({wine.vintage})</span>}
                                </h1>
                                <div className="flex items-center text-white/50 font-medium space-x-2 text-lg">
                                    <MapPin size={18} /><span>{wine.region}, {wine.country}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="flex items-center gap-2 bg-[#7B2D3A] text-white hover:bg-[#6A2433] font-semibold py-3 px-5 rounded-2xl shadow-lg transition-all border border-white/10 shrink-0"
                            >
                                <PackagePlus size={20} />
                                <span>In Voorraad</span>
                            </button>
                        </div>

                        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {wine.grape && (
                                <div className="glass-sm p-4 rounded-2xl">
                                    <Grape className="text-[#C4758A] mb-2" size={24} />
                                    <p className="text-xs text-white/30 font-bold uppercase tracking-wider mb-1">Druiven</p>
                                    <p className="font-semibold text-white">{wine.grape}</p>
                                </div>
                            )}
                            {wine.abv && (
                                <div className="glass-sm p-4 rounded-2xl">
                                    <FlaskConical className="text-[#C4758A] mb-2" size={24} />
                                    <p className="text-xs text-white/30 font-bold uppercase tracking-wider mb-1">Alcohol</p>
                                    <p className="font-semibold text-white">{wine.abv}%</p>
                                </div>
                            )}
                            {wine.body && (
                                <div className="glass-sm p-4 rounded-2xl">
                                    <Droplets className="text-[#C4758A] mb-2" size={24} />
                                    <p className="text-xs text-white/30 font-bold uppercase tracking-wider mb-1">Body</p>
                                    <p className="font-semibold text-white capitalize">{wine.body}</p>
                                </div>
                            )}
                            {wine.acidity && (
                                <div className="glass-sm p-4 rounded-2xl">
                                    <div className="text-[#C4758A] font-black text-xl mb-2">pH</div>
                                    <p className="text-xs text-white/30 font-bold uppercase tracking-wider mb-1">Zuurgraad</p>
                                    <p className="font-semibold text-white capitalize">{wine.acidity}</p>
                                </div>
                            )}
                        </div>

                        {(wine.elaborate || parsedHarmonize.length > 0 || wine.winery) && (
                            <div className="mt-8 pt-8 border-t border-white/10 space-y-6">
                                {wine.elaborate && (
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2">Omschrijving</h3>
                                        <p className="text-white/60 leading-relaxed glass-sm p-5 rounded-2xl">{wine.elaborate}</p>
                                    </div>
                                )}
                                {parsedHarmonize.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-3">Harmonieert goed met</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {parsedHarmonize.map((item, i) => (
                                                <span key={i} className="glass-sm border border-[#C4758A]/30 text-white/80 px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {(wine.winery || wine.website) && (
                                    <div className="flex items-center justify-between glass-sm p-5 rounded-2xl">
                                        <div>
                                            <p className="text-white/30 text-sm font-semibold uppercase tracking-wider">Wijnhuis</p>
                                            <p className="text-xl font-bold text-white">{wine.winery || 'Onbekend'}</p>
                                        </div>
                                        {wine.website && (
                                            <a href={wine.website} target="_blank" rel="noreferrer" className="flex items-center text-[#C4758A] hover:text-white transition-colors">
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
