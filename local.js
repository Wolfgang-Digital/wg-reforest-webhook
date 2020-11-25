const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

const recipient = 'Fakie McName';
const buyer = 'Fionn Casey';
const quantity = 10;

const main = async () => {
  const file = fs.readFileSync('template.pdf');
  const doc = await PDFDocument.load(file);
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const vw = width / 100;
  const vh = height / 100;

  page.drawText(recipient.toUpperCase(), {
    x: (width / 2) - ((recipient.length / 2) * 27),
    y: vh * 57,
    size: 42,
    font,
    color: rgb(0.282, 0.690, 0.513)
  });

  page.drawText(`${quantity} tree${quantity > 1 ? 's' : ''}`, {
    x: vw * (quantity > 9 ? 21.85 : quantity > 1 ? 22.7 : 23.3),
    y: vh * 49.3,
    size: 12,
    font,
    color: rgb(0.082, 0.376, 0.4)
  });

  page.drawText(`${buyer}.`, {
    x: vw * 60.5,
    y: vh * 46.2,
    size: 12,
    font,
    color: rgb(0.082, 0.376, 0.4)
  });

  const bytes = await doc.save();
  fs.writeFileSync('output.pdf', bytes);
};

main();