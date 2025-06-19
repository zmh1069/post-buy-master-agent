const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Parse address to extract components
function parseAddress(fullAddress) {
  const parts = fullAddress.split(',').map(p => p.trim());
  
  let streetAddress = parts[0] || '';
  let zipcode = '';
  
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    const zipMatch = lastPart.match(/\b(\d{5}(-\d{4})?)\b/);
    if (zipMatch) {
      zipcode = zipMatch[1];
    }
  }
  
  return { streetAddress, zipcode };
}

// Process the spreadsheet
async function updateSpreadsheet(address, propertyId) {
  try {
    const templatePath = './downloads/sample_dexp_input.xlsx';
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    const workbook = XLSX.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    if (data.length > 2) {
      data.splice(1, 2);
    }
    
    const { streetAddress, zipcode } = parseAddress(address);
    
    if (!data[0]) data[0] = [];
    while (data[0].length < 3) {
      data[0].push('');
    }
    
    const newRow = ['', streetAddress, zipcode];
    
    if (data.length === 1) {
      data.push(newRow);
    } else {
      data[1] = newRow;
    }
    
    const newWorksheet = XLSX.utils.aoa_to_sheet(data);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join('./output', `property_${propertyId}_${timestamp}.xlsx`);
    
    XLSX.writeFile(newWorkbook, outputPath);
    
    console.log(`✅ Created: ${outputPath}`);
    console.log(`   Address: ${streetAddress}, ${zipcode}`);
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🏠 Process All BUY Properties\n');
  
  const url = await new Promise(resolve => {
    rl.question('Enter your Supabase URL (https://xxxxx.supabase.co): ', resolve);
  });
  
  const apiKey = await new Promise(resolve => {
    rl.question('Enter your anon/public API key: ', resolve);
  });
  
  rl.close();
  
  console.log('\n🔄 Fetching BUY properties...');
  
  try {
    // Fetch only properties with offer_decision = 'BUY'
    const response = await fetch(`${url}/rest/v1/property_detail?offer_decision=eq.BUY`, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const properties = await response.json();
    
    console.log(`\n📊 Found ${properties.length} properties with BUY decision\n`);
    
    if (properties.length === 0) {
      console.log('No properties with offer_decision = "BUY" found.');
      return;
    }
    
    // Process each property
    for (const property of properties) {
      console.log(`\nProcessing property ${property.id}...`);
      await updateSpreadsheet(property.address, property.id);
    }
    
    console.log(`\n✅ Completed! Processed ${properties.length} properties.`);
    console.log(`📁 Files saved in: ./output/`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();