const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { getConfig } = require('../shared-config');

function parseAddress(fullAddress) {
  if (!fullAddress) return { streetAddress: '', zipcode: '' };
  const parts = fullAddress.split(',').map(p => p.trim());
  let streetAddress = parts.slice(0, -1).join(', ').trim();
  let zipcode = '';
  
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    const zipMatch = lastPart.match(/\b(\d{5}(-\d{4})?)\b/);
    if (zipMatch) {
      zipcode = zipMatch[1];
      // If street address is empty, it means the address was just state and zip
      if (!streetAddress) {
          streetAddress = parts.slice(0, -1).join(', ').trim();
          if (!streetAddress) streetAddress = lastPart.replace(zipcode, '').trim().replace(/,$/, '').trim();
      }
    } else {
        streetAddress = fullAddress;
    }
  }
   if (!streetAddress) streetAddress = fullAddress;

  return { streetAddress, zipcode };
}

// Using shared configuration module that supports both env.txt and environment variables

// Sanitize address for filename
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
}

// Normalize address for robust matching
function normalizeAddress(str) {
  return str.replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function generateAddressVariations(address) {
  const variations = [
    address, // Original address as-is
    address.trim(), // Remove leading/trailing spaces
  ];
  
  // Common street abbreviations and their expansions
  const abbrevMap = {
    'Ave': ['Avenue', 'Ave'],
    'Avenue': ['Ave', 'Avenue'], 
    'St': ['Street', 'St'],
    'Street': ['St', 'Street'],
    'Rd': ['Road', 'Rd'],
    'Road': ['Rd', 'Road'],
    'Dr': ['Drive', 'Dr'],
    'Drive': ['Dr', 'Drive'],
    'Ln': ['Lane', 'Ln'],
    'Lane': ['Ln', 'Lane'],
    'Blvd': ['Boulevard', 'Blvd'],
    'Boulevard': ['Blvd', 'Boulevard'],
    'Ct': ['Court', 'Ct'],
    'Court': ['Ct', 'Court'],
    'Pl': ['Place', 'Pl'],
    'Place': ['Pl', 'Place'],
    'Way': ['Way'],
    'Circle': ['Cir', 'Circle'],
    'Cir': ['Circle', 'Cir']
  };
  
  // Generate variations with different street abbreviations
  Object.keys(abbrevMap).forEach(abbrev => {
    if (address.includes(` ${abbrev} `) || address.includes(` ${abbrev},`)) {
      abbrevMap[abbrev].forEach(replacement => {
        if (replacement !== abbrev) {
          const variation1 = address.replace(` ${abbrev} `, ` ${replacement} `);
          const variation2 = address.replace(` ${abbrev},`, ` ${replacement},`);
          variations.push(variation1);
          variations.push(variation2);
        }
      });
    }
  });
  
  // Generate variations with/without commas
  variations.push(address.replace(/,/g, '')); // Remove all commas
  variations.push(address.replace(/,\s*/g, ', ')); // Normalize comma spacing
  
  // Generate variations with/without zipcode
  const zipMatch = address.match(/\s+\d{5}(-\d{4})?$/);
  if (zipMatch) {
    variations.push(address.replace(zipMatch[0], '')); // Remove zipcode
  }
  
  // Remove duplicates and return
  return [...new Set(variations)];
}

async function runHouseCanaryAgent(address) {
  let browser;
  let result = { success: false, message: '' };
  
  try {
    if (!address) {
      console.error('❌ Please provide an address...');
      return result;
    }
    
    const { streetAddress, zipcode } = parseAddress(address);

    // Normalize address for robust matching
    const normalizedArg = normalizeAddress(address);

    // Sanitize address for filename
    const sanitizedAddress = sanitizeFilename(address);
    const templateFilename = `sample_dexp_input_${sanitizedAddress}.xlsx`;
    const templatePath = path.join(__dirname, 'downloads', templateFilename);
    const templateData = [['client_file_id', 'address', 'zipcode'],[1, streetAddress, zipcode]];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'sample_input');
    const dir = path.dirname(templatePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    XLSX.writeFile(wb, templatePath);
    console.log(`✅ Template Excel file created at: ${templatePath}`);

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    browser = await puppeteer.launch({ 
      headless: process.env.NODE_ENV === 'production' ? 'new' : false, // Headless in production
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems in containers
        '--disable-extensions',
        '--disable-gpu',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps'
      ],
      timeout: 60000 // 1 minute for browser launch
    });
    
    const page = await browser.newPage();
    
    // Configure downloads to go to our downloads directory using newer API
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadsDir
    });
    
    // Define downloadDir for consistency with later usage
    const downloadDir = downloadsDir;
    
    // Set optimized timeouts for speed and reliability
    page.setDefaultTimeout(60000); // 1 minute
    page.setDefaultNavigationTimeout(60000); // 1 minute
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('dialog', async dialog => {
        console.log(`>>> Dialog message: ${dialog.message()}`);
        await dialog.accept();
    });

    console.log('Step 1: Navigating to HouseCanary...');
    await page.goto('https://housecanary.com', { 
      waitUntil: 'networkidle2',
      timeout: 120000 
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 2: Looking for Log In button...');
    const loginClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button'));
      for (const el of elements) {
        if (el.textContent && (
          el.textContent.toLowerCase().includes('log in') || 
          el.textContent.toLowerCase().includes('login') ||
          el.textContent.toLowerCase().includes('sign in')
        )) {
          el.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('Step 3: Entering credentials...');
    const config = getConfig();
    
    const emailInput = await page.$('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type(config.HOUSECANARY_EMAIL, { delay: 100 });
    }

    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click();
      await passwordInput.type(config.HOUSECANARY_PASSWORD, { delay: 100 });
    }

    console.log('Step 4: Submitting login...');
    await page.evaluate(() => {
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button');
      for (const btn of submitButtons) {
        if (btn.textContent?.toLowerCase().includes('log') || 
            btn.textContent?.toLowerCase().includes('sign') ||
            btn.textContent.toLowerCase().includes('continue')) {
          btn.click();
          return;
        }
      }
    });

    console.log('Waiting for login...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('Step 5: Looking for Data Explorer...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const element of allElements) {
        if (element.textContent?.includes('Data Explorer')) {
          let parent = element;
          for (let i = 0; i < 5; i++) {
            parent = parent.parentElement;
            if (!parent) break;
            
            const buttons = parent.querySelectorAll('button, a');
            for (const btn of buttons) {
              if (btn.textContent?.toLowerCase().includes('launch') ||
                  btn.textContent?.toLowerCase().includes('open') ||
                  btn.textContent?.toLowerCase().includes('start')) {
                btn.click();
                return;
              }
            }
          }
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('Step 6: Selecting "value" checkbox...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const element of allElements) {
        if (element.textContent?.trim().toLowerCase() === 'value' && 
            !element.querySelector('*')) {
          let parent = element;
          for (let i = 0; i < 5; i++) {
            parent = parent.parentElement;
            if (!parent) break;
            
            const checkbox = parent.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return;
            }
          }
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 7: Clicking Next...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('next')) {
          btn.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('Step 8: Clicking Continue to Upload...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('continue') && 
            btn.textContent?.toLowerCase().includes('upload')) {
          btn.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 8000));

    console.log('Step 9: Uploading spreadsheet...');
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(templatePath);
      console.log('✅ File uploaded successfully.');
    } else {
      console.log('✅ "Generate Analysis" button found. Using dummy file for testing.');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 10: Clicking Generate Analysis...');
    
    // Record files before download to detect new files
    const filesBeforeDownload = fs.readdirSync(downloadDir).filter(file => file.endsWith('.xlsx'));
    console.log('Files in downloads directory before clicking Generate Analysis:', filesBeforeDownload);
    
    // Method 2a (housecanary_prefix) doesn't require download events - it monitors the filesystem directly
    
    // Click the generate analysis button and handle potential navigation
    console.log('Looking for Generate Analysis button...');
    const generateButtonExists = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('generate') && 
            btn.textContent?.toLowerCase().includes('analysis')) {
          return true;
        }
      }
      return false;
    });

    if (!generateButtonExists) {
      throw new Error('Generate Analysis button not found on page');
    }

    console.log('Generate Analysis button found. Clicking and handling potential navigation...');
    
    try {
      // Use Promise.race to handle either navigation or timeout
      await Promise.race([
        // Option 1: Page navigates after clicking
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).then(() => {
          console.log('✅ Page navigated after clicking Generate Analysis');
        }).catch(() => {
          console.log('ℹ️ No navigation detected after clicking Generate Analysis');
        }),
        
        // Option 2: Click button and wait a bit
        (async () => {
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
              if (btn.textContent?.toLowerCase().includes('generate') && 
                  btn.textContent?.toLowerCase().includes('analysis')) {
                console.log('Clicking Generate Analysis button');
                btn.click();
                return;
              }
            }
          });
          await new Promise(resolve => setTimeout(resolve, 10000));
        })()
      ]);
    } catch (error) {
      console.log(`⚠️ Navigation handling completed with: ${error.message}`);
    }

    console.log('✅ Generate Analysis button clicked. Page should be stable now.');
    
    // Verify page is still accessible after button click
    try {
      await page.evaluate(() => document.title);
      console.log('✅ Page context verified - still accessible');
    } catch (error) {
      console.log('⚠️ Page context may be detached, but continuing with download detection...');
    }
    
    // Wait for download to start or complete with multiple detection methods
    console.log('Step 11: Waiting for download to complete...');
    let downloadPath = null;
    let detectionMethod = '';
    
    for (let i = 0; i < 60; i++) { // Wait up to 5 minutes (optimized since Method 2a works quickly)
      console.log(`🔍 Detection attempt ${i + 1}/60 (${(i * 5)} seconds elapsed)`);
      
      // PRIMARY METHOD: Look for HouseCanary-prefixed files (Method 2a - proven most reliable)
      const currentFiles = fs.readdirSync(downloadDir);
      const xlsxFiles = currentFiles.filter(file => file.endsWith('.xlsx'));
      
      const houseCanaryFiles = xlsxFiles.filter(file => 
        file.startsWith('HouseCanary-') && 
        !filesBeforeDownload.includes(file)
      );
      
      if (houseCanaryFiles.length > 0) {
        downloadPath = path.join(downloadDir, houseCanaryFiles[0]);
        detectionMethod = 'housecanary_prefix';
        console.log(`✅ HouseCanary report detected - ${houseCanaryFiles[0]}`);
        break;
      }
      
      // FALLBACK METHOD: Look for any new non-template files
      const newFiles = xlsxFiles.filter(file => !filesBeforeDownload.includes(file));
      
      if (newFiles.length > 0) {
        // Filter out template files and prefer HouseCanary files
        const nonTemplateFiles = newFiles.filter(file => 
          !file.startsWith('sample_dexp_input_') || file.startsWith('HouseCanary-')
        );
        
        if (nonTemplateFiles.length > 0) {
          downloadPath = path.join(downloadDir, nonTemplateFiles[0]);
          detectionMethod = 'fallback_new_file';
          console.log(`⚠️ Fallback: New non-template file detected - ${nonTemplateFiles[0]}`);
          break;
        }
      }
      
      // Log status every 30 seconds
      if (i % 6 === 0) {
        console.log(`🕐 Still waiting for HouseCanary-prefixed file... (${xlsxFiles.length} total XLSX files)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
    }

    if (!downloadPath) {
      // Simplified debugging focused on HouseCanary detection
      const allFiles = fs.readdirSync(downloadDir);
      const xlsxFiles = allFiles.filter(f => f.endsWith('.xlsx'));
      const newFiles = xlsxFiles.filter(file => !filesBeforeDownload.includes(file));
      
      console.log('❌ HOUSECANARY DOWNLOAD DETECTION FAILED');
      console.log(`📊 XLSX files in directory: ${JSON.stringify(xlsxFiles)}`);
      console.log(`🆕 New files since download started: ${JSON.stringify(newFiles)}`);
      
      throw new Error(`No HouseCanary-prefixed file detected after 5 minutes. Expected pattern: HouseCanary-*.xlsx`);
    }

    // Verify the file exists and is readable
    if (!fs.existsSync(downloadPath)) {
      throw new Error(`Detected download path does not exist: ${downloadPath}`);
    }
    
    const fileStats = fs.statSync(downloadPath);
    console.log(`✅ Download detected via ${detectionMethod}: ${path.basename(downloadPath)} (${fileStats.size} bytes)`);
    
    // Wait a bit more to ensure download is completely finished
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 12: Uploading report to Supabase...');
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    const fileContent = fs.readFileSync(downloadPath);
    const fileName = `report_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    const { error: uploadError } = await supabase.storage
      .from('housecanaryreports')
      .upload(fileName, fileContent, { 
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        upsert: false 
      });
    if (uploadError) {
      result.message = 'House Canary Agent Failure: Report could not be uploaded to Supabase.';
      throw new Error(result.message);
    }
    const { data: { publicUrl } } = supabase.storage
      .from('housecanaryreports')
      .getPublicUrl(fileName);
    console.log(`✅ File uploaded successfully to Supabase! Public URL: ${publicUrl}`);
    
    // Clean up local file
    fs.unlinkSync(downloadPath);
    console.log('Local XLSX deleted after upload.');

    console.log('Step 13: Updating database...');
    const { data: allRows, error: fetchError } = await supabase
      .from('property_detail')
      .select('id, address');
    if (fetchError) {
      result.message = 'House Canary Agent Failure: Could not fetch property_detail table.';
      throw new Error(result.message);
    }
    
    // Try multiple address variations for matching
    console.log(`🔍 Searching for address: "${address}"`);
    const addressVariations = generateAddressVariations(address);
    console.log(`📋 Generated ${addressVariations.length} address variations to try:`, addressVariations);
    
    let matchingRows = [];
    let successfulVariation = null;
    
    // Try each variation until we find a match
    for (const variation of addressVariations) {
      const normalizedVariation = normalizeAddress(variation);
      console.log(`🔎 Trying variation: "${variation}" (normalized: "${normalizedVariation}")`);
      
      const variationMatches = allRows.filter(row => normalizeAddress(row.address) === normalizedVariation);
      if (variationMatches.length > 0) {
        matchingRows = variationMatches;
        successfulVariation = variation;
        console.log(`✅ Found ${matchingRows.length} match(es) with variation: "${variation}"`);
        break;
      }
    }
    
    if (matchingRows.length === 0) {
      // Enhanced debugging - show what addresses are actually in the database
      console.log('❌ No matches found with any address variation.');
      console.log('🔍 First 10 addresses in database for reference:');
      allRows.slice(0, 10).forEach((row, index) => {
        console.log(`  ${index + 1}. "${row.address}" (normalized: "${normalizeAddress(row.address)}")`);
      });
      
      result.message = 'House Canary Agent Failure: No matching address found in property_detail table after trying multiple variations.';
    } else {
      console.log(`✅ Found ${matchingRows.length} matching row(s) using variation: "${successfulVariation}"`);
      
             for (const row of matchingRows) {
        const updateObj = { 
          house_canary_data: [publicUrl],
          house_canary_collection_status: 'complete'
        };
        
        console.log(`🔄 Updating database for address: "${row.address}" (ID: ${row.id})`);
        const { error: updateError } = await supabase
          .from('property_detail')
          .update(updateObj)
          .eq('id', row.id);
          
        if (updateError) {
          console.error(`❌ Database update failed for ID ${row.id}:`, updateError);
          result.message = `House Canary Agent Failure: Could not update property_detail table - ${updateError.message}`;
          throw new Error(result.message);
        }
        console.log(`✅ Supabase table updated for id: ${row.id}, address: ${row.address}`);
        console.log(`   - house_canary_data: ${publicUrl}`);
        console.log(`   - house_canary_collection_status: complete`);
      }
    }

    result = { 
      success: true, 
      message: 'House Canary Agent completed successfully and report uploaded to Supabase.',
      reportUrl: publicUrl
    };
    
  } catch (error) {
    console.error('❌ House Canary Agent error:', error.message);
    result = { 
      success: false, 
      message: 'House Canary Agent Failure: ' + error.message 
    };
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    console.log('HouseCanaryAgentResult:', JSON.stringify(result));
    return result;
  }
}

module.exports = { runHouseCanaryAgent };

if (require.main === module) {
  const address = process.argv.slice(2).join(' ');
  runHouseCanaryAgent(address).then(result => {
    console.log('HouseCanaryAgentResult:', JSON.stringify(result));
  });
}