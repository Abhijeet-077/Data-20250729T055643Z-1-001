import pandas as pd
import numpy as np
from scipy.optimize import curve_fit
import json

# --- Data Models (copied from slippage_model.py) ---
def power_law_model(x, a, b):
    return a * (x ** b)

def calculate_slippage(order_size, book_levels_prices, book_levels_sizes, mid_price):
    shares_remaining = order_size
    total_cost = 0
    for price, size in zip(book_levels_prices, book_levels_sizes):
        if shares_remaining <= 0: break
        volume_to_take = min(shares_remaining, size)
        total_cost += volume_to_take * price
        shares_remaining -= volume_to_take
    if order_size > 0:
        return (total_cost / order_size) - mid_price
    return 0

# --- Trade Allocation (copied from trade_allocation.py) ---
from scipy.optimize import minimize

def objective_function(x, slippage_params):
    a, b = slippage_params
    return np.sum(power_law_model(x, a, b) * x)

def solve_trade_allocation(total_shares, num_intervals, slippage_params):
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - total_shares})
    bounds = [(0, total_shares) for _ in range(num_intervals)]
    initial_guess = np.full(num_intervals, total_shares / num_intervals)
    result = minimize(objective_function, initial_guess, args=(slippage_params,), method='SLSQP', bounds=bounds, constraints=constraints)
    return result.x if result.success else [np.nan] * num_intervals

# --- Main Data Processing ---
def process_ticker_data(file_path, sample_rows=1000):
    """Processes a single ticker's data to get slippage model and allocation examples."""
    df = pd.read_csv(file_path, nrows=sample_rows)
    df.dropna(subset=['bid_px_00', 'ask_px_00'], inplace=True)

    slippage_points = []
    for _, row in df.iterrows():
        ask_prices = [row[f'ask_px_{i:02d}'] for i in range(10) if f'ask_px_{i:02d}' in row and pd.notna(row[f'ask_px_{i:02d}'])]
        ask_sizes = [row[f'ask_sz_{i:02d}'] for i in range(10) if f'ask_sz_{i:02d}' in row and pd.notna(row[f'ask_sz_{i:02d}'])]
        if not ask_prices or not ask_sizes: continue
        mid_price = (row['bid_px_00'] + row['ask_px_00']) / 2
        order_sizes = np.linspace(1, sum(ask_sizes) * 0.5, 20)
        for x in order_sizes:
            slippage = calculate_slippage(x, ask_prices, ask_sizes, mid_price)
            if slippage > 0:
                slippage_points.append({'order_size': x, 'slippage': slippage})
    
    slippage_df = pd.DataFrame(slippage_points)
    if slippage_df.empty or len(slippage_df) < 2:
        return None

    # Fit model
    popt_power, _ = curve_fit(power_law_model, slippage_df['order_size'], slippage_df['slippage'], p0=[1e-5, 1.5], maxfev=5000)
    a, b = popt_power

    # Generate allocation examples
    allocations = {}
    for total_shares in [10000, 50000, 100000]:
        allocations[str(total_shares)] = solve_trade_allocation(total_shares, 10, (a,b)).tolist()

    return {
        "ticker": file_path.split("/")[-2],
        "model_params": {"a": a, "b": b},
        "slippage_data": slippage_df.to_dict('records'),
        "allocations": allocations
    }

if __name__ == '__main__':
    files = [
        'C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/Data/CRWV/CRWV_2025-05-02 00_00_00+00_00.csv',
        'C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/Data/FROG/FROG_2025-05-02 00_00_00+00_00.csv',
        'C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/Data/SOUN/SOUN_2025-05-02 00_00_00+00_00.csv'
    ]
    
    all_results = [process_ticker_data(f) for f in files]
    
    with open('C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/results.json', 'w') as f:
        json.dump(all_results, f, indent=4)
        
    print("Successfully generated results.json")
