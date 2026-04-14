import axios from 'axios';

export interface StooqPoint {
  date: string;
  close: number;
  volume: number;
}

export async function fetchStooqHistory(symbol: string, from: string, to: string): Promise<StooqPoint[]> {
  const normalized = symbol.includes('.') ? symbol.toLowerCase() : `${symbol.toLowerCase()}.us`;

  const r = await axios.get(`https://stooq.com/q/d/l/?s=${normalized}&i=d`);
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
    .map(([date, , , , close, volume]) => ({
      date,
      close: Number(close),
      volume: Number(volume),
    }))
    .filter((p) => {
      const d = new Date(p.date);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (data.length === 0) {
    console.error(`[stooq] parsed ${rows.length} rows but none matched ${from}–${to}. First rows: ${rows.slice(0, 3).join(' | ')}`);
    throw new Error(`No Stooq data returned for ${normalized} between ${from} and ${to}`);
  }

  return data;
}
