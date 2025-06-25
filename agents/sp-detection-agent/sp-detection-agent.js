// SP Detection Agent (Waits for SVG H_icon as Map Ready Indicator)
// Steps:
// 1. Launch Puppeteer with a visible browser window.
// 2. Go to https://www.familywatchdog.us
// 3. Wait for and click the "Accept" button on the cookie popup.
// 4. Automate the Select2 search bar:
//   4.1. Click the span#select2-txtAutoComplete-container to activate the input.
//   4.2. Wait for the .select2-search__field input to appear.
//   4.3. Type the address into the input.
//   4.4. Wait for the suggestion dropdown and click the top suggestion.
// 5. Wait for the results to load.
// 6. Scroll down 300 pixels.
// 7. Take a screenshot.
// 8. Upload screenshot to Supabase storage bucket "sexual-predator-maps".
// 9. Update property_detail table with the screenshot link in sexual_predators_data column.

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { getConfig } = require('../shared-config');

// Using shared configuration module that supports both env.txt and environment variables

async function runSpDetectionAgent(address) {
  let result = { success: false, message: '' };
  let browser;
  
  if (!address) {
    console.error('No address provided.');
    result.message = 'Sexual Predator Detection Agent Failure: No address provided.';
    console.log('SpDetectionAgentResult:', JSON.stringify(result));
    return result;
  }
  
  console.log('SP Detection Agent started.');
  
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
    
    let screenshotTaken = false;
    let screenshotPath = path.join(__dirname, 'sp_detection_result.png');
    let screenshotUrl = '';
    let dbUpdated = false;
    let updatedRowCount = 0;
    
    console.log('Step 1: Navigating to FamilyWatchdog...');
    await page.goto('https://www.familywatchdog.us', { 
      waitUntil: 'networkidle2',
      timeout: 120000 
    });
    console.log('Page loaded successfully.');

    // Accept cookies with longer timeout
    console.log('Step 2: Looking for cookie popup...');
    try {
      await page.waitForSelector('button', { visible: true, timeout: 15000 });
      const accepted = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const acceptBtn = buttons.find(btn => btn.textContent.trim() === 'Accept');
        if (acceptBtn) {
          acceptBtn.click();
          return true;
        }
        return false;
      });
      if (accepted) {
        console.log('Clicked Accept on cookie popup.');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log('No Accept button found, continuing...');
      }
    } catch (error) {
      console.log('No cookie popup found or already accepted, continuing...');
    }

    // Automate Select2 search bar with better error handling
    console.log('Step 3: Setting up Select2 search...');
    await page.waitForSelector('#select2-txtAutoComplete-container', { visible: true, timeout: 30000 });
    await page.click('#select2-txtAutoComplete-container');
    console.log('Clicked Select2 search bar container.');
    
    await page.waitForSelector('.select2-search__field', { visible: true, timeout: 30000 });
    console.log('Select2 input appeared.');
    
    // Clear the field and paste the address
    await page.evaluate((addressToPaste) => {
      const input = document.querySelector('.select2-search__field');
      if (input) {
        input.value = '';
        input.value = addressToPaste;
        // Trigger input event to notify Select2 of the change
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, address);
    console.log('Address pasted into Select2 input.');

    // Wait for the suggestion dropdown with longer timeout
    console.log('Step 4: Waiting for search suggestions...');
    await page.waitForSelector('.select2-results__option', { visible: true, timeout: 45000 });
    await new Promise(r => setTimeout(r, 1000)); // Wait for dropdown to fully render
    
    const beforeClickPath = path.join(__dirname, 'sp_detection_before_mouse_click.png');
    await page.screenshot({ path: beforeClickPath });
    console.log('Screenshot before mouse click saved to', beforeClickPath);

    // Use Puppeteer's mouse API to click the first suggestion
    console.log('Step 5: Clicking search suggestion...');
    const optionBox = await page.$eval('.select2-results__option', el => {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    await page.mouse.move(optionBox.x, optionBox.y);
    await page.mouse.click(optionBox.x, optionBox.y);
    console.log('Mouse moved and clicked top suggestion in Select2 dropdown.');
    
    const afterClickPath = path.join(__dirname, 'sp_detection_after_mouse_click.png');
    await page.screenshot({ path: afterClickPath });
    console.log('Screenshot after mouse click saved to', afterClickPath);

    // Wait for the map canvas to be present with longer timeout
    console.log('Step 6: Waiting for map canvas...');
    await page.waitForSelector('#map_canvas', { visible: true, timeout: 90000 });

    // Wait for the SVG with class 'H_icon' to appear (map ready indicator)
    console.log("Step 7: Waiting for map to finish loading...");
    await page.waitForSelector('svg.H_icon', { visible: true, timeout: 120000 });
    console.log("SVG with class 'H_icon' appeared. Waiting 8 seconds for map to finish rendering...");
    await new Promise(r => setTimeout(r, 8000));

    // Scroll #map_canvas into view before taking the screenshot
    console.log('Step 8: Preparing for screenshot...');
    await page.evaluate(() => {
      const map = document.querySelector('#map_canvas');
      if (map) map.scrollIntoView({ behavior: 'auto' });
    });
    console.log('#map_canvas should now be at the top of the viewport.');

    // Take a full-page screenshot
    console.log('Step 9: Taking screenshot...');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshotTaken = true;
    console.log('Screenshot saved to', screenshotPath);

    // Upload to Supabase Storage
    console.log('Step 10: Uploading screenshot to Supabase...');
    const config = getConfig();
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    const fileContent = fs.readFileSync(screenshotPath);
    const fileName = `sp_map_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const { error: uploadError } = await supabase.storage
      .from('sexual-predator-maps')
      .upload(fileName, fileContent, { 
        contentType: 'image/png', 
        upsert: false 
      });
    if (uploadError) {
      result.message = 'Sexual Predator Detection Agent Failure: Screenshot could not be uploaded to Supabase.';
      throw new Error(result.message);
    }
    const { data: { publicUrl } } = supabase.storage
      .from('sexual-predator-maps')
      .getPublicUrl(fileName);
    screenshotUrl = publicUrl;
    console.log(`✅ Screenshot uploaded successfully to Supabase! Public URL: ${publicUrl}`);

    // Update Database (fetch all rows, normalize, and update matching row(s))
    console.log('Step 11: Updating database...');
    const { data: allRows, error: fetchError } = await supabase
      .from('property_detail')
      .select('id, address');
    if (fetchError) {
      result.message = 'Sexual Predator Detection Agent Failure: Could not fetch property_detail table.';
      throw new Error(result.message);
    }
    function normalizeAddress(str) {
      return str.replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    }
    const normalizedArg = normalizeAddress(address);
    const matchingRows = allRows.filter(row => normalizeAddress(row.address) === normalizedArg);
    if (matchingRows.length === 0) {
      result.message = 'Sexual Predator Detection Agent Failure: No matching address found in property_detail table.';
    } else {
      console.log(`Found ${matchingRows.length} matching row(s) after normalization.`);
      for (const row of matchingRows) {
        const updateObj = { sexual_predators_data: [publicUrl] };
        if (matchingRows.length === 1) {
          updateObj.sexual_predators_collection_status = 'complete';
        }
        const { error: updateError } = await supabase
          .from('property_detail')
          .update(updateObj)
          .eq('id', row.id);
        if (updateError) {
          result.message = 'Sexual Predator Detection Agent Failure: Could not update property_detail table.';
          throw new Error(result.message);
        }
        dbUpdated = true;
        updatedRowCount++;
        console.log(`✅ Supabase table updated for id: ${row.id}, address: ${row.address}`);
      }
    }
    
    // Set success result
    result = { 
      success: true, 
      message: 'Sexual Predator Detection Agent completed successfully and screenshot uploaded to Supabase.',
      screenshotPath,
      screenshotUrl,
      dbUpdated,
      updatedRowCount
    };
    
  } catch (error) {
    console.error('❌ SP Detection Agent error:', error.message);
    result = { 
      success: false, 
      message: 'Sexual Predator Detection Agent Failure: ' + error.message,
      screenshotPath: screenshotTaken ? screenshotPath : null,
      screenshotUrl: screenshotUrl || null
    };
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    console.log('SpDetectionAgentResult:', JSON.stringify(result));
    return result;
  }
}

module.exports = { runSpDetectionAgent };

if (require.main === module) {
  const address = process.argv.slice(2).join(' ');
  runSpDetectionAgent(address);
}
