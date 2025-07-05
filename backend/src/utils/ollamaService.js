import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434/api';
const OLLAMA_PATH = path.join(process.cwd(), '..', 'OllamaSetup.exe');

async function startOllamaService() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      console.log(`Attempting to start Ollama service (attempt ${attempts + 1}/${maxAttempts})...`);
      const result = await execAsync(`"${OLLAMA_PATH}" --start`).catch(e => e);
      if (result.stderr) console.error('Ollama startup stderr:', result.stderr);
      
      // Verify service is actually running
      await new Promise(resolve => setTimeout(resolve, 2000));
      const healthCheck = await axios.get(`${OLLAMA_BASE_URL}/tags`, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      
      if (healthCheck) {
        console.log('Ollama service started successfully');
        return true;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error('OllamaSetup.exe not found at:', OLLAMA_PATH);
        console.error('Please ensure Ollama is installed in the project root directory');
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error('Permission denied when trying to start Ollama');
        console.error('Try running the command manually in an elevated terminal:');
        console.error(`"${OLLAMA_PATH}" --start`);
      } else {
        console.error('Failed to start Ollama service:', error.message);
      }
      continue;
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.error(`Failed to start Ollama after ${maxAttempts} attempts`);
  return false;
}

export async function checkOllamaHealth(attemptStart = true) {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/tags`, { 
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
      },
    });
    return response.status === 200;
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.response?.status === 404) {
      console.log('Ollama service not running or not ready');
      if (attemptStart) {
        const started = await startOllamaService();
        if (started) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return checkOllamaHealth(false);
        }
      }
      console.error('Ollama is not running. You can:');
      console.error('1. Run "npm run dev" to start both Ollama and the server');
      console.error('2. Run "ollama serve" in a separate terminal');
      console.error('3. AI features will use local fallback if available');
    } else if (error.code === 'ENOTFOUND') {
      console.error('Ollama is not installed. Please install it from https://ollama.ai');
    } else {
      console.error('Ollama connection failed:', error.message);
    }
    return false;
  }
}
export const MODEL = 'mistral';
export const MODEL_STATUS = {
  initialized: false,
};

export const WIZARDLM2_MODEL = 'WizardLM2';
export const WIZARDLM2_STATUS = {
  initialized: false,
};


async function initializeModel() {
  try {
    if (!await checkOllamaHealth()) {
      throw new Error('Ollama service not available');
    }
    console.log('Using mistral model exclusively');
    MODEL_STATUS.initialized = true;

    if (!await ensureWizardlm2Available()) {
      throw new Error('WizardLM2 model not available');
    }
    console.log('WizardLM2 model is available');
    WIZARDLM2_STATUS.initialized = true;
  } catch (error) {
    console.error('Model initialization failed:', error);
    MODEL_STATUS.error = error.message;
    WIZARDLM2_STATUS.error = error.message;
  }
}

// Run initialization on startup
initializeModel();

async function ensureModelAvailable() {
  try {
    const availableModels = await listLocalModels();
    const isAvailable = availableModels.some(m => m.name.includes('mistral'));
    
    if (!isAvailable) {
      console.log('mistral model not found locally, attempting to pull...');
      await pullModel('mistral');
    }
    return 'mistral';
  } catch (error) {
    console.error('Failed to verify/pull mistral model:', error);
    throw new Error('mistral model is not available and could not be downloaded');
  }
}

async function ensureWizardlm2Available() {
  try {
    const availableModels = await listLocalModels();
    const isAvailable = availableModels.some(m => m.name.includes('WizardLM2'));
    
    if (!isAvailable) {
      console.log('WizardLM2 model not found locally, attempting to pull...');
      await pullWizardlm2Model();
    }
    return 'WizardLM2';
  } catch (error) {
    console.error('Failed to verify/pull WizardLM2 model:', error);
    throw new Error('WizardLM2 model is not available and could not be downloaded');
  }
}

async function pullModel() {
  try {
    console.log('Pulling mistral model...');
    const { stdout, stderr } = await execAsync('ollama pull mistral');
    if (stderr) console.error('Model pull stderr:', stderr);
    console.log('Successfully pulled mistral model');
    return true;
  } catch (error) {
    console.error('Failed to pull mistral model:', error);
    throw error;
  }
}

async function pullWizardlm2Model() {
  try {
    console.log('Pulling WizardLM2 model...');
    const { stdout, stderr } = await execAsync('ollama pull WizardLM2');
    if (stderr) console.error('WizardLM2 model pull stderr:', stderr);
    console.log('Successfully pulled WizardLM2 model');
    return true;
  } catch (error) {
    console.error('Failed to pull WizardLM2 model:', error);
    throw error;
  }
}

export async function getSmartReplies(conversation, model = 'mistral') {
  if (model === 'WizardLM2') {
    await ensureWizardlm2Available();
  } else {
    await ensureModelAvailable();
  }
  try {
    const { data } = await axios.post(`${OLLAMA_BASE_URL}/generate`, {
      model: model.toLowerCase(),
      prompt: `Suggest 3 short and relevant replies to continue this conversation:\n\n${conversation}\n\nReplies:`,
      stream: false,
    });
    return data.response.split('\n').filter(line => line.trim());
  } catch (error) {
    console.error('Smart reply generation failed:', error);
    throw new Error('Failed to generate smart replies');
  }
}

export async function getSummary(chatHistory, model = 'mistral') {
  const isHealthy = await checkOllamaHealth();
  if (!isHealthy) {
    throw new Error('Ollama service is not running or not reachable');
  }

  if (model === 'WizardLM2') {
    await ensureWizardlm2Available();
  } else {
    await ensureModelAvailable();
  }

  const maxRetries = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      const { data } = await axios.post(`${OLLAMA_BASE_URL}/generate`, {
        model: model.toLowerCase(),
        prompt: `Summarize this conversation in 3-5 concise bullet points:\n\n${chatHistory}`,
        stream: false,
      }, {
        timeout: 30000, // Increased timeout to 30 seconds
      });
      return data.response;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} - Conversation summarization failed:`, error.response?.data || error.message || error);
      
      // If the error is specifically a timeout, wait longer before retrying
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const waitTime = isTimeout ? 5000 : 2000;
      
      attempt++;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`Failed to generate summary after ${maxRetries} attempts: ` + (lastError?.message || 'unknown error'));
}

