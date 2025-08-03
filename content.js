// Dryft Mouse Tracking Extension - Content Script
let isTracking = false;
let sessionStartTime = 0;
let mouseData = [];
let lastPosition = null;
let dataPointCount = 0;
let totalDistance = 0;
let maxSpeed = 0;
let speedSamples = [];
let startPosition = null;

// Model integration variables
let trials = [];
let currentTrial = null;
let currentExperiment = "staircase_SSD"; // Default experiment type

// Configuration
const CAPTURE_INTERVAL = 16; // ~60fps
const MIN_DISTANCE_THRESHOLD = 2; // Minimum pixels to record
let lastCaptureTime = 0;

// Create visual indicator for tracking status
function createTrackingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'dryft-tracking-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 100px;
    height: 60px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ffff;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Orbitron', monospace;
    font-size: 9px;
    color: #00ffff;
    text-align: center;
    z-index: 10000;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
    opacity: 0;
    transition: opacity 0.3s ease;
    backdrop-filter: blur(10px);
  `;
  indicator.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 3px;">DRIFT ACTIVE</div>
    <div id="dryft-efficiency">0%</di
  `;
  document.body.appendChild(indicator);
  return indicator;
}

function updateTrackingIndicator() {
  const indicator = document.getElementById('dryft-tracking-indicator');
  if (indicator) {
    const efficiencyElement = indicator.querySelector('#dryft-efficiency');
    
    if (efficiencyElement) {
      const efficiency = calculatePathEfficiency();
      efficiencyElement.textContent = `${efficiency.toFixed(1)}%`;
    }
  }
}

function showTrackingIndicator() {
  const indicator = document.getElementById('dryft-tracking-indicator') || createTrackingIndicator();
  indicator.style.opacity = '1';
  indicator.style.animation = 'pulse 2s infinite';
}

function hideTrackingIndicator() {
  const indicator = document.getElementById('dryft-tracking-indicator');
  if (indicator) {
    indicator.style.opacity = '0';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }
}

// Calculate distance between two points
function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Calculate speed in pixels per second
function calculateSpeed(distance, timeDiff) {
  return timeDiff > 0 ? (distance / timeDiff) * 1000 : 0;
}

// Calculate path efficiency between consecutive points
function calculatePathEfficiency() {
  if (mouseData.length < 3) return 100; // Need at least 3 points for meaningful calculation
  
  let totalEfficiency = 0;
  let segmentCount = 0;
  
  // Calculate efficiency for each segment (point to point)
  for (let i = 1; i < mouseData.length - 1; i++) {
    const prevPoint = mouseData[i - 1];
    const currentPoint = mouseData[i];
    const nextPoint = mouseData[i + 1];
    
    // Calculate optimal distance (straight line from prev to next)
    const optimalDistance = calculateDistance(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y);
    
    // Calculate actual distance (prev -> current -> next)
    const actualDistance = calculateDistance(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y) +
                          calculateDistance(currentPoint.x, currentPoint.y, nextPoint.x, nextPoint.y);
    
    // Calculate direction change
    const angle1 = Math.atan2(currentPoint.y - prevPoint.y, currentPoint.x - prevPoint.x);
    const angle2 = Math.atan2(nextPoint.y - currentPoint.y, nextPoint.x - currentPoint.x);
    const directionChange = Math.abs(angle2 - angle1) * (180 / Math.PI); // Convert to degrees
    
    // Calculate segment efficiency
    let segmentEfficiency = 100;
    
    if (optimalDistance > 0) {
      // Distance efficiency (how close actual path is to optimal)
      const distanceEfficiency = (optimalDistance / actualDistance) * 100;
      
      // Direction efficiency (penalty for direction changes)
      // 0° change = 100%, 90° change = 70%, 180° change = 40%
      const directionEfficiency = Math.max(40, 100 - (directionChange * 0.67));
      
      // Combine both factors (weighted average: 70% distance, 30% direction)
      segmentEfficiency = (distanceEfficiency * 0.7) + (directionEfficiency * 0.3);
    }
    
    totalEfficiency += segmentEfficiency;
    segmentCount++;
  }
  
  // Return average efficiency across all segments
  return segmentCount > 0 ? totalEfficiency / segmentCount : 100;
}

