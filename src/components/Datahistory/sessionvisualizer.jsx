import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { axiosInstance } from '../../axiosApi';
import useWebSocket from "react-use-websocket";
import Slider from "rc-slider";
import 'rc-slider/assets/index.css';

// Optimized Smoothing utility functions
const applyRollingMeanOptimized = (data, window) => {
  const result = Array(data.length).fill(null);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= window) {
      sum -= data[i - window];
    }
    if (i >= window - 1) {
      result[i] = sum / window;
    }
  }
  return result;
};

const applyEMAOptimized = (data, alpha) => {
  const result = Array(data.length).fill(null);
  let ema = data[0];
  result[0] = ema;
  for (let i = 1; i < data.length; i++) {
    ema = alpha * data[i] + (1 - alpha) * ema;
    result[i] = ema;
  }
  return result;
};

const applyMedianFilterOptimized = (data, size) => {
  const result = Array(data.length).fill(null);
  const halfSize = Math.floor(size / 2);

  for (let i = 0; i < data.length; i++) {
    const windowStart = Math.max(0, i - halfSize);
    const windowEnd = Math.min(data.length, i + halfSize + 1);
    const windowSlice = data.slice(windowStart, windowEnd);
    const sorted = [...windowSlice].sort((a, b) => a - b);
    result[i] = sorted[Math.floor(sorted.length / 2)];
  }
  return result;
};

const applySavgolFilterOptimized = (data, windowLength, polyOrder) => {
    if (windowLength % 2 === 0 || windowLength > data.length || polyOrder >= windowLength) {
        console.error("Invalid Savitzky-Golay parameters");
        return Array(data.length).fill(null);
    }

    const result = Array(data.length).fill(null);
    const halfWindow = Math.floor(windowLength / 2);

    // Precompute weights (Example: Triangular weights for simplicity)
    const weights = Array(windowLength).fill(0);
    const center = Math.floor(windowLength / 2);
    let weightSum = 0;
    for (let i = 0; i < windowLength; i++) {
        weights[i] = 1 - Math.abs(i - center) / halfWindow;
        weightSum += weights[i];
    }

    // Normalize weights
    const normalizedWeights = weights.map(w => w / weightSum);

    for (let i = 0; i < data.length; i++) {
        let weightedSum = 0;
        let count = 0;  // Count valid data points in the window
        for (let j = 0; j < windowLength; j++) {
            const dataIndex = i - halfWindow + j;
            if (dataIndex >= 0 && dataIndex < data.length) {
                weightedSum += data[dataIndex] * normalizedWeights[j];
                count++;
            }
        }

        // Handle edge cases where the window is incomplete
        if (count > 0) {
            result[i] = weightedSum;
        } else {
            result[i] = null;  // Or handle differently based on your needs
        }
    }

    return result;
};