export async function chatCompletion(messages, stream = false, model = 'mistral') {
  if (model === 'WizardLM2') {
    await ensureWizardlm2Available();
  } else {
    await ensureModelAvailable();
  }
  try {
    const { data } = await axios.post(`${OLLAMA_BASE_URL}/chat`, {
      model: model.toLowerCase(),
      messages,
      stream,
    });
    return data;
  } catch (error) {
    console.error('Chat completion failed:', error);
    throw new Error('Failed to generate chat response');
  }
}

export async function streamChatCompletion(messages, callback, model = 'mistral') {
  if (model === 'WizardLM2') {
    await ensureWizardlm2Available();
  } else {
    await ensureModelAvailable();
  }
  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/chat`, {
      model: model.toLowerCase(),
      messages,
      stream: true,
    }, {
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      
      response.data.on('data', chunk => {
        const message = chunk.toString();
        if (message.trim()) {
          try {
            const parsed = JSON.parse(message);
            fullResponse += parsed.message?.content || '';
            if (callback) callback(parsed);
          } catch (e) {
            console.error('Error parsing stream chunk:', e);
          }
        }
      });

      response.data.on('end', () => resolve(fullResponse));
      response.data.on('error', reject);
    });
  } catch (error) {
    console.error('Stream chat failed:', error);
    throw new Error('Failed to stream chat response');
  }
}

export async function listLocalModels() {
  try {
    const { data } = await axios.get(`${OLLAMA_BASE_URL}/tags`);
    return data.models;
  } catch (error) {
    console.error('Failed to fetch local models:', error);
    throw new Error('Failed to fetch available models');
  }
}
