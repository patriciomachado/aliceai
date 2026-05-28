const OpenAI = require('openai');
require('dotenv').config();

const baseURL = process.env.OPENAI_BASE_URL || undefined;
const isOpenRouter = baseURL && baseURL.includes('openrouter');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-api-key-here-for-local-runs',
  baseURL,
  defaultHeaders: isOpenRouter ? {
    'HTTP-Referer': process.env.API_URL || 'http://localhost:3000',
    'X-Title': 'Alice AI'
  } : undefined
});

module.exports = {
  openai,
  model: process.env.OPENAI_MODEL || (isOpenRouter ? 'google/gemini-2.5-pro' : 'gpt-4-turbo')
};
