const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
let config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  pollInterval: 30000
};

// State file to persist property states between runs
const stateFile = './property-states.json';
const outputDir = './output';

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Load previous states from file
function loadStates() {
  try {
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, 'utf8');
      return new Map(JSON.parse(data));
    }
  } catch (error) {
    console.log('No previous state file found, starting fresh.');
  }
  return new Map();
}

// Save states to file
function saveStates(states) {
  const data = Array.from(states.entries());
  fs.writeFileSync(stateFile, JSON.stringify(data, null, 2));
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
    
    console.log(`\n✅ Spreadsheet created: ${outputPath}`);
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Failed to fetch data:', error.message);
    return [];
  }
}

// Check for changes
async function checkForChanges(previousStates) {
  const properties = await fetchProperties();
  let changesDetected = false;
  
  for (const row of properties) {
    const id = row.id;
    const currentDecision = row.offer_decision;
    const previousDecision = previousStates.get(id);
    
    // Check if it transitioned from NULL to BUY
    if ((!previousDecision || previousDecision === 'NULL' || previousDecision === null) && 
        currentDecision === 'BUY') {
      
      console.log(`\n🎯 DETECTED CHANGE: Property ${id} changed from NULL to BUY!`);
      console.log(`   Address: ${row.address}`);
      console.log(`   Time: ${new Date().toLocaleString()}`);
      
      await updateSpreadsheet(row.address, id);
      changesDetected = true;
      
      // Log the change
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
    
    // Update the state (including new properties)
    previousStates.set(id, currentDecision);
  }
  
  // Save updated states
  saveStates(previousStates);
  
  if (!changesDetected) {
    console.log(`[${new Date().toLocaleTimeString()}] No changes detected`);
  }
  
  return previousStates;
}

// Setup function
async function setup() {
  console.log('🚀 Supabase Property Monitor (With State Tracking)\n');
  console.log('This version remembers previous states and only triggers on actual changes.\n');
  
  return new Promise((resolve) => {
    rl.question('Enter your Supabase URL: ', (url) => {
      config.supabaseUrl = url.trim();
      
      rl.question('Enter your anon/public API key: ', async (key) => {
        config.supabaseAnonKey = key.trim();
        rl.close();
        
        console.log('\n🔄 Testing connection and loading states...');
        const properties = await fetchProperties();
        
        if (properties.length >= 0) {
          console.log(`✅ Connected! Found ${properties.length} properties.`);
          
          // Load previous states
          const previousStates = loadStates();
          console.log(`📁 Loaded ${previousStates.size} previous property states`);
          
          // Show current status
          const buyCount = properties.filter(p => p.offer_decision === 'BUY').length;
          const nullCount = properties.filter(p => !p.offer_decision || p.offer_decision === null).length;
          
          console.log(`\n📊 Current Status:`);
          console.log(`   Properties with BUY: ${buyCount}`);
          console.log(`   Properties with NULL: ${nullCount}`);
          console.log(`   Total properties: ${properties.length}`);
          
          resolve({ success: true, previousStates });
        } else {
          console.error('❌ Could not connect. Please check your credentials.');
          resolve({ success: false });
        }
      });
    });
  });
}

// Main function
async function main() {
  const result = await setup();
  
  if (!result.success) {
    process.exit(1);
  }
  
  let previousStates = result.previousStates;
  
  console.log(`\n👀 Monitoring for changes every ${config.pollInterval/1000} seconds...`);
  console.log('Only properties changing from NULL to BUY will trigger spreadsheet creation.');
  console.log('Press Ctrl+C to stop.\n');
  
  // Check immediately
  previousStates = await checkForChanges(previousStates);
  
  // Set up polling
  setInterval(async () => {
    previousStates = await checkForChanges(previousStates);
  }, config.pollInterval);
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down monitor...');
  console.log('State saved in property-states.json');
  process.exit(0);
});

// Start
main();