const fs = require('fs');
const path = require('path');

/**
 * Shared configuration module that works with both:
 * 1. Environment variables (GitHub Secrets/CI/CD)
 * 2. Local env.txt files (development)
 */

function parseEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ env.txt not found at ${filePath}, using environment variables only`);
      return {};
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const config = {};
    
    for (const line of lines) {
      const parts = line.split('=');
      if (parts.length === 2) {
        config[parts[0].trim()] = parts[1].trim();
      }
    }
    
    console.log('✅ Loaded env.txt configuration');
    return config;
  } catch (error) {
    console.log(`⚠️ Error reading env.txt: ${error.message}, falling back to environment variables`);
    return {};
  }
}

function getConfig() {
  // Try to load from env.txt first (for local development)
  const envFilePath = path.join(__dirname, '..', 'env.txt');
  const fileConfig = parseEnvFile(envFilePath);
  
  // Create config object with environment variables taking precedence
  const config = {
    // Supabase Configuration
    SUPABASE_URL: process.env.SUPABASE_URL || fileConfig.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || fileConfig.SUPABASE_SERVICE_KEY,
    
    // HouseCanary Configuration
    HOUSECANARY_EMAIL: process.env.HOUSECANARY_EMAIL || fileConfig.HOUSECANARY_EMAIL,
    HOUSECANARY_PASSWORD: process.env.HOUSECANARY_PASSWORD || fileConfig.HOUSECANARY_PASSWORD,
    
    // Environment settings
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 8080
  };
  
  // Validate required configuration
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missingVars = requiredVars.filter(varName => !config[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`❌ Missing required configuration: ${missingVars.join(', ')}`);
  }
  
  console.log('✅ Configuration loaded successfully');
  console.log(`📍 Environment: ${config.NODE_ENV}`);
  console.log(`🔑 Using ${process.env.SUPABASE_URL ? 'environment variables' : 'env.txt file'} for secrets`);
  
  return config;
}

module.exports = { getConfig, parseEnvFile }; 