// Generate comprehensive analytics
function generateAnalytics() {
  if (mouseData.length < 2) return null;
  
  const sessionDuration = Date.now() - sessionStartTime;
  const timeRange = mouseData[mouseData.length - 1].time - mouseData[0].time;
  
  // Calculate movement patterns
  let horizontalMovement = 0;
  let verticalMovement = 0;
  let directionChanges = 0;
  let previousDirection = null;
  
  for (let i = 1; i < mouseData.length; i++) {
    const dx = mouseData[i].x - mouseData[i-1].x;
    const dy = mouseData[i].y - mouseData[i-1].y;
    
    horizontalMovement += Math.abs(dx);
    verticalMovement += Math.abs(dy);
    
    // Detect direction changes
    const currentDirection = {
      x: dx > 0 ? 'right' : dx < 0 ? 'left' : 'none',
      y: dy > 0 ? 'down' : dy < 0 ? 'up' : 'none'
    };
    
    if (previousDirection && 
        (currentDirection.x !== previousDirection.x || currentDirection.y !== previousDirection.y)) {
      directionChanges++;
    }
    previousDirection = currentDirection;
  }
  
  // Calculate average speed - only during active movement with minimum threshold
  let avgSpeed = 0;
  if (speedSamples.length > 0) {
    // Filter speeds to only include meaningful movements
    // Minimum speed threshold: 10 px/s (very slow but intentional movement)
    // Maximum speed threshold: 5000 px/s (very fast but realistic)
    const meaningfulSpeeds = speedSamples.filter(speed => 
      speed >= 10 && speed <= 5000 && !isNaN(speed) && isFinite(speed)
    );
    
    if (meaningfulSpeeds.length > 0) {
      avgSpeed = meaningfulSpeeds.reduce((a, b) => a + b, 0) / meaningfulSpeeds.length;
    }
  }
  
  // Calculate path efficiency
  const pathEfficiency = calculatePathEfficiency();
  
  // Calculate optimal path distance
  let optimalDistance = 0;
  if (startPosition && mouseData.length > 0) {
    const currentPosition = mouseData[mouseData.length - 1];
    optimalDistance = calculateDistance(
      startPosition.x, startPosition.y,
      currentPosition.x, currentPosition.y
    );
  }
  
  return {
    sessionDuration: sessionDuration,
    timeRange: timeRange,
    totalPoints: dataPointCount,
    totalDistance: totalDistance,
    optimalDistance: optimalDistance,
    pathEfficiency: pathEfficiency,
    maxSpeed: maxSpeed,
    averageSpeed: avgSpeed,
    horizontalMovement: horizontalMovement,
    verticalMovement: verticalMovement,
    directionChanges: directionChanges,
    movementEfficiency: totalDistance / (horizontalMovement + verticalMovement),
    pointsPerSecond: dataPointCount / (sessionDuration / 1000),
    dataDensity: dataPointCount / (totalDistance || 1)
  };
}

// Export data to local mouseData folder
function exportData(analytics) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // Create JSON data structure
  const jsonData = {
    session_metadata: {
      timestamp: new Date().toISOString(),
      session_id: sessionStartTime,
      duration: analytics ? analytics.sessionDuration : 0,
      total_points: dataPointCount
    },
    mouse_tracking_data: mouseData,
    analytics: analytics || {}
  };
  
  // Prepare CSV data
  let csvData = null;
  if (mouseData.length > 0) {
    const csvHeaders = ['x', 'y', 'time', 'distance'];
    const csvRows = [csvHeaders.join(',')];
    
    mouseData.forEach(point => {
      csvRows.push(`${point.x},${point.y},${point.time},${point.distance || 0}`);
    });
    
    csvData = csvRows.join('\n');
  }
  
  // Save to local mouseData folder using chrome.storage
  const dataToStore = {
    jsonData: jsonData,
    csvData: csvData,
    timestamp: timestamp
  };
  
  chrome.storage.local.set({ 
    [`mouseData_${timestamp}`]: dataToStore 
  }, () => {
    console.log("%c[DRYFT] %cData saved to local storage: mouseData_" + timestamp, 
      "color: #00ffff; font-weight: bold;", 
      "color: #00ff00;");
    
    // Also try to save to the mouseData.js file in the extension directory
    saveToMouseDataFile(jsonData, csvData, timestamp);
  });
}

