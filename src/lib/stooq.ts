import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface StooqPoint {
  date: string;
  close: number;
  volume: number;
}

async function fetchAlphaVantage(symbol: string, from: string, to: string): Promise<StooqPoint[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error('No ALPHA_VANTAGE_API_KEY set');

  const r = await axios.get('https://www.alphavantage.co/query', {
    params: { function: 'TIME_SERIES_DAILY', symbol, outputsize: 'full', apikey: apiKey },
    timeout: 10000,
  });

  const timeSeries = r.data['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
  if (!timeSeries) {
    throw new Error(`Alpha Vantage returned no time series: ${JSON.stringify(r.data).slice(0, 200)}`);
  }

  const start = new Date(from);
  const end = new Date(to);

  const data: StooqPoint[] = Object.entries(timeSeries)
    .map(([date, vals]) => ({ date, close: Number(vals['4. close']), volume: Number(vals['5. volume']) }))
    .filter((p) => { const d = new Date(p.date); return d >= start && d <= end; })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length === 0) throw new Error(`Alpha Vantage: no data for ${symbol} between ${from} and ${to}`);
  return data;
}

async function fetchStooq(symbol: string, from: string, to: string): Promise<StooqPoint[]> {
  const normalized = symbol.includes('.') ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;

  const r = await axios.get(`https://stooq.com/q/d/l/?s=${normalized}&i=d`, { timeout: 10000 });
  const raw = String(r.data);
  console.log(`[stooq] status=${r.status} body_preview=${raw.slice(0, 300).replace(/\n/g, '\\n')}`);

  const rows: string[] = raw.trim().split('\n');
  const headerIndex = rows[0]?.toLowerCase().includes('date') ? 1 : 0;

  const start = new Date(from);
  const end = new Date(to);

  const data = rows
    .slice(headerIndex)
    .map((line) => line.split(','))
    .filter(([date, , , , close, volume]) => date && close && volume && close !== 'N/A' && volume !== 'N/A')
    .map(([date, , , , close, volume]) => ({ date, close: Number(close), volume: Number(volume) }))
    .filter((p) => { const d = new Date(p.date); return d >= start && d <= end; })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length === 0) throw new Error(`No Stooq data for ${normalized} between ${from} and ${to}`);
  return data;
}

function loadLocalData(symbol: string, from: string, to: string): StooqPoint[] {
  const dataDir = path.join(process.cwd(), 'data');
  const start = new Date(from);
  const end = new Date(to);

  let allPoints: StooqPoint[] = [];

  const files = fs.readdirSync(dataDir).filter(
    (f) => f.endsWith('.json') && f.toLowerCase().startsWith(symbol.toLowerCase())
  );

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf8');
    const parsed = JSON.parse(raw) as { prices: StooqPoint[] };
    allPoints = allPoints.concat(parsed.prices ?? []);
  }

  const data = allPoints
    .filter((p) => { const d = new Date(p.date); return d >= start && d <= end; })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length === 0) throw new Error(`No local data for ${symbol} between ${from} and ${to}`);
  return data;
}

export async function fetchHistoricalData(symbol: string, from: string, to: string): Promise<StooqPoint[]> {
  // 1. Try Alpha Vantage
  try {
    const data = await fetchAlphaVantage(symbol, from, to);
    console.log(`[fetchHistoricalData] Alpha Vantage success: ${data.length} points`);
    return data;
  } catch (e) {
    console.warn(`[fetchHistoricalData] Alpha Vantage failed: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Try Stooq
  try {
    const data = await fetchStooq(symbol, from, to);
    console.log(`[fetchHistoricalData] Stooq success: ${data.length} points`);
    return data;
  } catch (e) {
    console.warn(`[fetchHistoricalData] Stooq failed: ${e instanceof Error ? e.message : e}`);
  }

  // 3. Fall back to local JSON files
  console.warn(`[fetchHistoricalData] Falling back to local data for ${symbol}`);
  const data = loadLocalData(symbol, from, to);
  console.log(`[fetchHistoricalData] Local data success: ${data.length} points`);
  return data;
}
