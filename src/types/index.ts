export interface HistoricalData {
  date: string;
  close: number;
  volume: number;
}
//Purpose: Defines what a single day's stock price data looks like

export interface NewsItem {
  headline: string;
  summary: string;
  datetime: number;
  source: string;
  url: string;
}
//Purpose: Defines what a news article looks like from the API, Currently Obsolete, but may be useful for future features like utilizing sentiment analysis on news headlines to improve predictions


export interface SentimentData {
  date: string;
  sentiment: number;
  confidence: number;
  keyEvents: string[];
}
//Purpose: Defines the result after analyzing news sentiment for a specific day, Currently Obsolete, but may be useful for future features like utilizing sentiment analysis on news headlines to improve predictions


export interface PredictionResult {
  date: string;
  predicted: number;
  actual?: number;
  confidence: number;
  sentiment: number; //Obsolete but will be usefull when I add sentiment analysis features in the future, currently just fluf.
}
//Purpose: Defines what a single price prediction looks like


export interface ModelMetrics {
  accuracy: number;
  mse: number;
  directionalAccuracy: number;
}
//Purpose: Defines how we measure if our model is working well