import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const logo = fileURLToPath(new URL('../../client/public/assets/careerscope_logo.jpeg', import.meta.url));
export function renderBillingPdf({ title, reference, status, currency, rows, date, term, company }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 45, info: { Title: `${title} ${reference}` }, compress: false });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.image(logo, 45, 40, { fit: [65, 65] });
    doc.fontSize(22).fillColor('#136c43').text(company.name, 125, 45);
    doc.fontSize(11).fillColor('#222222').text(company.address, 125, 77);
    doc.moveDown(3).text(title, 45, 130, { width: 500 }).moveDown();
    const numberLabel = title.startsWith('Invoice') ? 'Invoice #' : title.includes('Receipt') ? 'Receipt #' : 'Transaction #';
    doc.fontSize(9).text(`${numberLabel}: ${reference}`).text(`Status: ${status}`).text(`Issued: ${date}`).text(`Term: ${term || 'Academic year'}`).moveDown(2);
    doc.fontSize(12).text(`Student allocation / amount (${currency})`).moveDown();
    let total = 0;
    for (const row of rows) {
      if (doc.y > 720) doc.addPage();
      total += Number(row.amount_minor);
      doc.fontSize(10).text(`${row.student_name} - ${(Number(row.amount_minor) / 100).toFixed(2)} ${currency}`).moveDown(0.6);
    }
    doc.moveDown().fontSize(14).text(`Total: ${(total / 100).toFixed(2)} ${currency}`).moveDown();
    doc.fontSize(9).text('Verify the REF # in the signed-in CareerScope Payments page.');
    doc.text('A receipt is issued only after administrator approval of an external payment.');
    doc.end();
  });
}
