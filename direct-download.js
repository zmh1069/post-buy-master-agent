const https = require('https');
const fs = require('fs');
const path = require('path');

const downloadUrl = 'https://solutions.housecanary.com/builds/716/assets/sample_dexp_input-CxxCypaZ.xlsx';
const downloadPath = path.join(__dirname, 'downloads', 'sample_dexp_input.xlsx');

// Ensure downloads directory exists
const dir = path.dirname(downloadPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log('Downloading file from:', downloadUrl);
console.log('Saving to:', downloadPath);

const file = fs.createWriteStream(downloadPath);

https.get(downloadUrl, (response) => {
  if (response.statusCode === 200) {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('\n✅ Download completed successfully!');
      console.log('File saved to:', downloadPath);
    });
  } else {
    console.log('❌ Download failed with status code:', response.statusCode);
  }
}).on('error', (err) => {
  fs.unlink(downloadPath, () => {});
  console.error('❌ Download failed:', err.message);
});