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

    if (!loginClicked) {
      console.log('Could not find login button by text, trying by href...');
      await page.goto('https://app.housecanary.com/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
    }

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
        if (btn.textContent?.toLowerCase().includes('log') || btn.textContent?.toLowerCase().includes('sign')) {
          btn.click();
          return true;
        }
      }
      // Method 2: Submit form directly
      const forms = document.querySelectorAll('form');
      if (forms.length > 0) {
        forms[0].submit();
        return true;
      }
      return false;
    });

    if (!submitted) {
      console.log('Could not submit form, pressing Enter...');
      await page.keyboard.press('Enter');
    }

    console.log('Waiting for login to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('Step 6: Navigating to platform page...');
    await page.goto('https://app.housecanary.com/platform', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 7: Looking for Data Explorer card and clicking Launch...');
    const dataExplorerLaunched = await page.evaluate(() => {
      // Look for the Data Explorer card
      const cards = Array.from(document.querySelectorAll('div[class*="card"], div[class*="Card"]'));
      for (const card of cards) {
        if (card.textContent?.includes('Data Explorer') || card.textContent?.includes('data explorer')) {
          // Look for Launch button within this card
          const launchBtn = card.querySelector('button, a');
          const buttons = Array.from(card.querySelectorAll('button, a'));
          for (const btn of buttons) {
            if (btn.textContent?.toLowerCase().includes('launch')) {
              btn.click();
              return true;
            }
          }
        }
      }
      return false;
    });

    if (!dataExplorerLaunched) {
      console.log('Could not find Launch button, trying direct navigation...');
      await page.goto('https://app.housecanary.com/data-explorer', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 8: Looking for "value" in the property block...');
    // Scroll down to find property block
    await page.evaluate(() => {
      // Look for property block section
      const sections = document.querySelectorAll('div, section');
      for (const section of sections) {
        if (section.textContent?.toLowerCase().includes('property')) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 9: Finding and clicking checkbox for "value" row...');
    const checkboxClicked = await page.evaluate(() => {
      // Look for rows in tables or lists
      const rows = Array.from(document.querySelectorAll('tr, li, div[class*="row"]'));
      for (const row of rows) {
        // Check if this row contains "value" in the first column/cell
        const firstCell = row.querySelector('td:first-child, div:first-child');
        if (firstCell && firstCell.textContent?.toLowerCase().trim() === 'value') {
          const checkbox = row.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.click();
            return true;
          }
        }
      }
      
      // Alternative: Look for any checkbox near "value" text
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        if (el.textContent?.toLowerCase().trim() === 'value') {
          const nearbyCheckbox = el.parentElement?.querySelector('input[type="checkbox"]') || 
                                el.nextElementSibling?.querySelector('input[type="checkbox"]');
          if (nearbyCheckbox) {
            nearbyCheckbox.click();
            return true;
          }
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 10: Scrolling down to find Next button...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 11: Clicking Next button in bottom block...');
    const nextClicked = await page.evaluate(() => {
      // Look for a block/div that appeared at the bottom
      const bottomElements = Array.from(document.querySelectorAll('div[class*="bottom"], div[class*="footer"], div[class*="fixed"]'));
      for (const element of bottomElements) {
        const buttons = element.querySelectorAll('button, a');
        for (const btn of buttons) {
          if (btn.textContent?.toLowerCase().trim() === 'next') {
            btn.click();
            return true;
          }
        }
      }
      
      // Fallback: any Next button
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of allButtons) {
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
      // Look for popup/modal elements
      const modals = Array.from(document.querySelectorAll('div[class*="modal"], div[class*="popup"], div[class*="dialog"], div[role="dialog"]'));
      for (const modal of modals) {
        const buttons = modal.querySelectorAll('button, a');
        for (const btn of buttons) {
          if (btn.textContent?.toLowerCase().includes('continue') && 
              btn.textContent?.toLowerCase().includes('upload')) {
            btn.click();
            return true;
          }
        }
      }
      
      // Fallback: any Continue to Upload button
      const allButtons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of allButtons) {
        if (btn.textContent?.toLowerCase().includes('continue') && 
            btn.textContent?.toLowerCase().includes('upload')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 13: Looking for "Download a sample spreadsheet" in top right of Upload File box...');
    
    // Set up download promise before clicking
    const downloadPromise = new Promise((resolve) => {
      page.once('download', download => resolve(download));
    });

    // Click download link in top right corner
    const downloadClicked = await page.evaluate(() => {
      // Look for upload file box/modal
      const uploadBoxes = Array.from(document.querySelectorAll('div[class*="upload"], div[class*="Upload"]'));
      for (const box of uploadBoxes) {
        // Look in top right area of the box
        const links = box.querySelectorAll('a, button');
        for (const link of links) {
          if (link.textContent?.toLowerCase().includes('download') && 
              link.textContent?.toLowerCase().includes('sample') &&
              link.textContent?.toLowerCase().includes('spreadsheet')) {
            link.click();
            return true;
          }
        }
      }
      
      // Fallback: any download sample spreadsheet link
      const allLinks = Array.from(document.querySelectorAll('a, button'));
      for (const link of allLinks) {
        if (link.textContent?.toLowerCase().includes('download') && 
            link.textContent?.toLowerCase().includes('sample') &&
            link.textContent?.toLowerCase().includes('spreadsheet')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (downloadClicked) {
      console.log('Download link clicked, waiting for file...');
      
      // Wait for download
      const download = await Promise.race([
        downloadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 30000))
      ]);

      const suggestedFileName = download.suggestedFilename();
      const filePath = path.join(downloadPath, suggestedFileName);
      await download.saveAs(filePath);
      
      console.log(`✅ File downloaded successfully to: ${filePath}`);
    } else {
      console.log('❌ Could not find download link');
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    console.error('❌ An error occurred:', error.message);
    console.error('Full error:', error);
  } finally {
    console.log('\nClosing browser in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await browser.close();
  }
}

downloadHouseCanaryReport();