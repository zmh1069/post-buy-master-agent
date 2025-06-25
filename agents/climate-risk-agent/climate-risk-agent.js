// Climate Risk Agent
// This agent will be triggered by the Post-Buy Master Agent and will automate climate risk assessment for a given address.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { getConfig } = require('../shared-config');

// Using shared configuration module that supports both env.txt and environment variables

// Function to extract risk factor data from OCR text
function extractRiskFactors(ocrText) {
    console.log('Extracting risk factors from OCR text...');
    console.log('OCR Text:', ocrText);
    
    const riskFactors = {
        flood_factor_data: null,
        fire_factor_data: null,
        wind_factor_data: null,
        air_factor_data: null,
        heat_factor_data: null
    };
    
    // Look for patterns like "X/10" near risk factor keywords
    const lines = ocrText.split('\n');
    
    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        // Look for flood factor (blue numbers)
        if (lowerLine.includes('flood') || lowerLine.includes('flood factor')) {
            const match = line.match(/(\d+)\/10/);
            if (match) {
                riskFactors.flood_factor_data = match[1] + '/10';
                console.log(`Found flood factor: ${riskFactors.flood_factor_data}`);
            }
        }
        
        // Look for fire factor (orange numbers)
        if (lowerLine.includes('fire') || lowerLine.includes('fire factor')) {
            const match = line.match(/(\d+)\/10/);
            if (match) {
                riskFactors.fire_factor_data = match[1] + '/10';
                console.log(`Found fire factor: ${riskFactors.fire_factor_data}`);
            }
        }
        
        // Look for wind factor (green numbers)
        if (lowerLine.includes('wind') || lowerLine.includes('wind factor')) {
            const match = line.match(/(\d+)\/10/);
            if (match) {
                riskFactors.wind_factor_data = match[1] + '/10';
                console.log(`Found wind factor: ${riskFactors.wind_factor_data}`);
            }
        }
        
        // Look for air factor (purple numbers)
        if (lowerLine.includes('air') || lowerLine.includes('air factor')) {
            const match = line.match(/(\d+)\/10/);
            if (match) {
                riskFactors.air_factor_data = match[1] + '/10';
                console.log(`Found air factor: ${riskFactors.air_factor_data}`);
            }
        }
        
        // Look for heat factor (pink numbers)
        if (lowerLine.includes('heat') || lowerLine.includes('heat factor')) {
            const match = line.match(/(\d+)\/10/);
            if (match) {
                riskFactors.heat_factor_data = match[1] + '/10';
                console.log(`Found heat factor: ${riskFactors.heat_factor_data}`);
            }
        }
    }
    
    // If we didn't find individual matches, try a more comprehensive approach
    // Look for the specific pattern we see in the OCR: "1/10 Fire Factor 2/10 Wind Factor 4/10 Air Factor 3/10 Heat Factor"
    const fullLine = ocrText.replace(/\n/g, ' ');
    const factorPattern = /(\d+)\/10\s+(Fire|Wind|Air|Heat|Flood)\s+Factor/g;
    let match;
    
    while ((match = factorPattern.exec(fullLine)) !== null) {
        const value = match[1] + '/10';
        const factorType = match[2].toLowerCase();
        const factorKey = `${factorType}_factor_data`;
        
        if (riskFactors.hasOwnProperty(factorKey)) {
            riskFactors[factorKey] = value;
            console.log(`Found ${factorType} factor: ${value}`);
        }
    }
    
    return riskFactors;
}

