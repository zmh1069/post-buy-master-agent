const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node manual-update-spreadsheet.js "Full Address"');
  console.log('Example: node manual-update-spreadsheet.js "123 Main St, New York, NY 10001"');
  process.exit(1);
}

const fullAddress = args[0];

// Parse address to extract components
function parseAddress(fullAddress) {
  const parts = fullAddress.split(',').map(p => p.trim());
  
  let streetAddress = parts[0] || '';
  let zipcode = '';
  
  // Extract zipcode from the last part
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    const zipMatch = lastPart.match(/\b(\d{5}(-\d{4})?)\b/);
    if (zipMatch) {
      zipcode = zipMatch[1];
    }
  }
  
  return {
    streetAddress,
    zipcode
  };
}

// Process the spreadsheet
async function updateSpreadsheet(address) {
  try {
    const templatePath = './downloads/sample_dexp_input.xlsx';
    const outputDir = './output';
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    // Read the template
    console.log('📖 Reading template file...');
    const workbook = XLSX.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    console.log(`   Original has ${data.length} rows`);
    
    // Delete rows 2 and 3 (index 1 and 2)
    if (data.length > 2) {
      data.splice(1, 2);
      console.log(`   After deletion: ${data.length} rows`);
    }
    
    // Parse the address
    const { streetAddress, zipcode } = parseAddress(address);
    console.log(`\n📍 Address parsed:`);
    console.log(`   Street: ${streetAddress}`);
    console.log(`   Zip: ${zipcode}`);
    
    // Add new row with address data
    // Ensure we have enough columns
    if (!data[0]) data[0] = [];
    while (data[0].length < 3) {
      data[0].push('');
    }
    
    // Add the new data row
    const newRow = ['', streetAddress, zipcode]; // Column A empty, B has street, C has zip
    
    if (data.length === 1) {
      data.push(newRow);
    } else {
      data[1] = newRow;
    }
    
    // Convert back to worksheet
    const newWorksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Create new workbook
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `property_${timestamp}.xlsx`);
    
    // Write the file
    XLSX.writeFile(newWorkbook, outputPath);
    
    console.log(`\n✅ Spreadsheet created successfully!`);
    console.log(`   File: ${outputPath}`);
    
    return outputPath;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the update
console.log('🏠 HouseCanary Spreadsheet Updater\n');
updateSpreadsheet(fullAddress);