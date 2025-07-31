import numpy as np
from scipy.optimize import minimize
from slippage_model import power_law_model # Assuming power law is a better fit

def objective_function(x, slippage_params):
    """The objective function to minimize (total slippage cost)."""
    # Unpack the 'a' and 'b' parameters for the power law model
    a, b = slippage_params
    return np.sum(power_law_model(x, a, b) * x)

def solve_trade_allocation(total_shares, num_intervals, slippage_params):
    """
    Solves the optimal trade allocation problem.
    
    Args:
        total_shares (float): The total number of shares to be executed.
        num_intervals (int): The number of trading intervals.
        slippage_params (tuple): The fitted parameters (a, b) for the power law model.
        
    Returns:
        np.array: The optimal allocation of shares for each interval.
    """
    # Constraint: the sum of shares in all intervals must equal the total shares
    constraints = ({'type': 'eq', 'fun': lambda x: np.sum(x) - total_shares})
    
    # Bounds: the number of shares in each interval must be non-negative
    bounds = [(0, total_shares) for _ in range(num_intervals)]
    
    # Initial guess: an equal allocation across all intervals
    initial_guess = np.full(num_intervals, total_shares / num_intervals)
    
    # Solve the optimization problem
    result = minimize(
        objective_function,
        initial_guess,
        args=(slippage_params,),
        method='SLSQP',
        bounds=bounds,
        constraints=constraints
    )
    
    if result.success:
        return result.x
    else:
        raise ValueError("Optimization failed: " + result.message)

if __name__ == '__main__':
    # --- Parameters for the simulation ---
    TOTAL_SHARES_TO_BUY = 10000  # Example: 10,000 shares
    NUM_TRADING_INTERVALS = 10   # Example: 10 trading intervals
    
    # These are the fitted slippage model parameters (a, b) from slippage_model.py
    # Using the placeholder values from the previous script for demonstration
    # In a real scenario, these would be the output of analyze_slippage_from_data
    SYNTHETIC_SLIPPAGE_PARAMS = (1.5e-5, 1.2) # (a, b)
    
    print("Solving for optimal trade allocation...")
    
    try:
        optimal_allocation = solve_trade_allocation(
            TOTAL_SHARES_TO_BUY,
            NUM_TRADING_INTERVALS,
            SYNTHETIC_SLIPPAGE_PARAMS
        )
        
        print("\nOptimal Trade Allocation per Interval:")
        for i, shares in enumerate(optimal_allocation):
            print(f"  Interval {i+1}: {shares:.2f} shares")
            
        print(f"\nTotal Allocated Shares: {np.sum(optimal_allocation):.2f}")
        
    except ValueError as e:
        print(e)