// Function to normalize address for robust matching
function normalizeAddress(str) {
  return str.replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Function to update Supabase with risk factor data
async function updateSupabaseWithRiskFactors(address, riskFactors) {
    try {
        console.log('Step 8: Updating Supabase with risk factor data...');
        
        // Load configuration (supports both env.txt and environment variables)
        const config = getConfig();
        
        // Initialize Supabase client
        const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
        
        // Fetch all rows from property_detail
        console.log('Fetching all property_detail rows for robust address matching...');
        const { data: allRows, error: fetchError } = await supabase
            .from('property_detail')
            .select('id, address');
        if (fetchError) throw new Error(`Failed to fetch property_detail rows: ${fetchError.message}`);

        // Normalize and find matching rows
        const normalizedArg = normalizeAddress(address);
        const matchingRows = allRows.filter(row => normalizeAddress(row.address) === normalizedArg);
        let dbUpdated = false;
        let updatedRowCount = 0;
        if (matchingRows.length === 0) {
            throw new Error('No matching address found in property_detail table.');
        } else {
            console.log(`Found ${matchingRows.length} matching row(s) after normalization.`);
            for (const row of matchingRows) {
                const updateObj = {
                    flood_factor_data: riskFactors.flood_factor_data,
                    flood_factor_collection_status: 'complete',
                    fire_factor_data: riskFactors.fire_factor_data,
                    fire_factor_collection_status: 'complete',
                    wind_factor_data: riskFactors.wind_factor_data,
                    wind_factor_collection_status: 'complete',
                    air_factor_data: riskFactors.air_factor_data,
                    air_factor_collection_status: 'complete',
                    heat_factor_data: riskFactors.heat_factor_data,
                    heat_factor_collection_status: 'complete'
                };
                const { error: updateError } = await supabase
                    .from('property_detail')
                    .update(updateObj)
                    .eq('id', row.id);
                if (updateError) {
                    throw new Error('Could not update property_detail table.');
                }
                dbUpdated = true;
                updatedRowCount++;
                console.log(`✅ Supabase table updated for id: ${row.id}, address: ${row.address}`);
            }
        }
        return dbUpdated && updatedRowCount > 0;
    } catch (error) {
        console.error('Error updating Supabase:', error.message);
        throw error;
    }
}

async function runClimateRiskAgent(address) {
  let result = { success: false, message: '' };
  let browser;
  
  if (!address) {
    const msg = 'Climate Risk Agent Failure: No address provided.';
    console.error(msg);
    result.message = msg;
    return result;
  }
  
  console.log('Climate Risk Agent started for address:', address);
  
  try {
    // Step 1: Store the address
    console.log('Step 1: Storing address for climate risk assessment...');
    console.log(`📍 Address stored: ${address}`);
    
    // Step 2: Launch Puppeteer
    console.log('Step 2: Launching browser...');
    browser = await puppeteer.launch({ 
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      timeout: 60000 // 1 minute for browser launch
    });
    
    const page = await browser.newPage();
    
    // Set optimized timeouts for speed and reliability
    page.setDefaultTimeout(60000); // 1 minute
    page.setDefaultNavigationTimeout(60000); // 1 minute
    
    // Step 3: Navigate to First Street Foundation
    console.log('Step 3: Navigating to First Street Foundation...');
    await page.goto('https://riskfactor.com', { 
      waitUntil: 'networkidle2',
      timeout: 120000 
    });
    console.log('✅ Step 3 complete: Successfully navigated to First Street Foundation');
    
    // Take a screenshot right after page load to debug cookie popup
    const beforeCookiesPath = path.join(__dirname, 'climate_risk_before_search.png');
    await page.screenshot({ path: beforeCookiesPath, fullPage: true });
    console.log('Screenshot before cookie handling saved to', beforeCookiesPath);
    
    // Step 4: Handle cookie acceptance popup with robust detection
    console.log('Step 4: Looking for and accepting cookies...');
    
    // Wait a bit for any dynamic content to load
    await new Promise(r => setTimeout(r, 3000));
    
    try {
      // Check for iframes that might contain the cookie popup
      const iframes = await page.$$('iframe');
      console.log(`Found ${iframes.length} iframe(s) on the page`);
      
      await page.waitForSelector('button', { visible: true, timeout: 15000 });
      const cookiesAccepted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        // Debug: Log all button texts found on the page
        console.log('All buttons found on page:');
        buttons.forEach((btn, index) => {
          console.log(`Button ${index}: "${btn.textContent.trim()}" (visible: ${btn.offsetParent !== null})`);
        });
        
        // Look for common cookie consent button texts (prioritize "Allow all" types)
        const cookieButtonTexts = [
          'Allow all', 'Allow All', 'Accept All', 'Accept all',
          'Accept All Cookies', 'Accept & Continue', 'I Accept All',
          'Accept', 'Allow', 'I Accept', 'OK', 'Got it',
          'Agree', 'Continue', 'Allow selection'
        ];
        
        let acceptBtn = null;
        
        // First, try to find exact matches (prefer "Allow all" over "Allow selection")
        for (const text of cookieButtonTexts) {
          acceptBtn = buttons.find(btn => btn.textContent.trim() === text);
          if (acceptBtn) {
            console.log('Found exact match cookie button:', text);
            break;
          }
        }
        
        // If no exact match, try case-insensitive partial matches
        if (!acceptBtn) {
          for (const text of cookieButtonTexts) {
            acceptBtn = buttons.find(btn => 
              btn.textContent.trim().toLowerCase().includes(text.toLowerCase())
            );
            if (acceptBtn) {
              console.log('Found partial match cookie button:', acceptBtn.textContent.trim());
              break;
            }
          }
        }
        
        // If still no match, look for buttons in common cookie consent containers
        if (!acceptBtn) {
          const cookieContainers = document.querySelectorAll(
            '[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"], ' +
            '[id*="gdpr"], [class*="gdpr"], [id*="privacy"], [class*="privacy"], ' +
            '[id*="cookiebot"], [class*="cookiebot"]'
          );
          
          for (const container of cookieContainers) {
            const containerButtons = container.querySelectorAll('button');
            for (const btn of containerButtons) {
              const btnText = btn.textContent.trim().toLowerCase();
              if (btnText.includes('allow all') || btnText.includes('accept all')) {
                acceptBtn = btn;
                console.log('Found in container - allow all button:', btn.textContent.trim());
                break;
              }
            }
            if (acceptBtn) break;
            
            // Fallback to any accept/allow button in cookie containers
            for (const btn of containerButtons) {
              const btnText = btn.textContent.trim().toLowerCase();
              if (btnText.includes('accept') || btnText.includes('allow') || btnText.includes('agree')) {
                acceptBtn = btn;
                console.log('Found in container - general accept button:', btn.textContent.trim());
                break;
              }
            }
            if (acceptBtn) break;
          }
        }
        
        if (acceptBtn) {
          console.log('Clicking cookie consent button:', acceptBtn.textContent.trim());
          acceptBtn.click();
          return true;
        }
        return false;
      });
      
      if (cookiesAccepted) {
        console.log('✅ Successfully clicked cookie consent button');
        await new Promise(r => setTimeout(r, 3000)); // Wait longer for popup to close
      } else {
        console.log('No cookie consent button found, continuing...');
      }
    } catch (error) {
      console.log('No cookie popup found or already accepted, continuing...');
    }
    
    // Step 5: Wait for page to load and look for search input
    console.log('Step 5: Looking for search input...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Try to find the search input field
    const searchSelectors = [
      'input[placeholder*="address" i]',
      'input[placeholder*="search" i]',
      'input[type="text"]',
      'input[name="address"]',
      'input[id*="address"]',
      'input[class*="search"]',
      'input[class*="Search"]'
    ];
    
    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        searchInput = await page.$(selector);
        if (searchInput) {
          const isVisible = await searchInput.isVisible();
          if (isVisible) {
            console.log(`Found search input with selector: ${selector}`);
            break;
          }
        }
      } catch (err) {
        // Continue to next selector
      }
    }
    
    if (!searchInput) {
      throw new Error('Could not find search input on First Street Foundation website');
    }
    
    // Step 6: Enter the address
    console.log('Step 6: Entering address...');
    await searchInput.click();
    await searchInput.type(address, { delay: 100 });
    console.log('✅ Step 6 complete: Address entered');
    
    // Step 7: Wait and submit the search
    console.log('Step 7: Waiting before submitting search...');
    
    // Wait a few seconds for the site to process the input
    await new Promise(r => setTimeout(r, 3000));
    console.log('Waited 3 seconds, now submitting search...');
    
    // Simple approach: Focus on input and press Enter
    await searchInput.focus();
    await page.keyboard.press('Enter');
    console.log('Pressed Enter on search input');
    
    console.log('✅ Step 7 complete: Search submitted');
    
    // Step 8: Wait for results to load
    console.log('Step 8: Waiting for results to load...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Wait for risk factors to appear
    try {
      await page.waitForSelector('[class*="risk"], [class*="factor"], [class*="score"]', { 
        visible: true, 
        timeout: 90000 
      });
      console.log('Risk factors section found.');
    } catch (error) {
      console.log('No specific risk factors section found, continuing...');
    }
    
    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 8000));
    
    // Step 9: Take a screenshot
    console.log('Step 9: Taking screenshot...');
    const screenshotPath = path.join(__dirname, 'climate_risk_result.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('✅ Step 9 complete: Screenshot saved to', screenshotPath);
    
    // Step 10: Extract risk factors using OCR
    console.log('Step 10: Extracting risk factors from screenshot...');
    const { data: { text } } = await Tesseract.recognize(screenshotPath, 'eng', {
      logger: m => console.log(m)
    });
    
    const riskFactors = extractRiskFactors(text);
    console.log('✅ Step 10 complete: Risk factors extracted from screenshot');
    
    // Step 11: Update Supabase
    await updateSupabaseWithRiskFactors(address, riskFactors);
    console.log('✅ Step 11 complete: Supabase updated with risk factor data');
    
    // Set success result
    result = { 
      success: true, 
      message: 'Climate Risk Agent completed successfully and risk factors extracted.',
      screenshotPath,
      riskFactors
    };
    
  } catch (error) {
    console.error('❌ Climate Risk Agent error:', error.message);
    result = { 
      success: false, 
      message: 'Climate Risk Agent Failure: ' + error.message,
      screenshotPath: null,
      riskFactors: null
    };
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    console.log('ClimateRiskAgentResult:', JSON.stringify(result));
    return result;
  }
}

module.exports = { runClimateRiskAgent };

if (require.main === module) {
  const address = process.argv.slice(2).join(' ');
  runClimateRiskAgent(address).then(result => {
    console.log('ClimateRiskAgentResult:', JSON.stringify(result));
  });
} 