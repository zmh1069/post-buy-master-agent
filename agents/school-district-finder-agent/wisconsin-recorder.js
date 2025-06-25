const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class WisconsinRecorderAgent {
    constructor() {
        this.browser = null;
        this.page = null;
        this.recordedActions = [];
        this.isRecording = false;
    }

    async initialize() {
        console.log('🚀 Initializing Wisconsin Recorder Agent...');
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Enable console logging
        this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        
        console.log('✅ Agent initialized successfully');
    }

    async startRecording() {
        console.log('🎬 Starting recording mode...');
        this.isRecording = true;
        this.recordedActions = [];
        
        // Navigate to Wisconsin DPI ArcGIS map (correct URL)
        await this.page.goto('https://data-wi-dpi.opendata.arcgis.com/datasets/WI-DPI::school-districts-wisconsin-2/explore?location=44.718075%2C-89.836697%2C7.36', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('📍 Navigated to Wisconsin DPI ArcGIS map');
        console.log('🎯 Please perform your search manually. The agent will record your actions.');
        console.log('⏹️  Press Ctrl+C to stop recording when done.');
        
        // Set up event listeners to record actions
        await this.setupRecordingListeners();
        
        // Keep the browser open for manual interaction
        await new Promise(() => {}); // This will keep the process running
    }

    async setupRecordingListeners() {
        // Record clicks
        await this.page.evaluateOnNewDocument(() => {
            const originalClick = HTMLElement.prototype.click;
            HTMLElement.prototype.click = function() {
                window.recordedActions = window.recordedActions || [];
                const rect = this.getBoundingClientRect();
                window.recordedActions.push({
                    type: 'click',
                    selector: this.tagName.toLowerCase() + (this.id ? '#' + this.id : '') + (this.className ? '.' + this.className.split(' ').join('.') : ''),
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                    timestamp: Date.now()
                });
                return originalClick.call(this);
            };
        });

        // Record typing
        await this.page.evaluateOnNewDocument(() => {
            const originalSetValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            Object.defineProperty(HTMLInputElement.prototype, 'value', {
                set: function(value) {
                    window.recordedActions = window.recordedActions || [];
                    window.recordedActions.push({
                        type: 'type',
                        selector: this.tagName.toLowerCase() + (this.id ? '#' + this.id : '') + (this.className ? '.' + this.className.split(' ').join('.') : ''),
                        value: value,
                        timestamp: Date.now()
                    });
                    return originalSetValue.call(this, value);
                },
                get: function() {
                    return originalSetValue.call(this);
                }
            });
        });

        // Record key presses
        await this.page.evaluateOnNewDocument(() => {
            document.addEventListener('keydown', (e) => {
                window.recordedActions = window.recordedActions || [];
                window.recordedActions.push({
                    type: 'keydown',
                    key: e.key,
                    keyCode: e.keyCode,
                    timestamp: Date.now()
                });
            });
        });
    }

    async stopRecording() {
        console.log('⏹️  Stopping recording...');
        this.isRecording = false;
        
        // Get recorded actions from the page
        const actions = await this.page.evaluate(() => {
            return window.recordedActions || [];
        });
        
        this.recordedActions = actions;
        console.log(`📝 Recorded ${actions.length} actions`);
        
        // Save recorded actions to file
        const actionsFile = path.join(__dirname, 'recorded-actions.json');
        fs.writeFileSync(actionsFile, JSON.stringify(actions, null, 2));
        console.log(`💾 Saved recorded actions to ${actionsFile}`);
        
        return actions;
    }

    async replayActions(address) {
        console.log('🔄 Replaying recorded actions...');
        
        // Load recorded actions
        const actionsFile = path.join(__dirname, 'recorded-actions.json');
        if (!fs.existsSync(actionsFile)) {
            throw new Error('No recorded actions found. Please record actions first.');
        }
        
        const actions = JSON.parse(fs.readFileSync(actionsFile, 'utf8'));
        console.log(`📋 Loaded ${actions.length} recorded actions`);
        
        // Navigate to the page (correct URL)
        await this.page.goto('https://data-wi-dpi.opendata.arcgis.com/datasets/WI-DPI::school-districts-wisconsin-2/explore?location=44.718075%2C-89.836697%2C7.36', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Wait for page to be ready
        await this.page.waitForTimeout(3000);
        
        // Replay each action
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            console.log(`🔄 Replaying action ${i + 1}/${actions.length}: ${action.type}`);
            
            try {
                switch (action.type) {
                    case 'click':
                        await this.page.click(action.selector);
                        break;
                    case 'type':
                        // Replace placeholder with actual address
                        const value = action.value === '[ADDRESS]' ? address : action.value;
                        await this.page.type(action.selector, value);
                        break;
                    case 'keydown':
                        if (action.key === 'Enter') {
                            await this.page.keyboard.press('Enter');
                        }
                        break;
                }
                
                // Small delay between actions
                await this.page.waitForTimeout(500);
                
            } catch (error) {
                console.log(`⚠️  Failed to replay action ${i + 1}: ${error.message}`);
                // Continue with next action
            }
        }
        
        console.log('✅ Finished replaying actions');
    }

    async findSchoolDistrict(address) {
        console.log(`🔍 Finding school district for: ${address}`);
        
        try {
            // Replay the recorded actions with the provided address
            await this.replayActions(address);
            
            // Wait for results to load
            await this.page.waitForTimeout(3000);
            
            // Extract school district information
            const schoolDistrict = await this.extractSchoolDistrictInfo();
            
            console.log('✅ School district found successfully');
            return schoolDistrict;
            
        } catch (error) {
            console.error('❌ Error finding school district:', error.message);
            throw error;
        }
    }

    async extractSchoolDistrictInfo() {
        // Try to extract school district information from the page
        const info = await this.page.evaluate(() => {
            // Look for school district information in various places
            const districtElements = document.querySelectorAll('[data-row]');
            if (districtElements.length > 0) {
                const firstRow = districtElements[0];
                const cells = firstRow.querySelectorAll('[data-col]');
                if (cells.length >= 4) {
                    return {
                        district: cells[0].textContent?.trim(),
                        districtId: cells[1].textContent?.trim(),
                        cesa: cells[2].textContent?.trim(),
                        leaId: cells[3].textContent?.trim(),
                        districtType: cells[4]?.textContent?.trim()
                    };
                }
            }
            
            // Fallback: look for any text that might contain district info
            const pageText = document.body.innerText;
            const districtMatch = pageText.match(/District[:\s]+([^\n\r]+)/i);
            
            return {
                district: districtMatch ? districtMatch[1].trim() : 'Unknown',
                rawText: pageText.substring(0, 500) // First 500 chars for debugging
            };
        });
        
        return info;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// CLI interface
async function main() {
    const agent = new WisconsinRecorderAgent();
    
    try {
        await agent.initialize();
        
        const command = process.argv[2];
        
        switch (command) {
            case 'record':
                console.log('🎬 Recording mode - perform your search manually');
                await agent.startRecording();
                break;
                
            case 'replay':
                const address = process.argv[3];
                if (!address) {
                    console.error('❌ Please provide an address: node wisconsin-recorder.js replay "123 Main St"');
                    return;
                }
                const result = await agent.findSchoolDistrict(address);
                console.log('📋 School District Result:', JSON.stringify(result, null, 2));
                break;
                
            default:
                console.log(`
🎯 Wisconsin Recorder Agent

Usage:
  node wisconsin-recorder.js record                    # Start recording mode
  node wisconsin-recorder.js replay "123 Main St"     # Replay actions with address

Steps:
1. Run 'node wisconsin-recorder.js record'
2. Perform your search manually in the browser
3. Press Ctrl+C to stop recording
4. Run 'node wisconsin-recorder.js replay "your address"' to automate
                `);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await agent.close();
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\n⏹️  Received SIGINT, stopping recording...');
    process.exit(0);
});

if (require.main === module) {
    main();
}

module.exports = WisconsinRecorderAgent; 