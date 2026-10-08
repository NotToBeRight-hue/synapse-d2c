import numpy as np
from scipy.optimize import minimize

def optimize_ad_spend_hill(spends, revenues, margins, inventory_days, max_total_budget):
    """
    SciPy SLSQP optimizer utilizing a diminishing-returns Hill saturation curve
    with multi-start initialization and strict inventory/margin bounds.
    """
    n = len(spends)
    
    # 1. Estimate Hill saturation parameters per SKU
    # R_max: Theoretical maximum revenue potential
    # K_half: Half-saturation spend constant
    r_max = np.array([max(rev * 1.6, 1000.0) for rev in revenues])
    k_half = np.array([max(sp * 0.75, 500.0) for sp in spends])
    
    # 2. Objective Function: Maximize Net Contribution Profit
    def objective(x):
        n_coeff = 1.4  # curvature parameter for sigmoidal shape
        numerator = r_max * (x ** n_coeff)
        denominator = (k_half ** n_coeff) + (x ** n_coeff)
        projected_revenue = numerator / (denominator + 1e-6)
        
        net_profit = np.sum(projected_revenue * margins - x)
        return -net_profit  # Minimize negative profit (maximizing profit)

    # 3. Constraints & Bounds
    # Constraint: Total spend cannot exceed global budget ceiling
    cons = ({'type': 'ineq', 'fun': lambda x: max_total_budget - np.sum(x)})
    
    bounds = []
    for i in range(n):
        # Inventory safeguard (< 14 days) or low margin floor (< 10%) forces spend to 0.0
        if inventory_days[i] < 14.0 or margins[i] < 0.10:
            bounds.append((0.0, 0.0))
        else:
            bounds.append((0.0, max_total_budget))

    # 4. Multi-Start Optimization Strategy (Guards against local minima traps)
    best_result = None
    best_fun = float('inf')
    
    # Test a few starting points: uniform split, skewed toward current spend, and zeroed
    start_vectors = [
        np.array([max_total_budget / n] * n),
        np.clip(spends, 0, max_total_budget),
        np.array([max_total_budget * 0.2 if i == 0 else max_total_budget * (0.8 / (n-1)) for i in range(n)])
    ]
    
    for x0 in start_vectors:
        # Ensure x0 respects bounds
        x0 = np.clip(x0, [b[0] for b in bounds], [b[1] for b in bounds])
        if np.sum(x0) > max_total_budget:
            x0 = x0 * (max_total_budget / np.sum(x0))
            
        res = minimize(objective, x0, method='SLSQP', bounds=bounds, constraints=cons, options={'maxiter': 500})
        if res.success and res.fun < best_fun:
            best_fun = res.fun
            best_result = res

    if best_result is None or not best_result.success:
        # Fallback to current safe spend if convergence fails
        fallback_spend = np.clip(spends, [b[0] for b in bounds], [b[1] for b in bounds])
        return fallback_spend, False, "Solver reached boundary limits; safe fallback applied."

    return best_result.x, True, "Hill-saturation optimization converged successfully."