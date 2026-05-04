import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { User, Building2, Plug, Plus, Trash2, X, Check, KeyRound, Loader2, Type } from 'lucide-react';
import {
    getMe, updateProfile, updatePassword, updateCompany,
    listIntegrations, createIntegration, deleteIntegration, updateIntegration,
} from '../api/account';

const PROVIDERS = [
    { value: 'lightspeed', label: 'Lightspeed' },
    { value: 'untill',     label: 'Untill' },
    { value: 'square',     label: 'Square' },
    { value: 'other',      label: 'Anders' },
];

const Section = ({ icon: Icon, title, subtitle, children }) => (
    <div className="glass rounded-2xl p-6 mb-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#7B2D3A]/40 border border-[#C4758A]/30 flex items-center justify-center">
                <Icon size={18} className="text-[#C4758A]" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>{title}</h2>
                {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
            </div>
        </div>
        {children}
    </div>
);

const Field = ({ label, children }) => (
    <label className="block">
        <span className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5">{label}</span>
        {children}
    </label>
);

const Account = () => {
    const [loading, setLoading] = useState(true);
    const [me, setMe] = useState(null);
    const [company, setCompany] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingCompany, setSavingCompany] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    const [profile, setProfile] = useState({ name: '', email: '' });
    const [companyForm, setCompanyForm] = useState({ name: '', logo_url: '', primary_color: '', secondary_color: '' });
    const [pwd, setPwd] = useState({ current_password: '', new_password: '' });

    const DEFAULT_MENU_STYLE = {
        heading: { font: 'Helvetica', size: 18, weight: 'bold' },
        body:    { font: 'Helvetica', size: 11,   weight: 'normal' },
    };
    const [menuStyle, setMenuStyle] = useState(DEFAULT_MENU_STYLE);
    const [savingMenuStyle, setSavingMenuStyle] = useState(false);

    const [icons, setIcons] = useState([]);
    const [savingIcons, setSavingIcons] = useState(false);

    const refresh = async () => {
        try {
            const [meRes, intRes] = await Promise.all([getMe(), listIntegrations()]);
            setMe(meRes.user);
            setCompany(meRes.company);
            setProfile({ name: meRes.user.name || '', email: meRes.user.email || '' });
            setCompanyForm({
                name: meRes.company?.name || '',
                logo_url: meRes.company?.logo_url || '',
                primary_color: meRes.company?.primary_color || '',
                secondary_color: meRes.company?.secondary_color || '',
            });
            const ms = meRes.company?.menu_style || {};
            setMenuStyle({
                heading: { ...DEFAULT_MENU_STYLE.heading, ...(ms.heading || {}) },
                body:    { ...DEFAULT_MENU_STYLE.body,    ...(ms.body    || {}) },
            });
            setIcons(meRes.company?.icons || []);
            setIntegrations(intRes);
        } catch (e) {
            toast.error('Kon account niet laden');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    const onSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const u = await updateProfile(profile);
            toast.success('Profiel opgeslagen');
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...stored, name: u.name, email: u.email }));
            setMe(u);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Opslaan mislukt');
        } finally { setSavingProfile(false); }
    };

    const onSaveCompany = async (e) => {
        e.preventDefault();
        setSavingCompany(true);
        try {
            const c = await updateCompany(companyForm);
            toast.success('Bedrijfsgegevens opgeslagen');
            setCompany(c);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Opslaan mislukt');
        } finally { setSavingCompany(false); }
    };

    const onUploadIcon = async (file) => {
        if (!file) return;
        if (file.size > 200_000) return toast.error('Bestand te groot (max 200KB)');
        if (!/^image\/(svg\+xml|png|jpeg|jpg|gif)$/i.test(file.type)) {
            return toast.error('Alleen SVG, PNG, JPG of GIF');
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const newIcons = [...icons, {
                id: Math.random().toString(36).slice(2, 11),
                name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'icoon',
                mime: file.type,
                data_url: reader.result,
                position: { h: 'left', v: 'middle' },
            }];
            setIcons(newIcons);
            await persistIcons(newIcons);
        };
        reader.readAsDataURL(file);
    };

    const persistIcons = async (next) => {
        setSavingIcons(true);
        try {
            const c = await updateCompany({ icons: next });
            setCompany(c);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Iconen opslaan mislukt');
        } finally { setSavingIcons(false); }
    };

    const updateIcon = (id, patch) => {
        const next = icons.map(i => i.id === id ? { ...i, ...patch, position: { ...i.position, ...(patch.position || {}) } } : i);
        setIcons(next);
        persistIcons(next);
    };

    const removeIcon = (id) => {
        if (!window.confirm('Icoon verwijderen?')) return;
        const next = icons.filter(i => i.id !== id);
        setIcons(next);
        persistIcons(next);
    };

    const onSaveMenuStyle = async (e) => {
        e.preventDefault();
        setSavingMenuStyle(true);
        try {
            const c = await updateCompany({ menu_style: menuStyle });
            toast.success('Menu-stijl opgeslagen');
            setCompany(c);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Opslaan mislukt');
        } finally { setSavingMenuStyle(false); }
    };

    const onSavePassword = async (e) => {
        e.preventDefault();
        if (pwd.new_password.length < 8) return toast.error('Nieuw wachtwoord moet ≥ 8 tekens zijn');
        setSavingPassword(true);
        try {
            await updatePassword(pwd);
            toast.success('Wachtwoord gewijzigd');
            setPwd({ current_password: '', new_password: '' });
        } catch (e) {
            toast.error(e.response?.data?.error || 'Wijzigen mislukt');
        } finally { setSavingPassword(false); }
    };

    const onDeleteIntegration = async (id) => {
        if (!window.confirm('Koppeling verwijderen?')) return;
        try {
            await deleteIntegration(id);
            setIntegrations(integrations.filter(i => i.id !== id));
            toast.success('Koppeling verwijderd');
        } catch {
            toast.error('Verwijderen mislukt');
        }
    };

    const onToggleActive = async (row) => {
        try {
            const updated = await updateIntegration(row.id, { is_active: !row.is_active });
            setIntegrations(integrations.map(i => i.id === row.id ? updated : i));
        } catch {
            toast.error('Kon status niet wijzigen');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-white/60">
                <Loader2 className="animate-spin mr-2" size={20} /> Laden…
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>Mijn account</h1>
                <p className="text-sm text-white/50 mt-1">Beheer je profiel, bedrijfsinfo en kassakoppelingen.</p>
            </div>

            {/* Profiel */}
            <Section icon={User} title="Profiel" subtitle="Persoonlijke gegevens">
                <form onSubmit={onSaveProfile} className="grid sm:grid-cols-2 gap-4">
                    <Field label="Naam">
                        <input className="input-glass" value={profile.name}
                            onChange={e => setProfile({ ...profile, name: e.target.value })} />
                    </Field>
                    <Field label="E-mail">
                        <input type="email" className="input-glass" value={profile.email}
                            onChange={e => setProfile({ ...profile, email: e.target.value })} />
                    </Field>
                    <Field label="Gebruikersnaam">
                        <input className="input-glass opacity-60" value={me?.username || ''} disabled />
                    </Field>
                    <Field label="Rol">
                        <input className="input-glass opacity-60" value={me?.role || ''} disabled />
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                        <button type="submit" disabled={savingProfile}
                            className="px-5 py-2.5 rounded-xl bg-[#7B2D3A] hover:bg-[#8c3845] text-white font-semibold text-sm shadow-lg disabled:opacity-50">
                            {savingProfile ? 'Opslaan…' : 'Profiel opslaan'}
                        </button>
                    </div>
                </form>
            </Section>

            {/* Wachtwoord */}
            <Section icon={KeyRound} title="Wachtwoord" subtitle="Wijzig je inloggegevens">
                <form onSubmit={onSavePassword} className="grid sm:grid-cols-2 gap-4">
                    <Field label="Huidig wachtwoord">
                        <input type="password" className="input-glass" autoComplete="current-password"
                            value={pwd.current_password}
                            onChange={e => setPwd({ ...pwd, current_password: e.target.value })} />
                    </Field>
                    <Field label="Nieuw wachtwoord">
                        <input type="password" className="input-glass" autoComplete="new-password"
                            value={pwd.new_password}
                            onChange={e => setPwd({ ...pwd, new_password: e.target.value })} />
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                        <button type="submit" disabled={savingPassword}
                            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm disabled:opacity-50">
                            {savingPassword ? 'Wijzigen…' : 'Wachtwoord wijzigen'}
                        </button>
                    </div>
                </form>
            </Section>

            {/* Bedrijf */}
            <Section icon={Building2} title="Bedrijf" subtitle="Bedrijfsgegevens & branding">
                <form onSubmit={onSaveCompany} className="grid sm:grid-cols-2 gap-4">
                    <Field label="Bedrijfsnaam">
                        <input className="input-glass" value={companyForm.name}
                            onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} />
                    </Field>
                    <Field label="Logo URL">
                        <input className="input-glass" placeholder="https://…" value={companyForm.logo_url}
                            onChange={e => setCompanyForm({ ...companyForm, logo_url: e.target.value })} />
                    </Field>
                    <Field label="Primaire kleur">
                        <div className="flex gap-2">
                            <input type="color" className="h-10 w-12 rounded-xl bg-transparent border border-white/20 cursor-pointer"
                                value={companyForm.primary_color || '#7B2D3A'}
                                onChange={e => setCompanyForm({ ...companyForm, primary_color: e.target.value })} />
                            <input className="input-glass flex-1" placeholder="#7B2D3A" value={companyForm.primary_color}
                                onChange={e => setCompanyForm({ ...companyForm, primary_color: e.target.value })} />
                        </div>
                    </Field>
                    <Field label="Secundaire kleur">
                        <div className="flex gap-2">
                            <input type="color" className="h-10 w-12 rounded-xl bg-transparent border border-white/20 cursor-pointer"
                                value={companyForm.secondary_color || '#C4758A'}
                                onChange={e => setCompanyForm({ ...companyForm, secondary_color: e.target.value })} />
                            <input className="input-glass flex-1" placeholder="#C4758A" value={companyForm.secondary_color}
                                onChange={e => setCompanyForm({ ...companyForm, secondary_color: e.target.value })} />
                        </div>
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                        <button type="submit" disabled={savingCompany}
                            className="px-5 py-2.5 rounded-xl bg-[#7B2D3A] hover:bg-[#8c3845] text-white font-semibold text-sm shadow-lg disabled:opacity-50">
                            {savingCompany ? 'Opslaan…' : 'Bedrijf opslaan'}
                        </button>
                    </div>
                </form>
            </Section>

            {/* Wijnkaart-stijl */}
            <Section icon={Type} title="Wijnkaart-stijl" subtitle="Lettertype en grootte voor de PDF-export">
                <form onSubmit={onSaveMenuStyle} className="space-y-5">
                    {[
                        { slot: 'heading', label: 'Kop tekst (groep-titels)' },
                        { slot: 'body',    label: 'Body tekst (wijn-regels)' },
                    ].map(({ slot, label }) => (
                        <div key={slot} className="glass-sm rounded-xl p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">{label}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field label="Lettertype">
                                    <select className="select-glass" value={menuStyle[slot].font}
                                        onChange={e => setMenuStyle(s => ({ ...s, [slot]: { ...s[slot], font: e.target.value } }))}>
                                        <option value="Helvetica">Helvetica (sans)</option>
                                        <option value="Times-Roman">Times Roman (serif)</option>
                                        <option value="Courier">Courier (mono)</option>
                                    </select>
                                </Field>
                                <Field label="Grootte (pt)">
                                    <input type="number" min="6" max="48" className="input-glass"
                                        value={menuStyle[slot].size}
                                        onChange={e => setMenuStyle(s => ({ ...s, [slot]: { ...s[slot], size: Number(e.target.value) } }))} />
                                </Field>
                                <Field label="Dikte">
                                    <select className="select-glass" value={menuStyle[slot].weight}
                                        onChange={e => setMenuStyle(s => ({ ...s, [slot]: { ...s[slot], weight: e.target.value } }))}>
                                        <option value="normal">Normaal</option>
                                        <option value="bold">Vetgedrukt</option>
                                    </select>
                                </Field>
                            </div>
                            <p className="mt-3 px-3 py-2 rounded-lg bg-black/20 border border-white/5"
                                style={{
                                    fontFamily: menuStyle[slot].font === 'Times-Roman' ? "'Times New Roman', serif"
                                              : menuStyle[slot].font === 'Courier' ? "'Courier New', monospace"
                                              : 'Helvetica, Arial, sans-serif',
                                    fontSize: `${menuStyle[slot].size}px`,
                                    fontWeight: menuStyle[slot].weight === 'bold' ? 700 : 400,
                                    color: 'white',
                                }}>
                                {slot === 'heading' ? 'Voorbeeld: Rode wijnen' : 'Voorbeeld: Château Lafite — Bordeaux — Cabernet Sauvignon'}
                            </p>
                        </div>
                    ))}
                    <div className="flex justify-end">
                        <button type="submit" disabled={savingMenuStyle}
                            className="px-5 py-2.5 rounded-xl bg-[#7B2D3A] hover:bg-[#8c3845] text-white font-semibold text-sm shadow-lg disabled:opacity-50">
                            {savingMenuStyle ? 'Opslaan…' : 'Stijl opslaan'}
                        </button>
                    </div>
                </form>

                {/* Icon library */}
                <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm font-bold text-white">Iconen</p>
                            <p className="text-xs text-white/50">SVG of PNG om naast wijnen te plaatsen (max 200KB).</p>
                        </div>
                        <label className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold cursor-pointer flex items-center gap-2">
                            <Plus size={14} /> {savingIcons ? 'Bezig…' : 'Upload'}
                            <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/gif"
                                className="hidden"
                                onChange={e => { onUploadIcon(e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                    </div>

                    {icons.length === 0 ? (
                        <p className="text-center py-6 text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
                            Nog geen iconen toegevoegd.
                        </p>
                    ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                            {icons.map(icon => (
                                <div key={icon.id} className="glass-sm rounded-xl p-3 flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                                        <img src={icon.data_url} alt={icon.name} className="max-w-full max-h-full" />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <input className="input-glass text-sm py-1.5"
                                            value={icon.name}
                                            onChange={e => setIcons(s => s.map(i => i.id === icon.id ? { ...i, name: e.target.value } : i))}
                                            onBlur={() => updateIcon(icon.id, { name: icons.find(i => i.id === icon.id).name })} />
                                        <div className="grid grid-cols-2 gap-2">
                                            <select className="select-glass text-xs py-1"
                                                value={icon.position?.h || 'left'}
                                                onChange={e => updateIcon(icon.id, { position: { h: e.target.value } })}>
                                                <option value="left">Links</option>
                                                <option value="right">Rechts</option>
                                            </select>
                                            <select className="select-glass text-xs py-1"
                                                value={icon.position?.v || 'middle'}
                                                onChange={e => updateIcon(icon.id, { position: { v: e.target.value } })}>
                                                <option value="top">Hoog</option>
                                                <option value="middle">Midden</option>
                                                <option value="bottom">Laag</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button onClick={() => removeIcon(icon.id)}
                                        className="text-white/40 hover:text-red-400 p-1 rounded">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Section>

            {/* Kassakoppelingen */}
            <Section icon={Plug} title="Kassakoppelingen" subtitle="Verbind je POS-systeem">
                <div className="space-y-2 mb-4">
                    {integrations.length === 0 && (
                        <div className="text-center py-8 text-white/40 text-sm border border-dashed border-white/10 rounded-xl">
                            Nog geen kassakoppelingen toegevoegd.
                        </div>
                    )}
                    {integrations.map(row => {
                        const provider = PROVIDERS.find(p => p.value === row.provider);
                        return (
                            <div key={row.id} className="glass-sm rounded-xl p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-[#7B2D3A]/40 border border-white/10 flex items-center justify-center shrink-0">
                                    <Plug size={16} className="text-[#C4758A]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-white truncate">{row.display_name}</p>
                                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                                            {provider?.label || row.provider}
                                        </span>
                                        {row.is_active ? (
                                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">Actief</span>
                                        ) : (
                                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">Inactief</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/40 truncate font-mono">key: {row.api_key_masked}</p>
                                </div>
                                <button onClick={() => onToggleActive(row)} title={row.is_active ? 'Deactiveren' : 'Activeren'}
                                    className="text-white/40 hover:text-white p-2 rounded-lg hover:bg-white/10">
                                    <Check size={16} />
                                </button>
                                <button onClick={() => onDeleteIntegration(row.id)} title="Verwijderen"
                                    className="text-white/40 hover:text-red-400 p-2 rounded-lg hover:bg-white/10">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button onClick={() => setShowAdd(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/20 hover:border-[#C4758A]/50 hover:bg-white/5 text-white/70 hover:text-white transition-colors text-sm font-semibold">
                    <Plus size={16} /> Koppeling toevoegen
                </button>
            </Section>

            {showAdd && (
                <AddIntegrationModal
                    onClose={() => setShowAdd(false)}
                    onCreated={(row) => { setIntegrations([row, ...integrations]); setShowAdd(false); }}
                />
            )}
        </div>
    );
};

const AddIntegrationModal = ({ onClose, onCreated }) => {
    const [form, setForm] = useState({
        provider: 'lightspeed',
        display_name: '',
        api_key: '',
        api_secret: '',
        location_id: '',
    });
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.display_name.trim() || !form.api_key.trim()) {
            return toast.error('Naam en API-sleutel zijn verplicht');
        }
        setSaving(true);
        try {
            const row = await createIntegration({
                ...form,
                api_secret: form.api_secret || null,
                location_id: form.location_id || null,
            });
            toast.success('Koppeling toegevoegd');
            onCreated(row);
        } catch (e) {
            toast.error(e.response?.data?.error || 'Toevoegen mislukt');
        } finally { setSaving(false); }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-md pointer-events-auto animate-slide-up">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Inria Serif', serif" }}>Kassakoppeling toevoegen</h3>
                        <button type="button" onClick={onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <Field label="Kassasysteem">
                            <select className="select-glass" value={form.provider}
                                onChange={e => setForm({ ...form, provider: e.target.value })}>
                                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Naam (eigen referentie)">
                            <input className="input-glass" placeholder="bv. Hoofdvestiging Amsterdam"
                                value={form.display_name}
                                onChange={e => setForm({ ...form, display_name: e.target.value })} />
                        </Field>
                        <Field label="API-sleutel">
                            <input className="input-glass" type="password" autoComplete="off"
                                value={form.api_key}
                                onChange={e => setForm({ ...form, api_key: e.target.value })} />
                        </Field>
                        <Field label="API-secret (optioneel)">
                            <input className="input-glass" type="password" autoComplete="off"
                                value={form.api_secret}
                                onChange={e => setForm({ ...form, api_secret: e.target.value })} />
                        </Field>
                        <Field label="Locatie-ID (optioneel)">
                            <input className="input-glass" value={form.location_id}
                                onChange={e => setForm({ ...form, location_id: e.target.value })} />
                        </Field>
                        <p className="text-[11px] text-white/40 leading-relaxed">
                            Credentials worden versleuteld opgeslagen. De daadwerkelijke synchronisatie met je kassa volgt in een latere update.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 text-sm">
                            Annuleren
                        </button>
                        <button type="submit" disabled={saving}
                            className="px-5 py-2 rounded-xl bg-[#7B2D3A] hover:bg-[#8c3845] text-white font-semibold text-sm shadow-lg disabled:opacity-50">
                            {saving ? 'Opslaan…' : 'Toevoegen'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default Account;
