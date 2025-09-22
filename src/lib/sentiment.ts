import OpenAI from 'openai';
import { NewsItem, SentimentData } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class SentimentAnalyzer {
  async analyzeDailySentiment(
    news: NewsItem[],
    date: string
  ): Promise<SentimentData> {
    if (news.length === 0) {
      return {
        date,
        sentiment: 0,
        confidence: 0,
        keyEvents: []
      };
    }

    // Combine headlines for batch analysis
    const headlines = news.map(item => item.headline).join('\n');
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial sentiment analyst. Analyze news headlines and return a JSON response with:
            - sentiment: number between -1 (very bearish) and 1 (very bullish)
            - confidence: number between 0 and 1 indicating confidence in the analysis
            - keyEvents: array of strings describing the 2-3 most impactful events`
          },
          {
            role: 'user',
            content: `Analyze the market sentiment for these news headlines from ${date}:\n\n${headlines}`
          }
        ],
        temperature: 0.1,
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      
      return {
        date,
        sentiment: Math.max(-1, Math.min(1, result.sentiment || 0)),
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        keyEvents: result.keyEvents || []
      };
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return {
        date,
        sentiment: 0,
        confidence: 0,
        keyEvents: ['Analysis failed']
      };
    }
  }

  async batchAnalyzeSentiment(newsData: { [date: string]: NewsItem[] }): Promise<SentimentData[]> {
    const results: SentimentData[] = [];
    
    for (const [date, news] of Object.entries(newsData)) {
      const sentiment = await this.analyzeDailySentiment(news, date);
      results.push(sentiment);
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
}