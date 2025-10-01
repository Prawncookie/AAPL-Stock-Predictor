import { NextRequest, NextResponse } from 'next/server';
import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as path from 'path';
import { DataAPI } from '@/lib/api';

interface PredictionResult {
  date: string;
  predicted: number;
  actual?: number;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    const { symbol, startDate, endDate } = await request.json();
    
    console.log(`Generating predictions for ${symbol} from ${startDate} to ${endDate}`);
    
    // Load the trained model
  // Load the trained model
  const modelPath = path.join(process.cwd(), 'models', 'aapl-model.json');
  const savedModel = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

// Parse the modelTopology string into an actual object
  const modelTopology = JSON.parse(savedModel.modelTopology);

// Now load the model
  const model = await tf.models.modelFromJSON(modelTopology);

  interface WeightSpec {
  name: string;
  shape: number[];
  data: number[];
}

const weightData = savedModel.weightData.map((spec: WeightSpec) => 
  tf.tensor(spec.data, spec.shape, 'float32')
);
model.setWeights(weightData);
    // Fetch historical data
    const api = new DataAPI();
    const contextStart = new Date(new Date(startDate).getTime() - 30 * 24 * 60 * 60 * 1000);
    const contextStartStr = contextStart.toISOString().split('T')[0];
    
    const prices = await api.getHistoricalPrices(symbol, contextStartStr, endDate);
    
    // Prepare predictions
    const predictions: PredictionResult[] = [];
    const lookback = 5;
    
    for (let i = lookback; i < prices.length; i++) {
      const recentPrices = prices.slice(i - lookback, i);
      
      // Calculate features
      const priceChanges = recentPrices.map((p, idx) => 
        idx === 0 ? 0 : (p.close - recentPrices[idx-1].close) / recentPrices[idx-1].close
      );
      const volumeChanges = recentPrices.map((p, idx) =>
        idx === 0 ? 0 : (p.volume - recentPrices[idx-1].volume) / recentPrices[idx-1].volume
      );
      
      const features: number[] = [];
      for (let j = 0; j < lookback; j++) {
        features.push(priceChanges[j], volumeChanges[j]);
      }
      
      // Predict
      const prediction = model.predict(tf.tensor2d([features])) as tf.Tensor;
      const predictedChange = (await prediction.data())[0];
      prediction.dispose();
      
      const predictedPrice = prices[i].close * (1 + predictedChange);
      const actualPrice = i < prices.length - 1 ? prices[i + 1].close : undefined;
      
      if (prices[i].date >= startDate && prices[i].date <= endDate) {
        predictions.push({
          date: prices[i].date,
          predicted: predictedPrice,
          actual: actualPrice,
          confidence: 0.75
        });
      }
    }
    
    return NextResponse.json({
      predictions,
      symbol,
      dateRange: { startDate, endDate }
    });
    
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Prediction failed' },
      { status: 500 }
    );
  }
}