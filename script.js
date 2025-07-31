// Global variables
let currentResults = null;
let chartInstances = [];

// Chart.js configuration
Chart.register(ChartZoom);

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Initialize slider value displays
    updateSliderValues();

    // Add event listeners
    document.getElementById('sample-size').addEventListener('input', updateSliderValues);
    document.getElementById('order-size-points').addEventListener('input', updateSliderValues);
    document.getElementById('book-depth').addEventListener('input', updateSliderValues);
    document.getElementById('trading-intervals').addEventListener('input', updateSliderValues);

    document.getElementById('analyze-btn').addEventListener('click', runAnalysis);
    document.getElementById('export-btn').addEventListener('click', exportResults);
    document.getElementById('reset-btn').addEventListener('click', resetToDefaults);
    document.getElementById('help-btn').addEventListener('click', showHelp);

    // Modal event listeners
    document.querySelector('.close').addEventListener('click', hideHelp);
    document.getElementById('help-modal').addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') hideHelp();
    });

    // Load initial data with default parameters
    loadDefaultData();
}

function updateSliderValues() {
    document.getElementById('sample-size-value').textContent = document.getElementById('sample-size').value;
    document.getElementById('order-size-points-value').textContent = document.getElementById('order-size-points').value;
    document.getElementById('book-depth-value').textContent = document.getElementById('book-depth').value;
    document.getElementById('trading-intervals-value').textContent = document.getElementById('trading-intervals').value;
}

function loadDefaultData() {
    // Load the original results.json for initial display
    fetch('results.json')
        .then(response => response.json())
        .then(data => {
            displayLegacyResults(data);
        })
        .catch(error => {
            console.error('Error loading default data:', error);
            showError('Failed to load default data. Please run a new analysis.');
        });
}

function displayLegacyResults(data) {
    const resultsContainer = document.getElementById('analysis-results');
    resultsContainer.innerHTML = '';

    data.forEach(tickerData => {
        if (!tickerData) return;

        const section = createTickerSection(tickerData, true);
        resultsContainer.appendChild(section);
    });
}

async function runAnalysis() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const exportBtn = document.getElementById('export-btn');
    const loading = document.getElementById('loading');
    const errorDisplay = document.getElementById('error-display');

    // Show loading state with enhanced UI
    analyzeBtn.disabled = true;
    exportBtn.disabled = true;
    loading.style.display = 'block';
    errorDisplay.style.display = 'none';

    // Show spinner in button
    const btnText = analyzeBtn.querySelector('.btn-text');
    const btnSpinner = analyzeBtn.querySelector('.btn-spinner');
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';

    try {
        // Validate parameters first
        const validationErrors = validateParameters();
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join('; '));
        }

        const params = getAnalysisParameters();
        const ticker = params.ticker;

        if (ticker === 'ALL') {
            // Analyze all tickers
            const results = await analyzeAllTickers(params);
            displayResults(results);
            currentResults = results;
        } else {
            // Analyze single ticker
            const result = await analyzeSingleTicker(params);
            displayResults([result]);
            currentResults = [result];
        }

        exportBtn.disabled = false;
        showToast('Analysis completed successfully!', 'success');

    } catch (error) {
        console.error('Analysis error:', error);
        showError(`Analysis failed: ${error.message}`);
    } finally {
        analyzeBtn.disabled = false;
        loading.style.display = 'none';

        // Hide spinner in button
        const btnText = analyzeBtn.querySelector('.btn-text');
        const btnSpinner = analyzeBtn.querySelector('.btn-spinner');
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
    }
}

function getAnalysisParameters() {
    return {
        ticker: document.getElementById('ticker-select').value,
        sample_size: parseInt(document.getElementById('sample-size').value),
        order_size_points: parseInt(document.getElementById('order-size-points').value),
        book_depth_pct: parseFloat(document.getElementById('book-depth').value),
        total_shares: parseInt(document.getElementById('total-shares').value),
        trading_intervals: parseInt(document.getElementById('trading-intervals').value)
    };
}

async function analyzeSingleTicker(params) {
    // For now, simulate the analysis with modified parameters
    // This will be replaced with actual backend calls once Flask is working
    return simulateAnalysis(params);
}

