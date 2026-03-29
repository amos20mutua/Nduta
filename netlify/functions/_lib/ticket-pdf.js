const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');

async function buildTicketPdf(input) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 40,
    y: height - 210,
    width: width - 80,
    height: 170,
    color: rgb(0.07, 0.04, 0.06)
  });

  page.drawText('Essy Singer Ticket', { x: 58, y: height - 74, size: 24, font: bold, color: rgb(0.98, 0.92, 0.8) });
  page.drawText(input.eventTitle, { x: 58, y: height - 102, size: 14, font, color: rgb(0.95, 0.86, 0.66) });
  page.drawText(`Name: ${input.holderName}`, { x: 58, y: height - 132, size: 12, font, color: rgb(0.95, 0.92, 0.9) });
  page.drawText(`Ticket ID: ${input.ticketId}`, { x: 58, y: height - 152, size: 12, font, color: rgb(0.95, 0.92, 0.9) });
  page.drawText(`Type: ${input.ticketType}`, { x: 58, y: height - 172, size: 12, font, color: rgb(0.95, 0.92, 0.9) });
  page.drawText(`Amount: ${input.amountLabel}`, { x: 58, y: height - 192, size: 12, font, color: rgb(0.95, 0.92, 0.9) });

  const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, { width: 300, margin: 1 });
  const qrBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImg = await pdf.embedPng(qrBytes);
  page.drawImage(qrImg, { x: width - 210, y: height - 225, width: 150, height: 150 });

  page.drawText('Scan QR to verify ticket', {
    x: width - 205,
    y: height - 242,
    size: 10,
    font,
    color: rgb(0.45, 0.36, 0.24)
  });

  page.drawText('Please keep this ticket available at check-in.', {
    x: 58,
    y: 70,
    size: 11,
    font,
    color: rgb(0.3, 0.24, 0.2)
  });

  return await pdf.save();
}

module.exports = { buildTicketPdf };
