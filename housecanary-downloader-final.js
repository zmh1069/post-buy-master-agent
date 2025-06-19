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

    // Monitor all new tabs/pages
    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        const newPage = await target.page();
        console.log('New tab opened:', await newPage.url());
        
        // Set download behavior for new tab too
        const newClient = await newPage.target().createCDPSession();
        await newClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadPath
        });
      }
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

    console.log('Step 3: Entering credentials...');
    const emailInput = await page.$('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.type('sean@scholasticcapital.com');
    }

    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await passwordInput.click();
      await passwordInput.type('mzn-WQB4qgv4yme5dtq');
    }

    console.log('Step 4: Submitting login...');
    await page.evaluate(() => {
      const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], button');
      for (const btn of submitButtons) {
        if (btn.textContent?.toLowerCase().includes('log') || 
            btn.textContent?.toLowerCase().includes('sign') ||
            btn.textContent?.toLowerCase().includes('continue')) {
          btn.click();
          return;
        }
      }
    });

    console.log('Waiting for login...');
    await new Promise(resolve => setTimeout(resolve, 10000));

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

    await new Promise(resolve => setTimeout(resolve, 5000));

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

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 7: Clicking Next...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().trim() === 'next') {
          btn.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 8: Clicking Continue to Upload...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        if (btn.textContent?.toLowerCase().includes('continue') && 
            btn.textContent?.toLowerCase().includes('upload')) {
          btn.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 9: Looking for download link...');
    
    // Set up download listener for all pages
    const downloadPromise = new Promise((resolve) => {
      const handler = (download) => {
        browser.off('targetcreated', handler);
        resolve(download);
      };
      
      page.once('download', handler);
      
      // Also listen on any new pages
      browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
          const newPage = await target.page();
          newPage.once('download', handler);
        }
      });
    });

    // Try multiple methods to find and click the download link
    const clicked = await page.evaluate(() => {
      // Method 1: Find by text content
      const elements = Array.from(document.querySelectorAll('a, button, span, div, p'));
      for (const el of elements) {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('download') && text.includes('sample')) {
          console.log('Found element with text:', el.textContent);
          console.log('Element type:', el.tagName);
          console.log('Element href:', el.href);
          
          // Try clicking
          el.click();
          
          // If it's a link, also try direct navigation
          if (el.href) {
            window.location.href = el.href;
          }
          
          return true;
        }
      }
      
      // Method 2: Find links with download in href
      const links = Array.from(document.querySelectorAll('a[href*="download"], a[href*="sample"]'));
      for (const link of links) {
        console.log('Found download link:', link.href);
        link.click();
        return true;
      }
      
      // Method 3: Look for any clickable element in top right area
      const topRightElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < 200 && rect.right > window.innerWidth - 200;
      });
      
      for (const el of topRightElements) {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('download') || text.includes('sample')) {
          console.log('Found in top right:', el.textContent);
          el.click();
          return true;
        }
      }
      
      return false;
    });

    if (clicked) {
      console.log('Clicked download element, waiting for file...');
      
      try {
        const download = await Promise.race([
          downloadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout after 45 seconds')), 45000))
        ]);

        const suggestedFileName = download.suggestedFilename();
        const filePath = path.join(downloadPath, suggestedFileName);
        await download.saveAs(filePath);
        
        console.log(`\n✅ SUCCESS! File downloaded to: ${filePath}\n`);
      } catch (error) {
        console.log('\n❌ Download failed:', error.message);
        console.log('\nTrying alternative download method...');
        
        // Take screenshot of current state
        const screenshotPath = path.join(downloadPath, 'download-page.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Screenshot saved to:', screenshotPath);
        
        // Log all links on the page
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent,
            href: a.href
          })).filter(link => link.text?.toLowerCase().includes('download') || 
                              link.text?.toLowerCase().includes('sample'));
        });
        
        console.log('\nFound these download-related links:');
        links.forEach(link => console.log(`- "${link.text.trim()}" -> ${link.href}`));
      }
    } else {
      console.log('❌ Could not find download link');
      
      // Log page content for debugging
      const pageText = await page.evaluate(() => document.body.innerText);
      const downloadRelated = pageText.split('\n').filter(line => 
        line.toLowerCase().includes('download') || 
        line.toLowerCase().includes('sample')
      );
      
      console.log('\nLines containing "download" or "sample":');
      downloadRelated.forEach(line => console.log(`- ${line.trim()}`));
    }

    console.log('\nKeeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close when done.');
    
    // Keep browser open indefinitely
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

downloadHouseCanaryReport();