// Main component
const SessionVisualizer = ({ sessionid, is_active }) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const dataInitializedRef = useRef(false);
  const [selectedMetrics, setSelectedMetrics] = useState({
    actual_position: true,
    actual_velocity: true,
    phase_current: false,
    phase_current_rolling_mean_large: false,
    phase_current_ema_low: true,
    phase_current_savgol_large: false,
    phase_current_median_large: false,
    phase_current_cascaded: false,
    phase_current_hybrid: false,
    voltage_logic: false,
  });
  const colors = {
    actual_position: "#4361EE",
    actual_velocity: "#3A0CA3",
    phase_current: "#F72585",
    phase_current_rolling_mean_large: "#FF9E00",
    phase_current_ema_low: "#7209B7",
    phase_current_savgol_large: "#4CC9F0",
    phase_current_median_large: "#38B000",
    phase_current_cascaded: "#FB5607",
    phase_current_hybrid: "#023047",
    voltage_logic: "#4CC9F0"
  };
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const containerRef = useRef(null);
  const [zoomStart, setZoomStart] = useState(55);
  const [zoomEnd, setZoomEnd] = useState(100);

  // Smoothing parameters
  const [smoothingParams, setSmoothingParams] = useState({
    rolling: { window: 15 },
    ema: { alpha: 0.05 },
    savgol: { windowLength: 15, polyOrder: 2 },
    median: { window: 5 },
    cascade: { window: 5, alpha: 0.2 },
    hybrid: { medianWindow: 3, savgolWindow: 7, polyOrder: 3 }
  });

  const formatTime = (timeString) => {
    let time = (timeString.time);
    return time;
  };

  // Use useCallback to memoize the toggle function
  const toggleMetric = useCallback((metric) => {
    setSelectedMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  }, []);

  // Process data with smoothing algorithms
  const processedData = useMemo(() => {
    if (!data.length) return [];

    const result = [...data];

    // Extract phase current values
    const phaseCurrentValues = data.map(item => item.phase_current || 0);

    // Apply different smoothing techniques with optimized functions
    const rollingMeanLarge = applyRollingMeanOptimized(phaseCurrentValues, smoothingParams.rolling.window);
    const emaLow = applyEMAOptimized(phaseCurrentValues, smoothingParams.ema.alpha);
    const savgolLarge = applySavgolFilterOptimized(phaseCurrentValues, smoothingParams.savgol.windowLength, smoothingParams.savgol.polyOrder);
    const medianLarge = applyMedianFilterOptimized(phaseCurrentValues, smoothingParams.median.window);

    // Cascaded: Rolling Average -> EMA
    const rollingCascade = applyRollingMeanOptimized(phaseCurrentValues, smoothingParams.cascade.window);
    const cascaded = applyEMAOptimized(rollingCascade, smoothingParams.cascade.alpha);

    // Hybrid: Median Filter -> Savitzky-Golay
    const medianHybrid = applyMedianFilterOptimized(phaseCurrentValues, smoothingParams.hybrid.medianWindow);
    const hybrid = applySavgolFilterOptimized(medianHybrid, smoothingParams.hybrid.savgolWindow, smoothingParams.hybrid.polyOrder);

    // Add smoothed values to the data
    for (let i = 0; i < result.length; i++) {
      result[i] = {
        ...result[i],
        phase_current_rolling_mean_large: rollingMeanLarge[i],
        phase_current_ema_low: emaLow[i],
        phase_current_savgol_large: savgolLarge[i],
        phase_current_median_large: medianLarge[i],
        phase_current_cascaded: cascaded[i],
        phase_current_hybrid: hybrid[i]
      };
    }

    return result;
  }, [data, smoothingParams]);

  // Reset chart when sessionid changes
  useEffect(() => {
    // Clean up previous chart instance when sessionid changes
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }

    setData([]);  // Clear existing data
    dataInitializedRef.current = false;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!sessionid) {
          setData([]);
          return;
        }
        const response = await axiosInstance.get(`get_session_data/${sessionid}`);
        if (!Array.isArray(response.data)) throw new Error("Invalid data format");
        setData([...response.data]);
        console.log("Data Fetched:", response.data);
        dataInitializedRef.current = true;
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionid]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    // Always initialize a new chart when data or metrics change
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    if (processedData.length > 0) {
      chartInstance.current = echarts.init(chartRef.current);

      const timeData = processedData.map(formatTime);

      const series = Object.entries(selectedMetrics)
        .filter(([, selected]) => selected)
        .map(([metric]) => ({
          name: metric.replace(/_/g, ' '), // Replace underscores with spaces for display
          type: 'line',
          smooth: false,
          data: processedData.map(item => item[metric] || 0),
          showSymbol: false,
          lineStyle: { width: 2, color: colors[metric] },
          emphasis: { itemStyle: { borderWidth: 2 } }
        }));

      const option = {
        progressive: 1000,          // Enable progressive rendering
        progressiveThreshold: 5000, // Threshold to trigger progressive rendering
        animation: false,           // Disable animations for better performance
        large: true,                // Enable large dataset optimization
        largeThreshold: 2000,       // Threshold to enable large mode
        sampling: 'lttb',
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            if (!params || params.length === 0) return '';
            return `Time: ${params[0].axisValue}<br>${params.map(p => `${p.seriesName}: ${p.value.toFixed(4)}<br>`).join('')}`;
          }
        },
        xAxis: { type: 'category', data: timeData, axisLabel: { fontSize: 12, color: '#666' } },
        dataZoom: [{ type: 'inside', zoomLock: false, start: zoomStart, end: zoomEnd, zoomOnMouseWheel: true }],
        yAxis: { type: 'value', axisLabel: { fontSize: 12, color: '#666' } },
        series: series,
        color: Object.values(colors),
        legend: {
          data: series.map(s => s.name),
          top: 10,
          right: 10,
          icon: 'circle',
          textStyle: { fontSize: 12 },
          formatter: (name) => {
            // Shorten long names
            if (name.length > 20) {
              return name.substring(0, 18) + '...';
            }
            return name;
          }
        },
        animation: false
      };

      // Use try-catch to handle potential errors in chart updates
      try {
        chartInstance.current.setOption(option);
      } catch (error) {
        console.error("Chart update error:", error);
        // If there's an error, try to dispose and reinitialize
        if (chartInstance.current) {
          chartInstance.current.dispose();
          chartInstance.current = null;
        }
      }
    }
  }, [processedData, isLoading, selectedMetrics, zoomStart, zoomEnd]);

  // Handle resize events
  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    // Resize once on component mount
    if (chartInstance.current) {
      setTimeout(() => {
        chartInstance.current.resize();
      }, 200); // Add a small delay to ensure DOM is ready
    }

    // Clean up event listener and dispose chart on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // WebSocket for real-time data
  useWebSocket('ws://' + window.location.hostname + ':8000/ws/motor_control/', {
    onOpen: () => console.log('WS Open'),
    shouldReconnect: () => true,
    share: true,
    onMessage: (event) => {
      if (is_active && event.data && event.data.includes('"dbw": true')) {
        try {
          const newData = JSON.parse(event.data);
          const formattedData = {
            ...newData,
            time: new Date(newData.timestamp * 1e3).toISOString().slice(-13, -3),
            actual_position: newData.actual_position || 0,
            actual_velocity: newData.actual_velocity || 0,
            phase_current: newData.phase_current || 0,
            voltage_logic: newData.voltage_logic || 0
          };

          if (dataInitializedRef.current) {
            setData(prev => [...prev, formattedData]);
          }
        } catch (error) {
          console.error('WS Data Error:', error);
        }
      }
    },
    onError: (error) => console.error('WS Error:', error),
  });

  // Update zoom range when slider changes
  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.dispatchAction({
        type: 'dataZoom',
        start: zoomStart,
        end: zoomEnd,
      });
    }
  }, [zoomStart, zoomEnd]);

  // Group metrics by categories for better organization
  const metricGroups = {
    "Original Data": ["actual_position", "actual_velocity", "phase_current", "voltage_logic",],
    "Smoothed Phase Current": [
      "phase_current_rolling_mean_large",
      "phase_current_ema_low",
      "phase_current_savgol_large",
      "phase_current_median_large",
      "phase_current_cascaded",
      "phase_current_hybrid"
    ]
  };

  return (
    <div className="container">
      {isLoading ? (
        <div className="loading-indicator"><p>Loading...</p></div>
      ) : (
        <>
          <div className="metric-selection">
            {Object.entries(metricGroups).map(([groupName, metrics]) => (
              <div key={groupName} className="metric-group">
                <h4>{groupName}</h4>
                <div className="metric-buttons">
                  {metrics.map(metric => (
                    <button
                      key={metric}
                      className={`metric-button ${selectedMetrics[metric] ? 'active' : ''}`}
                      style={{
                        backgroundColor: selectedMetrics[metric] ? colors[metric] || '#ccc' : '#f0f0f0',
                        color: selectedMetrics[metric] ? 'white' : 'black',
                        margin: '3px',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => toggleMetric(metric)}
                    >
                      {metric.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <a
              className="export-button"
              style={{
                display: 'inline-block',
                margin: '10px 0',
                padding: '8px 12px',
                backgroundColor: '#2c3e50',
                color: 'white',
                borderRadius: '4px',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              href={`data:text/json;charset=utf-8,${encodeURIComponent(
                JSON.stringify(processedData)
              )}`}
              download="session_data_with_smoothing.json"
            >
              Export JSON (with smoothing)
            </a>
          </div>
          <div className="chart-container">
            {processedData.length ? (
              <div
                className="chart-wrapper"
                style={{
                  width: '100%',
                  height: 400, // Increased height for better visibility
                  overflowX: 'auto',
                  cursor: 'grab',
                  overflowY: 'hidden',
                  border: '1px solid #eee',
                  borderRadius: '4px'
                }}
                ref={containerRef}
              >
                <div
                  ref={chartRef}
                  style={{ width: '100%', height: '100%' }}
                ></div>
              </div>
            ) : (
              <div className="no-data-message"><p>No Data Available</p></div>
            )}
          </div>
        </>
      )}
      <div style={{ width: '90%', padding: '10px', margin: '20px auto 10px auto' }}>
        <p style={{ fontSize: '14px', marginBottom: '5px' }}>Zoom Range</p>
        <Slider
          id="slider"
          range={{ draggableTrack: true }}
          allowCross={false}
          trackStyle={{ backgroundColor: '#2c3e50', height: 20 }}
          railStyle={{ backgroundColor: '#ebebeb', height: 20 }}
          handleStyle={{
            height: 25,
            width: 25,
            borderColor: '#2c3e50',
            borderWidth: 0,
            opacity: 0
          }}
          value={[zoomStart, zoomEnd]}
          onChange={(value) => {
            setZoomStart(value[0]);
            setZoomEnd(value[1]);
          }}
        />
      </div>
    </div>
  );
};

export default SessionVisualizer;