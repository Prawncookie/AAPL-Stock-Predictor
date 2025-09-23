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
  }

  // Get historical price data from Alpha Vantage (free tier supports this)
  async getHistoricalPrices(
    symbol: string,
    fromDate: string,
    toDate: string
  ): Promise<HistoricalData[]> {
    try {
      const response = await axios.get(ALPHA_VANTAGE_BASE, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol: symbol,
          apikey: this.alphaVantageKey,
          outputsize: 'full'
        }
      });

      const timeSeries = response.data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error('No historical data available');
      }

      // Convert to our format and filter by date range
      const data: HistoricalData[] = [];
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);

      for (const [date, values] of Object.entries(timeSeries)) {
        const currentDate = new Date(date);
        if (currentDate >= startDate && currentDate <= endDate) {
          data.push({
            date,
            close: parseFloat((values as any)['4. close']),
            volume: parseInt((values as any)['5. volume'])
          });
        }
      }

      return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Error fetching historical prices:', error);
      throw new Error('Failed to fetch historical price data');
    }
  }

  // Keep using Finnhub for news (this works on free tier)
  async getNews(
    symbol: string,
    fromDate: string,
    toDate: string
  ): Promise<NewsItem[]> {
    try {
      const response = await axios.get(
        `${FINNHUB_BASE}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${this.finnhubKey}`
      );

      return response.data.slice(0, 50);
    } catch (error) {
      console.error('Error fetching news:', error);
      throw new Error('Failed to fetch news data');
    }
  }

  // Get current quotes from Finnhub (this works)
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

  // Replace ETF holdings with stock profile (since we switched to AAPL)
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