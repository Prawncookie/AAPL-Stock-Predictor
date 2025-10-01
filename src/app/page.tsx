'use client';

import React, { useState } from 'react';
import PredictionChart from '@/components/PredictionChart';
import { PredictionResult, ModelMetrics } from '@/types';

export default function Home() {
  const [symbol, setSymbol] = useState('AAPL');
  const [startDate, setStartDate] = useState('2024-08-01');
  const [endDate, setEndDate] = useState('2024-09-01');
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePredict = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          startDate,
          endDate
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPredictions(data.predictions);
      setMetrics(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Prediction error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateAccuracy = () => {
    if (predictions.length === 0) return 0;
    
    const validPredictions = predictions.filter(p => p.actual !== undefined);
    if (validPredictions.length === 0) return 0;
    
    let correctDirections = 0;
    for (let i = 1; i < validPredictions.length; i++) {
      const prevActual = validPredictions[i - 1].actual!;
      const currActual = validPredictions[i].actual!;
      const actualDirection = currActual > prevActual ? 1 : -1;
      
      const prevPred = validPredictions[i - 1].predicted;
      const currPred = validPredictions[i].predicted;
      const predDirection = currPred > prevPred ? 1 : -1;
      
      if (actualDirection === predDirection) {
        correctDirections++;
      }
    }
    
    return (correctDirections / (validPredictions.length - 1)) * 100;
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Stock Price Predictor
          </h1>
          <p className="text-gray-600">
            AI-powered stock price predictions using sentiment analysis and machine learning
          </p>
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded mt-4">
            ⚠️ For educational and demonstration purposes only. Not financial advice.
          </div>
        </div>
 
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Prediction Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Stock Symbol
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AAPL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handlePredict}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition duration-200"
              >
                {loading ? 'Predicting...' : 'Generate Predictions'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {predictions.length > 0 && (
          <div className="space-y-6">
            {/* Metrics */}
            <div className="text-gray-700">
              <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {calculateAccuracy().toFixed(1)}%
                  </div>
                  <div className="text-gray-700">Directional Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {metrics?.mse ? metrics.mse.toFixed(4) : 'N/A'}
                  </div>
                  <div className="text-gray-700">Mean Squared Error</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {predictions.length}
                  </div>
                  <div className="text-gray-700">Predictions Made</div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <PredictionChart predictions={predictions} />

            {/* Detailed Results */}
            <div className="text-gray-700">
              <h2 className="text-xl font-semibold mb-4">Prediction Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-700 text-white">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Predicted</th>
                      <th className="px-4 py-2 text-left">Actual</th>
                      <th className="px-4 py-2 text-left">Diff</th>
                      <th className="px-4 py-2 text-left">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((pred, index) => {
                      const diff = pred.actual ? pred.predicted - pred.actual : null;
                      const diffPercent = pred.actual && diff ? (diff / pred.actual) * 100 : null;
                      
                      return (
                        <tr key={index} className="border-b">
                          <td className="px-4 py-2">
                            {new Date(pred.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            ${pred.predicted.toFixed(2)}
                          </td>
                          <td className="px-4 py-2">
                            {pred.actual ? `$${pred.actual.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="px-4 py-2">
                            {diffPercent ? (
                              <span className={diffPercent > 0 ? 'text-red-600' : 'text-green-600'}>
                                {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(2)}%
                              </span>
                            ) : 'N/A'}
                          </td>
                          <td className="px-4 py-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${pred.confidence * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600">
                              {(pred.confidence * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-12">
          <p>Built with Next.js, TensorFlow.js, and Google Gemini</p>
          <p>Data provided by your mom... ahem, by Alpha Vantage & Finnhub</p>
        </div>
      </div>
    </div>
  );
}
