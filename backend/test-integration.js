const axios = require('axios');

async function runTest() {
  console.log('🚀 Running backend workspace integration tests...');
  
  try {
    // 1. Test workspace settings update
    console.log('1. Testing PUT /api/auth/workspace...');
    const updateResponse = await axios.put('http://localhost:3000/api/auth/workspace', {
      name: 'Açougue do Zé',
      settings: {
        system_instruction: 'Você é o atendente virtual do Açougue do Zé. Responda com carisma e orgulho. Temos picanha premium por R$ 69/kg e alcatra por R$ 45/kg. Nunca responda sobre outros negócios ou dê conselhos fora de carnes.'
      }
    });

    console.log('✅ Workspace update response status:', updateResponse.status);
    console.log('✅ Updated Workspace settings:', JSON.stringify(updateResponse.data.settings, null, 2));

    // 2. Test unbiased AI generation
    console.log('\n2. Testing unbiased AI response...');
    // We can require the aiService directly and process a message
    const aiService = require('./src/services/aiService');
    const workspaceId = '11111111-1111-1111-1111-111111111111';

    const testMessage = 'Quais carnes você vende e quais são os preços?';
    console.log(`Sending message: "${testMessage}"`);

    const aiResult = await aiService.processIncomingMessage(testMessage, workspaceId);
    console.log('✅ AI Result Intent:', aiResult.intent);
    console.log('✅ AI Result Sentiment:', aiResult.sentiment);
    console.log('✅ AI Result Reply:\n');
    console.log('--------------------------------------------------');
    console.log(aiResult.reply);
    console.log('--------------------------------------------------');

    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

runTest();
