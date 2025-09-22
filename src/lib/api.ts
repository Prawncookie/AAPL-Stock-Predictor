import axios from 'axios';
import { HistoricalData, NewsItem } from '@/types';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export class DataAPI {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || '';
  }

  // Get historical price data
  async getHistoricalPrices(
    symbol: string,
    fromDate: string,
    toDate: string
  ): Promise<HistoricalData[]> {
    const from = Math.floor(new Date(fromDate).getTime() / 1000);
    const to = Math.floor(new Date(toDate).getTime() / 1000);
    
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${this.apiKey}`
      );

      const data = response.data;
      if (data.s === 'no_data') {
        throw new Error('No data available for the specified period');
      }

      return data.c.map((close: number, index: number) => ({
        date: new Date(data.t[index] * 1000).toISOString().split('T')[0],
        close,
        volume: data.v[index]
      }));
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      throw new Error('Failed to fetch historical price data');
    }
  }

  // Get news for a symbol
  async getNews(
    symbol: string,
    fromDate: string,
    toDate: string
  ): Promise<NewsItem[]> {
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${this.apiKey}`
      );

      return response.data.slice(0, 50); // Limit to 50 most recent articles
    } catch (error) {
      console.error('Error fetching news:', error);
      throw new Error('Failed to fetch news data');
    }
  }

  // Get ETF holdings (for SPY analysis)
  async getETFHoldings(symbol: string = 'SPY') {
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/etf/holdings?symbol=${symbol}&token=${this.apiKey}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching ETF holdings:', error);
      throw new Error('Failed to fetch ETF holdings');
    }
  }
}