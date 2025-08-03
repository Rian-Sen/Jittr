let isTracking = false;
let analyticsInterval = null;

// Check for existing tracking session on popup open
function checkExistingSession() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found");
      return;
    }
    
    const tab = tabs[0];
    
    // Check if we're on a restricted page
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      console.log("Cannot run on restricted page:", tab.url);
      return;
    }
    
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['content.js']
      },
      () => {
        // Wait a moment for the script to load
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { command: "get_status" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Failed to get status:", chrome.runtime.lastError.message);
              updateStatus(false);
            } else if (response && response.isTracking) {
              isTracking = true;
              updateStatus(true);
              startAnalyticsPolling();
              console.log("Resumed existing tracking session");
            }
          });
        }, 100);
      }
    );
  });
}

function updateStatus(tracking) {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  
  if (tracking) {
    statusIndicator.classList.add('active');
    statusText.textContent = 'TRACKING ACTIVE';
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    stopBtn.disabled = false;
    stopBtn.style.opacity = '1';
  } else {
    statusIndicator.classList.remove('active');
    statusText.textContent = 'STANDBY';
    startBtn.disabled = false;
    startBtn.style.opacity = '1';
    stopBtn.disabled = true;
    stopBtn.style.opacity = '0.5';
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDistance(pixels) {
  if (pixels < 1000) return `${Math.round(pixels)}px`;
  return `${(pixels / 1000).toFixed(1)}kpx`;
}

function updateAnalyticsDisplay(analytics) {
  const dataDisplay = document.getElementById('data-display');
  const dataContent = document.getElementById('data-content');
  
  if (analytics) {
    const html = `
      <div class="analytics-grid">
        <div class="metric">
          <div class="metric-label">DURATION</div>
          <div class="metric-value">${formatTime(analytics.sessionDuration)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">DISTANCE</div>
          <div class="metric-value">${formatDistance(analytics.totalDistance)}</div>
        </div>
        <div class="metric">
          <div class="metric-label">AVG SPEED</div>
          <div class="metric-value">${Math.round(analytics.averageSpeed)} px/s</div>
        </div>
        <div class="metric">
          <div class="metric-label">MAX SPEED</div>
          <div class="metric-value">${Math.round(analytics.maxSpeed)} px/s</div>
        </div>
      </div>
      <div class="movement-breakdown">
        <div class="breakdown-item">
          <span class="breakdown-label">Optimal Path:</span>
          <span class="breakdown-value">${formatDistance(analytics.optimalDistance)}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Actual Path:</span>
          <span class="breakdown-value">${formatDistance(analytics.totalDistance)}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Direction Changes:</span>
          <span class="breakdown-value">${analytics.directionChanges}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Horizontal Movement:</span>
          <span class="breakdown-value">${formatDistance(analytics.horizontalMovement)}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Vertical Movement:</span>
          <span class="breakdown-value">${formatDistance(analytics.verticalMovement)}</span>
        </div>
        <div class="breakdown-item">
          <span class="breakdown-label">Points/Second:</span>
          <span class="breakdown-value">${analytics.pointsPerSecond.toFixed(1)}</span>
        </div>
      </div>
    `;
    dataContent.innerHTML = html;
    dataDisplay.classList.add('show');
  } else {
    dataContent.innerHTML = '<div class="no-data">No data collected</div>';
    dataDisplay.classList.remove('show');
  }
}

function updatePredictionDisplay(prediction) {
  const predictionDisplay = document.getElementById('prediction-display');
  const predictionValue = document.getElementById('prediction-value');
  
  if (prediction !== undefined && prediction !== null) {
    const percentage = (prediction * 100).toFixed(1);
    predictionValue.textContent = `${percentage}%`;
    
    // Apply color coding based on probability
    predictionValue.classList.remove('low', 'medium', 'high');
    if (prediction >= 0.7) {
      predictionValue.classList.add('high');
    } else if (prediction >= 0.4) {
      predictionValue.classList.add('medium');
    } else {
      predictionValue.classList.add('low');
    }
    
    predictionDisplay.style.display = 'block';
  } else {
    predictionDisplay.style.display = 'none';
  }
}

function startAnalyticsPolling() {
  // Clear any existing interval
  if (analyticsInterval) {
    clearInterval(analyticsInterval);
  }
  
  // Start new polling
  analyticsInterval = setInterval(() => {
    if (isTracking) {
      sendMessageToContentScript("get_analytics");
    } else {
      stopAnalyticsPolling();
    }
  }, 1000); // Poll every 1 second for real-time updates
}

function stopAnalyticsPolling() {
  if (analyticsInterval) {
    clearInterval(analyticsInterval);
    analyticsInterval = null;
  }
}

function sendMessageToContentScript(command) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found");
      return;
    }
    
    const tab = tabs[0];
    
    // Check if we're on a restricted page
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      console.log("Cannot run on restricted page:", tab.url);
      return;
    }

    // Inject content.js if it's not already injected
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['content.js']
      },
      () => {
        // Wait a moment for the script to load
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { command }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Failed to send message:", chrome.runtime.lastError.message);
              updateStatus(false);
              stopAnalyticsPolling();
            } else {
              console.log(`Command "${command}" sent. Response:`, response);
              if (command === "start") {
                isTracking = true;
                updateStatus(true);
                startAnalyticsPolling();
              } else if (command === "stop") {
                isTracking = false;
                updateStatus(false);
                stopAnalyticsPolling();
                if (response && response.analytics) {
                  updateAnalyticsDisplay(response.analytics);
                }
                // Check for prediction result
                if (response && response.prediction !== undefined) {
                  updatePredictionDisplay(response.prediction);
                }
              } else if (command === "get_analytics") {
                if (response && response.analytics) {
                  updateAnalyticsDisplay(response.analytics);
                }
              }
            }
          });
        }, 100);
      }
    );
  });
}

// Listen for messages from background script (model predictions)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PREDICTION_RESULT") {
    updatePredictionDisplay(message.prediction);
  }
});

// Initialize status and check for existing session
updateStatus(false);
checkExistingSession();

document.getElementById("start-btn").addEventListener("click", () => {
  sendMessageToContentScript("start");
});

document.getElementById("stop-btn").addEventListener("click", () => {
  sendMessageToContentScript("stop");
});

document.getElementById("simulation-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("simulation.html") });
});
