export interface HistoricalData {
  date: string;
  close: number;
  volume: number;
}

export interface PredictionResult {
  date: string;
  predicted: number;
  actual?: number;
  confidence: number;
}

export interface ModelMetrics {
  accuracy: number;
  mse: number;
  directionalAccuracy: number;
}