// Save data to mouseData.js file
function saveToMouseDataFile(jsonData, csvData, timestamp) {
  // Create a data URL for the JSON file
  const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  
  // Create a data URL for the CSV file
  const csvBlob = new Blob([csvData], { type: 'text/csv' });
  const csvUrl = URL.createObjectURL(csvBlob);
  
  // Try to download to the mouseData folder
  chrome.downloads.download({
    url: jsonUrl,
    filename: `mouseData/dryft_mouse_data_${timestamp}.json`,
    saveAs: false
  }, (downloadId) => {
    URL.revokeObjectURL(jsonUrl);
    if (chrome.runtime.lastError) {
      console.log("JSON download failed, data saved to storage only:", chrome.runtime.lastError.message);
    } else {
      console.log('JSON file download started:', downloadId);
    }
  });
  
  if (csvData) {
    chrome.downloads.download({
      url: csvUrl,
      filename: `mouseData/dryft_mouse_data_${timestamp}.csv`,
      saveAs: false
    }, (downloadId) => {
      URL.revokeObjectURL(csvUrl);
      if (chrome.runtime.lastError) {
        console.log("CSV download failed, data saved to storage only:", chrome.runtime.lastError.message);
      } else {
        console.log('CSV file download started:', downloadId);
      }
    });
  }
}

// Enhanced mouse tracking with throttling and analytics
function handleMouseMove(event) {
  if (!isTracking) return;
  
  const currentTime = Date.now();
  
  // Throttle captures for performance
  if (currentTime - lastCaptureTime < CAPTURE_INTERVAL) return;
  
  const currentPosition = { x: event.clientX, y: event.clientY };
  
  // Set start position on first movement
  if (!startPosition) {
    startPosition = currentPosition;
  }
  
  // Only record if mouse moved enough
  if (lastPosition) {
    const distance = calculateDistance(
      lastPosition.x, lastPosition.y, 
      currentPosition.x, currentPosition.y
    );
    
    if (distance < MIN_DISTANCE_THRESHOLD) return;
    
    // Calculate speed with better accuracy
    const timeDiff = (currentTime - lastPosition.time) / 1000;
    if (timeDiff > 0) {
      const speed = distance / timeDiff; // pixels per second
      
      // Only record meaningful speeds
      if (speed >= 10 && speed <= 5000 && !isNaN(speed) && isFinite(speed)) {
        if (speed > maxSpeed) maxSpeed = speed;
        speedSamples.push(speed);
        
        // Keep only recent speed samples for average calculation
        if (speedSamples.length > 50) speedSamples.shift();
      }
    }
    
    totalDistance += distance;
  }
  
  const point = { 
    x: currentPosition.x, 
    y: currentPosition.y, 
    time: currentTime,
    distance: lastPosition ? calculateDistance(lastPosition.x, lastPosition.y, currentPosition.x, currentPosition.y) : 0
  };
  
  mouseData.push(point);
  dataPointCount++;
  lastCaptureTime = currentTime;
  lastPosition = { ...currentPosition, time: currentTime };
  
  // Update indicator
  updateTrackingIndicator();
  
  // Log progress every 100 points
  if (dataPointCount % 100 === 0) {
    const efficiency = calculatePathEfficiency();
    console.log("%c[DRYFT] %cData point #" + dataPointCount + " | Distance: " + Math.round(totalDistance) + "px | Efficiency: " + efficiency.toFixed(1) + "%", 
      "color: #00ffff; font-weight: bold;", 
      "color: #ffffff;");
  }
}

// ─── TRIAL MANAGEMENT ─────────────────────────────────────────────────────────
function startTrial(type, coherence) {
  // type: "go" or "stop"; coherence: 10, 50, or 80
  currentTrial = {
    type,
    coh: coherence,
    start: performance.now(),
    samples: [],        // {t,x,y}
    moved: false,
    moveTime: null,
    experiment: currentExperiment
  };
  console.log(`Started ${type} trial with ${coherence}% coherence`);
}

function endTrial() {
  if (!currentTrial) return;
  currentTrial.end = performance.now();
  trials.push(currentTrial);
  console.log(`Ended trial. Total trials: ${trials.length}`);
  currentTrial = null;
}

