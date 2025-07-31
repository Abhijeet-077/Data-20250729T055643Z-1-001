<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# now do same for this assignemtn as well

Certainly. I’ll rigorously apply the linear, step-by-step “sequential thinking” framework (with the operational rule that only explicitly stated actions are to be performed and user help sought at any external requirement) to the attached assignment: **Blockhouse Work Trial Task**.

#### **Agent Operating Principle Reminder:**

I will only execute steps explicitly described in the assignment document or the user prompt. If any external resource, API key, credential, or lengthy operation is required and not provided, I will halt and ask the user for assistance.

## **STEP 1: Interpret the Task Description**

**Assignment Summary and Objectives (from Blockhouse_Work_Trial_Task-2.pdf):**

- You are tasked with developing a **strategy and framework for optimal execution of large buy orders in a limit order book**, minimizing the total temporary impact (slippage costs).
- **Two Main Questions:**

1. **Modeling the Temporary Impact Function (gt(x)):**
        - Propose and discuss how to model gt(x), using data from 3 tickers provided.
        - Write a 1–2 page explanation with data analysis, code in a Python notebook (preferably GitHub link).
2. **Algorithmic Framework/Mathematical Formulation:**
        - Formulate a rigorous (but concise) algorithm or mathematical setup that allocates trades across time points \$ x_i \$, such that \$ \sum x_i = S \$, where S is the total shares to buy by end of day.
        - Use clear reasoning, mathematical setup, tools/techniques, and keep it under 2 pages.

**Type of task:**

1. Quantitative modeling and explanation (regression/curve fitting, financial modeling).
2. Mathematical optimization formulation (algorithm/math setup).
3. Supporting code/notebook.

**Do not execute yet—just confirming understanding.**

## **STEP 2: Break Down the Task**

**Sub-task A:**

- Model the temporary impact function \$ g_t(x) \$ for given limit order book data.
- Provide detailed written explanation and link to code.

**Sub-task B:**

- Formulate a mathematical strategy/algorithm that allocates trade sizes over time under the constraint \$ \sum x_i = S \$.
- Detailed explanation with rigor (not necessarily code).


## **STEP 3: Set Execution Plan**

1. For **Sub-task A**:
    - Describe at least one (preferably two) ways to model temporary market impact.
    - Use assignment’s limit order book example to motivate approach.
    - Provide reasoning for/against linear vs. nonlinear models.
    - Outline supporting code logic (describe inputs/outputs, and analysis steps for the notebook).
2. For **Sub-task B**:
    - Rigorously define variables, equations, constraints for the multi-period trading allocation.
    - Present a clear mathematical optimization problem or algorithm.
    - Identify any solution approach (e.g., dynamic programming, convex optimization), but **do not** go beyond what’s asked or make unsupported assumptions.
3. Combine both answers in clear, labeled markdown format as deliverable.
4. Before outputting, check for any required data or external elements not provided.
    - If actual data or tickers are missing, **halt, notify user, and request input**.
5. Perform a quality check for completeness and clarity.

## **STEP 4: Execute Tasks One Step At A Time**

### **4.1 Sub-task A: Model the Temporary Impact Function gt(x)**

#### **Textual Explanation with Assignment Example**

- In a limit order book, the **temporary impact function** \$ g_t(x) \$ models the total slippage cost for executing a market order of size \$ x \$ at time \$ t \$.
- The *simplest model* assumes \$ g_t(x) \approx \beta_t x \$ (linear), where \$ \beta_t \$ can be estimated from the slope of the order book around the top-of-book.
- **However, real books often display nonlinearity:** the price slippage per unit grows as the order size consumes more liquidity deeper into the book.
- **Nonlinear modeling example:** For order size \$ x \$, cumulative executed cost is the sum over each price level, until \$ x \$ shares are filled; mathematically,

$$
g_t(x) = \frac{1}{x} \sum_{i=1}^{k} (p_i - p_{\text{mid}}) \cdot q_i
$$

where \$ p_i \$ is the price at level \$ i \$, \$ q_i \$ the order size at that price, and sum covers just enough levels to fill \$ x \$ shares.
- **In practice:**
    - For small \$ x \$, \$ g_t(x) \$ is nearly linear.
    - For large \$ x \$, liquidity at top levels dries up, causing increasing marginal slippage.
