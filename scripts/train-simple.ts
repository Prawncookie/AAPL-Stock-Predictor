import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';

interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

// RSI normalized to [0, 1]. Returns one value per index (0.5 during warmup).
function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      rsi.push(0.5);
      continue;
    }
    let gains = 0;
    let losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) {
      rsi.push(1.0);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(rs / (1 + rs));
    }
  }
  return rsi;
}

// (MA5 - MA20) / MA20. Returns 0 during warmup.
function calcMACrossover(closes: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 19) {
      result.push(0);
      continue;
    }
    const ma5 = closes.slice(i - 4, i + 1).reduce((s, v) => s + v, 0) / 5;
    const ma20 = closes.slice(i - 19, i + 1).reduce((s, v) => s + v, 0) / 20;
    result.push((ma5 - ma20) / ma20);
  }
  return result;
}

// (close - 20d_low) / (20d_high - 20d_low). Returns 0.5 during warmup.
function calcPricePosition(closes: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 19) {
      result.push(0.5);
      continue;
    }
    const window = closes.slice(i - 19, i + 1);
    const high = Math.max(...window);
    const low = Math.min(...window);
    result.push(high === low ? 0.5 : (closes[i] - low) / (high - low));
  }
  return result;
}

// Features per sample: 10 (lookback price+volume changes) + 3 indicators = 13
const LOOKBACK = 5;
const FEATURE_COUNT = LOOKBACK * 2 + 3; // 13

function prepareData(prices: PricePoint[]) {
  const closes = prices.map((p) => p.close);
  const volumes = prices.map((p) => p.volume);

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
  const targets: number[] = [];

  // Start at 19 so MA20/RSI have full history; stop at len-2 so target[i+1] exists
  const startIdx = Math.max(LOOKBACK, 19);
  for (let i = startIdx; i < prices.length - 1; i++) {
    const feature: number[] = [];

    // 5-day lookback window: price change + volume change
    for (let j = i - LOOKBACK + 1; j <= i; j++) {
      feature.push(priceChanges[j], volumeChanges[j]);
    }

    // Technical indicators at current day
    feature.push(rsi[i], maCrossover[i], pricePosition[i]);

    features.push(feature);
    targets.push(priceChanges[i + 1]);
  }

  return { features, targets };
}

async function train() {
  console.log('Loading data...');

  const dataFiles = [
    'data/aapl-2023-01-01-2023-06-30.json',
    'data/aapl-2023-07-01-2023-12-31.json',
    'data/aapl-2024-01-01-2024-06-30.json',
    'data/aapl-2024-07-01-2024-09-01.json',
  ];

  let allPrices: PricePoint[] = [];

  for (const file of dataFiles) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      allPrices = allPrices.concat(raw.prices);
      console.log(`  Loaded ${raw.prices.length} points from ${file}`);
    } else {
      console.log(`  Warning: ${file} not found, skipping`);
    }
  }

  allPrices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  console.log(`\nTotal: ${allPrices.length} price points`);

  const { features, targets } = prepareData(allPrices);
  console.log(`Created ${features.length} training samples with ${FEATURE_COUNT} features each\n`);

  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [FEATURE_COUNT], units: 64, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.1 }),
      tf.layers.dense({ units: 16, activation: 'relu' }),
      tf.layers.dense({ units: 1 }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  model.summary();

  const xs = tf.tensor2d(features);
  const ys = tf.tensor2d(targets, [targets.length, 1]);

  console.log('Training...');
  await model.fit(xs, ys, {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(
            `  Epoch ${epoch + 1}/100  loss=${logs?.loss.toFixed(6)}  val_loss=${logs?.val_loss?.toFixed(6)}`
          );
        }
      },
    },
  });

  if (!fs.existsSync('models')) fs.mkdirSync('models');

  const modelTopology = model.toJSON();
  const weights = model.getWeights();
  const weightData = await Promise.all(
    weights.map(async (w) => ({
      name: w.name,
      shape: w.shape,
      data: Array.from(await w.data()),
    }))
  );

  fs.writeFileSync(
    'models/aapl-model.json',
    JSON.stringify(
      {
        modelTopology,
        weightData,
        featureCount: FEATURE_COUNT,
        lookback: LOOKBACK,
        features: ['priceChange×5', 'volumeChange×5', 'rsi14', 'maCrossover5_20', 'pricePosition20'],
      },
      null,
      2
    )
  );

  console.log('\nModel saved to models/aapl-model.json');
  xs.dispose();
  ys.dispose();
}

train().catch(console.error);