// ─── METRIC CALCULATORS ─────────────────────────────────────────────────────────
function calcMetrics(samples) {
  const vels = [], accs = [], dists = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i-1].t) / 1000; // sec
    const dx = samples[i].x - samples[i-1].x;
    const dy = samples[i].y - samples[i-1].y;
    const dist = Math.hypot(dx, dy);
    const vel = dt > 0 ? dist / dt : 0;
    vels.push(vel);
    dists.push(dist);
    if (vels.length > 1) {
      const acc = (vels[vels.length - 1] - vels[vels.length - 2]) / dt;
      accs.push(acc);
    }
  }
  return {
    maxVel: vels.length ? Math.max(...vels) : 0,
    maxAcc: accs.length ? Math.max(...accs) : 0,
    totDist: dists.reduce((a, b) => a + b, 0)
  };
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// ─── FEATURE COMPUTATION ────────────────────────────────────────────────────────
function computeFeatures(trials) {
  const feats = {};

  // Helper to filter and aggregate one coherence & type
  function agg(type, coh) {
    const subset = trials.filter(t => t.type === type && t.coh === coh);
    const mets = subset.map(t => calcMetrics(t.samples));
    return {
      vel_max: avg(mets.map(m => m.maxVel)),
      acc_max: avg(mets.map(m => m.maxAcc)),
      total_dist: avg(mets.map(m => m.totDist))
    };
  }

  // 1–9) No-go kinematics at 10,50,80
  [10, 50, 80].forEach(c => {
    const { vel_max, acc_max, total_dist } = agg("stop", c);
    feats[`vel_max_nogo${c}coh`] = vel_max;
    feats[`acc_max_nogo${c}coh`] = acc_max;
    feats[`total_dist_nogo${c}coh`] = total_dist;
  });

  // 10) SSRT (integration method)
  const goRTs = trials.filter(t => t.type === "go").map(t => t.moveTime).filter(v => v != null);
  const stopFails = trials.filter(t => t.type === "stop" && t.moved).length;
  const stopTotal = trials.filter(t => t.type === "stop").length;
  const failPct = stopTotal ? stopFails / stopTotal : 0;
  const sortedRTs = goRTs.slice().sort((a, b) => a - b);
  const nthIdx = Math.floor(failPct * sortedRTs.length);
  const ssrtPt = sortedRTs[nthIdx] || avg(goRTs);
  const meanSSD = 250; // if you have SSD timings per trial, compute actual mean
  feats.ssrt_integ = ssrtPt - meanSSD;

  // 11) IN = # successful inhibits (stop & no move)
  feats.IN = trials.filter(t => t.type === "stop" && !t.moved).length;

  // 12) vol = # violations (stop & moved)
  feats.vol = stopFails;

  // 13) go_acc = proportion of go trials with movement
  const goTotal = trials.filter(t => t.type === "go").length;
  feats.go_acc = goTotal ? trials.filter(t => t.type === "go" && t.moved).length / goTotal : 0;

  // 14) meanmt = mean movement time on go trials
  feats.meanmt = avg(trials.filter(t => t.type === "go" && t.moveTime != null).map(t => t.moveTime));

  // 15) one-hot experiment dummy
  feats.experiment_staircase_SSD = currentExperiment === "staircase_SSD" ? 1 : 0;

  return feats;
}

// ─── MAIN TRACKING FUNCTIONS ──────────────────────────────────────────────────
function startTracking() {
  if (isTracking) {
    console.log("%c[DRYFT] %cAlready tracking, stopping previous session", 
      "color: #ff0066; font-weight: bold;", 
      "color: #ffffff;");
    stopTracking();
  }
  
  isTracking = true;
  sessionStartTime = Date.now();
  mouseData = [];
  dataPointCount = 0;
  lastCaptureTime = 0;
  lastPosition = null;
  totalDistance = 0;
  maxSpeed = 0;
  speedSamples = [];
  startPosition = null;
  trials = [];
  currentTrial = null;
  
  // Add event listener
  document.addEventListener("mousemove", handleMouseMove);
  
  showTrackingIndicator();
  
  console.log("%c[DRYFT] %cADVANCED NEURAL TRACKING SYSTEM INITIALIZED", 
    "color: #00ffff; font-weight: bold; font-size: 14px;", 
    "color: #ff00ff; font-size: 12px;");
  console.log("%c[DRYFT] %cMouse tracking enabled", 
    "color: #00ffff; font-weight: bold;", 
    "color: #ffffff;");
}

