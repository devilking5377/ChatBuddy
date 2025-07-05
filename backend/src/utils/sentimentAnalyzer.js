import Sentiment from 'sentiment';
import { HfInference } from '@huggingface/inference';

const HF_TOKEN = process.env.HF_TOKEN || '';
const USE_HF_API = Boolean(HF_TOKEN);

let sentimentAnalyzer;
let hf;

// Initialize during server startup
export async function initSentimentAnalysis() {
  try {
    if (USE_HF_API) {
      if (!HF_TOKEN) throw new Error('HF_TOKEN is required for API access');
      hf = new HfInference(HF_TOKEN);
      // Warm up HF API
      await hf.featureExtraction({
        model: 'distilbert-base-uncased',
        inputs: 'warming up'
      });
    } else {
      console.log('Using local sentiment analyzer');
      sentimentAnalyzer = new Sentiment();
    }
  } catch (error) {
    console.error('Failed to initialize sentiment analysis:', error);
    throw error;
  }
}

export async function analyze(text) {
  try {
    if (USE_HF_API) {
      const result = await hf.sentimentAnalysis({
        model: 'distilbert-base-uncased-finetuned-sst-2-english',
        inputs: text
      });
      return result[0];
    }
    const result = sentimentAnalyzer.analyze(text);
    return {
      label: result.score > 0 ? 'positive' : result.score < 0 ? 'negative' : 'neutral',
      score: Math.abs(result.score)
    };
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    throw error;
  }
}

// Test function to verify sentiment analysis
export async function testSentimentAnalysis() {
  const testCases = [
    { text: 'I love this product!', expected: 'positive' },
    { text: 'This is terrible and awful', expected: 'negative' },
    { text: 'It was okay, nothing special', expected: 'neutral' }
  ];

  for (const testCase of testCases) {
    const result = await analyze(testCase.text);
    console.log(`Test: "${testCase.text}"`);
    console.log(`- Expected: ${testCase.expected}`);
    console.log(`- Actual: ${result.label}`);
    console.log(`- Score: ${result.score}`);
    console.log('---');
  }
}
