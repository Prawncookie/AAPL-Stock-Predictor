import { NextRequest, NextResponse } from "next/server";
import { fetchStooqHistory } from "@/lib/stooq";
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

    const data = await fetchStooqHistory(symbol, from, to);
    return NextResponse.json({ symbol, from, to, source: "stooq", data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("historical route error:", msg);
    return NextResponse.json({ error: "Failed to load historical data" }, { status: 500 });
  }
}
