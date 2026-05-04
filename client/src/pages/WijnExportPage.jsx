import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import {
    DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Plus, Trash2, GripVertical, ChevronDown, ChevronRight, FileDown, Save, FilePlus2,
    FolderTree, X, RefreshCcw, Eye,
} from 'lucide-react';

const RULE_FIELDS = [
    { value: 'type', label: 'Type' },
    { value: 'country', label: 'Land' },
    { value: 'region', label: 'Regio' },
    { value: 'subregion', label: 'Subregio' },
    { value: 'grape', label: 'Druif' },
    { value: 'winery', label: 'Wijnhuis' },
    { value: 'vintage', label: 'Jaargang' },
    { value: 'sell_price', label: 'Verkoopprijs' },
    { value: 'name', label: 'Naam' },
];

const RULE_OPS = [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is niet' },
    { value: 'contains', label: 'bevat' },
    { value: 'in', label: 'in lijst' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
];

const SORT_OPTIONS = [
    { value: 'name-asc', label: 'Naam A→Z' },
    { value: 'name-desc', label: 'Naam Z→A' },
    { value: 'price-asc', label: 'Prijs ↑' },
    { value: 'price-desc', label: 'Prijs ↓' },
    { value: 'vintage-asc', label: 'Jaar ↑' },
    { value: 'vintage-desc', label: 'Jaar ↓' },
];

const TYPE_OPTIONS = ['red', 'white', 'rose', 'sparkling', 'dessert'];
const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bubbels', dessert: 'Dessert' };

const WINE_TOKENS = [
    { key: 'name', label: 'Naam' },
    { key: 'vintage', label: 'Jaargang' },
    { key: 'winery', label: 'Wijnhuis' },
    { key: 'region', label: 'Regio' },
    { key: 'subregion', label: 'Subregio' },
    { key: 'country', label: 'Land' },
    { key: 'grape', label: 'Druif' },
    { key: 'type', label: 'Type' },
];

const PRICE_TOKENS = [
    { key: 'sell_price', label: 'Fles € 25,00' },
    { key: 'sell_price_glass', label: 'Glas € 5,00' },
    { key: 'price', label: 'Fles 25,00' },
    { key: 'price_glass', label: 'Glas 5,00' },
];

const fmtEur = (v) => v != null ? `€ ${Number(v).toFixed(2)}` : '';
const fmtNum = (v) => v != null ? Number(v).toFixed(2).replace('.', ',') : '';

const TOKEN_RESOLVERS = {
    name:             w => w.name,
    vintage:          w => w.vintage,
    winery:           w => w.winery,
    region:           w => w.region,
    subregion:        w => w.subregion,
    country:          w => w.country,
    grape:            w => w.grape,
    type:             w => TYPE_LABELS[w.type] || w.type,
    sell_price:       w => fmtEur(w.sell_price),
    sell_price_glass: w => fmtEur(w.sell_price_glass),
    price:            w => fmtNum(w.sell_price),
    price_glass:      w => fmtNum(w.sell_price_glass),
};

const SEP_CLASS = '[\\s\\-\\/\\|\\*·•+]';
const formatTemplate = (template, wine) => {
    if (!template) return '';
    let out = template.replace(/\[(\w+)\]/g, (_, key) => {
        const fn = TOKEN_RESOLVERS[key];
        if (!fn) return '';
        const v = fn(wine);
        return v === null || v === undefined || v === '' ? '' : String(v);
    });
    // Drop separators around dropped tokens (consecutive separators collapse to one space).
    out = out.replace(new RegExp(`(${SEP_CLASS})+(?=$|${SEP_CLASS})`, 'g'), '');
    out = out.replace(new RegExp(`^${SEP_CLASS}+|${SEP_CLASS}+$`, 'g'), '');
    return out.replace(/\s+/g, ' ').trim();
};

const uid = () => Math.random().toString(36).slice(2, 11);

const newGroup = (name = 'Nieuwe groep') => ({
    id: uid(), name, rules: [], sort: 'name-asc', children: [],
});

// ────────────────────────────────────────────────────────────────────────────
// Recursive update / delete helpers (immutable)
const mapTree = (groups, fn, depth = 0) =>
    groups.map(g => {
        const updated = fn(g, depth);
        if (updated.children) updated.children = mapTree(updated.children, fn, depth + 1);
        return updated;
    });

const updateGroup = (groups, id, updater) =>
    groups.map(g => {
        if (g.id === id) return updater(g);
        return { ...g, children: updateGroup(g.children, id, updater) };
    });

const deleteGroup = (groups, id) =>
    groups.filter(g => g.id !== id).map(g => ({ ...g, children: deleteGroup(g.children, id) }));

const addChildGroup = (groups, parentId, child) =>
    groups.map(g => {
        if (g.id === parentId) return { ...g, children: [...g.children, child] };
        return { ...g, children: addChildGroup(g.children, parentId, child) };
    });

const reorderSiblings = (groups, parentId, oldIndex, newIndex) => {
    if (parentId === null) return arrayMove(groups, oldIndex, newIndex);
    return groups.map(g => {
        if (g.id === parentId) return { ...g, children: arrayMove(g.children, oldIndex, newIndex) };
        return { ...g, children: reorderSiblings(g.children, parentId, oldIndex, newIndex) };
    });
};

// ────────────────────────────────────────────────────────────────────────────

const RuleEditor = ({ rule, onChange, onDelete }) => {
    const fieldDef = RULE_FIELDS.find(f => f.value === rule.field);
    const isType = rule.field === 'type';
    const isNumeric = rule.field === 'vintage' || rule.field === 'sell_price';

    const optStyle = { background: '#1B4332', color: 'white' };

    return (
        <div className="flex flex-wrap items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs">
            <select
                value={rule.field}
                onChange={e => onChange({ ...rule, field: e.target.value, value: '' })}
                className="bg-white/10 border border-white/15 rounded px-1.5 py-1 text-white outline-none"
            >
                {RULE_FIELDS.map(f => <option key={f.value} value={f.value} style={optStyle}>{f.label}</option>)}
            </select>
            <select
                value={rule.op}
                onChange={e => onChange({ ...rule, op: e.target.value })}
                className="bg-white/10 border border-white/15 rounded px-1.5 py-1 text-white outline-none"
            >
                {RULE_OPS.map(op => <option key={op.value} value={op.value} style={optStyle}>{op.label}</option>)}
            </select>
            {isType ? (
                <select
                    value={rule.value || ''}
                    onChange={e => onChange({ ...rule, value: e.target.value })}
                    className="bg-white/10 border border-white/15 rounded px-1.5 py-1 text-white outline-none"
                >
                    <option value="" style={optStyle}>—</option>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t} style={optStyle}>{TYPE_LABELS[t]}</option>)}
                </select>
            ) : (
                <input
                    type={isNumeric ? 'number' : 'text'}
                    value={rule.value ?? ''}
                    onChange={e => onChange({ ...rule, value: e.target.value })}
                    placeholder={rule.op === 'in' ? 'a, b, c' : `${fieldDef?.label || ''}…`}
                    className="bg-white/10 border border-white/15 rounded px-1.5 py-1 text-white outline-none w-32"
                />
            )}
            <button onClick={onDelete} className="p-1 text-white/40 hover:text-red-400 transition-colors">
                <X size={13} />
            </button>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────

