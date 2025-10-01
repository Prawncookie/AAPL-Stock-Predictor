<img width="1200" height="400" alt="image" src="https://github.com/user-attachments/assets/00185b99-c4cf-45c1-8960-0a540f0b2661" />

**Stock Price Predictor**

AI-powered stock price prediction using neural networks and historical market data.

**Features**:

- Real-time stock price predictions using trained neural network.

- Historical data visualization with actual vs predicted prices.

- Performance metrics (directional accuracy, MSE).

- Interactive charts powered by Chart.js.

- Support for AAPL stock (extensible to other symbols).


**Tech Stack**:

- Frontend: Next.js 15, React, TypeScript, Tailwind CSS.

- ML Model: TensorFlow.js (feedforward neural network).

- Data Sources: Alpha Vantage (historical prices), Finnhub (current quotes).

- Deployment: Vercel.

**Model Performance**:

- Training Data: 418 data points from Jan 2023 - Sep 2024.

- Features: Price changes, volume changes (5-day lookback window).

- Accuracy: 45-65% directional accuracy.

- Loss: 0.0002 MSE on training data.

**Note**: Stock price prediction is extremely difficult. This model is for educational/demonstration purposes only, not financial advice.

**Installation**:
-bash
<img width="1358" height="249" alt="Screenshot 2025-10-01 233447" src="https://github.com/user-attachments/assets/8185faf4-95b8-482b-a687-f460f59cf1bf" />

**Enviromental Variable**:
<img width="1354" height="207" alt="Screenshot 2025-10-01 233541" src="https://github.com/user-attachments/assets/01b11c32-f87c-4ee5-b466-1c5557933221" />

**Usage**:
-Bash
<img width="1344" height="435" alt="Screenshot 2025-10-01 233635" src="https://github.com/user-attachments/assets/2849c2b9-bede-4f3a-938d-9a3cdcd2e681" />
Open http://localhost:3000

**Project Structure**:
<img width="1928" height="1928" alt="screenshotify_2025-10-01T19-41-31-535Z" src="https://github.com/user-attachments/assets/0567da09-ec29-4f4e-be28-f620ba68befa" />


**Limitations**:

-Small training dataset (1.5 years).

-No sentiment analysis (future enhancement).

-Single stock support.

-Market volatility not fully captured.


**Future Enhancements**:

-Add sentiment analysis from news

-Support multiple stocks

-LSTM architecture for better time-series modeling

-Real-time predictions

-Backtesting dashboard

**License**:

MIT

**Disclaimer**.
This is a portfolio project for educational purposes. Do not use for actual trading decisions.

License
MIT
