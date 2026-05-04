import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';

const ICON_SIZE = 12; // pt
const ICON_GAP = 4;

/** Decode a data URL to { mime, buffer, raw }. */
const decodeDataUrl = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const m = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
    if (!m) return null;
    const [, mime, b64, body] = m;
    if (b64) return { mime, buffer: Buffer.from(body, 'base64'), raw: null };
    return { mime, buffer: null, raw: decodeURIComponent(body) };
};

const drawIcon = (doc, icon, x, baselineY, lineHeight) => {
    const decoded = decodeDataUrl(icon.data_url);
    if (!decoded) return;
    const v = icon.position?.v || 'middle';
    let y = baselineY;
    if (v === 'middle') y = baselineY + (lineHeight - ICON_SIZE) / 2;
    else if (v === 'bottom') y = baselineY + lineHeight - ICON_SIZE;
    try {
        if (/svg/i.test(decoded.mime)) {
            const svgText = decoded.raw || (decoded.buffer && decoded.buffer.toString('utf8'));
            if (svgText) SVGtoPDF(doc, svgText, x, y, { width: ICON_SIZE, height: ICON_SIZE, preserveAspectRatio: 'xMidYMid meet' });
        } else if (decoded.buffer) {
            doc.image(decoded.buffer, x, y, { fit: [ICON_SIZE, ICON_SIZE] });
        }
    } catch (e) {
        console.warn('[pdf] icon render failed:', e.message);
    }
};

const fmtPrice = (v) => v == null ? '' : `€ ${Number(v).toFixed(2)}`;
const fmtPriceNum = (v) => v == null ? '' : Number(v).toFixed(2).replace('.', ',');

const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bubbels', dessert: 'Dessert' };

const TOKEN_RESOLVERS = {
    name:             w => w.name,
    vintage:          w => w.vintage,
    winery:           w => w.winery,
    region:           w => w.region,
    subregion:        w => w.subregion,
    country:          w => w.country,
    grape:            w => w.grape,
    type:             w => TYPE_LABELS[w.type] || w.type,
    sell_price:       w => fmtPrice(w.sell_price),
    sell_price_glass: w => fmtPrice(w.sell_price_glass),
    price:            w => fmtPriceNum(w.sell_price),
    price_glass:      w => fmtPriceNum(w.sell_price_glass),
    bottle_size:      w => w.bottle_size,
};

// Format-string resolver. Tokens die leeg zijn worden samen met directe
// omringende separator-tekens (spaces, -, /, |, *, ·, +) weggehaald — zo
// blijft "[price] / [price_glass]" netjes "€ 25,00 / € 5,00", maar als de
// glas-prijs ontbreekt valt de losse "/" eraf en blijft "€ 25,00" over.
const SEP_CHARS = '\\s\\-\\/\\|\\*·•+';
const MARKER = '';
const TOKEN_RE = /\[(\w+)\]/g;
const SUR_RE = new RegExp(`[${SEP_CHARS}]*${MARKER}+[${SEP_CHARS}]*`, 'g');
const TRIM_SEP_RE = new RegExp(`^[${SEP_CHARS}]+|[${SEP_CHARS}]+$`, 'g');

export const formatTemplate = (template, wine) => {
    if (!template) return '';
    let out = template.replace(TOKEN_RE, (_, key) => {
        const fn = TOKEN_RESOLVERS[key];
        if (!fn) return MARKER;
        const v = fn(wine);
        return v === null || v === undefined || v === '' ? MARKER : String(v);
    });
    out = out.replace(SUR_RE, ' ');
    out = out.replace(TRIM_SEP_RE, '');
    return out.replace(/\s+/g, ' ').trim();
};

// Backwards-compat alias.
export const formatWineLine = formatTemplate;

const DEFAULT_STYLE = {
    heading: { font: 'Helvetica', size: 18, weight: 'bold' },
    body:    { font: 'Helvetica', size: 10.5, weight: 'normal' },
};

const pdfFont = (family, weight) => {
    const isBold = weight === 'bold';
    if (family === 'Times-Roman') return isBold ? 'Times-Bold' : 'Times-Roman';
    if (family === 'Courier')     return isBold ? 'Courier-Bold' : 'Courier';
    return isBold ? 'Helvetica-Bold' : 'Helvetica';
};