- **Proposed model:** Piecewise-linear or convex (e.g., power law):
\$ g_t(x) = a_t x^{b_t} \$ with \$ b_t > 1 \$.
- **To choose between linear and nonlinear:**
    - Plot slippage vs. order size with sample data (here, the assignment's example order books).
    - Fit both linear regression and nonlinear (e.g., polynomial or power law) to empirical data.


#### **Supporting Code Outline (for notebook)**

**Inputs:**

- List of price levels and available shares (sizes) at each price; mid price.

**Process/Algorithm:**

- For several hypothetical market order sizes \$ x \$, compute \$ g_t(x) \$ by simulating "walking the book."
- Plot \$ g_t(x) \$ vs. \$ x \$, fit a linear and nonlinear curve, compare residuals/errors.

**Outputs:**

- Plots of slippage vs. order size.
- Fitted parameters for each model.


#### **Sample Notebook Logic** (pseudocode, NOT execution)

```python
# Example pseudo-code for market buy side
def calc_gt(x, ask_prices, ask_sizes, mid_price):
    shares_left = x
    total_slippage = 0
    for price, size in zip(ask_prices, ask_sizes):
        take = min(size, shares_left)
        total_slippage += (price - mid_price) * take
        shares_left -= take
        if shares_left <= 0:
            break
    return total_slippage / x

# Generate curve for a range of x, plot and fit models
```

**NOTE:**
If actual order book CSVs for the 3 stocks are not provided, halt and request data upload or sample.

### **4.2 Sub-task B: Formulate Mathematical Execution Algorithm**

**Problem setup:**

- Time is discretized into \$ N \$ periods (e.g., 390 minutes).
- Buy S shares across \$ N \$ intervals: allocation vector \$ x \in \mathbb{R}^N \$, sum \$ x_i = S \$.
- At each \$ t_i \$, immediate slippage cost is \$ g_{t_i}(x_i) \$.

**Optimization goal:**
Minimize \$ \sum_{i=1}^N g_{t_i}(x_i) \$ subject to \$ \sum_{i=1}^N x_i = S \$ and \$ x_i \geq 0 \$.

**Mathematical Formulation:**

$$
\begin{align*}
\text{Minimize:} & \qquad \sum_{i=1}^N g_{t_i}(x_i) \\
\text{Subject to:} & \qquad \sum_{i=1}^N x_i = S \\
& \qquad x_i \geq 0 \quad \forall i \\
\end{align*}
$$

- If \$ g_{t_i}(x) \$ is linear (\$ g_{t_i}(x) = \beta_{t_i} x \$), optimal is to allocate all at the cheapest \$ \beta_{t_i} \$.
- For convex \$ g_{t_i}(x) \$, solution is given by Lagrangian minimization; makes sense to spread trades more evenly (e.g., **TWAP**).
- In practice:
    - If \$ g_{t_i}(x) \$ is known, this can be solved using convex optimization tools (e.g., quadratic programming if \$ g_{t_i}(x) \$ is quadratic).
    - For time-varying liquidity, a dynamic programming or stochastic control approach can be developed (not required for this assignment).


## **STEP 5: Output Structuring**

**Markdown-formatted deliverable follows:**

# Blockhouse Assignment: Optimal Trading Model

## 1. Modeling Temporary Market Impact (\$ g_t(x) \$)

- **Linear model:** \$ g_t(x) = \beta_t x \$
    - Simple, but often underestimates impact for large \$ x \$.
- **Nonlinear model:** \$ g_t(x) = a_t x^{b_t} \$, with \$ b_t > 1 \$
    - Captures accelerating slippage for larger trades.
- **Empirical approach:**
    - For each snapshot, simulate slippage for various \$ x \$, plotting \$ g_t(x) \$.
    - Fit and compare models (regression).
- **Supporting Code Outline:**
    - Calculate slippage for hypothetical order sizes given book state.
    - Fit linear vs. convex models and plot results.
    - Links to code/notebooks to be shared if data is provided.


## 2. Mathematical Execution Algorithm

- **Objective:** Minimize total temporary impact across all periods.
- **Formulation:**

$$
\min_{x_1,\dots,x_N} \sum_{i=1}^{N} g_{t_i}(x_i), \quad \text{subject to} \quad \sum x_i = S,\;\; x_i \geq 0
$$
- **Algorithm:**
    - For known, convex \$ g_{t_i}(x) \$: solve as convex optimization.
    - For linear: allocate all to best time.
    - For nonlinear: balanced allocation (e.g., TWAP/VWAP heuristic, or by solving KKT conditions).
- **Practical tools:** Use Python with numpy/scipy.optimize or cvxpy for solution (code provided upon data availability).


## **STEP 6: Error Identification \& Self-Correction**

**Blocker:**

- The document references data for 3 stocks, but **actual data files (order book snapshots) are not attached**.

**Action:**

- To provide a functional notebook/code, please upload or share the data files (CSV or similar).


## **STEP 7: Quality Check**

- All assignment sections are covered as per instruction.
- Scope rigorously limited to what assignment and prompt specify.
- No code is “run,” but code outlines and formulations are delivered as required.
- External data requirement logged for user action.


## **STEP 8: Final Response Assembly**

- Results sequenced per assignment requirements.
- **Task complete for current inputs.**
- **Action Required:**
> To continue with actual data-driven analysis or working Python notebook, please provide the referenced order book/ticker data.

**End of output. Proceeding further (i.e., with code, analysis, or notebook) is blocked until order book data is given, as per operational rule.**

<div style="text-align: center">⁂</div>

[^1]: Blockhouse_Work_Trial_Task-2.pdf

