require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

// Database connection
let db;

// Use connection string if provided, otherwise use individual settings
if (process.env.DATABASE_URL) {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Supabase
  });
} else {
  db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false } // Required for Supabase
  });
}

// Track previous states
const previousStates = new Map();

// Ensure output directory exists
const outputDir = process.env.OUTPUT_DIRECTORY || './output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Parse address to extract components
function parseAddress(fullAddress) {
  // Common patterns:
  // "123 Main St, City, ST 12345"
  // "123 Main Street Apt 4B, City, State 12345"
  
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
async function updateSpreadsheet(address, propertyId) {
  try {
    const templatePath = process.env.HOUSECANARY_TEMPLATE_PATH || './downloads/sample_dexp_input.xlsx';
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    // Read the template
    const workbook = XLSX.readFile(templatePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    // Delete rows 2 and 3 (index 1 and 2)
    if (data.length > 2) {
      data.splice(1, 2);
    }
    
    // Parse the address
    const { streetAddress, zipcode } = parseAddress(address);
    
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
    
    // Generate filename with timestamp and property ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `property_${propertyId}_${timestamp}.xlsx`);
    
    // Write the file
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

// Check for changes in the database
async function checkForChanges() {
  try {
    const query = 'SELECT * FROM property_detail WHERE offer_decision IS NOT NULL';
    const result = await db.query(query);
    
    for (const row of result.rows) {
      const id = row.id || row.property_id; // Adjust based on your primary key
      const currentDecision = row.offer_decision;
      const previousDecision = previousStates.get(id);
      
      // Check if it transitioned from NULL to BUY
      if (!previousDecision && currentDecision === 'BUY') {
        console.log(`\n🎯 Detected transition to BUY for property ${id}`);
        console.log(`   Address: ${row.address}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        
        // Update the spreadsheet
        await updateSpreadsheet(row.address, id);
        
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
      
      // Update the state
      previousStates.set(id, currentDecision);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    if (error.message.includes('does not exist')) {
      console.error('\n⚠️  Table "property_detail" not found in your Supabase database.');
      console.error('Please create the table with this SQL in Supabase SQL Editor:\n');
      console.error(`CREATE TABLE property_detail (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  offer_decision TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`);
    }
  }
}

// Test database connection
async function testConnection() {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✅ Connected to Supabase successfully!');
    console.log(`   Server time: ${result.rows[0].now}`);
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'property_detail'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error('\n⚠️  Table "property_detail" not found!');
      console.error('Create it in Supabase with this SQL:\n');
      console.error(`CREATE TABLE property_detail (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  offer_decision TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE property_detail ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (adjust as needed)
CREATE POLICY "Allow all operations" ON property_detail
  FOR ALL USING (true);`);
      
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    console.error('\nPlease check your .env file:');
    console.error('1. DB_HOST should be: your-project-ref.supabase.co');
    console.error('2. DB_PASSWORD should be your Supabase database password');
    console.error('3. Or use DATABASE_URL from Supabase dashboard');
    return false;
  }
}

// Initialize by loading current states
async function initialize() {
  console.log('🚀 Starting Supabase property monitor...');
  console.log(`   Host: ${process.env.DB_HOST || 'Using connection string'}`);
  console.log(`   Poll interval: ${process.env.POLL_INTERVAL_SECONDS || 30} seconds`);
  
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }
  
  try {
    const query = 'SELECT * FROM property_detail';
    const result = await db.query(query);
    
    // Load initial states
    for (const row of result.rows) {
      const id = row.id || row.property_id;
      previousStates.set(id, row.offer_decision);
    }
    
    console.log(`\n✅ Loaded ${previousStates.size} properties into memory`);
    
    // Show current BUY decisions
    const buyCount = Array.from(previousStates.values()).filter(v => v === 'BUY').length;
    console.log(`   Current BUY decisions: ${buyCount}`);
    
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
    process.exit(1);
  }
}

// Main monitoring loop
async function startMonitoring() {
  await initialize();
  
  // Check immediately
  await checkForChanges();
  
  // Set up polling
  const pollInterval = (process.env.POLL_INTERVAL_SECONDS || 30) * 1000;
  setInterval(checkForChanges, pollInterval);
  
  console.log('\n👀 Monitoring for changes... Press Ctrl+C to stop.\n');
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down monitor...');
  await db.end();
  process.exit(0);
});

// Start the monitor
startMonitoring();