const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function downloadHouseCanaryReport() {
  // Ensure downloads directory exists
  const downloadPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
    executablePath: puppeteer.executablePath()
  });

  try {
    const page = await browser.newPage();
    
    // Set download behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    // Add console logging for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    console.log('Step 1: Navigating to HouseCanary...');
    await page.goto('https://housecanary.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 2: Looking for Log In button...');
    // Try to find and click login button
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

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 3: Entering email...');
    // Try to find email input
    const emailInput = await page.$('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type('sean@scholasticcapital.com');
    }

    console.log('Step 4: Entering password...');
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click();
      await passwordInput.type('mzn-WQB4qgv4yme5dtq');
    }

    console.log('Step 5: Submitting login form...');
    // Try multiple methods to submit
    const submitted = await page.evaluate(() => {
      // Method 1: Click submit button
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button');
      for (const btn of submitButtons) {
        if (btn.textContent?.toLowerCase().includes('log') || 
            btn.textContent?.toLowerCase().includes('sign') ||
            btn.textContent?.toLowerCase().includes('continue')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (!submitted) {
      console.log('Could not find submit button, pressing Enter...');
      await page.keyboard.press('Enter');
    }

    console.log('Waiting for login to complete and navigation...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Log current URL after login
    console.log('Current URL after login:', page.url());

    console.log('Step 6: Looking for Data Explorer...');
    
    // First, check if we're already on a page with Data Explorer
    const hasDataExplorer = await page.evaluate(() => {
      const text = document.body.textContent.toLowerCase();
      return text.includes('data explorer');
    });

    if (hasDataExplorer) {
      console.log('Found Data Explorer on current page');
    } else {
      // Try to find a link to platform or dashboard
      console.log('Looking for navigation to platform/dashboard...');
      const navigated = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent?.toLowerCase().includes('platform') ||
              link.textContent?.toLowerCase().includes('dashboard') ||
              link.textContent?.toLowerCase().includes('home')) {
            link.click();
            return true;
          }
        }
        return false;
      });

      if (navigated) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('Step 7: Looking for Data Explorer card and clicking Launch...');
    const dataExplorerLaunched = await page.evaluate(() => {
      // Look for Data Explorer text and nearby Launch button
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const element of allElements) {
        if (element.textContent?.includes('Data Explorer') || 
            element.textContent?.includes('data explorer')) {
          // Look for Launch button in parent elements
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
                return true;
              }
            }
          }
        }
      }
      
      // Alternative: Click directly on Data Explorer text/link
      const links = Array.from(document.querySelectorAll('a, button'));
      for (const link of links) {
        if (link.textContent?.includes('Data Explorer')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Current URL:', page.url());

    console.log('Step 8: Looking for property data section...');
    
    // Wait for the page to load property options
    await page.waitForSelector('input[type="checkbox"]', { timeout: 10000 }).catch(() => {
      console.log('No checkboxes found yet...');
    });

    console.log('Step 9: Finding and clicking checkbox for "value"...');
    const checkboxClicked = await page.evaluate(() => {
      // Method 1: Look for text "value" and find nearby checkbox
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const element of allElements) {
        // Look for exact match of "value"
        if (element.textContent?.trim().toLowerCase() === 'value' && 
            !element.querySelector('*')) { // Ensure it's a leaf node
          // Look for checkbox in parent elements
          let parent = element;
          for (let i = 0; i < 5; i++) {
            parent = parent.parentElement;
            if (!parent) break;
            
            const checkbox = parent.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              return true;
            }
          }
        }
      }
      
      // Method 2: Look in table rows
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells[0]?.textContent?.trim().toLowerCase() === 'value') {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            return true;
          }
        }
      }
      
      return false;
    });

    if (!checkboxClicked) {
      console.log('Could not find value checkbox automatically, trying alternative method...');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 10: Scrolling down to find Next button...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 11: Clicking Next button...');
    const nextClicked = await page.evaluate(() => {
      // Look for Next button, preferably in a bottom/footer area
      const buttons = Array.from(document.querySelectorAll('button, a'));
      
      // First try: buttons at the bottom of the page
      const bottomButtons = buttons.filter(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.top > window.innerHeight * 0.7;
      });
      
      for (const btn of bottomButtons) {
        if (btn.textContent?.toLowerCase().trim() === 'next' ||
            btn.textContent?.toLowerCase().includes('next')) {
          btn.click();
          return true;
        }
      }
      
      // Fallback: any Next button
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().trim() === 'next') {
          btn.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 12: Clicking "Continue to Upload" in popup...');
    const continueClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('continue') && 
            btn.textContent?.toLowerCase().includes('upload')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 13: Looking for "Download a sample spreadsheet"...');
    
    // Set up download promise before clicking
    const downloadPromise = new Promise((resolve) => {
      page.once('download', download => resolve(download));
    });

    // Click download link
    const downloadClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, span'));
      for (const link of links) {
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('download') && 
            text.includes('sample') &&
            text.includes('spreadsheet')) {
          // Check if it's a link or make it clickable
          if (link.tagName === 'A' || link.tagName === 'BUTTON') {
            link.click();
          } else {
            link.style.cursor = 'pointer';
            link.click();
          }
          return true;
        }
      }
      return false;
    });

    if (downloadClicked) {
      console.log('Download link clicked, waiting for file...');
      
      try {
        // Wait for download with timeout
        const download = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 30000))
        ]);

        const suggestedFileName = download.suggestedFilename();
        const filePath = path.join(downloadPath, suggestedFileName);
        await download.saveAs(filePath);
        
        console.log(`✅ File downloaded successfully to: ${filePath}`);
      } catch (error) {
        console.log('❌ Download failed:', error.message);
      }
    } else {
      console.log('❌ Could not find download link');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    console.error('❌ An error occurred:', error.message);
    
    // Take debugging screenshot
    try {
      const pages = await browser.pages();
      if (pages.length > 0) {
        const screenshotPath = path.join(downloadPath, `error-${Date.now()}.png`);
        await pages[0].screenshot({ path: screenshotPath, fullPage: true });
        console.log('Debug screenshot saved to:', screenshotPath);
      }
    } catch (e) {
      console.log('Could not take screenshot');
    }
  } finally {
    console.log('\nPress Ctrl+C to close the browser or wait 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await browser.close();
  }
}

downloadHouseCanaryReport();