const mergeStyle = (override) => ({
    heading: { ...DEFAULT_STYLE.heading, ...(override?.heading || {}) },
    body:    { ...DEFAULT_STYLE.body,    ...(override?.body    || {}) },
});

/**
 * Renders the export tree to a PDF. Streams to res.
 */
export const renderExportPdf = (res, { title, tree, wineFormat, priceFormat, menuStyle, icons, iconAssignments }) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title || 'Wijnkaart' } });
    doc.pipe(res);

    const style = mergeStyle(menuStyle);
    const headingFont = pdfFont(style.heading.font, style.heading.weight);
    const bodyFont    = pdfFont(style.body.font,    style.body.weight);
    const headingSizeBase = style.heading.size;
    const bodySize        = style.body.size;

    const iconById = new Map((icons || []).map(i => [i.id, i]));
    const assignmentMap = iconAssignments || {};
    const resolveIcon = (wineId) => {
        const iconId = assignmentMap[wineId];
        return iconId ? iconById.get(iconId) : null;
    };

    const renderNode = (node, depth) => {
        const headingSize = Math.max(8, headingSizeBase - depth * 3);
        const indent = depth * 12;

        if (doc.y > doc.page.height - 120) doc.addPage();

        doc.moveDown(depth === 0 ? 0.6 : 0.4);
        doc.font(headingFont).fontSize(headingSize).fillColor('#3a1418')
            .text(node.name, doc.page.margins.left + indent, doc.y);
        doc.moveDown(depth === 0 ? 0.3 : 0.2);

        if (node.wines.length > 0) {
            for (const w of node.wines) {
                if (doc.y > doc.page.height - 80) doc.addPage();

                const baseLeft = doc.page.margins.left + indent + 6;
                const rightEdge = doc.page.width - doc.page.margins.right;

                const icon = resolveIcon(w.id);
                const iconReserve = icon ? ICON_SIZE + ICON_GAP : 0;
                const iconOnLeft  = icon && (icon.position?.h || 'left') === 'left';
                const iconOnRight = icon && (icon.position?.h || 'left') === 'right';
                const left = baseLeft + (iconOnLeft ? iconReserve : 0);

                const priceText = priceFormat && priceFormat.trim()
                    ? formatTemplate(priceFormat, w)
                    : fmtPrice(w.sell_price);

                doc.font(bodyFont).fontSize(bodySize);
                const priceWidth = priceText ? doc.widthOfString(priceText) : 0;

                const startY = doc.y;

                const titleText = wineFormat && wineFormat.trim()
                    ? formatTemplate(wineFormat, w)
                    : (w.vintage ? `${w.name} (${w.vintage})` : w.name);

                const titleWidth = rightEdge - left - priceWidth - (priceWidth ? 10 : 0) - (iconOnRight ? iconReserve : 0);

                doc.fillColor('#1a1a1a');
                doc.text(titleText, left, startY, { width: titleWidth });
                const yAfterTitle = doc.y;

                if (priceText) {
                    const priceX = rightEdge - priceWidth - (iconOnRight ? iconReserve : 0);
                    doc.font(bodyFont).fontSize(bodySize).fillColor('#7B2D3A')
                        .text(priceText, priceX, startY);
                }
                const yAfterPrice = doc.y;
                const lineHeight = Math.max(yAfterTitle, yAfterPrice) - startY;

                if (icon) {
                    const iconX = iconOnLeft ? baseLeft : rightEdge - ICON_SIZE;
                    drawIcon(doc, icon, iconX, startY, lineHeight);
                }

                doc.y = Math.max(yAfterTitle, yAfterPrice);
                doc.moveDown(0.4);
            }
        } else if (node.children.length === 0) {
            doc.font('Helvetica-Oblique').fontSize(9).fillColor('#999')
                .text('Geen wijnen in deze groep.', doc.page.margins.left + indent + 6, doc.y);
            doc.moveDown(0.3);
        }

        for (const c of node.children) renderNode(c, depth + 1);
    };

    if (!tree || tree.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(11).fillColor('#666')
            .text('Geen groepen gedefinieerd.', { align: 'center' });
    } else {
        for (const node of tree) renderNode(node, 0);
    }

    doc.end();
};
