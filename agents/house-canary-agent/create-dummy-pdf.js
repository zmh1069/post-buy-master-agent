const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createDummyPdf() {
  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();

  // Add a blank page to the document
  const page = pdfDoc.addPage();

  // Draw the text "test" in the center of the page
  page.drawText('test', {
    x: page.getWidth() / 2 - 20,
    y: page.getHeight() / 2,
    size: 50,
    color: rgb(0, 0, 0),
  });

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await pdfDoc.save();

  // Define the output path
  const outputPath = path.join(__dirname, 'downloads', 'dummy_analysis.pdf');

  // Ensure the downloads directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write the PDF to a file
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`✅ Dummy PDF created at: ${outputPath}`);
}

createDummyPdf(); 