from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
from scipy.optimize import curve_fit, minimize
import json
import os
import traceback
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Import existing functions
def power_law_model(x, a, b):
    """Power law model for market impact."""
    return a * (x ** b)

def linear_model(x, beta):
    """Linear model for market impact."""
    return beta * x

def calculate_slippage(order_size, book_levels_prices, book_levels_sizes, mid_price):
    """Calculate slippage for a given order size by walking the order book."""
    shares_remaining = order_size
    total_cost = 0
    
    for price, size in zip(book_levels_prices, book_levels_sizes):
        if shares_remaining <= 0:
            break
        volume_to_take = min(shares_remaining, size)
        total_cost += volume_to_take * price
        shares_remaining -= volume_to_take
        
    if order_size > 0:
        return (total_cost / order_size) - mid_price
    return 0

def objective_function(x, slippage_params):
    """Objective function to minimize total slippage cost."""
    a, b = slippage_params
    return np.sum(power_law_model(x, a, b) * x)

def solve_trade_allocation(total_shares, num_intervals, slippage_params):
    """Solve optimal trade allocation problem."""
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - total_shares})
    bounds = [(0, total_shares) for _ in range(num_intervals)]
    initial_guess = np.full(num_intervals, total_shares / num_intervals)
    
    result = minimize(
        objective_function, 
        initial_guess, 
        args=(slippage_params,), 
        method='SLSQP', 
        bounds=bounds, 
        constraints=constraints
    )
    
    return result.x if result.success else np.full(num_intervals, total_shares / num_intervals)

def calculate_risk_metrics(allocations, slippage_params):
    """Calculate risk metrics for the allocation."""
    a, b = slippage_params
    total_cost = np.sum(power_law_model(allocations, a, b) * allocations)
    max_allocation = np.max(allocations)
    min_allocation = np.min(allocations)
    allocation_variance = np.var(allocations)
    
    return {
        'total_slippage_cost': float(total_cost),
        'max_allocation': float(max_allocation),
        'min_allocation': float(min_allocation),
        'allocation_variance': float(allocation_variance),
        'allocation_std': float(np.sqrt(allocation_variance))
    }

