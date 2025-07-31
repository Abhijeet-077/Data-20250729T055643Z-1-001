import pandas as pd
import numpy as np
from scipy.optimize import curve_fit
import matplotlib.pyplot as plt

def linear_model(x, beta):
    """A linear model for market impact."""
    return beta * x

def power_law_model(x, a, b):
    """A non-linear power law model for market impact."""
    return a * (x ** b)

def calculate_slippage(order_size, book_levels_prices, book_levels_sizes, mid_price):
    """
    Calculates the slippage for a given order size by walking the order book.
    """
    shares_remaining = order_size
    total_cost = 0
    
    for price, size in zip(book_levels_prices, book_levels_sizes):
        if shares_remaining <= 0:
            break
        
        volume_to_take = min(shares_remaining, size)
        total_cost += volume_to_take * price
        shares_remaining -= volume_to_take
        
    if order_size > 0:
        avg_price = total_cost / order_size
        slippage = avg_price - mid_price
        return slippage
    return 0

def analyze_slippage_from_data(file_path, sample_rows=1000):
    """
    Analyzes slippage from order book data in a CSV file.
    """
    df = pd.read_csv(file_path, nrows=sample_rows)

    # We are interested in the state of the book, which is present in each row.
    # We will filter out rows where the top-of-book is missing.
    df.dropna(subset=['bid_px_00', 'ask_px_00'], inplace=True)

    slippage_results = []
    for index, row in df.iterrows():
        # Construct the ask book from the columns
        ask_prices = [row[f'ask_px_{i:02d}'] for i in range(10) if f'ask_px_{i:02d}' in row and pd.notna(row[f'ask_px_{i:02d}'])]
        ask_sizes = [row[f'ask_sz_{i:02d}'] for i in range(10) if f'ask_sz_{i:02d}' in row and pd.notna(row[f'ask_sz_{i:02d}'])]
        
        if not ask_prices or not ask_sizes:
            continue

        mid_price = (row['bid_px_00'] + row['ask_px_00']) / 2
        
        # Use a range of order sizes to calculate slippage
        order_sizes = np.linspace(1, sum(ask_sizes) * 0.5, 20) # up to 50% of book depth
        for x in order_sizes:
            slippage = calculate_slippage(x, ask_prices, ask_sizes, mid_price)
            if slippage > 0:
                slippage_results.append({'order_size': x, 'slippage': slippage})

    slippage_df = pd.DataFrame(slippage_results)

    if slippage_df.empty or len(slippage_df) < 2:
        print(f"Not enough data to fit models for {file_path.split('/')[-1]}.")
        return (np.nan,), (np.nan, np.nan)

    # Fit linear model
    popt_linear, _ = curve_fit(linear_model, slippage_df['order_size'], slippage_df['slippage'])
    
    # Fit power law model
    popt_power, _ = curve_fit(power_law_model, slippage_df['order_size'], slippage_df['slippage'], p0=[1e-5, 1.5], maxfev=5000)
    
    # Plotting
    plt.figure(figsize=(10, 6))
    plt.scatter(slippage_df['order_size'], slippage_df['slippage'], label='Empirical Slippage', color='blue', s=10, alpha=0.5)
    plt.plot(slippage_df['order_size'], linear_model(slippage_df['order_size'], *popt_linear), 'g--', label=f'Linear Fit: beta={popt_linear[0]:.6f}')
    plt.plot(slippage_df['order_size'], power_law_model(slippage_df['order_size'], *popt_power), 'r--', label=f'Power Law Fit: a={popt_power[0]:.6f}, b={popt_power[1]:.2f}')
    plt.title(f'Market Impact Slippage Model for {file_path.split("/")[-1]}')
    plt.xlabel('Order Size')
    plt.ylabel('Slippage (Price per Share)')
    plt.legend()
    plt.grid(True)
    plt.show()
    
    return popt_linear, popt_power

if __name__ == '__main__':
    # --- File Paths ---
    crwv_file = 'C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/Data/CRWV/CRWV_2025-05-02 00_00_00+00_00.csv'
    frog_file = 'C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/Data/FROG/FROG_2025-05-02 00_00_00+00_00.csv'
    soun_file = 'C:/Users/Abhij/Downloads/Data-20250729T055643Z-1-001/Data/SOUN/SOUN_2025-05-02 00_00_00+00_00.csv'

    # --- Analyze Slippage for Each Ticker ---
    print("--- Analyzing Slippage for CRWV ---")
    crwv_linear, crwv_power = analyze_slippage_from_data(crwv_file)
    if crwv_power[0] is not np.nan:
        print(f"CRWV Fitted Power Law Model: g(x) = {crwv_power[0]:.6f} * x^{crwv_power[1]:.2f}")

    print("\n--- Analyzing Slippage for FROG ---")
    frog_linear, frog_power = analyze_slippage_from_data(frog_file)
    if frog_power[0] is not np.nan:
        print(f"FROG Fitted Power Law Model: g(x) = {frog_power[0]:.6f} * x^{frog_power[1]:.2f}")

    print("\n--- Analyzing Slippage for SOUN ---")
    soun_linear, soun_power = analyze_slippage_from_data(soun_file)
    if soun_power[0] is not np.nan:
        print(f"SOUN Fitted Power Law Model: g(x) = {soun_power[0]:.6f} * x^{soun_power[1]:.2f}")
