import { NextRequest, NextResponse } from "next/server";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-cpu";
import fs from "fs";
import path from "path";
export const runtime = "nodejs";

type HistoricalPoint = { date: string; close: number; volume: number };

type SavedModel = {
  modelTopology: any; // your file stores this as a STRING
  weightData: { name: string; shape: number[]; data: number[] }[];
};

function buildFeatures(series: HistoricalPoint[], lookback = 5) {
  const priceChanges = series.map((p, i) =>
    i === 0 ? 0 : (p.close - series[i - 1].close) / series[i - 1].close
  );
  const volumeChanges = series.map((p, i) =>
    i === 0 ? 0 : (p.volume - series[i - 1].volume) / series[i - 1].volume
  );

  const features: number[][] = [];
  const dates: string[] = [];
  const actuals: number[] = [];

  // Predict day i using data up to day i-1 (lookback window)
  for (let i = lookback; i < series.length; i++) {
    const feature: number[] = [];
    for (let j = i - lookback; j <= i - 1; j++) {
      feature.push(priceChanges[j], volumeChanges[j]);
    }
    features.push(feature);
    dates.push(series[i].date);
    actuals.push(series[i].close);
  }

  return { features, dates, actuals };
}

async function loadModelFromDisk(): Promise<tf.LayersModel> {
  await tf.setBackend("cpu");

  const modelPath = path.join(process.cwd(), "models", "aapl-model.json");
  const raw = fs.readFileSync(modelPath, "utf8");
  const saved = JSON.parse(raw) as SavedModel;

  // IMPORTANT: your modelTopology is a JSON string
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

    // Optional: model is trained on AAPL only
    if (symbol.toUpperCase() !== "AAPL") {
      return NextResponse.json(
        { error: "This model currently supports AAPL only." },
        { status: 400 }
      );
    }

    // Fetch historical data for the range
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
    const lookback = 5;

    if (series.length < lookback + 1) {
      return NextResponse.json(
        { error: `Not enough data. Need at least ${lookback + 1} days.` },
        { status: 400 }
      );
    }

    series.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const { features, dates, actuals } = buildFeatures(series, lookback);

    const model = await loadModelFromDisk();

    const xs = tf.tensor2d(features, [features.length, lookback * 2], "float32");
    const yhat = model.predict(xs) as tf.Tensor;

    const predChanges = Array.from(await yhat.data()); // number[]

    xs.dispose();
    yhat.dispose();
    model.dispose();

    // Convert predicted % change into predicted close price
    const predictions = dates.map((date, k) => {
      const prevClose = series[lookback + k - 1].close;
      const predicted = prevClose * (1 + predChanges[k]);
      const actual = actuals[k];

      return {
        date,
        predicted,
        actual,
        confidence: 0.75, // placeholder (your model doesn't output confidence)
      };
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
  } catch (e: any) {
    console.error("predict route error:", e?.message || e);
    return NextResponse.json({ error: "Prediction failed" }, { status: 500 });
  }
}