// Post-Buy Master Agent - Optimized Parallel Version
// This agent runs all 4 agents in PARALLEL for maximum speed and efficiency

// Helper function to retry failed agents with shorter intervals
async function retryAgent(agentFunction, address, agentName, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 ${agentName} - Attempt ${attempt}/${maxRetries}...`);
      const result = await agentFunction(address);
      
      if (result.success) {
        console.log(`✅ ${agentName} succeeded on attempt ${attempt}`);
        return result;
      } else {
        console.log(`❌ ${agentName} failed on attempt ${attempt}: ${result.message}`);
        if (attempt === maxRetries) {
          console.log(`❌ ${agentName} failed all ${maxRetries} attempts`);
          return result;
        }
        // Shorter wait before retry for speed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`❌ ${agentName} error on attempt ${attempt}: ${error.message}`);
      if (attempt === maxRetries) {
        console.log(`❌ ${agentName} failed all ${maxRetries} attempts due to errors`);
        return { success: false, message: error.message };
      }
      // Shorter wait before retry for speed
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Memory monitoring helper
function formatBytes(bytes) {
  return Math.round(bytes / 1024 / 1024 * 100) / 100 + ' MB';
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss, // Resident Set Size
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external
  };
}

// Main function to run all agents IN PARALLEL
async function runAllAgents(address) {
  console.log(`🚀 Starting Post-Buy Master Agent for address: ${address}`);
  const startTime = new Date();
  console.log(`⏰ Start time: ${startTime.toLocaleTimeString()}`);
  
  // Initialize memory monitoring
  const initialMemory = getMemoryUsage();
  let peakMemory = { ...initialMemory };
  console.log(`💾 Initial memory usage: RSS ${formatBytes(initialMemory.rss)}, Heap ${formatBytes(initialMemory.heapUsed)}`);
  
  // Start memory monitoring interval
  const memoryMonitor = setInterval(() => {
    const currentMemory = getMemoryUsage();
    if (currentMemory.rss > peakMemory.rss) peakMemory.rss = currentMemory.rss;
    if (currentMemory.heapUsed > peakMemory.heapUsed) peakMemory.heapUsed = currentMemory.heapUsed;
    if (currentMemory.heapTotal > peakMemory.heapTotal) peakMemory.heapTotal = currentMemory.heapTotal;
    if (currentMemory.external > peakMemory.external) peakMemory.external = currentMemory.external;
  }, 2000); // Check every 2 seconds
  
  const results = {
    spDetection: null,
    schoolDistrict: null,
    houseCanary: null,
    climateRisk: null
  };
  
  const successfulAgents = [];
  const failedAgents = [];
  
  try {
    // Import agent functions
    const { runSpDetectionAgent } = require('../sp-detection-agent/sp-detection-agent');
    const { runSchoolDistrictFinderAgent } = require('../school-district-finder-agent/school-district-finder-agent');
    const { runHouseCanaryAgent } = require('../house-canary-agent/house-canary-agent');
    const { runClimateRiskAgent } = require('../climate-risk-agent/climate-risk-agent');
    
    console.log('📦 All agent modules loaded successfully');
    
    // Run ALL agents in PARALLEL for maximum speed
    console.log('🚀 Running ALL 4 agents in PARALLEL for maximum speed...');
    console.log('🔍 SP Detection Agent starting...');
    console.log('🏫 School District Finder Agent starting...');
    console.log('🏠 House Canary Agent starting...');
    console.log('🌡️ Climate Risk Agent starting...');
    
    // Start all agents simultaneously using Promise.allSettled
    const agentPromises = [
      retryAgent(runSpDetectionAgent, address, 'SP Detection Agent'),
      retryAgent(runSchoolDistrictFinderAgent, address, 'School District Finder Agent'),
      retryAgent(runHouseCanaryAgent, address, 'House Canary Agent'),
      retryAgent(runClimateRiskAgent, address, 'Climate Risk Agent')
    ];
    
    // Wait for all agents to complete
    const agentResults = await Promise.allSettled(agentPromises);
    
    // Process results
    const [spResult, schoolResult, houseResult, climateResult] = agentResults;
    
    // SP Detection Agent
    if (spResult.status === 'fulfilled' && spResult.value.success) {
      results.spDetection = spResult.value;
      successfulAgents.push('SP Detection');
    } else {
      results.spDetection = spResult.value || { success: false, message: 'Agent failed to complete' };
      failedAgents.push('SP Detection');
    }
    
    // School District Finder Agent
    if (schoolResult.status === 'fulfilled' && schoolResult.value.success) {
      results.schoolDistrict = schoolResult.value;
      successfulAgents.push('School District Finder');
    } else {
      results.schoolDistrict = schoolResult.value || { success: false, message: 'Agent failed to complete' };
      failedAgents.push('School District Finder');
    }
    
    // House Canary Agent
    if (houseResult.status === 'fulfilled' && houseResult.value.success) {
      results.houseCanary = houseResult.value;
      successfulAgents.push('House Canary');
    } else {
      results.houseCanary = houseResult.value || { success: false, message: 'Agent failed to complete' };
      failedAgents.push('House Canary');
    }
    
    // Climate Risk Agent
    if (climateResult.status === 'fulfilled' && climateResult.value.success) {
      results.climateRisk = climateResult.value;
      successfulAgents.push('Climate Risk');
    } else {
      results.climateRisk = climateResult.value || { success: false, message: 'Agent failed to complete' };
      failedAgents.push('Climate Risk');
    }
    
  } catch (error) {
    console.error('❌ Error running agents:', error);
    return {
      success: false,
      message: `Error running agents: ${error.message}`,
      results
    };
  }
  
  const endTime = new Date();
  const executionTime = Math.round((endTime - startTime) / 1000);
  
  // Stop memory monitoring and get final memory stats
  clearInterval(memoryMonitor);
  const finalMemory = getMemoryUsage();
  
  console.log(`\n⏰ End time: ${endTime.toLocaleTimeString()}`);
  console.log(`⏱️  Total execution time: ${Math.floor(executionTime / 60)}m ${executionTime % 60}s`);
  
  // Report memory usage statistics
  console.log(`\n💾 Memory Usage Report:`);
  console.log(`📈 Peak RSS (Resident Set Size): ${formatBytes(peakMemory.rss)}`);
  console.log(`📈 Peak Heap Used: ${formatBytes(peakMemory.heapUsed)}`);
  console.log(`📈 Peak Heap Total: ${formatBytes(peakMemory.heapTotal)}`);
  console.log(`📈 Peak External Memory: ${formatBytes(peakMemory.external)}`);
  console.log(`📊 Final RSS: ${formatBytes(finalMemory.rss)}`);
  console.log(`📊 Final Heap Used: ${formatBytes(finalMemory.heapUsed)}`);
  console.log(`🔺 Memory Delta: RSS +${formatBytes(finalMemory.rss - initialMemory.rss)}, Heap +${formatBytes(finalMemory.heapUsed - initialMemory.heapUsed)}`);
  
  // Log results summary
  console.log(`\n📈 Summary: ${successfulAgents.length}/4 agents completed successfully`);
  if (successfulAgents.length > 0) {
    console.log(`✅ Successful agents: ${successfulAgents.join(', ')}`);
  }
  if (failedAgents.length > 0) {
    console.log(`❌ Failed agents: ${failedAgents.join(', ')}`);
  }
  
  // Log detailed results
  console.log('\n📊 SP Detection Agent Results:');
  if (results.spDetection?.success) {
    console.log('✅ SP Detection Agent completed successfully');
    if (results.spDetection.screenshotUrl) {
      console.log(`✅ Screenshot uploaded to: ${results.spDetection.screenshotUrl}`);
    }
  } else {
    console.log('❌ SP Detection Agent failed');
    console.log(`Error: ${results.spDetection?.message || 'Unknown error'}`);
  }
  
  console.log('\n📊 School District Finder Agent Results:');
  if (results.schoolDistrict?.success) {
    console.log('✅ School District Finder Agent completed successfully');
    if (results.schoolDistrict.screenshotUrl) {
      console.log(`✅ Screenshot uploaded to: ${results.schoolDistrict.screenshotUrl}`);
    }
  } else {
    console.log('❌ School District Finder Agent failed');
    console.log(`Error: ${results.schoolDistrict?.message || 'Unknown error'}`);
  }
  
  console.log('\n📊 House Canary Agent Results:');
  if (results.houseCanary?.success) {
    console.log('✅ House Canary Agent completed successfully');
    if (results.houseCanary.reportUrl) {
      console.log(`✅ Report uploaded to: ${results.houseCanary.reportUrl}`);
    }
  } else {
    console.log('❌ House Canary Agent failed');
    console.log(`Error: ${results.houseCanary?.message || 'Unknown error'}`);
  }
  
  console.log('\n📊 Climate Risk Agent Results:');
  if (results.climateRisk?.success) {
    console.log('✅ Climate Risk Agent completed successfully');
    if (results.climateRisk.screenshotPath) {
      console.log(`✅ Screenshot saved to: ${results.climateRisk.screenshotPath}`);
    }
    if (results.climateRisk.riskFactors) {
      console.log('✅ Risk factors extracted:');
      Object.entries(results.climateRisk.riskFactors).forEach(([key, value]) => {
        console.log(`   • ${key}: ${value}`);
      });
    }
  } else {
    console.log('❌ Climate Risk Agent failed');
    console.log(`Error: ${results.climateRisk?.message || 'Unknown error'}`);
  }
  
  console.log('\n🎉 Post-Buy Master Agent completed all workflows.');
  
  return {
    success: successfulAgents.length > 0,
    message: `${successfulAgents.length}/4 agents completed successfully`,
    results,
    successfulAgents,
    failedAgents,
    executionTime,
    memoryUsage: {
      initial: initialMemory,
      peak: peakMemory,
      final: finalMemory,
      peakRSSMB: Math.round(peakMemory.rss / 1024 / 1024 * 100) / 100,
      peakHeapMB: Math.round(peakMemory.heapUsed / 1024 / 1024 * 100) / 100
    }
  };
}

module.exports = { runAllAgents };

// Command-line interface
if (require.main === module) {
  const address = process.argv.slice(2).join(' ');
  
  if (!address) {
    console.error('❌ Please provide an address...');
    console.log('Usage: node index.js "Address Here"');
    process.exit(1);
  }
  
  runAllAgents(address).then(result => {
    console.log('\n🏁 Final Result:', JSON.stringify(result, null, 2));
  }).catch(error => {
    console.error('❌ Master Agent Error:', error);
    process.exit(1);
  });
} 