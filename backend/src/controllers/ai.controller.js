import { analyze } from '../utils/sentimentAnalyzer.js';
import { 
  getSmartReplies, 
  getSummary,
  chatCompletion,
  streamChatCompletion,
  listLocalModels,
  checkOllamaHealth,
  MODEL,
  MODEL_STATUS
} from '../utils/ollamaService.js';

export const analyzeSentiment = async (req, res) => {
  try {
    const { message } = req.body;
    const result = await analyze(message);
    res.json({ sentiment: result.label, confidence: result.score });
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({ error: 'Sentiment analysis failed' });
  }
};

export const generateSmartReplies = async (req, res) => {
  try {
    const { conversation } = req.body;
    const replies = await getSmartReplies(conversation);
    res.json({ replies });
  } catch (error) {
    console.error('Smart reply error:', error);
    res.status(500).json({ error: error.message || 'Smart reply generation failed' });
  }
};

export const summarizeConversation = async (req, res) => {
  try {
    const { chatHistory } = req.body;
    if (!chatHistory || chatHistory.trim() === '') {
      return res.status(400).json({ error: 'chatHistory is required and cannot be empty' });
    }
    const summary = await getSummary(chatHistory);
    res.json({ summary });
  } catch (error) {
    console.error('Summarization error:', error);
    res.status(500).json({ error: error.message || 'Summarization failed' });
  }
};

export const chatComplete = async (req, res) => {
  try {
    const { messages, stream } = req.body;
    
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      await streamChatCompletion(messages, (chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });
      
      res.end();
    } else {
      const response = await chatCompletion(messages);
      res.json(response);
    }
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({ error: error.message || 'Chat completion failed' });
  }
};

export const getAvailableModels = async (req, res) => {
  try {
    const models = await listLocalModels();
    const currentModel = models.find(model => model.name.includes(MODEL));
    
    res.json({ 
      models: currentModel ? [currentModel] : [],
      status: MODEL_STATUS.initialized ? 'ready' : 'initializing'
    });
  } catch (error) {
    console.error('Model listing error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to list models',
      status: 'error'
    });
  }
};

export const getModelStatus = async (req, res) => {
  try {
    const healthy = await checkOllamaHealth();
    res.json({
      healthy,
      initialized: MODEL_STATUS.initialized,
      error: MODEL_STATUS.error
    });
  } catch (error) {
    console.error('Model status check failed:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to check model status',
      healthy: false
    });
  }
};
