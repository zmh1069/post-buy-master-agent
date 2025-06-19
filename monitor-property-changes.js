require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Database setup based on DB_TYPE
let db;
if (process.env.DB_TYPE === 'mysql') {
  const mysql = require('mysql2/promise');
  db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  const { Pool } = require('pg');
  db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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
async function updateSpreadsheet(address) {
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
    // Assuming row 1 has headers, we add to row 2 (index 1)
    if (data.length > 0) {
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
    
    console.log(`✅ Spreadsheet created: ${outputPath}`);
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
    let query, result;
    
    if (process.env.DB_TYPE === 'mysql') {
      query = 'SELECT * FROM property_detail WHERE offer_decision IS NOT NULL';
      [result] = await db.execute(query);
    } else {
      query = 'SELECT * FROM property_detail WHERE offer_decision IS NOT NULL';
      result = await db.query(query);
      result = result.rows;
    }
    
    for (const row of result) {
      const id = row.id || row.property_id; // Adjust based on your primary key
      const currentDecision = row.offer_decision;
      const previousDecision = previousStates.get(id);
      
      // Check if it transitioned from NULL to BUY
      if (!previousDecision && currentDecision === 'BUY') {
        console.log(`\n🎯 Detected transition to BUY for property ${id}`);
        console.log(`   Address: ${row.address}`);
        
        // Update the spreadsheet
        await updateSpreadsheet(row.address);
        
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
  }
}

// Initialize by loading current states
async function initialize() {
  console.log('🚀 Starting property monitor...');
  console.log(`   Database: ${process.env.DB_TYPE}`);
  console.log(`   Poll interval: ${process.env.POLL_INTERVAL_SECONDS || 30} seconds`);
  
  try {
    let query, result;
    
    if (process.env.DB_TYPE === 'mysql') {
      query = 'SELECT * FROM property_detail';
      [result] = await db.execute(query);
    } else {
      query = 'SELECT * FROM property_detail';
      result = await db.query(query);
      result = result.rows;
    }
    
    // Load initial states
    for (const row of result) {
      const id = row.id || row.property_id;
      previousStates.set(id, row.offer_decision);
    }
    
    console.log(`✅ Loaded ${previousStates.size} properties into memory`);
    
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
    console.error('Please check your database connection settings in .env');
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
  
  if (process.env.DB_TYPE === 'mysql') {
    await db.end();
  } else {
    await db.end();
  }
  
  process.exit(0);
});

// Start the monitor
startMonitoring();