const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Define the data structure
const data = [
  ['client_file_id', 'address', 'zipcode'],
  [1, '', '']
];

// Create a new workbook and worksheet
const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'sample_input');

// Define the output path
const outputPath = path.join(__dirname, 'downloads', 'sample_dexp_input.xlsx');

// Ensure downloads directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write the workbook to file
XLSX.writeFile(wb, outputPath);

console.log(`✅ Template Excel file created at: ${outputPath}`); 