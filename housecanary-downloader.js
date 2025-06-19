const puppeteer = require('puppeteer');
const path = require('path');

async function downloadHouseCanaryReport() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    const downloadPath = path.join(__dirname, 'downloads');
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    console.log('Navigating to HouseCanary...');
    await page.goto('https://housecanary.com', { waitUntil: 'networkidle2' });

    console.log('Clicking Log In button...');
    // Try multiple possible selectors for the login button
    const loginSelectors = [
      'a[href*="login"]',
      'a[href*="signin"]',
      'button:contains("Log In")',
      'a:contains("Log In")',
      '[class*="login"]',
      '[class*="signin"]'
    ];
    
    let clicked = false;
    for (const selector of loginSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
        clicked = true;
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!clicked) {
      // If none of the selectors worked, try clicking by text
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button'));
        const loginLink = links.find(link => 
          link.textContent.toLowerCase().includes('log in') || 
          link.textContent.toLowerCase().includes('login') ||
          link.textContent.toLowerCase().includes('sign in')
        );
        if (loginLink) loginLink.click();
      });
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log('Entering login credentials...');
    // Wait for and fill email field
    const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]', 'input[name="username"]'];
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.type(selector, 'sean@scholasticcapital.com');
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    // Fill password field
    const passwordSelectors = ['input[type="password"]', 'input[name="password"]', 'input[placeholder*="password" i]'];
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.type(selector, 'mzn-WQB4qgv4yme5dtq');
        break;
      } catch (e) {
        // Try next selector
      }
    }

    console.log('Clicking login button...');
    // Submit the form
    const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', 'button[name="submit"]'];
    for (const selector of submitSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
        break;
      } catch (e) {
        // If no submit button found, try pressing Enter
        await page.keyboard.press('Enter');
      }
    }
    
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);

    console.log('Clicking data explorer...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, span'));
      const dataExplorer = elements.find(el => 
        el.textContent.toLowerCase().includes('data explorer')
      );
      if (dataExplorer) dataExplorer.click();
    });

    await page.waitForTimeout(3000);

    console.log('Searching for "value"...');
    const searchSelectors = ['input[type="search"]', 'input[placeholder*="search" i]', 'input[name="search"]'];
    for (const selector of searchSelectors) {
      try {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.type(selector, 'value');
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    await page.waitForTimeout(2000);

    console.log('Clicking checkbox for "value" row...');
    await page.evaluate(() => {
      // Find the row containing "value" and click its checkbox
      const rows = Array.from(document.querySelectorAll('tr'));
      const valueRow = rows.find(row => row.textContent.toLowerCase().includes('value'));
      if (valueRow) {
        const checkbox = valueRow.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.click();
      }
    });

    console.log('Scrolling to bottom and clicking "next"...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      const nextButton = elements.find(el => 
        el.textContent.toLowerCase().trim() === 'next'
      );
      if (nextButton) nextButton.click();
    });

    await page.waitForTimeout(2000);

    console.log('Clicking "continue to upload"...');
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      const continueButton = elements.find(el => 
        el.textContent.toLowerCase().includes('continue to upload')
      );
      if (continueButton) continueButton.click();
    });

    await page.waitForTimeout(2000);

    console.log('Downloading sample spreadsheet...');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, button'));
        const downloadLink = elements.find(el => 
          el.textContent.toLowerCase().includes('download a sample spreadsheet') ||
          el.textContent.toLowerCase().includes('download sample')
        );
        if (downloadLink) downloadLink.click();
      })
    ]);

    const suggestedFileName = download.suggestedFilename();
    const filePath = path.join(downloadPath, suggestedFileName);
    await download.saveAs(filePath);
    
    console.log(`File downloaded successfully to: ${filePath}`);
    
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await browser.close();
  }
}

downloadHouseCanaryReport();