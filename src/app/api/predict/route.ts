import { NextRequest, NextResponse } from "next/server";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import fs from "fs";
import path from "path";
export const runtime = "nodejs";

declare global {
  var __AAPL_MODEL__: tf.LayersModel | undefined;
  var __AAPL_MODEL_LOADING__: Promise<tf.LayersModel> | undefined;
}

async function getModel() {
  if (globalThis.__AAPL_MODEL__) return globalThis.__AAPL_MODEL__;
  if (!globalThis.__AAPL_MODEL_LOADING__) {
    globalThis.__AAPL_MODEL_LOADING__ = loadModelFromDisk();
  }
  globalThis.__AAPL_MODEL__ = await globalThis.__AAPL_MODEL_LOADING__;
  return globalThis.__AAPL_MODEL__;
}

type HistoricalPoint = { date: string; close: number; volume: number };

type SavedModel = {
  modelTopology: unknown;
  weightData: { name: string; shape: number[]; data: number[] }[];
};

const LOOKBACK = 5;
const FEATURE_COUNT = LOOKBACK * 2 + 3; // 13
const MIN_SERIES_LENGTH = 20; // MA20 needs 20 days of history before first prediction

// Must exactly mirror scripts/train-simple.ts indicator functions

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { rsi.push(0.5); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) { rsi.push(1.0); continue; }
    const rs = avgGain / avgLoss;
    rsi.push(rs / (1 + rs));
  }
  return rsi;
}

function calcMACrossover(closes: number[]): number[] {
  return closes.map((_, i) => {
    if (i < 19) return 0;
    const ma5 = closes.slice(i - 4, i + 1).reduce((s, v) => s + v, 0) / 5;
    const ma20 = closes.slice(i - 19, i + 1).reduce((s, v) => s + v, 0) / 20;
    return (ma5 - ma20) / ma20;
  });
}

function calcPricePosition(closes: number[]): number[] {
  return closes.map((c, i) => {
    if (i < 19) return 0.5;
    const window = closes.slice(i - 19, i + 1);
    const high = Math.max(...window);
    const low = Math.min(...window);
    return high === low ? 0.5 : (c - low) / (high - low);
  });
}

function buildFeatures(series: HistoricalPoint[]) {
  const closes = series.map((p) => p.close);
  const volumes = series.map((p) => p.volume);

  const priceChanges = closes.map((c, i) =>
    i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]
  );
  const volumeChanges = volumes.map((v, i) =>
    i === 0 ? 0 : (v - volumes[i - 1]) / volumes[i - 1]
  );

  const rsi = calcRSI(closes);
  const maCrossover = calcMACrossover(closes);
  const pricePosition = calcPricePosition(closes);

  const features: number[][] = [];
  const dates: string[] = [];
  const actuals: number[] = [];

  const startIdx = Math.max(LOOKBACK, 19);
  for (let i = startIdx; i < series.length; i++) {
    const feature: number[] = [];
    for (let j = i - LOOKBACK + 1; j <= i; j++) {
      feature.push(priceChanges[j], volumeChanges[j]);
    }
    feature.push(rsi[i], maCrossover[i], pricePosition[i]);

    features.push(feature);
    dates.push(series[i].date);
    actuals.push(series[i].close);
  }

  return { features, dates, actuals };
}

async function loadModelFromDisk(): Promise<tf.LayersModel> {
  if (tf.getBackend() !== "cpu") {
    await tf.setBackend("cpu");
  }

  const modelPath = path.join(process.cwd(), "models", "aapl-model.json");
  const raw = fs.readFileSync(modelPath, "utf8");
  const saved = JSON.parse(raw) as SavedModel;

  const topology =
    typeof saved.modelTopology === "string"
      ? JSON.parse(saved.modelTopology)
      : saved.modelTopology;

  const model = await tf.models.modelFromJSON(topology);

  const weightTensors = saved.weightData.map((w) =>
    tf.tensor(w.data, w.shape, "float32")
  );
  model.setWeights(weightTensors);
  weightTensors.forEach((t) => t.dispose());

  return model;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const { symbol, startDate, endDate } = body as {
      symbol?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!symbol || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing symbol/startDate/endDate", received: body },
        { status: 400 }
      );
    }

    if (symbol.toUpperCase() !== "AAPL") {
      return NextResponse.json(
        { error: "This model currently supports AAPL only." },
        { status: 400 }
      );
    }

    const baseUrl = new URL(req.url).origin;
    const histRes = await fetch(
      `${baseUrl}/api/historical?symbol=${encodeURIComponent(symbol)}&from=${startDate}&to=${endDate}`,
      { cache: "no-store" }
    );

    if (!histRes.ok) {
      const msg = await histRes.text();
      return NextResponse.json({ error: "Historical fetch failed", details: msg }, { status: 502 });
    }

    const histJson = await histRes.json();
    const series = (histJson.data ?? []) as HistoricalPoint[];

    if (series.length < MIN_SERIES_LENGTH + 1) {
      return NextResponse.json(
        { error: `Not enough data. Need at least ${MIN_SERIES_LENGTH + 1} trading days in range.` },
        { status: 400 }
      );
    }

    series.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const { features, dates, actuals } = buildFeatures(series);

    if (features.length === 0) {
      return NextResponse.json({ error: "No predictions could be generated from this date range." }, { status: 400 });
    }

    const model = await getModel();

    const yhat = tf.tidy(() => {
      const xs = tf.tensor2d(features, [features.length, FEATURE_COUNT], "float32");
      return model.predict(xs) as tf.Tensor;
    });

    const predChanges = Array.from(await yhat.data());
    yhat.dispose();

    const startIdx = Math.max(LOOKBACK, 19);
    const predictions = dates.map((date, k) => {
      const prevClose = series[startIdx + k - 1].close;
      const predicted = prevClose * (1 + predChanges[k]);
      const actual = actuals[k];
      return { date, predicted, actual, confidence: 0.75 };
    });

    const mse =
      predictions.reduce((sum, p) => sum + Math.pow(p.predicted - p.actual, 2), 0) /
      predictions.length;

    return NextResponse.json({
      predictions,
      metrics: { mse },
      symbol,
      dateRange: { startDate, endDate },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("predict route error:", msg);
    return NextResponse.json({ error: "Prediction failed", details: msg }, { status: 500 });
  }
}
