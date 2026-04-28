import PDFDocument from 'pdfkit';

const fmtPrice = (v) => v == null ? '' : `€ ${Number(v).toFixed(2)}`;

const TYPE_LABELS = { red: 'Rood', white: 'Wit', rose: 'Rosé', sparkling: 'Bubbels', dessert: 'Dessert' };

/**
 * Renders the export tree to a PDF. Streams to res.
 */
export const renderExportPdf = (res, { title, tree, companyName }) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: title || 'Wijnkaart' } });
    doc.pipe(res);

    // Title page header
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#3a1418').text(title || 'Wijnkaart', { align: 'center' });
    if (companyName) {
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(11).fillColor('#7B2D3A').text(companyName, { align: 'center' });
    }
    doc.moveDown(1.2);

    const renderNode = (node, depth) => {
        // Heading sizes per depth
        const sizes = [18, 14, 12, 11, 10];
        const headingSize = sizes[Math.min(depth, sizes.length - 1)];
        const indent = depth * 12;

        // Page break if low space for heading
        if (doc.y > doc.page.height - 120) doc.addPage();

        doc.moveDown(depth === 0 ? 0.6 : 0.4);
        doc.font('Helvetica-Bold').fontSize(headingSize).fillColor('#3a1418')
            .text(node.name, doc.page.margins.left + indent, doc.y);

        // Underline only for top-level
        if (depth === 0) {
            const y = doc.y + 2;
            doc.strokeColor('#C4758A').lineWidth(1)
                .moveTo(doc.page.margins.left + indent, y)
                .lineTo(doc.page.width - doc.page.margins.right, y)
                .stroke();
            doc.moveDown(0.5);
        } else {
            doc.moveDown(0.2);
        }

        // Wines list
        if (node.wines.length > 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#222');
            for (const w of node.wines) {
                if (doc.y > doc.page.height - 80) doc.addPage();

                const left = doc.page.margins.left + indent + 6;
                const rightEdge = doc.page.width - doc.page.margins.right;
                const priceText = fmtPrice(w.sell_price);
                const priceWidth = doc.widthOfString(priceText);

                const startY = doc.y;

                // Name (bold)
                doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1a1a1a');
                const nameText = w.vintage ? `${w.name} (${w.vintage})` : w.name;
                doc.text(nameText, left, startY, {
                    width: rightEdge - left - priceWidth - 10,
                    continued: false,
                });

                // Price right-aligned at the same starting Y
                doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#7B2D3A');
                doc.text(priceText, rightEdge - priceWidth, startY);

                // Subtitle
                const subParts = [];
                if (w.winery) subParts.push(w.winery);
                if (w.region) subParts.push(w.region);
                if (w.country) subParts.push(w.country);
                if (w.grape) subParts.push(w.grape);
                if (TYPE_LABELS[w.type]) subParts.push(TYPE_LABELS[w.type]);
                if (subParts.length > 0) {
                    doc.font('Helvetica').fontSize(9).fillColor('#666')
                        .text(subParts.join(' · '), left, doc.y, {
                            width: rightEdge - left,
                        });
                }
                doc.moveDown(0.4);
            }
        } else if (node.children.length === 0) {
            doc.font('Helvetica-Oblique').fontSize(9).fillColor('#999')
                .text('Geen wijnen in deze groep.', doc.page.margins.left + indent + 6, doc.y);
            doc.moveDown(0.3);
        }

        // Children
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
