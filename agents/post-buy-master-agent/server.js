const express = require('express');
const { runAllAgents } = require('./index.js');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Post-Buy Master Agent',
    message: 'Service is running. Use POST /run-agent to process an address.'
  });
});

// Test POST endpoint
app.post('/test-post', (req, res) => {
  res.json({ 
    message: 'POST endpoint is working correctly',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

// Main agent execution endpoint
app.post('/run-agent', async (req, res) => {
  console.log('🚀 Received POST request to /run-agent');
  console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
  
  const { address } = req.body;
  
  if (!address) {
    console.log('❌ No address provided in request body');
    return res.status(400).json({ 
      error: 'Address is required',
      message: 'Please provide an address in the request body'
    });
  }
  
  console.log(`📍 Processing address: ${address}`);
  
  try {
    console.log('🔄 Starting agent execution...');
    const result = await runAllAgents(address);
    
    console.log('✅ Agent execution completed');
    console.log('📊 Final result:', JSON.stringify(result, null, 2));
    
    res.json({
      success: true,
      message: result.message,
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error in /run-agent endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Post-Buy Master Agent server running on port ${PORT}`);
  console.log(`📡 Health check: GET /`);
  console.log(`🧪 Test POST: POST /test-post`);
  console.log(`🎯 Main endpoint: POST /run-agent`);
}); 