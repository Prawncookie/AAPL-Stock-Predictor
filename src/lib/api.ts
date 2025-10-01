import axios from 'axios';
import { HistoricalData, NewsItem } from '@/types';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

export class DataAPI {
  private finnhubKey: string;
  private alphaVantageKey: string;

  constructor() {
    this.finnhubKey = process.env.FINNHUB_API_KEY || '';
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    console.log('Alpha Vantage key loaded:', this.alphaVantageKey ? this.alphaVantageKey.substring(0, 10) + '...' : 'Missing');
  }

  async getHistoricalPrices(symbol: string, from: string, to: string): Promise<HistoricalData[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15s delay for rate limit
      const toDate = to;
      console.log('Calling Alpha Vantage for', symbol, from, toDate);
      const response = await axios.get(ALPHA_VANTAGE_BASE, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol,
          apikey: this.alphaVantageKey,
          outputsize: 'full' // Up to 100 days, matches Dec 2024
        }
      });

      console.log('Alpha Vantage response keys:', Object.keys(response.data));

      const timeSeries = response.data['Time Series (Daily)'];
      if (!timeSeries || response.data['Note'] || response.data['Error Message']) {
        throw new Error(`No historical data available or rate limit exceeded: ${JSON.stringify(response.data)}`);
      }

      const data: HistoricalData[] = [];
      const startDate = new Date(from);
      const endDate = new Date(toDate);

      interface AlphaVantageData {
  '4. close': string;
  '5. volume': string;
}
for (const [date, values] of Object.entries(timeSeries) as [string, AlphaVantageData][]) {      
        const currentDate = new Date(date);
        if (currentDate >= startDate && currentDate <= endDate && values['4. close'] && values['5. volume']) {
          data.push({
            date,
            close: parseFloat(values['4. close']),
            volume: parseInt(values['5. volume'])
          });
        }
      }

      return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      throw new Error('Failed to fetch historical price data');
    }
  }

  async getNews(symbol: string, from: string, to: string): Promise<NewsItem[]> {
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${this.finnhubKey}`
      );
    
      return response.data.slice(0, 50);
    } catch (error) {
      console.error('Error fetching news:', error);
      throw new Error('Failed to fetch news data');
    }
  }


  async getCurrentQuote(symbol: string) {
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${this.finnhubKey}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching current quote:', error);
      throw new Error('Failed to fetch current quote');
    }
  }


  async getStockProfile(symbol: string = 'AAPL') {
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${this.finnhubKey}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching stock profile:', error);
      throw new Error('Failed to fetch stock profile');
    }
  }
}

