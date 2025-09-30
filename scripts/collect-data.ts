// scripts/collect-data.ts
import * as fs from 'fs';
import { DataAPI } from '../src/lib/api';
import { SentimentAnalyzer } from '../src/lib/sentiment';
import { HistoricalData, NewsItem, SentimentData } from '../src/types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface ProcessedData {
  prices: HistoricalData[];
  sentiments: SentimentData[];
  startDate: string;
  endDate: string;
}

class DataCollector {
  private api: DataAPI;
  private sentimentAnalyzer: SentimentAnalyzer;

  constructor() {
    this.api = new DataAPI();
    this.sentimentAnalyzer = new SentimentAnalyzer();
  }

  async collectHistoricalData(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<ProcessedData> {
    console.log(`Collecting data for ${symbol} from ${startDate} to ${endDate}`);

    // Get price data
    console.log('Fetching price data...');
    let prices: HistoricalData[] = [];
    try {
      prices = await this.api.getHistoricalPrices(symbol, startDate, endDate);
      console.log(`Got ${prices.length} price points`);
    } catch (error) {
      console.error('Price fetch failed, continuing with empty prices:', error);
    }

    // Get news data
    console.log('Fetching news data...');
    const news = await this.api.getNews(symbol, startDate, endDate);
    console.log(`Got ${news.length} news articles`);

    // Group news by date
    const newsByDate: { [date: string]: NewsItem[] } = {};
    news.forEach(item => {
      const date = new Date(item.datetime * 1000).toISOString().split('T')[0];
      if (!newsByDate[date]) newsByDate[date] = [];
      newsByDate[date].push(item);
    });

    // Analyze sentiment
    console.log('Analyzing sentiment...');
    const sentiments = await this.sentimentAnalyzer.batchAnalyzeSentiment(newsByDate);
    console.log(`Processed ${sentiments.length} sentiment points`);

    return {
      prices,
      sentiments,
      startDate,
      endDate
    };
  }

  async saveData(data: ProcessedData, filename: string) {
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }
    
    fs.writeFileSync(`data/${filename}`, JSON.stringify(data, null, 2));
    console.log(`Data saved to data/${filename}`);
  }
}

async function main() {
  const collector = new DataCollector();
  
  // Collect multiple periods for better training data
  const periods = [
    { from: '2023-01-01', to: '2023-06-30' },
    { from: '2023-07-01', to: '2023-12-31' },
    { from: '2024-01-01', to: '2024-06-30' },
    { from: '2024-07-01', to: '2024-09-01' }
  ];
  
  for (const period of periods) {
    console.log(`\n--- Collecting ${period.from} to ${period.to} ---`);
    const data = await collector.collectHistoricalData('AAPL', period.from, period.to);
    await collector.saveData(data, `aapl-${period.from}-${period.to}.json`);
    
    // Wait between API calls to respect rate limits
    if (period !== periods[periods.length - 1]) {
      console.log('Waiting 15s before next API call...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
  
  console.log('\nAll data collected!');
}

if (require.main === module) {
  main().catch(console.error);
}