function simulateAnalysis(params) {
    // Load the original data and modify it based on parameters
    return fetch('results.json')
        .then(response => response.json())
        .then(data => {
            const tickerData = data.find(d => d && d.ticker === params.ticker);
            if (!tickerData) {
                throw new Error(`No data found for ticker ${params.ticker}`);
            }

            // Simulate parameter effects
            const modifiedData = JSON.parse(JSON.stringify(tickerData));

            // Adjust slippage data based on parameters
            const sampleRatio = params.sample_size / 1000;
            const pointsRatio = params.order_size_points / 20;
            const depthRatio = params.book_depth_pct / 50;

            // Modify slippage data
            modifiedData.slippage_data = modifiedData.slippage_data
                .slice(0, Math.floor(modifiedData.slippage_data.length * sampleRatio * pointsRatio))
                .map(d => ({
                    ...d,
                    order_size: d.order_size * depthRatio,
                    slippage: d.slippage * (1 + (sampleRatio - 1) * 0.1)
                }));

            // Calculate new allocation
            const totalShares = params.total_shares;
            const intervals = params.trading_intervals;
            const baseAllocation = totalShares / intervals;
            const allocations = Array.from({length: intervals}, (_, i) => {
                // Simple allocation with some variation
                const variation = Math.sin(i * Math.PI / intervals) * 0.2;
                return baseAllocation * (1 + variation);
            });

            // Create new format
            return {
                ticker: params.ticker,
                model_params: {
                    linear: { beta: modifiedData.model_params.a * 1000 },
                    power_law: {
                        a: modifiedData.model_params.a,
                        b: modifiedData.model_params.b
                    }
                },
                slippage_data: modifiedData.slippage_data,
                allocation: {
                    total_shares: totalShares,
                    intervals: intervals,
                    allocations: allocations
                },
                risk_metrics: {
                    total_slippage_cost: allocations.reduce((sum, a) => sum + a * modifiedData.model_params.a * Math.pow(a, modifiedData.model_params.b), 0),
                    max_allocation: Math.max(...allocations),
                    min_allocation: Math.min(...allocations),
                    allocation_variance: calculateVariance(allocations),
                    allocation_std: Math.sqrt(calculateVariance(allocations))
                },
                analysis_params: {
                    sample_size: params.sample_size,
                    order_size_points: params.order_size_points,
                    book_depth_pct: params.book_depth_pct,
                    timestamp: new Date().toISOString()
                }
            };
        });
}

