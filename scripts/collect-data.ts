import * as fs from 'fs';
import axios from 'axios';

interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

async function fetchFromStooq(symbol: string, from: string, to: string): Promise<PricePoint[]> {
  const normalized = symbol.includes('.') ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;
  const response = await axios.get(`https://stooq.com/q/d/l/?s=${normalized}&i=d`);
  const rows: string[] = String(response.data).trim().split('\n');
  const headerIndex = rows[0]?.toLowerCase().includes('date') ? 1 : 0;

  const start = new Date(from);
  const end = new Date(to);

  const data: PricePoint[] = [];

  for (const row of rows.slice(headerIndex)) {
    if (!row) continue;
    const [date, , , , close, volume] = row.split(',');
    if (!date || !close || !volume || close === 'N/A' || volume === 'N/A') continue;
    const d = new Date(date);
    if (d >= start && d <= end) {
      data.push({ date, close: parseFloat(close), volume: parseInt(volume, 10) });
    }
  }

  if (data.length === 0) throw new Error(`No data returned for ${normalized}`);
  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function main() {
  const periods = [
    { from: '2023-01-01', to: '2023-06-30' },
    { from: '2023-07-01', to: '2023-12-31' },
    { from: '2024-01-01', to: '2024-06-30' },
    { from: '2024-07-01', to: '2024-09-01' },
  ];

  if (!fs.existsSync('data')) fs.mkdirSync('data');

  for (const period of periods) {
    console.log(`Fetching AAPL ${period.from} → ${period.to}...`);
    const prices = await fetchFromStooq('AAPL', period.from, period.to);
    const filename = `data/aapl-${period.from}-${period.to}.json`;
    fs.writeFileSync(filename, JSON.stringify({ prices, startDate: period.from, endDate: period.to }, null, 2));
    console.log(`  Saved ${prices.length} points to ${filename}`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
