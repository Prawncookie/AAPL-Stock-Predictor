import { GoogleGenerativeAI } from '@google/generative-ai';
import { NewsItem, SentimentData } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export class SentimentAnalyzer {
  async analyzeDailySentiment(news: NewsItem[], date: string): Promise<SentimentData> {
    if (news.length === 0) {
      throw new Error(`No news available for ${date}`);
    }
    const headlines = news.map(item => item.headline).join('\n');
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(
        `You are a financial sentiment analyst. Analyze news headlines and return a JSON response with:
        - sentiment: number between -1 (very bearish) and 1 (very bullish)
        - confidence: number between 0 and 1 indicating confidence in the analysis
        - keyEvents: array of strings describing the 2-3 most impactful events
        Analyze the market sentiment for these news headlines from ${date}:\n\n${headlines}`
      );
      const result = JSON.parse(response.response.text() || '{}');
      if (!result.sentiment || !result.confidence || !result.keyEvents) {
        throw new Error('Invalid sentiment response format');
      }
      return {
        date,
        sentiment: Math.max(-1, Math.min(1, result.sentiment)),
        confidence: Math.max(0, Math.min(1, result.confidence)),
        keyEvents: result.keyEvents.slice(0, 3)
      };
    } catch (error) {
      console.error(`Error analyzing sentiment for ${date}:`, error);
      throw new Error(`Failed to analyze sentiment for ${date}`);
    }
  }

  async batchAnalyzeSentiment(newsData: { [date: string]: NewsItem[] }): Promise<SentimentData[]> {
    const results: SentimentData[] = [];
    for (const [date, news] of Object.entries(newsData)) {
      const sentiment = await this.analyzeDailySentiment(news, date);
      results.push(sentiment);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay for rate limits
    }
    return results;
  }
}