function calculateVariance(arr) {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

async function analyzeAllTickers(params) {
    const tickers = ['CRWV', 'FROG', 'SOUN'];
    const results = [];

    for (const ticker of tickers) {
        try {
            const tickerParams = { ...params, ticker };
            const result = await analyzeSingleTicker(tickerParams);
            results.push(result);
        } catch (error) {
            console.error(`Failed to analyze ${ticker}:`, error);
            showError(`Failed to analyze ${ticker}: ${error.message}`);
        }
    }

    return results;
}

function displayResults(results) {
    const resultsContainer = document.getElementById('analysis-results');
    resultsContainer.innerHTML = '';

    // Clear existing chart instances
    chartInstances.forEach(chart => chart.destroy());
    chartInstances = [];

    results.forEach(result => {
        if (!result) return;

        const section = createTickerSection(result, false);
        resultsContainer.appendChild(section);
    });

    // Show comparison section if multiple results
    if (results.length > 1) {
        showComparisonSection(results);
    }
}

function createTickerSection(tickerData, isLegacy = false) {
    const section = document.createElement('div');
    section.className = 'ticker-section';

    // Title with badge
    const title = document.createElement('h2');
    title.className = 'ticker-title';
    title.innerHTML = `
        <span>Ticker: ${tickerData.ticker}</span>
        <span class="ticker-badge">${isLegacy ? 'Legacy' : 'Interactive'}</span>
    `;
    section.appendChild(title);

    // Model parameters
    const params = document.createElement('div');
    params.className = 'model-params';

    if (isLegacy) {
        params.textContent = `Fitted Power Law Model: g(x) = ${tickerData.model_params.a.toExponential(4)} * x^${tickerData.model_params.b.toFixed(2)}`;
    } else {
        params.innerHTML = `
            <strong>Linear Model:</strong> g(x) = ${tickerData.model_params.linear.beta.toExponential(4)} * x<br>
            <strong>Power Law Model:</strong> g(x) = ${tickerData.model_params.power_law.a.toExponential(4)} * x^${tickerData.model_params.power_law.b.toFixed(2)}
        `;
    }
    section.appendChild(params);

    // Charts container
    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'charts-container';

    // Slippage Chart
    const slippageChartWrapper = document.createElement('div');
    slippageChartWrapper.className = 'chart-wrapper';
    const slippageTitle = document.createElement('h3');
    slippageTitle.textContent = 'Slippage vs. Order Size';
    slippageChartWrapper.appendChild(slippageTitle);
    const slippageCanvas = document.createElement('canvas');
    slippageChartWrapper.appendChild(slippageCanvas);
    chartsContainer.appendChild(slippageChartWrapper);

    // Allocation Chart
    const allocationChartWrapper = document.createElement('div');
    allocationChartWrapper.className = 'chart-wrapper';
    const allocationTitle = document.createElement('h3');
    allocationTitle.textContent = 'Optimal Trade Allocation';
    allocationChartWrapper.appendChild(allocationTitle);
    const allocationCanvas = document.createElement('canvas');
    allocationChartWrapper.appendChild(allocationCanvas);
    chartsContainer.appendChild(allocationChartWrapper);

    section.appendChild(chartsContainer);

    // Risk metrics (for new results)
    if (!isLegacy && tickerData.risk_metrics) {
        const riskSection = createRiskMetricsSection(tickerData.risk_metrics);
        section.appendChild(riskSection);
    }

    // Create charts after DOM insertion
    setTimeout(() => {
        createSlippageChart(slippageCanvas, tickerData, isLegacy);
        createAllocationChart(allocationCanvas, tickerData, isLegacy);
    }, 100);

    return section;
}

function createRiskMetricsSection(riskMetrics) {
    const section = document.createElement('div');
    section.className = 'risk-metrics';

    const metrics = [
        { label: 'Total Slippage Cost', value: riskMetrics.total_slippage_cost.toFixed(4) },
        { label: 'Max Allocation', value: Math.round(riskMetrics.max_allocation).toLocaleString() },
        { label: 'Min Allocation', value: Math.round(riskMetrics.min_allocation).toLocaleString() },
        { label: 'Allocation Std Dev', value: Math.round(riskMetrics.allocation_std).toLocaleString() }
    ];

    metrics.forEach(metric => {
        const card = document.createElement('div');
        card.className = 'metric-card';
        card.innerHTML = `
            <div class="metric-value">${metric.value}</div>
            <div class="metric-label">${metric.label}</div>
        `;
        section.appendChild(card);
    });

    return section;
}

function createSlippageChart(canvas, tickerData, isLegacy = false) {
    const empiricalData = tickerData.slippage_data.map(d => ({x: d.order_size, y: d.slippage}));

    let datasets = [
        {
            label: 'Empirical Slippage',
            data: empiricalData,
            backgroundColor: 'rgba(0, 123, 255, 0.5)',
            pointRadius: 4
        }
    ];

    if (isLegacy) {
        const modelData = empiricalData.map(d => ({
            x: d.x,
            y: tickerData.model_params.a * Math.pow(d.x, tickerData.model_params.b)
        }));

        datasets.push({
            label: 'Power Law Model',
            data: modelData,
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            type: 'line',
            fill: false,
            pointRadius: 0
        });
    } else {
        // Add both linear and power law models
        const linearData = empiricalData.map(d => ({
            x: d.x,
            y: tickerData.model_params.linear.beta * d.x
        }));

        const powerData = empiricalData.map(d => ({
            x: d.x,
            y: tickerData.model_params.power_law.a * Math.pow(d.x, tickerData.model_params.power_law.b)
        }));

        datasets.push(
            {
                label: 'Linear Model',
                data: linearData,
                borderColor: 'rgba(40, 167, 69, 1)',
                borderWidth: 2,
                type: 'line',
                fill: false,
                pointRadius: 0
            },
            {
                label: 'Power Law Model',
                data: powerData,
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                type: 'line',
                fill: false,
                pointRadius: 0
            }
        );
    }

    const chart = new Chart(canvas, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Slippage vs. Order Size'
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'Order Size' }
                },
                y: {
                    title: { display: true, text: 'Slippage' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    chartInstances.push(chart);
}

function createAllocationChart(canvas, tickerData, isLegacy = false) {
    let data, labels;

    if (isLegacy) {
        const allocations = tickerData.allocations;
        labels = Object.keys(allocations);
        const allocationData = labels.map(k => allocations[k]);

        data = {
            labels: allocationData[0].map((_, i) => `Interval ${i + 1}`),
            datasets: labels.map((label, i) => ({
                label: `${label} Shares`,
                data: allocationData[i],
                backgroundColor: `rgba(${54 + i * 70}, 162, 235, 0.6)`
            }))
        };
    } else {
        const allocations = tickerData.allocation.allocations;
        labels = allocations.map((_, i) => `Interval ${i + 1}`);

        data = {
            labels: labels,
            datasets: [{
                label: `${tickerData.allocation.total_shares.toLocaleString()} Total Shares`,
                data: allocations,
                backgroundColor: 'rgba(0, 123, 255, 0.6)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
            }]
        };
    }

    const chart = new Chart(canvas, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Optimal Trade Allocation'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${Math.round(context.parsed.y).toLocaleString()} shares`;
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Trading Interval' } },
                y: {
                    title: { display: true, text: 'Number of Shares' },
                    ticks: {
                        callback: function(value) {
                            return Math.round(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });

    chartInstances.push(chart);
}

function showComparisonSection(results) {
    const comparisonSection = document.getElementById('comparison-section');
    const comparisonCharts = document.getElementById('comparison-charts');

    comparisonCharts.innerHTML = '';

    // Create comparison chart
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    chartWrapper.style.width = '100%';

    const canvas = document.createElement('canvas');
    chartWrapper.appendChild(canvas);
    comparisonCharts.appendChild(chartWrapper);

    // Prepare comparison data
    const comparisonData = {
        labels: results.map(r => r.ticker),
        datasets: [
            {
                label: 'Total Slippage Cost',
                data: results.map(r => r.risk_metrics ? r.risk_metrics.total_slippage_cost : 0),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                yAxisID: 'y'
            },
            {
                label: 'Max Allocation',
                data: results.map(r => r.risk_metrics ? r.risk_metrics.max_allocation : 0),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                yAxisID: 'y1'
            }
        ]
    };

    const comparisonChart = new Chart(canvas, {
        type: 'bar',
        data: comparisonData,
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Ticker Comparison'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Slippage Cost' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Max Allocation' },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });

    chartInstances.push(comparisonChart);
    comparisonSection.style.display = 'block';

    // Generate trading recommendations
    generateTradingRecommendations(results);
}

function generateTradingRecommendations(results) {
    const recommendationsContent = document.getElementById('recommendations-content');
    recommendationsContent.innerHTML = '';

    if (results.length === 1) {
        // Single ticker recommendations
        const result = results[0];
        const recommendations = analyzeSingleTickerRecommendations(result);
        recommendations.forEach(rec => {
            recommendationsContent.appendChild(createRecommendationCard(rec));
        });
    } else {
        // Multi-ticker comparison recommendations
        const recommendations = analyzeComparisonRecommendations(results);
        recommendations.forEach(rec => {
            recommendationsContent.appendChild(createRecommendationCard(rec));
        });
    }
}

function analyzeSingleTickerRecommendations(result) {
    const recommendations = [];
    const metrics = result.risk_metrics;
    const allocation = result.allocation;

    // Analyze slippage cost
    if (metrics.total_slippage_cost > 0.01) {
        recommendations.push({
            type: 'warning',
            title: 'High Slippage Cost Detected',
            text: `Total slippage cost of ${metrics.total_slippage_cost.toFixed(4)} is relatively high. Consider reducing order sizes or extending trading intervals.`,
            metrics: {
                'Current Cost': metrics.total_slippage_cost.toFixed(4),
                'Suggested Intervals': Math.min(allocation.intervals + 5, 20)
            }
        });
    } else {
        recommendations.push({
            type: 'success',
            title: 'Optimal Slippage Cost',
            text: `Slippage cost of ${metrics.total_slippage_cost.toFixed(4)} is within acceptable range. Current allocation strategy is efficient.`,
            metrics: {
                'Current Cost': metrics.total_slippage_cost.toFixed(4),
                'Efficiency': 'High'
            }
        });
    }

    // Analyze allocation variance
    const allocationCV = metrics.allocation_std / (allocation.total_shares / allocation.intervals);
    if (allocationCV > 0.3) {
        recommendations.push({
            type: 'warning',
            title: 'High Allocation Variance',
            text: `Allocation variance is high (CV: ${allocationCV.toFixed(2)}). Consider smoothing the allocation across intervals.`,
            metrics: {
                'Coefficient of Variation': allocationCV.toFixed(2),
                'Max Allocation': Math.round(metrics.max_allocation).toLocaleString(),
                'Min Allocation': Math.round(metrics.min_allocation).toLocaleString()
            }
        });
    }

    // Trading timing recommendation
    const avgAllocation = allocation.total_shares / allocation.intervals;
    recommendations.push({
        type: 'info',
        title: 'Trading Strategy Recommendation',
        text: `Execute ${allocation.intervals} trades with average size of ${Math.round(avgAllocation).toLocaleString()} shares. Monitor market conditions and adjust timing accordingly.`,
        metrics: {
            'Total Intervals': allocation.intervals,
            'Avg Trade Size': Math.round(avgAllocation).toLocaleString(),
            'Total Shares': allocation.total_shares.toLocaleString()
        }
    });

    return recommendations;
}

function analyzeComparisonRecommendations(results) {
    const recommendations = [];

    // Find best performer
    const bestTicker = results.reduce((best, current) =>
        current.risk_metrics.total_slippage_cost < best.risk_metrics.total_slippage_cost ? current : best
    );

    const worstTicker = results.reduce((worst, current) =>
        current.risk_metrics.total_slippage_cost > worst.risk_metrics.total_slippage_cost ? current : worst
    );

    recommendations.push({
        type: 'success',
        title: 'Best Performing Ticker',
        text: `${bestTicker.ticker} shows the lowest slippage cost (${bestTicker.risk_metrics.total_slippage_cost.toFixed(4)}). Consider prioritizing this ticker for large trades.`,
        metrics: {
            'Best Ticker': bestTicker.ticker,
            'Slippage Cost': bestTicker.risk_metrics.total_slippage_cost.toFixed(4),
            'Max Trade Size': Math.round(bestTicker.risk_metrics.max_allocation).toLocaleString()
        }
    });

    if (worstTicker.ticker !== bestTicker.ticker) {
        recommendations.push({
            type: 'warning',
            title: 'Highest Risk Ticker',
            text: `${worstTicker.ticker} has the highest slippage cost (${worstTicker.risk_metrics.total_slippage_cost.toFixed(4)}). Use smaller trade sizes or more intervals for this ticker.`,
            metrics: {
                'Risky Ticker': worstTicker.ticker,
                'Slippage Cost': worstTicker.risk_metrics.total_slippage_cost.toFixed(4),
                'Suggested Intervals': Math.min(worstTicker.allocation.intervals + 3, 20)
            }
        });
    }

    // Portfolio allocation recommendation
    const totalSlippage = results.reduce((sum, r) => sum + r.risk_metrics.total_slippage_cost, 0);
    recommendations.push({
        type: 'info',
        title: 'Portfolio Allocation Strategy',
        text: `Total portfolio slippage cost: ${totalSlippage.toFixed(4)}. Allocate larger portions to lower-cost tickers for optimal execution.`,
        metrics: {
            'Total Cost': totalSlippage.toFixed(4),
            'Tickers Analyzed': results.length,
            'Best Ratio': `${bestTicker.ticker}: ${(bestTicker.risk_metrics.total_slippage_cost / totalSlippage * 100).toFixed(1)}%`
        }
    });

    return recommendations;
}

function createRecommendationCard(recommendation) {
    const card = document.createElement('div');
    card.className = `recommendation-card ${recommendation.type}`;

    const title = document.createElement('div');
    title.className = 'recommendation-title';
    title.textContent = recommendation.title;

    const text = document.createElement('div');
    text.className = 'recommendation-text';
    text.textContent = recommendation.text;

    card.appendChild(title);
    card.appendChild(text);

    if (recommendation.metrics) {
        const metricsContainer = document.createElement('div');
        metricsContainer.className = 'recommendation-metrics';

        Object.entries(recommendation.metrics).forEach(([label, value]) => {
            const metricItem = document.createElement('div');
            metricItem.className = 'metric-item';
            metricItem.innerHTML = `
                <div class="metric-value">${value}</div>
                <div class="metric-label">${label}</div>
            `;
            metricsContainer.appendChild(metricItem);
        });

        card.appendChild(metricsContainer);
    }

    return card;
}

function showError(message) {
    const errorDisplay = document.getElementById('error-display');
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';

    // Auto-hide after 10 seconds
    setTimeout(() => {
        errorDisplay.style.display = 'none';
    }, 10000);
}

async function exportResults() {
    if (!currentResults) {
        showError('No results to export. Please run an analysis first.');
        return;
    }

    try {
        // Create JSON export directly
        const exportData = {
            timestamp: new Date().toISOString(),
            results: currentResults,
            summary: {
                total_tickers: currentResults.length,
                analysis_type: currentResults.length > 1 ? 'comparison' : 'single_ticker'
            }
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const filename = `trade_analysis_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;

        // Create and trigger download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Also offer CSV export
        exportCSV(currentResults);

    } catch (error) {
        console.error('Export error:', error);
        showError(`Export failed: ${error.message}`);
    }
}

function exportCSV(results) {
    const csvLines = [];
    csvLines.push('Ticker,Model_A,Model_B,Total_Slippage_Cost,Max_Allocation,Min_Allocation,Allocation_Variance,Sample_Size,Trading_Intervals');

    results.forEach(result => {
        if (result && result.ticker) {
            const line = [
                result.ticker,
                result.model_params.power_law.a.toExponential(4),
                result.model_params.power_law.b.toFixed(2),
                result.risk_metrics.total_slippage_cost.toFixed(4),
                Math.round(result.risk_metrics.max_allocation),
                Math.round(result.risk_metrics.min_allocation),
                result.risk_metrics.allocation_variance.toFixed(4),
                result.analysis_params ? result.analysis_params.sample_size : 'N/A',
                result.allocation.intervals
            ].join(',');
            csvLines.push(line);
        }
    });

    const csvContent = csvLines.join('\n');
    const filename = `trade_analysis_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function resetToDefaults() {
    document.getElementById('ticker-select').value = 'CRWV';
    document.getElementById('sample-size').value = 1000;
    document.getElementById('order-size-points').value = 20;
    document.getElementById('book-depth').value = 50;
    document.getElementById('total-shares').value = 50000;
    document.getElementById('trading-intervals').value = 10;

    updateSliderValues();

    // Clear results
    document.getElementById('analysis-results').innerHTML = '';
    document.getElementById('comparison-section').style.display = 'none';
    document.getElementById('export-btn').disabled = true;

    // Clear chart instances
    chartInstances.forEach(chart => chart.destroy());
    chartInstances = [];
    currentResults = null;

    // Load default data
    loadDefaultData();
}

function showHelp() {
    document.getElementById('help-modal').style.display = 'flex';
}

function hideHelp() {
    document.getElementById('help-modal').style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
    }, 4000);
}

// Enhanced error display with toast
function showError(message) {
    const errorDisplay = document.getElementById('error-display');
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';

    // Also show as toast
    showToast(message, 'error');

    // Auto-hide after 10 seconds
    setTimeout(() => {
        errorDisplay.style.display = 'none';
    }, 10000);
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                if (!document.getElementById('analyze-btn').disabled) {
                    runAnalysis();
                }
                break;
            case 'r':
                e.preventDefault();
                resetToDefaults();
                break;
            case 'h':
                e.preventDefault();
                showHelp();
                break;
            case 'Escape':
                hideHelp();
                break;
        }
    }
});

// Add form validation
function validateParameters() {
    const params = getAnalysisParameters();
    const errors = [];

    if (params.sample_size < 100 || params.sample_size > 5000) {
        errors.push('Sample size must be between 100 and 5000');
    }

    if (params.order_size_points < 10 || params.order_size_points > 50) {
        errors.push('Order size points must be between 10 and 50');
    }

    if (params.book_depth_pct < 10 || params.book_depth_pct > 100) {
        errors.push('Book depth must be between 10% and 100%');
    }

    if (params.total_shares < 1000 || params.total_shares > 1000000) {
        errors.push('Total shares must be between 1,000 and 1,000,000');
    }

    if (params.trading_intervals < 5 || params.trading_intervals > 20) {
        errors.push('Trading intervals must be between 5 and 20');
    }

    return errors;
}