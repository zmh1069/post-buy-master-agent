const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function manualHouseCanaryDownload() {
  // Ensure downloads directory exists
  const downloadPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();
    
    // Set download behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    console.log('Browser opened. Please complete the following steps manually:');
    console.log('1. Navigate to housecanary.com');
    console.log('2. Click "Log In"');
    console.log('3. Enter credentials:');
    console.log('   Email: sean@scholasticcapital.com');
    console.log('   Password: mzn-WQB4qgv4yme5dtq');
    console.log('4. Click login');
    console.log('5. Click "data explorer"');
    console.log('6. Search for "value"');
    console.log('7. Click checkbox for "value" row');
    console.log('8. Click "next" at bottom');
    console.log('9. Click "continue to upload"');
    console.log('10. Click "download a sample spreadsheet"');
    console.log('\nThe script will detect when you download the file and save it automatically.');
    console.log('Press Ctrl+C to exit when done.\n');

    // Navigate to the site
    await page.goto('https://housecanary.com');

    // Wait for download
    page.on('download', async (download) => {
      console.log('\n🎉 Download detected!');
      const suggestedFileName = download.suggestedFilename();
      const filePath = path.join(downloadPath, suggestedFileName);
      await download.saveAs(filePath);
      console.log(`✅ File saved to: ${filePath}`);
      console.log('\nYou can close the browser or press Ctrl+C to exit.');
    });

    // Keep the script running
    await new Promise(() => {});

  } catch (error) {
    if (error.message.includes('Target closed')) {
      console.log('\nBrowser closed by user.');
    } else {
      console.error('Error:', error.message);
    }
  }
}

manualHouseCanaryDownload();