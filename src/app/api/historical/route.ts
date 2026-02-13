import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!symbol || !from || !to) {
      return NextResponse.json({ error: "Missing symbol/from/to" }, { status: 400 });
    }

    const start = new Date(from);
    const end = new Date(to);

    const normalized = symbol.includes(".")
      ? symbol.toLowerCase()
      : `${symbol.toLowerCase()}.us`;

    const r = await axios.get(`https://stooq.com/q/d/l/?s=${normalized}&i=d`);
    const rows = String(r.data).trim().split("\n");
    const headerIndex = rows[0]?.toLowerCase().includes("date") ? 1 : 0;

    const data = rows
      .slice(headerIndex)
      .map((line) => line.split(","))
      .filter(([date, , , , close, volume]) => date && close && volume && close !== "N/A" && volume !== "N/A")
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

    return NextResponse.json({ symbol, from, to, source: "stooq", data });
  } catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("historical route error:", msg);
  return NextResponse.json({ error: "Failed to load historical data" }, { status: 500 });
}
}
