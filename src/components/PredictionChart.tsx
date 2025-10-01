'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PredictionResult } from '@/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  predictions: PredictionResult[];
  title?: string;
}

export default function PredictionChart({ predictions, title = "Stock Price Predictions" }: Props) {
  const chartData = {
    labels: predictions.map(p => new Date(p.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Actual Price',
        data: predictions.map(p => p.actual).filter(Boolean),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
      {
        label: 'Predicted Price',
        data: predictions.map(p => p.predicted),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderDash: [5, 5],
        tension: 0.1,
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      }
    },
  };

  return (
    <div className="w-full h-96 p-4 bg-white rounded-lg shadow-lg">
      <Line data={chartData} options={options} />
    </div>
  );
}