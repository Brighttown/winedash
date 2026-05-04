// Engine voor wijn-export: regels evalueren, groepen opbouwen, sorteren.

const RULE_FIELDS = ['type', 'country', 'region', 'subregion', 'grape', 'winery', 'vintage', 'sell_price', 'name'];
const RULE_OPS = ['equals', 'not_equals', 'contains', 'in', 'gte', 'lte'];
const SORT_OPTIONS = ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'vintage-asc', 'vintage-desc'];

const getFieldValue = (wine, field) => {
    const v = wine[field];
    if (v === null || v === undefined) return null;
    return v;
};

const matchRule = (wine, rule) => {
    const { field, op, value } = rule;
    if (!RULE_FIELDS.includes(field) || !RULE_OPS.includes(op)) return true;

    const wv = getFieldValue(wine, field);

    switch (op) {
        case 'equals':
            if (wv === null) return false;
            return String(wv).toLowerCase() === String(value).toLowerCase();
        case 'not_equals':
            if (wv === null) return value !== null && value !== '';
            return String(wv).toLowerCase() !== String(value).toLowerCase();
        case 'contains': {
            if (wv === null) return false;
            return String(wv).toLowerCase().includes(String(value).toLowerCase());
        }
        case 'in': {
            if (wv === null) return false;
            const arr = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim());
            return arr.some(v => String(wv).toLowerCase() === String(v).toLowerCase());
        }
        case 'gte':
            if (wv === null) return false;
            return Number(wv) >= Number(value);
        case 'lte':
            if (wv === null) return false;
            return Number(wv) <= Number(value);
        default:
            return true;
    }
};

// All rules must match (AND-logic).
const matchesAllRules = (wine, rules) => {
    if (!rules || rules.length === 0) return true;
    return rules.every(r => matchRule(wine, r));
};

const sortWines = (wines, sort) => {
    const dir = sort?.endsWith('-desc') ? -1 : 1;
    const key = sort?.replace(/-asc$|-desc$/, '');
    const out = [...wines];
    out.sort((a, b) => {
        let av, bv;
        if (key === 'price') { av = a.sell_price ?? 0; bv = b.sell_price ?? 0; return (av - bv) * dir; }
        if (key === 'vintage') { av = a.vintage ?? 0; bv = b.vintage ?? 0; return (av - bv) * dir; }
        // name (default)
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
    });
    return out;
};

/**
 * Bouwt een boom van groepen → {name, wines, children}.
 * Per groep wordt de pool gefilterd; de overgebleven pool gaat naar de volgende groep
 * op hetzelfde niveau zodat een wijn niet dubbel verschijnt.
 */
export const buildExportTree = (allWines, structure) => {
    const rootGroups = structure?.groups || [];
    const buildLevel = (groups, pool) => {
        let remaining = [...pool];
        const result = [];
        for (const g of groups) {
            const matched = remaining.filter(w => matchesAllRules(w, g.rules));
            const matchedIds = new Set(matched.map(w => w.id));
            remaining = remaining.filter(w => !matchedIds.has(w.id));

            const children = g.children && g.children.length > 0
                ? buildLevel(g.children, matched)
                : [];

            // Wines that fall within this group but didn't match any subgroup
            const claimedByChildren = new Set(
                children.flatMap(c => collectIds(c))
            );
            const directWines = sortWines(
                matched.filter(w => !claimedByChildren.has(w.id)),
                g.sort || 'name-asc'
            );

            result.push({
                id: g.id,
                name: g.name || 'Groep',
                rules: g.rules || [],
                sort: g.sort || 'name-asc',
                wines: directWines,
                children,
            });
        }
        return result;
    };

    return buildLevel(rootGroups, allWines);
};

const collectIds = (node) => {
    const ids = node.wines.map(w => w.id);
    for (const c of node.children) ids.push(...collectIds(c));
    return ids;
};

export const validateStructure = (structure) => {
    if (!structure || typeof structure !== 'object') return 'structure must be an object';
    if (!Array.isArray(structure.groups)) return 'structure.groups must be an array';
    const walk = (groups, depth = 0) => {
        if (depth > 19) return 'maximum nesting depth (20) exceeded';
        for (const g of groups) {
            if (typeof g.name !== 'string') return 'group.name must be a string';
            if (g.sort && !SORT_OPTIONS.includes(g.sort)) return `invalid sort: ${g.sort}`;
            if (g.rules) {
                if (!Array.isArray(g.rules)) return 'group.rules must be an array';
                for (const r of g.rules) {
                    if (!RULE_FIELDS.includes(r.field)) return `invalid rule field: ${r.field}`;
                    if (!RULE_OPS.includes(r.op)) return `invalid rule op: ${r.op}`;
                }
            }
            if (g.children) {
                const e = walk(g.children, depth + 1);
                if (e) return e;
            }
        }
        return null;
    };
    return walk(structure.groups);
};

export { RULE_FIELDS, RULE_OPS, SORT_OPTIONS };
