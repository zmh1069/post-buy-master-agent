// School District Finder Agent
// This agent will be triggered by the Post-Buy Master Agent and will automate school district lookup for a given address.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../shared-config');

// Using shared configuration module that supports both env.txt and environment variables

async function schoolDistrictWorkflow(address) {
  const puppeteer = require('puppeteer');
  const path = require('path');
  const fs = require('fs');
  let result = { success: false, message: '' };
  let browser;
  
  try {
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
    
    console.log('Starting school district workflow for address:', address);
    
    // Step 1: Go to the GreatSchools website
    console.log('Step 1: Navigating to GreatSchools website...');
    await page.goto('https://www.greatschools.org/school-district-boundaries-map/#:~:text=Find%20Your%20School%20District%20and%20Nearby%20Schools&text=District%20Boundary%20Map&text=GreatSchools', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
    console.log('✅ Step 1 complete: Successfully navigated to GreatSchools website');
    
    // Wait for page to load completely
    await new Promise(r => setTimeout(r, 5000));
    
    // Step 2: Click into the search bar
    console.log('Step 2: Looking for search bar...');
    const searchBarSelectors = [
      'input[type="text"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="address" i]',
      'input[placeholder*="location" i]',
      'input[aria-label*="search" i]',
      'input[class*="search"]',
      'input[class*="Search"]',
      '.search-input',
      '#search-input',
      'input[name="search"]',
      'input[name="q"]'
    ];
    
    let searchBar = null;
    for (const selector of searchBarSelectors) {
      try {
        searchBar = await page.$(selector);
        if (searchBar) {
          const isVisible = await searchBar.isVisible();
          if (isVisible) {
            console.log(`Found search bar with selector: ${selector}`);
            break;
          }
        }
      } catch (err) {
        // Continue to next selector
      }
    }
    
    if (!searchBar) {
      throw new Error('Could not find search bar on GreatSchools website');
    }
    
    await searchBar.click();
    console.log('✅ Step 2 complete: Clicked into search bar');
    
    // Step 3: Paste the address
    console.log('Step 3: Pasting address...');
    await page.keyboard.type(address, { delay: 100 });
    console.log('✅ Step 3 complete: Pasted address');
    
    // Step 4: Click search
    console.log('Step 4: Clicking search...');
    await page.keyboard.press('Enter');
    console.log('✅ Step 4 complete: Clicked search');
    
    // Wait for search results to load (reduced timeout)
    console.log('Waiting for search results to load...');
    await new Promise(r => setTimeout(r, 5000));
    
    // Wait for map or results to appear (reduced timeout)
    try {
      await page.waitForSelector('canvas, .map, [class*="map"], [id*="map"]', { 
        visible: true, 
        timeout: 10000  // Reduced from 60000 to 10000 (10 seconds)
      });
      console.log('Map or results container found.');
    } catch (error) {
      console.log('No specific map container found, continuing...');
    }
    
    // Additional wait for any dynamic content (reduced)
    await new Promise(r => setTimeout(r, 3000));
    
    // Zoom out to fit more information in the screenshot
    console.log('Zooming out to fit more information...');
    await page.evaluate(() => {
      // Zoom out by setting the zoom level to 75% (0.75)
      document.body.style.zoom = '0.75';
      // Alternative method using transform scale
      document.body.style.transform = 'scale(0.75)';
      document.body.style.transformOrigin = 'top left';
    });
    
    // Wait a moment for zoom to apply
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 5: Take a screenshot of the page
    console.log('Step 5: Taking screenshot...');
    const screenshotPath = path.join(__dirname, `school_district_result.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('✅ Step 5 complete: Screenshot saved to', screenshotPath);
    
    // Upload to Supabase Storage
    console.log('Step 6: Uploading screenshot to Supabase...');
    const config = getConfig();
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    const fileContent = fs.readFileSync(screenshotPath);
    const fileName = `school_district_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const { error: uploadError } = await supabase.storage
      .from('school-district-maps')
      .upload(fileName, fileContent, { 
        contentType: 'image/png', 
        upsert: false 
      });
    if (uploadError) {
      result.message = 'School District Finder Agent Failure: Screenshot could not be uploaded to Supabase.';
      throw new Error(result.message);
    }
    const { data: { publicUrl } } = supabase.storage
      .from('school-district-maps')
      .getPublicUrl(fileName);
    console.log(`✅ Screenshot uploaded successfully to Supabase! Public URL: ${publicUrl}`);

    // Update Database (fetch all rows, normalize, and update matching row(s))
    console.log('Step 7: Fetching all property_detail rows for robust address matching...');
    const { data: allRows, error: fetchError } = await supabase
      .from('property_detail')
      .select('id, address');
    if (fetchError) {
      result.message = 'School District Finder Agent Failure: Could not fetch property_detail table.';
      throw new Error(result.message);
    }
    function normalizeAddress(str) {
      return str.replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    const normalizedArg = normalizeAddress(address);
    const matchingRows = allRows.filter(row => normalizeAddress(row.address) === normalizedArg);
    if (matchingRows.length === 0) {
      result.message = 'School District Finder Agent Failure: No matching address found in property_detail table.';
      throw new Error(result.message);
    } else {
      console.log(`Found ${matchingRows.length} matching row(s) after normalization.`);
      for (const row of matchingRows) {
        const updateObj = { school_district_confirmation: [publicUrl] };
        if (matchingRows.length === 1) {
          updateObj.school_district_confirmation_collection_status = 'complete';
        }
        const { error: updateError } = await supabase
          .from('property_detail')
          .update(updateObj)
          .eq('id', row.id);
        if (updateError) {
          result.message = 'School District Finder Agent Failure: Could not update property_detail table.';
          throw new Error(result.message);
        }
        console.log(`✅ Supabase table updated for id: ${row.id}, address: ${row.address}`);
      }
    }
    
    result = { success: true, message: 'School district workflow completed successfully and screenshot uploaded to Supabase.', screenshotPath, screenshotUrl: publicUrl };
  } catch (err) {
    console.error('❌ School District Finder Agent error:', err.message);
    result = { success: false, message: 'School district workflow failed: ' + (err.message || 'Unknown error') };
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    return result;
  }
}

async function runSchoolDistrictFinderAgent(address) {
  let result = { success: false, message: '' };
  
  if (!address) {
    console.error('No address provided.');
    result.message = 'School District Finder Agent Failure: No address provided.';
    console.log('SchoolDistrictFinderAgentResult:', JSON.stringify(result));
    return result;
  }
  
  console.log('School District Finder Agent started for address:', address);
  
  try {
    result = await schoolDistrictWorkflow(address);
  } catch (error) {
    console.error('❌ School District Finder Agent error:', error.message);
    result = { success: false, message: 'School District Finder Agent Failure: ' + error.message };
  }
  
  console.log('SchoolDistrictFinderAgentResult:', JSON.stringify(result));
  return result;
}

module.exports = { runSchoolDistrictFinderAgent };

if (require.main === module) {
  const address = process.argv.slice(2).join(' ');
  runSchoolDistrictFinderAgent(address).then(result => {
    console.log('SchoolDistrictFinderAgentResult:', JSON.stringify(result));
  });
} 