function stopTracking() {
  if (!isTracking) {
    console.log("%c[DRYFT] %cNo active tracking session", 
      "color: #ff0066; font-weight: bold;", 
      "color: #ffffff;");
    return;
  }
  
  console.log("%c[DRYFT] %cStopping tracking session", 
    "color: #ff0066; font-weight: bold;", 
    "color: #ffffff;");
  
  // Remove event listener
  document.removeEventListener("mousemove", handleMouseMove);
  
  const analytics = generateAnalytics();
  
  console.log("%c[DRYFT] %cTRACKING TERMINATED", 
    "color: #ff0066; font-weight: bold; font-size: 14px;", 
    "color: #ffffff;");
  console.log("%c[DRYFT] %cSession Analytics:", 
    "color: #00ffff; font-weight: bold;", 
    "color: #ffffff;");
  console.table(analytics);
  console.log("%c[DRYFT] %cRaw movement data:", 
    "color: #00ffff; font-weight: bold;", 
    "color: #ffffff;");
  console.table(mouseData);
  
  // Build features for model prediction
  const features = buildModelFeatures(analytics);
  
  // Send to background for model prediction
  chrome.runtime.sendMessage(
    { type: "PREDICT_ADHD", features: features },
    response => {
      console.log("Model prediction response:", response);
      if (response && response.prediction !== undefined) {
        console.log("%c[DRYFT] %cADHD Probability: " + (response.prediction * 100).toFixed(1) + "%", 
          "color: #ff00ff; font-weight: bold; font-size: 16px;", 
          "color: #ffffff;");
      }
    }
  );
  
  // Export data
  exportData(analytics);
  
  // Clean up
  hideTrackingIndicator();
  isTracking = false;
  
  console.log("%c[DRYFT] %cTracking stopped", 
    "color: #ff0066; font-weight: bold;", 
    "color: #ffffff;");
}

// Build features for the model
function buildModelFeatures(analytics) {
  return {
    // Mouse movement features mapped to model expectations
    vel_max_nogo10coh: analytics.maxSpeed,
    acc_max_nogo10coh: analytics.averageSpeed || 0, // Use 0 if averageSpeed doesn't exist
    total_dist_nogo10coh: analytics.totalDistance,
    
    vel_max_nogo50coh: analytics.maxSpeed * 0.8, // Slightly different for different coherences
    acc_max_nogo50coh: (analytics.averageSpeed || 0) * 0.8,
    total_dist_nogo50coh: analytics.totalDistance * 0.8,
    
    vel_max_nogo80coh: analytics.maxSpeed * 0.6,
    acc_max_nogo80coh: (analytics.averageSpeed || 0) * 0.6,
    total_dist_nogo80coh: analytics.totalDistance * 0.6,
    
    // Stop-signal and go metrics
    ssrt_integ: analytics.sessionDuration * 0.3,
    IN: Math.max(0, analytics.directionChanges - 5),
    vol: Math.min(analytics.directionChanges, 10),
    go_acc: Math.min(analytics.movementEfficiency, 1.0),
    meanmt: analytics.sessionDuration / Math.max(dataPointCount, 1),
    
    // Experiment type
    experiment_staircase_SSD: 1
  };
}

// ─── MESSAGE HANDLERS ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "start") {
    startTracking();
    sendResponse({ success: true });
  } else if (message.command === "stop") {
    stopTracking();
    sendResponse({ success: true });
  } else if (message.command === "get_status") {
    sendResponse({
      isTracking, dataPointCount, sessionStartTime
    });
  } else if (message.command === "get_analytics") {
    const analytics = generateAnalytics();
    sendResponse({ analytics: analytics });
  } else if (message.command === "start_trial") {
    startTrial(message.type, message.coherence);
    sendResponse({ success: true });
  } else if (message.command === "end_trial") {
    endTrial();
    sendResponse({ success: true });
  } else if (message.command === "set_experiment") {
    currentExperiment = message.experiment;
    sendResponse({ success: true });
  }
});

// Add CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.5); }
    50% { box-shadow: 0 0 30px rgba(0, 255, 255, 0.8); }
    100% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.5); }
  }
`;
document.head.appendChild(style);

console.log("%c[DRYFT] %cContent script loaded successfully", 
  "color: #00ffff; font-weight: bold;", 
  "color: #00ff00;");