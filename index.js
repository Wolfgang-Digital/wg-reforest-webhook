const AWS = require('aws-sdk');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const nodemailer = require('nodemailer');

const S3 = new AWS.S3();
const s3Bucket = 'wg-forestry';

const templateParams = {
  Bucket: s3Bucket,
  Key: 'template.pdf'
};

const emailHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
  </head>
  <body>
    <p>
      <strong>Welcome to the 'gang.</strong><br>
      You can learn all about the Wolfgang Reforest story and ambition on the <a href="https://wolfgangreforest.ie">website</a>.<br>
      Please make sure you sign up for the newsletter (bottom of <a href="https://wolfgangreforest.ie">homepage</a>) so we can send you seasonal video updates on how your forest is growing.
    </p>
    <p>
      Your Wolfgang Reforest Certification is attached.<br>
      If you wanna to post it on social feel free to tag @wolfgangreforest
    </p>
    <p>It's great to have you as part of the tree planting movement!</p>
  </body>
</html>
`;

const generatePdf = async ({ template, orderNumber, recipientName, buyerName, quantity, output }) => {
  const doc = await PDFDocument.load(template.Body);
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const vw = width / 100;
  const vh = height / 100;

  page.drawText(recipientName.toUpperCase(), {
    x: (width / 2) - ((recipientName.length / 2) * 26),
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

  page.drawText(`${buyerName}.`, {
    x: vw * 60.5,
    y: vh * 46.2,
    size: 12,
    font,
    color: rgb(0.082, 0.376, 0.4)
  });

  const bytes = await doc.save();
  const buffer = Buffer.from(bytes);

  const uploadParams = {
    Bucket: s3Bucket,
    Key: `certificates/${orderNumber}_${recipientName.replace(/\s/g, '')}.pdf`,
    Body: buffer,
    ContentType: 'application/pdf'
  };
  await S3.putObject(uploadParams).promise();

  output.push({
    filename: `${recipientName} - Forestry Certificate.pdf`,
    content: buffer,
    contentType: 'application/pdf'
  });
};

exports.handler = async e => {
  const data = JSON.parse(e.body);
  try {
    const buyerName = `${data.billing.first_name} ${data.billing.last_name}`;
    const buyerEmail = data.billing.email;

    const template = await S3.getObject(templateParams).promise();

    const pdfs = [];

    for (let i in data.line_items) {
      const item = data.line_items[i];
      const recipient = item.meta_data.find(item => item.key === 'Recipient Name');
      const recipientName = recipient ? recipient.value : buyerName;

      await generatePdf({
        template,
        orderNumber: data.number,
        recipientName,
        buyerName,
        quantity: item.quantity,
        output: pdfs
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'Sendgrid',
      auth: {
        user: process.env.SENDGRID_USERNAME,
        pass: process.env.SENDGRID_PASSWORD
      }
    });

    await transporter.sendMail({
      from: 'Wolfgang Reforest <no-reply@wolfgangreforest.ie>',
      to: buyerEmail,
      subject: `Congrats, You're A Wolfgang Reforester!`,
      text: `Welcome to the 'gang.
      You can learn all about the Wolfgang Reforest story and ambition on the website.
      Please make sure you sign up for the newsletter (bottom of homepage) so we can send you seasonal video updates on how your forest is growing.\n
      Your Wolfgang Reforest Certification is attached. 
      If you wanna to post it on social feel free to tag @wolfgangreforest\n
      It's great to have you as part of the tree planting movement!
      `,
      html: emailHtml,
      attachments: pdfs
    });

    return { statusCode: 200 };
  } catch (error) {
    const uploadParams = {
      Bucket: s3Bucket,
      Key: `errors/${new Date()}.json`,
      Body: `{ error: ${error.toString()}, data: ${JSON.stringify(data)} }`,
      ContentType: 'application/json'
    };
    await S3.putObject(uploadParams).promise();

    return { statusCode: 400 };
  }
};
