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
    // Take a screenshot for debugging
    await page.screenshot({ path: path.join(downloadPath, 'step1-homepage.png') });
    
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
    await page.screenshot({ path: path.join(downloadPath, 'step2-login-page.png') });

    console.log('Step 3: Entering email...');
    // Try to find email input
    const emailInput = await page.$('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type('sean@scholasticcapital.com');
    } else {
      console.log('Could not find email input, trying alternative method...');
      await page.evaluate(() => {
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          if (input.type === 'email' || input.name?.includes('email') || input.placeholder?.toLowerCase().includes('email')) {
            input.value = 'sean@scholasticcapital.com';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }
      });
    }

    console.log('Step 4: Entering password...');
    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click();
      await passwordInput.type('mzn-WQB4qgv4yme5dtq');
    } else {
      console.log('Could not find password input');
    }

    await page.screenshot({ path: path.join(downloadPath, 'step3-credentials-entered.png') });

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
    await page.screenshot({ path: path.join(downloadPath, 'step4-after-login.png') });

    console.log('Step 6: Looking for data explorer...');
    const dataExplorerClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, span, div'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('data explorer')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (!dataExplorerClicked) {
      console.log('Could not find data explorer, navigating directly...');
      await page.goto('https://app.housecanary.com/data-explorer', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.screenshot({ path: path.join(downloadPath, 'step5-data-explorer.png') });

    console.log('Step 7: Searching for "value"...');
    const searchInput = await page.$('input[type="search"], input[placeholder*="search" i]');
    if (searchInput) {
      await searchInput.click();
      await searchInput.type('value');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 8: Clicking checkbox for "value"...');
    await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const labels = document.querySelectorAll('label');
      
      // Try to find by parent element containing "value"
      for (const checkbox of checkboxes) {
        const parent = checkbox.closest('tr, div, li');
        if (parent && parent.textContent?.toLowerCase().includes('value')) {
          checkbox.click();
          return;
        }
      }
      
      // Try to find by label
      for (const label of labels) {
        if (label.textContent?.toLowerCase().includes('value')) {
          const checkbox = label.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.click();
        }
      }
    });

    await page.screenshot({ path: path.join(downloadPath, 'step6-value-selected.png') });

    console.log('Step 9: Scrolling and clicking next...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().trim() === 'next' || 
            el.textContent?.toLowerCase().includes('next')) {
          el.click();
          break;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(downloadPath, 'step7-after-next.png') });

    console.log('Step 10: Clicking continue to upload...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('continue') && 
            el.textContent?.toLowerCase().includes('upload')) {
          el.click();
          break;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(downloadPath, 'step8-upload-page.png') });

    console.log('Step 11: Downloading sample spreadsheet...');
    
    // Set up download promise before clicking
    const downloadPromise = new Promise((resolve) => {
      page.once('download', download => resolve(download));
    });

    // Click download link
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button'));
      for (const el of elements) {
        if (el.textContent?.toLowerCase().includes('download') && 
            (el.textContent?.toLowerCase().includes('sample') || 
             el.textContent?.toLowerCase().includes('spreadsheet'))) {
          el.click();
          break;
        }
      }
    });

    // Wait for download
    console.log('Waiting for download to start...');
    const download = await Promise.race([
      downloadPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 30000))
    ]);

    const suggestedFileName = download.suggestedFilename();
    const filePath = path.join(downloadPath, suggestedFileName);
    await download.saveAs(filePath);
    
    console.log(`✅ File downloaded successfully to: ${filePath}`);
    
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    console.error('❌ An error occurred:', error.message);
    console.error('Full error:', error);
    
    // Take a screenshot of the error state
    try {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({ path: path.join(downloadPath, 'error-screenshot.png') });
        console.log('Error screenshot saved to:', path.join(downloadPath, 'error-screenshot.png'));
      }
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError.message);
    }
  } finally {
    await browser.close();
  }
}

downloadHouseCanaryReport();