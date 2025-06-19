require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Test address parsing
function testAddressParsing() {
  console.log('Testing address parsing...\n');
  
  const testAddresses = [
    '123 Main Street, New York, NY 10001',
    '456 Oak Avenue Apt 5B, Los Angeles, CA 90210',
    '789 Pine Road, Chicago, IL 60601-1234',
    '321 Elm Street',
    '999 Park Blvd, Boston MA 02134'
  ];
  
  testAddresses.forEach(addr => {
    const parts = addr.split(',').map(p => p.trim());
    let streetAddress = parts[0] || '';
    let zipcode = '';
    
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      const zipMatch = lastPart.match(/\b(\d{5}(-\d{4})?)\b/);
      if (zipMatch) {
        zipcode = zipMatch[1];
      }
    }
    
    console.log(`Original: ${addr}`);
    console.log(`  Street: ${streetAddress}`);
    console.log(`  Zip: ${zipcode}`);
    console.log('---');
  });
}

// Test spreadsheet creation
async function testSpreadsheetCreation() {
  console.log('\nTesting spreadsheet creation...\n');
  
  const templatePath = './downloads/sample_dexp_input.xlsx';
  const outputDir = './output';
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  if (!fs.existsSync(templatePath)) {
    console.log('❌ Template file not found:', templatePath);
    console.log('Please ensure the HouseCanary template is downloaded first.');
    return;
  }
  
  try {
    // Read the template
    console.log('Reading template file...');
    const workbook = XLSX.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    console.log(`Original sheet has ${data.length} rows`);
    
    // Show first few rows
    console.log('\nFirst 4 rows of original:');
    data.slice(0, 4).forEach((row, idx) => {
      console.log(`Row ${idx + 1}: ${JSON.stringify(row.slice(0, 5))}`);
    });
    
    // Delete rows 2 and 3
    if (data.length > 2) {
      data.splice(1, 2);
      console.log(`\nAfter deleting rows 2 and 3: ${data.length} rows`);
    }
    
    // Add test address
    const testAddress = '123 Main Street, Springfield, IL 62701';
    const streetAddress = '123 Main Street';
    const zipcode = '62701';
    
    // Ensure we have enough columns
    if (data[0]) {
      while (data[0].length < 3) {
        data[0].push('');
      }
    }
    
    // Add new row
    const newRow = ['', streetAddress, zipcode];
    if (data.length === 1) {
      data.push(newRow);
    } else {
      data[1] = newRow;
    }
    
    console.log('\nAfter adding address:');
    data.slice(0, 3).forEach((row, idx) => {
      console.log(`Row ${idx + 1}: ${JSON.stringify(row.slice(0, 5))}`);
    });
    
    // Create new worksheet
    const newWorksheet = XLSX.utils.aoa_to_sheet(data);
    
    // Create new workbook
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
    
    // Save test file
    const outputPath = path.join(outputDir, 'test_output.xlsx');
    XLSX.writeFile(newWorkbook, outputPath);
    
    console.log(`\n✅ Test file created: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run tests
console.log('=== Property Monitor Test Suite ===\n');
testAddressParsing();
testSpreadsheetCreation();