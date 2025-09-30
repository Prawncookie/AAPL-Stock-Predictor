import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';

interface TrainingData {
  date: string;
  close: number;
  volume: number;
}

function prepareData(prices: TrainingData[], lookback: number = 5) {
  const features: number[][] = [];
  const targets: number[] = [];
  
  const priceChanges = prices.map((p, i) => 
    i === 0 ? 0 : (p.close - prices[i-1].close) / prices[i-1].close
  );
  
  const volumeChanges = prices.map((p, i) =>
    i === 0 ? 0 : (p.volume - prices[i-1].volume) / prices[i-1].volume
  );
  
  for (let i = lookback; i < prices.length - 1; i++) {
    const feature: number[] = [];
    
    for (let j = i - lookback + 1; j <= i; j++) {
      feature.push(priceChanges[j], volumeChanges[j]);
    }
    
    features.push(feature);
    targets.push(priceChanges[i + 1]);
  }
  
  return { features, targets };
}

async function train() {
  console.log('Loading data...');
  const rawData = JSON.parse(fs.readFileSync('data/aapl-2024-01-01-2024-03-31.json', 'utf8'));
  const prices = rawData.prices;
  
  console.log(`Loaded ${prices.length} price points`);
  
  const lookback = 5;
  const { features, targets } = prepareData(prices, lookback);
  
  console.log(`Created ${features.length} training samples`);
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [lookback * 2], units: 32, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 16, activation: 'relu' }),
      tf.layers.dense({ units: 1 })
    ]
  });
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError'
  });
  
  console.log('Training model...');
  
  const xs = tf.tensor2d(features);
  const ys = tf.tensor2d(targets, [targets.length, 1]);
  
  await model.fit(xs, ys, {
    epochs: 50,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 10 === 0) {
          console.log(`Epoch ${epoch}: loss=${logs?.loss.toFixed(4)}`);
        }
      }
    }
  });
  
  if (!fs.existsSync('models')) {
    fs.mkdirSync('models');
  }
  
  // Save as JSON (browser-compatible format)
  const modelTopology = model.toJSON();
  const weights = model.getWeights();
  const weightData = await Promise.all(weights.map(async w => {
    return {
      name: w.name,
      shape: w.shape,
      data: Array.from(await w.data())
    };
  }));
  
  fs.writeFileSync('models/aapl-model.json', JSON.stringify({
    modelTopology,
    weightData,
    format: 'layers-model',
    generatedBy: 'TensorFlow.js',
    convertedBy: null
  }, null, 2));
  
  console.log('Model saved to models/aapl-model.json');
  
  xs.dispose();
  ys.dispose();
}

train().catch(console.error);