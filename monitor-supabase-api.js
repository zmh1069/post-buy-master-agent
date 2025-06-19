const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Store configuration
let config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  pollInterval: 30000
};

// Track previous states
const previousStates = new Map();

// Ensure output directory exists
const outputDir = './output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

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
    const outputPath = path.join(outputDir, `property_${propertyId}_${timestamp}.xlsx`);
    
    XLSX.writeFile(newWorkbook, outputPath);
    
    console.log(`✅ Spreadsheet created: ${outputPath}`);
    console.log(`   Property ID: ${propertyId}`);
    console.log(`   Street Address: ${streetAddress}`);
    console.log(`   Zipcode: ${zipcode}`);
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Error updating spreadsheet:', error.message);
    throw error;
  }
}

// Fetch data using Supabase REST API
async function fetchProperties() {
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/property_detail?select=*`, {
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.error('❌ Table "property_detail" not found.');
        console.error('Please create it in Supabase with this SQL:\n');
        console.error(`CREATE TABLE property_detail (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  offer_decision TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`);
        return [];
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Failed to fetch data:', error.message);
    return [];
  }
}

// Check for changes
async function checkForChanges() {
  const properties = await fetchProperties();
  
  for (const row of properties) {
    const id = row.id;
    const currentDecision = row.offer_decision;
    const previousDecision = previousStates.get(id);
    
    // Check if it transitioned from NULL to BUY
    if (!previousDecision && currentDecision === 'BUY') {
      console.log(`\n🎯 Detected transition to BUY for property ${id}`);
      console.log(`   Address: ${row.address}`);
      console.log(`   Timestamp: ${new Date().toISOString()}`);
      
      await updateSpreadsheet(row.address, id);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        property_id: id,
        address: row.address,
        old_decision: previousDecision || 'NULL',
        new_decision: currentDecision
      };
      
      const logPath = path.join(outputDir, 'changes.log');
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    }
    
    previousStates.set(id, currentDecision);
  }
}

// Setup function
async function setup() {
  console.log('🚀 Supabase Property Monitor (API Version)\n');
  console.log('This version uses your Supabase API key instead of database password.\n');
  
  console.log('📍 Where to find your credentials:');
  console.log('1. Go to https://app.supabase.com');
  console.log('2. Select your project');
  console.log('3. Go to Settings → API\n');
  
  return new Promise((resolve) => {
    rl.question('Enter your Supabase URL (https://xxxxx.supabase.co): ', (url) => {
      config.supabaseUrl = url.trim();
      
      rl.question('Enter your anon/public API key: ', async (key) => {
        config.supabaseAnonKey = key.trim();
        rl.close();
        
        console.log('\n🔄 Testing connection...');
        const properties = await fetchProperties();
        
        if (properties.length >= 0) {
          console.log(`✅ Connected successfully! Found ${properties.length} properties.`);
          
          // Load initial states
          for (const row of properties) {
            previousStates.set(row.id, row.offer_decision);
          }
          
          const buyCount = properties.filter(p => p.offer_decision === 'BUY').length;
          console.log(`   Current BUY decisions: ${buyCount}`);
          
          resolve(true);
        } else {
          console.error('❌ Could not connect. Please check your credentials.');
          resolve(false);
        }
      });
    });
  });
}

// Main function
async function main() {
  const connected = await setup();
  
  if (!connected) {
    process.exit(1);
  }
  
  console.log(`\n👀 Monitoring for changes every ${config.pollInterval/1000} seconds...`);
  console.log('Press Ctrl+C to stop.\n');
  
  // Check immediately
  await checkForChanges();
  
  // Set up polling
  setInterval(checkForChanges, config.pollInterval);
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down monitor...');
  process.exit(0);
});

// Start
main();