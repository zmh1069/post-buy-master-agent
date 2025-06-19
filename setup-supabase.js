const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testConnection(config) {
  const db = new Pool({
    host: config.host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: config.password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔄 Testing connection...');
    const result = await db.query('SELECT NOW()');
    console.log('✅ Connected successfully!');
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'property_detail'
      );
    `);
    
    await db.end();
    return { success: true, tableExists: tableCheck.rows[0].exists };
  } catch (error) {
    await db.end();
    return { success: false, error: error.message };
  }
}

async function createTable(config) {
  const db = new Pool({
    host: config.host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: config.password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await db.query(`
      CREATE TABLE property_detail (
        id SERIAL PRIMARY KEY,
        address TEXT NOT NULL,
        offer_decision TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await db.query(`CREATE INDEX idx_offer_decision ON property_detail(offer_decision);`);
    
    console.log('✅ Table created successfully!');
    await db.end();
    return true;
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    await db.end();
    return false;
  }
}

async function setup() {
  console.log('🚀 Supabase Property Monitor Setup\n');
  console.log('This will help you configure your Supabase connection.\n');
  
  console.log('📍 Where to find your credentials:');
  console.log('1. Go to https://app.supabase.com');
  console.log('2. Select your project');
  console.log('3. Go to Settings → Database\n');
  
  // Get project reference
  console.log('Your project URL looks like: https://xxxxxxxxxxxxx.supabase.co');
  const projectRef = await question('Enter your project reference (the xxxxxxxxxxxxx part): ');
  
  if (!projectRef) {
    console.log('❌ Project reference is required');
    rl.close();
    return;
  }
  
  // Get password
  const password = await question('Enter your database password: ');
  
  if (!password) {
    console.log('❌ Password is required');
    rl.close();
    return;
  }
  
  const config = {
    host: `db.${projectRef}.supabase.co`,
    password: password
  };
  
  // Test connection
  const testResult = await testConnection(config);
  
  if (!testResult.success) {
    console.log('\n❌ Connection failed:', testResult.error);
    console.log('\nPossible issues:');
    console.log('1. Check your project reference (should not include .supabase.co)');
    console.log('2. Verify your password is correct');
    console.log('3. Make sure your project is not paused\n');
    
    const retry = await question('Would you like to try again? (y/n): ');
    if (retry.toLowerCase() === 'y') {
      rl.close();
      require('child_process').fork(__filename);
      return;
    }
    rl.close();
    return;
  }
  
  // Check if table exists
  if (!testResult.tableExists) {
    console.log('\n⚠️  Table "property_detail" not found.');
    const create = await question('Would you like to create it now? (y/n): ');
    
    if (create.toLowerCase() === 'y') {
      await createTable(config);
    }
  } else {
    console.log('✅ Table "property_detail" exists');
  }
  
  // Save configuration
  const envContent = `# Supabase Database Configuration
DB_TYPE=postgresql
DB_HOST=db.${projectRef}.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=${password}

# Application Settings
POLL_INTERVAL_SECONDS=30
HOUSECANARY_TEMPLATE_PATH=./downloads/sample_dexp_input.xlsx
OUTPUT_DIRECTORY=./output
`;
  
  fs.writeFileSync('.env', envContent);
  console.log('\n✅ Configuration saved to .env file');
  
  // Ask if they want to start monitoring
  const startNow = await question('\nWould you like to start monitoring now? (y/n): ');
  
  if (startNow.toLowerCase() === 'y') {
    console.log('\n🚀 Starting monitor...\n');
    rl.close();
    require('child_process').spawn('npm', ['run', 'monitor:supabase'], { 
      stdio: 'inherit',
      shell: true 
    });
  } else {
    console.log('\nTo start monitoring later, run:');
    console.log('  npm run monitor:supabase\n');
    rl.close();
  }
}

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nSetup cancelled.');
  process.exit(0);
});

setup();