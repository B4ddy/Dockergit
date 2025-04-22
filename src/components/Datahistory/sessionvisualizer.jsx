import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { axiosInstance } from '../../axiosApi';
import useWebSocket from "react-use-websocket";
import Slider from "rc-slider";
import 'rc-slider/assets/index.css';

// Advanced sampling technique for large datasets
const sampleData = (data, maxPoints = 2000) => {
  if (data.length <= maxPoints) return data;

  const step = Math.floor(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
};

// Optimized Smoothing utility functions
const applyRollingMeanOptimized = (data, window) => {
  const result = new Float64Array(data.length);
  const buffer = new Float64Array(data.length);
  buffer.set(data);

  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += buffer[i];
    if (i >= window) {
      sum -= buffer[i - window];
    }
    if (i >= window - 1) {
      result[i] = sum / window;
    }
  }
  return result;
};

// Main component
const SessionVisualizer = ({ sessionid, is_active, maxDataPoints = 10000 }) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const dataInitializedRef = useRef(false);
  const [selectedMetrics, setSelectedMetrics] = useState({
    actual_position: true,
    actual_velocity: true,
    phase_current: false,
    phase_current_rolling_mean_large: true,
    voltage_logic: false,
  });
  
  const colors = {
    actual_position: "#4361EE",
    actual_velocity: "#3A0CA3",
    phase_current: "#F72585",
    phase_current_rolling_mean_large: "#FF9E00",
    voltage_logic: "#4CC9F0"
  };
  
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const containerRef = useRef(null);
  const [zoomStart, setZoomStart] = useState(55);
  const [zoomEnd, setZoomEnd] = useState(100);

  // Performance tracking
  const performanceRef = useRef({
    lastProcessingTime: 0,
    dataProcessingCount: 0
  });

  // Smoothing parameters
  const [smoothingParams, setSmoothingParams] = useState({
    rolling: { window: 15 }
  });

  const formatTime = (timeString) => {
    return timeString.time || '';
  };

  // Use useCallback to memoize the toggle function
  const toggleMetric = useCallback((metric) => {
    setSelectedMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  }, []);

  // Process data with advanced sampling and smoothing
  const processedData = useMemo(() => {
    const startTime = performance.now();
    
    // Early return if no data
    if (!data.length) return [];

    // Sample data for better performance
    const sampledData = sampleData(data, 2000);

    // Extract phase current values efficiently
    const phaseCurrentValues = sampledData.map(item => item.phase_current || 0);

    // Apply optimized smoothing
    const rollingMeanLarge = applyRollingMeanOptimized(
      phaseCurrentValues, 
      smoothingParams.rolling.window
    );

    // Add smoothed values
    const result = sampledData.map((item, index) => ({
      ...item,
      phase_current_rolling_mean_large: rollingMeanLarge[index] || 0
    }));

    const processingTime = performance.now() - startTime;
    performanceRef.current.lastProcessingTime = processingTime;
    performanceRef.current.dataProcessingCount++;

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
        
        // Limit initial data points
        const limitedData = response.data.slice(-maxDataPoints);
        setData(limitedData);
        console.log("Data Fetched:", limitedData);
        dataInitializedRef.current = true;
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionid, maxDataPoints]);

  // Initialize and update chart with performance optimizations
  useEffect(() => {
    if (!chartRef.current || isLoading) return;

    // Always initialize a new chart when data or metrics change
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    if (processedData.length > 0) {
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas'  // Explicitly set canvas renderer
      });

      const timeData = processedData.map(formatTime);

      const series = Object.entries(selectedMetrics)
        .filter(([, selected]) => selected)
        .map(([metric]) => ({
          name: metric.replace(/_/g, ' '),
          type: 'line',
          smooth: false,
          data: processedData.map(item => item[metric] || 0),
          showSymbol: false,
          lineStyle: { width: 2, color: colors[metric] },
          emphasis: { itemStyle: { borderWidth: 2 } }
        }));

      const option = {
        // Performance optimization settings
        progressive: 1000,          // Enable progressive rendering
        progressiveThreshold: 5000, // Threshold to trigger progressive rendering
        animation: false,           // Disable animations for better performance
        large: true,                // Enable large dataset optimization
        largeThreshold: 2000,       // Threshold to enable large mode
        sampling: 'lttb',           // Largest-Triangle-Three-Buckets sampling
        
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            if (!params || params.length === 0) return '';
            return `Time: ${params[0].axisValue}<br>${params.map(p => `${p.seriesName}: ${p.value.toFixed(4)}<br>`).join('')}`;
          }
        },
        xAxis: { 
          type: 'category', 
          data: timeData, 
          axisLabel: { 
            fontSize: 12, 
            color: '#666',
            interval: 'auto'  // Optimize label rendering
          } 
        },
        dataZoom: [{ 
          type: 'inside', 
          zoomLock: false, 
          start: zoomStart, 
          end: zoomEnd, 
          zoomOnMouseWheel: true 
        }],
        yAxis: { 
          type: 'value', 
          axisLabel: { 
            fontSize: 12, 
            color: '#666' 
          } 
        },
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
            return name.length > 20 ? name.substring(0, 18) + '...' : name;
          }
        }
      };

      // Use try-catch to handle potential errors in chart updates
      try {
        chartInstance.current.setOption(option, {
          notMerge: true,  // Create a new chart instead of merging
          lazyUpdate: true // Lazy update for better performance
        });
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
            // Limit total data points
            setData(prevData => {
              const updatedData = [...prevData, formattedData];
              return updatedData.slice(-maxDataPoints);
            });
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

  // Performance information display
  const renderPerformanceInfo = () => {
    const { lastProcessingTime, dataProcessingCount } = performanceRef.current;
    return (
      <div style={{ 
        fontSize: '10px', 
        color: '#666', 
        padding: '5px',
        backgroundColor: '#f4f4f4',
        borderRadius: '4px',
        margin: '5px 0'
      }}>
        Last Data Processing: {lastProcessingTime.toFixed(2)}ms
        | Total Processes: {dataProcessingCount}
      </div>
    );
  };

  // Group metrics by categories for better organization
  const metricGroups = {
    "Original Data": ["actual_position", "actual_velocity", "phase_current", "voltage_logic"],
    "Smoothed Phase Current": ["phase_current_rolling_mean_large"]
  };

  return (
    <div className="container">
      {renderPerformanceInfo()}
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
                  height: 400,
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

export default React.memo(SessionVisualizer);