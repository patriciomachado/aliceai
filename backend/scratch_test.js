const { openai, model } = require('./src/config/llm');
const { supabase } = require('./src/config/database');

async function testRawCompletion() {
  console.log('Testing raw OpenAI chat completion with max_tokens: 4096...');
  const workspaceId = '11111111-1111-1111-1111-111111111111';
  try {
    const [workspaceRes, productsRes] = await Promise.all([
      supabase.from('workspaces').select('name, settings').eq('id', workspaceId).single(),
      supabase.from('products').select('name, description, price, stock, category').eq('workspace_id', workspaceId)
    ]);

    const workspaceName = workspaceRes.data?.name || 'Assistente Virtual';
    const workspaceSettings = workspaceRes.data?.settings || {};
    const systemInstruction = workspaceSettings.system_instruction || '';
    const productsList = productsRes.data || [];

    const systemPrompt = `${systemInstruction}

Você está conversando com um cliente em nome da empresa "${workspaceName}". 
Siga RIGOROSAMENTE as instruções de comportamento e escopo listadas acima. 
Não crie ou invente informações fora do escopo ou contexto fornecido. Responda de forma direta, concisa, amigável e objetiva.
LEMBRE-SE do histórico de conversa abaixo para não repetir perguntas (como pedir o nome do cliente mais de uma vez ou dizer oi repetidamente). Se o cliente já informou seu nome anteriormente no histórico, use-o de forma natural.

${productsList.length > 0 ? `DADOS DOS PRODUTOS DISPONÍVEIS:
${productsList.map(p => `- [${p.category}] ${p.name}: R$ ${p.price} (Estoque: ${p.stock}) - ${p.description}`).join('\n')}
` : ''}`;

    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: 'Olá! Sou a Aura, assistente virtual da Support Store.\n\nPara começarmos' },
      { role: 'user', content: 'Começar o que ?' }
    ];

    console.log('Calling OpenRouter with max_tokens: 4096...');
    const chatCompletion = await openai.chat.completions.create({
      model: model,
      messages: messagesPayload,
      temperature: 0.7,
      max_tokens: 4096
    });

    console.log('RAW Completion Response:', JSON.stringify(chatCompletion, null, 2));
  } catch (err) {
    console.error('Error during raw test:', err);
  }
}

testRawCompletion();