const GroupCard = ({ group, depth, parentId, onUpdate, onDelete, onAddChild, previewCount }) => {
    const [open, setOpen] = useState(true);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: group.id,
        data: { parentId },
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const updateRule = (idx, newRule) => {
        const rules = [...group.rules];
        rules[idx] = newRule;
        onUpdate({ ...group, rules });
    };
    const removeRule = (idx) => onUpdate({ ...group, rules: group.rules.filter((_, i) => i !== idx) });
    const addRule = () => onUpdate({ ...group, rules: [...group.rules, { field: 'type', op: 'equals', value: '' }] });

    const indent = depth * 16;

    return (
        <div ref={setNodeRef} style={{ ...style, marginLeft: indent }} className="mb-2">
            <div className="glass-sm rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-2 bg-white/5">
                    <button
                        {...attributes} {...listeners}
                        className="text-white/40 hover:text-white cursor-grab active:cursor-grabbing"
                        title="Versleep"
                    >
                        <GripVertical size={16} />
                    </button>
                    <button onClick={() => setOpen(o => !o)} className="text-white/50 hover:text-white">
                        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <input
                        value={group.name}
                        onChange={e => onUpdate({ ...group, name: e.target.value })}
                        className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-[#C4758A] outline-none text-white font-semibold flex-1 min-w-0 px-1 py-0.5 text-sm"
                    />
                    {previewCount !== undefined && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                            {previewCount} wijn{previewCount === 1 ? '' : 'en'}
                        </span>
                    )}
                    <select
                        value={group.sort}
                        onChange={e => onUpdate({ ...group, sort: e.target.value })}
                        className="shrink-0 bg-white/10 border border-white/15 rounded px-1.5 py-1 text-white text-xs outline-none"
                        title="Sortering"
                    >
                        {SORT_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ background: '#1B4332', color: 'white' }}>{s.label}</option>)}
                    </select>
                    <button
                        onClick={() => onAddChild(group.id)}
                        title="Subgroep toevoegen"
                        className="shrink-0 p-1.5 text-white/50 hover:text-[#C4758A] transition-colors"
                    >
                        <FolderTree size={15} />
                    </button>
                    <button
                        onClick={() => onDelete(group.id)}
                        title="Verwijder groep"
                        className="shrink-0 p-1.5 text-white/40 hover:text-red-400 transition-colors"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>

                {open && (
                    <div className="p-2.5 space-y-2">
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {group.rules.length === 0 && (
                                <span className="text-xs text-white/30 italic">Geen regels — bevat alle resterende wijnen.</span>
                            )}
                            {group.rules.map((r, i) => (
                                <RuleEditor key={i} rule={r} onChange={nr => updateRule(i, nr)} onDelete={() => removeRule(i)} />
                            ))}
                            <button
                                onClick={addRule}
                                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <Plus size={11} /> regel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────

const SortableLevel = ({ groups, parentId, depth, onUpdate, onDelete, onAddChild, previewMap, onReorder }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const handleDragEnd = (e) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldIndex = groups.findIndex(g => g.id === active.id);
        const newIndex = groups.findIndex(g => g.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onReorder(parentId, oldIndex, newIndex);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                {groups.map(g => (
                    <div key={g.id}>
                        <GroupCard
                            group={g}
                            depth={depth}
                            parentId={parentId}
                            onUpdate={(ng) => onUpdate(g.id, () => ng)}
                            onDelete={onDelete}
                            onAddChild={onAddChild}
                            previewCount={previewMap?.[g.id]}
                        />
                        {g.children.length > 0 && (
                            <SortableLevel
                                groups={g.children}
                                parentId={g.id}
                                depth={depth + 1}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onAddChild={onAddChild}
                                previewMap={previewMap}
                                onReorder={onReorder}
                            />
                        )}
                    </div>
                ))}
            </SortableContext>
        </DndContext>
    );
};

// ────────────────────────────────────────────────────────────────────────────

const PreviewTree = ({ tree, depth = 0, wineFormat, priceFormat, iconAssignments, onToggleIcon, iconLookup }) => {
    if (!tree || tree.length === 0) return <p className="text-white/30 italic text-sm">Geen groepen.</p>;
    return (
        <div className="space-y-2">
            {tree.map(node => (
                <div key={node.id} style={{ marginLeft: depth * 12 }}>
                    <p className="font-bold text-white text-sm border-b border-white/10 pb-1 mb-1">
                        {node.name} <span className="text-white/30 font-normal text-xs">· {node.wines.length}</span>
                    </p>
                    {node.wines.length > 0 && (
                        <ul className="space-y-0.5 text-xs">
                            {node.wines.map(w => {
                                const customLine = wineFormat?.trim() ? formatTemplate(wineFormat, w) : null;
                                const customPrice = priceFormat?.trim() ? formatTemplate(priceFormat, w) : null;
                                const assignedIconId = iconAssignments?.[w.id];
                                const assignedIcon = assignedIconId && iconLookup ? iconLookup[assignedIconId] : null;
                                return (
                                    <li key={w.id} className="flex items-center gap-2 text-white/70">
                                        <input type="checkbox"
                                            checked={!!assignedIconId}
                                            onChange={() => onToggleIcon?.(w.id)}
                                            title="Icoon koppelen"
                                            className="shrink-0 accent-[#7B2D3A]" />
                                        {assignedIcon && (
                                            <img src={assignedIcon.data_url} alt="" className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        <span className="truncate flex-1">
                                            {customLine || (
                                                <>
                                                    {w.name}{w.vintage ? ` (${w.vintage})` : ''}
                                                    {w.winery && <span className="text-white/30"> · {w.winery}</span>}
                                                </>
                                            )}
                                        </span>
                                        <span className="shrink-0 text-white/50 font-medium">
                                            {customPrice ?? (w.sell_price != null ? `€ ${Number(w.sell_price).toFixed(2)}` : '—')}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {node.children.length > 0 && <PreviewTree tree={node.children} depth={depth + 1} wineFormat={wineFormat} priceFormat={priceFormat} iconAssignments={iconAssignments} onToggleIcon={onToggleIcon} iconLookup={iconLookup} />}
                </div>
            ))}
        </div>
    );
};

// ────────────────────────────────────────────────────────────────────────────

const WijnExportPage = () => {
    const [templates, setTemplates] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('Mijn wijnkaart');
    const [title, setTitle] = useState('Wijnkaart');
    const [groups, setGroups] = useState([
        { ...newGroup('Rode wijnen'), rules: [{ field: 'type', op: 'equals', value: 'red' }] },
        { ...newGroup('Witte wijnen'), rules: [{ field: 'type', op: 'equals', value: 'white' }] },
    ]);
    const [wineFormat, setWineFormat] = useState('[name] · [region] · [grape]');
    const [priceFormat, setPriceFormat] = useState('[sell_price] / [sell_price_glass]');
    const [iconAssignments, setIconAssignments] = useState({}); // { [wineId]: iconId }
    const [activeIconId, setActiveIconId] = useState('');
    const [companyIcons, setCompanyIcons] = useState([]);
    const [previewTree, setPreviewTree] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const structure = useMemo(
        () => ({ groups, wineFormat, priceFormat, iconAssignments }),
        [groups, wineFormat, priceFormat, iconAssignments]
    );

    const fetchTemplates = useCallback(async () => {
        try {
            const { data } = await api.get('/wine-export/templates');
            setTemplates(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    useEffect(() => {
        api.get('/account/me').then(({ data }) => {
            const list = data.company?.icons || [];
            setCompanyIcons(list);
            if (!activeIconId && list[0]) setActiveIconId(list[0].id);
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshPreview = useCallback(async () => {
        setPreviewLoading(true);
        try {
            const { data } = await api.post('/wine-export/preview', { structure });
            setPreviewTree(data.tree);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Preview mislukt');
        } finally {
            setPreviewLoading(false);
        }
    }, [structure]);

    useEffect(() => {
        const handle = setTimeout(refreshPreview, 400);
        return () => clearTimeout(handle);
    }, [structure, refreshPreview]);

    // Periodic auto-refresh so de preview meebeweegt met voorraad-wijzigingen elders.
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') refreshPreview();
        }, 30000);
        return () => clearInterval(interval);
    }, [refreshPreview]);

    const previewMap = useMemo(() => {
        const map = {};
        const walk = (nodes) => {
            for (const n of nodes) {
                let total = n.wines.length;
                const childWalk = (cs) => { for (const c of cs) { total += c.wines.length; childWalk(c.children); } };
                childWalk(n.children);
                map[n.id] = total;
                walk(n.children);
            }
        };
        if (previewTree) walk(previewTree);
        return map;
    }, [previewTree]);

    const handleUpdate = (id, updater) => setGroups(g => updateGroup(g, id, updater));
    const handleDelete = (id) => setGroups(g => deleteGroup(g, id));
    const handleAddChild = (parentId) => setGroups(g => addChildGroup(g, parentId, newGroup('Subgroep')));
    const handleAddRoot = () => setGroups(g => [...g, newGroup()]);
    const handleReorder = (parentId, oldIndex, newIndex) => setGroups(g => reorderSiblings(g, parentId, oldIndex, newIndex));

    const loadTemplate = async (id) => {
        try {
            const { data } = await api.get(`/wine-export/templates/${id}`);
            setActiveId(data.id);
            setName(data.name);
            setTitle(data.title || 'Wijnkaart');
            setGroups(data.structure?.groups || []);
            setWineFormat(data.structure?.wineFormat ?? '[name] · [region] · [grape]');
            setPriceFormat(data.structure?.priceFormat ?? '[sell_price] / [sell_price_glass]');
            setIconAssignments(data.structure?.iconAssignments || {});
            toast.success('Template geladen');
        } catch { toast.error('Kan template niet laden'); }
    };

    const saveTemplate = async () => {
        try {
            const payload = { name, title, structure };
            if (activeId) {
                await api.put(`/wine-export/templates/${activeId}`, payload);
                toast.success('Template opgeslagen');
            } else {
                const { data } = await api.post('/wine-export/templates', payload);
                setActiveId(data.id);
                toast.success('Template aangemaakt');
            }
            fetchTemplates();
        } catch (err) { toast.error(err.response?.data?.error || 'Opslaan mislukt'); }
    };

    const newTemplate = () => {
        setActiveId(null);
        setName('Nieuwe wijnkaart');
        setTitle('Wijnkaart');
        setGroups([newGroup('Rode wijnen')]);
        setWineFormat('[name] · [region] · [grape]');
        setPriceFormat('[sell_price] / [sell_price_glass]');
        setIconAssignments({});
    };

    const toggleWineIcon = (wineId) => {
        if (!activeIconId) return;
        setIconAssignments(prev => {
            const next = { ...prev };
            if (next[wineId] === activeIconId) delete next[wineId];
            else next[wineId] = activeIconId;
            return next;
        });
    };

    const deleteTemplate = async () => {
        if (!activeId) return;
        if (!window.confirm('Verwijder deze template?')) return;
        try {
            await api.delete(`/wine-export/templates/${activeId}`);
            toast.success('Verwijderd');
            newTemplate();
            fetchTemplates();
        } catch { toast.error('Verwijderen mislukt'); }
    };

    const downloadPdf = async () => {
        const toastId = toast.loading('PDF wordt gegenereerd...');
        try {
            const response = await api.post('/wine-export/pdf', { structure, title }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${(title || 'wijnkaart').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF gedownload', { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.error || 'PDF mislukt', { id: toastId });
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Wijnkaart Export</h1>
                    <p className="text-white/50">Bouw groepen met regels en sleep ze op de gewenste volgorde.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={newTemplate} className="glass border border-white/20 text-white hover:bg-white/10 transition-colors font-semibold py-2 px-3 rounded-xl flex items-center gap-2 text-sm">
                        <FilePlus2 size={15} /> Nieuw
                    </button>
                    <button onClick={saveTemplate} className="glass border border-white/20 text-white hover:bg-white/10 transition-colors font-semibold py-2 px-3 rounded-xl flex items-center gap-2 text-sm">
                        <Save size={15} /> Opslaan
                    </button>
                    {activeId && (
                        <button onClick={deleteTemplate} className="border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors font-semibold py-2 px-3 rounded-xl flex items-center gap-2 text-sm">
                            <Trash2 size={15} />
                        </button>
                    )}
                    <button onClick={downloadPdf} className="bg-[#7B2D3A] hover:bg-[#6A2433] text-white font-semibold py-2 px-4 rounded-xl flex items-center gap-2 border border-white/10 shadow-lg transition-colors text-sm">
                        <FileDown size={16} /> PDF
                    </button>
                </div>
            </div>

            <div className="glass rounded-2xl shadow-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1 block">Template</label>
                    <select
                        value={activeId || ''}
                        onChange={e => e.target.value ? loadTemplate(e.target.value) : newTemplate()}
                        className="select-glass text-sm"
                    >
                        <option value="">— Nieuw —</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1 block">Naam (intern)</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="input-glass text-sm" />
                </div>
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1 block">Titel op PDF</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className="input-glass text-sm" />
                </div>
            </div>

            <div className="glass rounded-2xl shadow-xl p-4 grid gap-4 md:grid-cols-2">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">Wijn-notatie per regel</label>
                    <input
                        value={wineFormat}
                        onChange={e => setWineFormat(e.target.value)}
                        placeholder="bv. [name] [region] [grape]"
                        className="input-glass text-sm font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {WINE_TOKENS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setWineFormat(f => `${f}${f && !f.endsWith(' ') ? ' ' : ''}[${t.key}]`)}
                                className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-colors font-mono"
                                title={t.label}
                            >
                                [{t.key}]
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">Prijs-notatie</label>
                    <input
                        value={priceFormat}
                        onChange={e => setPriceFormat(e.target.value)}
                        placeholder="bv. [sell_price] / [sell_price_glass]"
                        className="input-glass text-sm font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {PRICE_TOKENS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setPriceFormat(f => `${f}${f && !f.endsWith(' ') ? ' ' : ''}[${t.key}]`)}
                                className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/15 text-white/70 hover:bg-white/10 hover:text-white transition-colors font-mono"
                                title={t.label}
                            >
                                [{t.key}]
                            </button>
                        ))}
                        {['/', '|', '-', '·', '*'].map(s => (
                            <button
                                key={s}
                                onClick={() => setPriceFormat(f => `${f}${f && !f.endsWith(' ') ? ' ' : ''}${s} `)}
                                className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/15 text-white/50 hover:bg-white/10 hover:text-white transition-colors font-mono"
                                title={`Scheidingsteken ${s}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-2">
                    <p className="text-[11px] text-white/30">
                        Tokens worden bij export vervangen door wijnwaarden. Lege velden worden weggelaten — separator-tekens (-, /, |, *, ·) eromheen worden netjes opgeschoond.
                    </p>
                </div>

                <div className="md:col-span-2 pt-3 border-t border-white/10">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 block">Icoon</label>
                    {companyIcons.length === 0 ? (
                        <p className="text-[11px] text-white/40">Nog geen iconen geüpload — voeg ze toe via <strong>Account → Wijnkaart-stijl</strong>.</p>
                    ) : (
                        <div className="flex items-center gap-3 flex-wrap">
                            <select
                                value={activeIconId}
                                onChange={e => setActiveIconId(e.target.value)}
                                className="select-glass text-sm w-auto min-w-[160px]"
                            >
                                {companyIcons.map(ic => <option key={ic.id} value={ic.id}>{ic.name}</option>)}
                            </select>
                            {activeIconId && (() => {
                                const ic = companyIcons.find(i => i.id === activeIconId);
                                if (!ic) return null;
                                return (
                                    <div className="flex items-center gap-2 text-xs text-white/50">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden">
                                            <img src={ic.data_url} alt={ic.name} className="max-w-full max-h-full" />
                                        </div>
                                        <span>{ic.position?.h === 'right' ? 'Rechts' : 'Links'} · {({ top: 'Hoog', middle: 'Midden', bottom: 'Laag' })[ic.position?.v || 'middle']}</span>
                                    </div>
                                );
                            })()}
                            <span className="text-[11px] text-white/40 ml-auto">
                                {Object.keys(iconAssignments).length} wijn{Object.keys(iconAssignments).length === 1 ? '' : 'en'} aangevinkt
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Editor */}
                <div className="lg:col-span-3 glass rounded-2xl shadow-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><FolderTree size={18} /> Structuur</h2>
                        <button onClick={handleAddRoot} className="text-sm flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white hover:bg-white/10 transition-colors">
                            <Plus size={14} /> Groep
                        </button>
                    </div>
                    {groups.length === 0 ? (
                        <p className="text-white/30 italic text-sm py-8 text-center">Nog geen groepen — klik <strong>Groep</strong> om te starten.</p>
                    ) : (
                        <SortableLevel
                            groups={groups}
                            parentId={null}
                            depth={0}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onAddChild={handleAddChild}
                            previewMap={previewMap}
                            onReorder={handleReorder}
                        />
                    )}
                </div>

                {/* Preview */}
                <div className="lg:col-span-2 glass rounded-2xl shadow-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><Eye size={18} /> Preview</h2>
                        <button onClick={refreshPreview} disabled={previewLoading} className="text-white/50 hover:text-white transition-colors disabled:opacity-50">
                            <RefreshCcw size={15} className={previewLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    {previewLoading && !previewTree ? (
                        <div className="text-center py-8"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" /></div>
                    ) : (
                        <PreviewTree
                            tree={previewTree || []}
                            wineFormat={wineFormat}
                            priceFormat={priceFormat}
                            iconAssignments={iconAssignments}
                            onToggleIcon={toggleWineIcon}
                            iconLookup={Object.fromEntries(companyIcons.map(i => [i.id, i]))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default WijnExportPage;