@app.route('/')
def index():
    """Serve the main HTML file."""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files."""
    return send_from_directory('.', filename)

@app.route('/api/tickers')
def get_available_tickers():
    """Get list of available tickers."""
    tickers = []
    data_dir = './Data'
    if os.path.exists(data_dir):
        for ticker_dir in os.listdir(data_dir):
            ticker_path = os.path.join(data_dir, ticker_dir)
            if os.path.isdir(ticker_path):
                csv_files = [f for f in os.listdir(ticker_path) if f.endswith('.csv')]
                if csv_files:
                    tickers.append({
                        'symbol': ticker_dir,
                        'file': csv_files[0],
                        'path': os.path.join(ticker_path, csv_files[0])
                    })
    return jsonify(tickers)

@app.route('/api/analyze', methods=['POST'])
def analyze_ticker():
    """Analyze ticker data with custom parameters."""
    try:
        params = request.json
        ticker = params.get('ticker')
        sample_size = int(params.get('sample_size', 1000))
        order_size_points = int(params.get('order_size_points', 20))
        book_depth_pct = float(params.get('book_depth_pct', 50)) / 100
        total_shares = int(params.get('total_shares', 50000))
        trading_intervals = int(params.get('trading_intervals', 10))
        
        # Get file path
        file_path = f'./Data/{ticker}/{ticker}_2025-05-02 00_00_00+00_00.csv'
        
        if not os.path.exists(file_path):
            return jsonify({'error': f'Data file not found for ticker {ticker}'}), 404
        
        # Process data
        result = process_ticker_data_dynamic(
            file_path, ticker, sample_size, order_size_points, 
            book_depth_pct, total_shares, trading_intervals
        )
        
        if result is None:
            return jsonify({'error': 'Insufficient data to fit models'}), 400
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

def process_ticker_data_dynamic(file_path, ticker, sample_rows, order_size_points, 
                               book_depth_pct, total_shares, num_intervals):
    """Process ticker data with dynamic parameters."""
    try:
        df = pd.read_csv(file_path, nrows=sample_rows)
        df.dropna(subset=['bid_px_00', 'ask_px_00'], inplace=True)
        
        if len(df) < 10:
            return None
            
        slippage_points = []
        for _, row in df.iterrows():
            ask_prices = [row[f'ask_px_{i:02d}'] for i in range(10) 
                         if f'ask_px_{i:02d}' in row and pd.notna(row[f'ask_px_{i:02d}'])]
            ask_sizes = [row[f'ask_sz_{i:02d}'] for i in range(10) 
                        if f'ask_sz_{i:02d}' in row and pd.notna(row[f'ask_sz_{i:02d}'])]
            
            if not ask_prices or not ask_sizes:
                continue
                
            mid_price = (row['bid_px_00'] + row['ask_px_00']) / 2
            max_order_size = sum(ask_sizes) * book_depth_pct
            order_sizes = np.linspace(1, max_order_size, order_size_points)
            
            for x in order_sizes:
                slippage = calculate_slippage(x, ask_prices, ask_sizes, mid_price)
                if slippage > 0:
                    slippage_points.append({'order_size': x, 'slippage': slippage})
        
        slippage_df = pd.DataFrame(slippage_points)
        if slippage_df.empty or len(slippage_df) < 2:
            return None
        
        # Fit models
        try:
            popt_linear, _ = curve_fit(linear_model, slippage_df['order_size'], 
                                     slippage_df['slippage'])
            popt_power, _ = curve_fit(power_law_model, slippage_df['order_size'], 
                                    slippage_df['slippage'], p0=[1e-5, 1.5], maxfev=5000)
        except:
            return None
        
        # Calculate optimal allocation
        allocations = solve_trade_allocation(total_shares, num_intervals, popt_power)
        
        # Calculate risk metrics
        risk_metrics = calculate_risk_metrics(allocations, popt_power)
        
        return {
            'ticker': ticker,
            'model_params': {
                'linear': {'beta': float(popt_linear[0])},
                'power_law': {'a': float(popt_power[0]), 'b': float(popt_power[1])}
            },
            'slippage_data': slippage_df.to_dict('records'),
            'allocation': {
                'total_shares': total_shares,
                'intervals': num_intervals,
                'allocations': allocations.tolist()
            },
            'risk_metrics': risk_metrics,
            'analysis_params': {
                'sample_size': sample_rows,
                'order_size_points': order_size_points,
                'book_depth_pct': book_depth_pct * 100,
                'timestamp': datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        print(f"Error processing {ticker}: {str(e)}")
        return None

@app.route('/api/compare', methods=['POST'])
def compare_scenarios():
    """Compare multiple analysis scenarios."""
    try:
        scenarios = request.json.get('scenarios', [])
        results = []
        
        for scenario in scenarios:
            result = analyze_ticker_internal(scenario)
            if result:
                results.append(result)
        
        return jsonify({
            'scenarios': results,
            'comparison_metrics': calculate_comparison_metrics(results)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def analyze_ticker_internal(params):
    """Internal function to analyze ticker (used by compare endpoint)."""
    ticker = params.get('ticker')
    sample_size = int(params.get('sample_size', 1000))
    order_size_points = int(params.get('order_size_points', 20))
    book_depth_pct = float(params.get('book_depth_pct', 50)) / 100
    total_shares = int(params.get('total_shares', 50000))
    trading_intervals = int(params.get('trading_intervals', 10))

    file_path = f'./Data/{ticker}/{ticker}_2025-05-02 00_00_00+00_00.csv'

    if not os.path.exists(file_path):
        return None

    return process_ticker_data_dynamic(
        file_path, ticker, sample_size, order_size_points,
        book_depth_pct, total_shares, trading_intervals
    )

def calculate_comparison_metrics(results):
    """Calculate comparison metrics between scenarios."""
    if len(results) < 2:
        return {}

    metrics = {}
    for i, result in enumerate(results):
        key = f"{result['ticker']}_{i}"
        metrics[key] = {
            'total_cost': result['risk_metrics']['total_slippage_cost'],
            'max_allocation': result['risk_metrics']['max_allocation'],
            'allocation_variance': result['risk_metrics']['allocation_variance']
        }

    return metrics

@app.route('/api/export', methods=['POST'])
def export_results():
    """Export analysis results in various formats."""
    try:
        data = request.json
        format_type = data.get('format', 'json')
        results = data.get('results')

        if format_type == 'csv':
            # Convert to CSV format
            csv_data = convert_to_csv(results)
            return jsonify({'data': csv_data, 'filename': f'analysis_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'})
        else:
            # Return JSON format
            return jsonify({'data': json.dumps(results, indent=2), 'filename': f'analysis_results_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def convert_to_csv(results):
    """Convert results to CSV format."""
    lines = []
    lines.append("Ticker,Model_A,Model_B,Total_Slippage_Cost,Max_Allocation,Min_Allocation,Allocation_Variance")

    if isinstance(results, list):
        for result in results:
            if result and 'ticker' in result:
                lines.append(f"{result['ticker']},{result['model_params']['power_law']['a']},{result['model_params']['power_law']['b']},{result['risk_metrics']['total_slippage_cost']},{result['risk_metrics']['max_allocation']},{result['risk_metrics']['min_allocation']},{result['risk_metrics']['allocation_variance']}")
    else:
        if results and 'ticker' in results:
            lines.append(f"{results['ticker']},{results['model_params']['power_law']['a']},{results['model_params']['power_law']['b']},{results['risk_metrics']['total_slippage_cost']},{results['risk_metrics']['max_allocation']},{results['risk_metrics']['min_allocation']},{results['risk_metrics']['allocation_variance']}")

    return '\n'.join(lines)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
