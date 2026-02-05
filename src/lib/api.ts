import axios from 'axios';
import { HistoricalData, NewsItem } from '@/types';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

type AlphaVantageDaily = Record<
  string,
  {
    '4. close': string;
    '5. volume': string;
  }
>;

export class DataAPI {
  private finnhubKey: string;
  private alphaVantageKey: string;

  constructor() {
    this.finnhubKey = process.env.FINNHUB_API_KEY || '';
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    console.log(
      'Alpha Vantage key loaded:',
      this.alphaVantageKey ? this.alphaVantageKey.substring(0, 10) + '...' : 'Missing'
    );
  }

  async getHistoricalPrices(symbol: string, from: string, to: string): Promise<HistoricalData[]> {
    const startDate = new Date(from);
    const endDate = new Date(to);

    const loadFromStooq = async (): Promise<HistoricalData[]> => {
      const normalizedSymbol = symbol.includes('.')
        ? symbol.toLowerCase()
        : `${symbol.toLowerCase()}.us`;

      const response = await axios.get(`https://stooq.com/q/d/l/?s=${normalizedSymbol}&i=d`);
      const rows: string[] = String(response.data).trim().split('\n');
      const headerIndex = rows[0]?.toLowerCase().includes('date') ? 1 : 0;

      const data: HistoricalData[] = [];

      for (const row of rows.slice(headerIndex)) {
        if (!row) continue;
        const [date, open, high, low, close, volume] = row.split(',');
        if (!date || !close || !volume || close === 'N/A' || volume === 'N/A') continue;

        const currentDate = new Date(date);
        if (currentDate >= startDate && currentDate <= endDate) {
          data.push({
            date,
            close: parseFloat(close),
            volume: parseInt(volume, 10),
          });
        }
      }

      if (data.length === 0) {
        throw new Error(`No Stooq historical data returned for ${normalizedSymbol}.`);
      }

      return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    const loadFromAlphaVantage = async (): Promise<HistoricalData[]> => {
      // NOTE: Alpha Vantage free tier is rate-limited. This delay helps but isn't bulletproof.
      await new Promise((r) => setTimeout(r, 15000));

      console.log('Calling Alpha Vantage for', symbol, from, to);

      const response = await axios.get(ALPHA_VANTAGE_BASE, {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol,
          apikey: this.alphaVantageKey,
          outputsize: 'full',
        },
      });

      const body = response.data;

      if (body?.Note || body?.['Error Message']) {
        throw new Error(`Alpha Vantage error: ${JSON.stringify(body)}`);
      }

      const timeSeries = body?.['Time Series (Daily)'] as AlphaVantageDaily | undefined;
      if (!timeSeries) {
        throw new Error(`Alpha Vantage missing Time Series (Daily): ${JSON.stringify(body)}`);
      }

      const data: HistoricalData[] = [];

      for (const [date, values] of Object.entries(timeSeries)) {
        const currentDate = new Date(date);
        const close = values?.['4. close'];
        const volume = values?.['5. volume'];

        if (currentDate >= startDate && currentDate <= endDate && close && volume) {
          data.push({
            date,
            close: parseFloat(close),
            volume: parseInt(volume, 10),
          });
        }
      }

      if (data.length === 0) {
        throw new Error(`Alpha Vantage returned no rows in range for ${symbol}.`);
      }

      return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    };

    // Try Alpha Vantage, fall back to Stooq
    if (!this.alphaVantageKey) {
      console.warn('Alpha Vantage key missing, falling back to Stooq.');
      return loadFromStooq();
    }

    try {
      return await loadFromAlphaVantage();
    } catch (err) {
      console.error('Alpha Vantage failed, falling back to Stooq:', err);
      return await loadFromStooq();
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
      const response = await axios.get(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${this.finnhubKey}`);
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