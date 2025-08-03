// Game state
let gameActive = false;
let currentButtons = [];
let targetButtonIndex = 0;
let clickTimes = [];
let mousePositions = [];
let lastMouseTime = 0;
let velocities = [];
let accelerations = [];
let pathDeviations = [];
let buttonPositions = [];
let totalClicks = 0;
let lastButtonCenter = null;

// DOM elements
const welcomeScreen = document.getElementById('welcomeScreen');
const gameContainer = document.getElementById('gameContainer');
const instructionOverlay = document.getElementById('instructionOverlay');
const startGameButton = document.getElementById('startGame');
const startButton = document.getElementById('startButton');
const customCursor = document.getElementById('customCursor');
const pathCanvas = document.getElementById('pathCanvas');
const ctx = pathCanvas.getContext('2d');

// Resize canvas
function resizeCanvas() {
    pathCanvas.width = window.innerWidth;
    pathCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Initialize custom cursor
function initCustomCursor() {
    if (customCursor) {
        customCursor.style.display = 'none'; // Hide initially
    }
}

// Custom cursor tracking
document.addEventListener('mousemove', (e) => {
    if (customCursor && gameActive) {
        customCursor.style.display = 'block';
        customCursor.style.left = e.clientX - 10 + 'px';
        customCursor.style.top = e.clientY - 10 + 'px';
        trackMouseMovement(e.clientX, e.clientY);
    }
});

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    initCustomCursor();
    attachEventListeners();
});

// Fallback initialization
window.addEventListener('load', () => {
    console.log('Window loaded, checking initialization...');
    if (customCursor) {
        customCursor.style.display = 'none';
    }
    
    // Make sure event listeners are attached if DOMContentLoaded missed
    if (startGameButton && !startGameButton.onclick) {
        console.log('Attaching event listeners via window load...');
        attachEventListeners();
    }
});

// Function to attach all event listeners
function attachEventListeners() {
    console.log('Attaching event listeners...');
    
    // Verify elements exist
    if (!startGameButton) {
        console.error('Start game button not found!');
        return;
    } else {
        console.log('Start game button found successfully');
    }
    
    if (!startButton) {
        console.error('Start button not found!');
        return;
    } else {
        console.log('Start button found successfully');
    }
    
    // Attach start game event listener
    startGameButton.addEventListener('click', () => {
        console.log('Start game button clicked!'); // Debug log
        welcomeScreen.style.display = 'none';
        instructionOverlay.style.display = 'block';
    });
    
    // Attach begin tracking event listener
    startButton.addEventListener('click', () => {
        console.log('Begin tracking button clicked!'); // Debug log
        instructionOverlay.style.display = 'none';
        gameContainer.style.display = 'block';
        startGame();
    });
    
    console.log('Event listeners attached successfully!');
}

function startGame() {
    gameActive = true;
    resetMetrics();
    createInitialButtons();
}

function resetMetrics() {
    clickTimes = [];
    mousePositions = [];
    velocities = [];
    accelerations = [];
    pathDeviations = [];
    buttonPositions = [];
    totalClicks = 0;
    lastButtonCenter = null;
    updateMetricsDisplay();
}

function createInitialButtons() {
    // Clear existing buttons
    currentButtons.forEach(btn => btn.remove());
    currentButtons = [];
    
    // Create two buttons at random positions
    const positions = generateButtonPositions(2);
    
    positions.forEach((pos, index) => {
        const button = createButton(pos.x, pos.y, index);
        currentButtons.push(button);
        gameContainer.appendChild(button);
    });
    
    // Set first button as target
    targetButtonIndex = 0;
    updateTargetButton();
}

function generateButtonPositions(count) {
    const positions = [];
    const minDistance = 300; // Minimum distance between buttons
    const margin = 100; // Margin from edges
    
    for (let i = 0; i < count; i++) {
        let validPosition = false;
        let attempts = 0;
        
        while (!validPosition && attempts < 50) {
            const x = margin + Math.random() * (window.innerWidth - 2 * margin - 80);
            const y = margin + Math.random() * (window.innerHeight - 2 * margin - 80);
            
            validPosition = true;
            
            // Check distance from existing positions
            for (const pos of positions) {
                const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
                if (distance < minDistance) {
                    validPosition = false;
                    break;
                }
            }
            
            if (validPosition) {
                positions.push({ x, y });
            }
            
            attempts++;
        }
        
        // Fallback if no valid position found
        if (!validPosition) {
            positions.push({
                x: margin + (i * 300) % (window.innerWidth - 2 * margin),
                y: margin + Math.floor(i * 300 / (window.innerWidth - 2 * margin)) * 200
            });
        }
    }
    
    return positions;
}

function createButton(x, y, index) {
    const button = document.createElement('div');
    button.className = 'game-button';
    button.style.left = x + 'px';
    button.style.top = y + 'px';
    button.textContent = `${index + 1}`;
    button.dataset.index = index;
    
    button.addEventListener('click', (e) => handleButtonClick(e, button, x + 40, y + 40));
    
    return button;
}

function updateTargetButton() {
    currentButtons.forEach((btn, index) => {
        btn.classList.toggle('target', index === targetButtonIndex);
    });
}

function handleButtonClick(event, button, centerX, centerY) {
    if (!gameActive) return;
    
    const buttonIndex = parseInt(button.dataset.index);
    if (buttonIndex !== targetButtonIndex) return; // Only allow clicking target button
    
    // Record click metrics
    const now = Date.now();
    const clickAccuracy = calculateClickAccuracy(event, button);
    
    clickTimes.push(now);
    totalClicks++;
    
    // Calculate path deviation if we have a previous button
    if (lastButtonCenter) {
        const deviation = calculatePathDeviation(lastButtonCenter, { x: centerX, y: centerY });
        pathDeviations.push(deviation);
    }
    
    lastButtonCenter = { x: centerX, y: centerY };
    
    // Remove the previous button (if exists) and create a new one
    if (currentButtons.length === 2) {
        const oldButtonIndex = 1 - targetButtonIndex;
        currentButtons[oldButtonIndex].remove();
        
        // Create new button at random position
        const newPosition = generateButtonPositions(1)[0];
        const newButton = createButton(newPosition.x, newPosition.y, oldButtonIndex);
        currentButtons[oldButtonIndex] = newButton;
        gameContainer.appendChild(newButton);
    }
    
    // Switch target to the other button
    targetButtonIndex = 1 - targetButtonIndex;
    updateTargetButton();
    
    // Clear mouse tracking for new path
    mousePositions = [];
    
    updateMetricsDisplay();
}

function calculateClickAccuracy(event, button) {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    const distance = Math.sqrt(Math.pow(clickX - centerX, 2) + Math.pow(clickY - centerY, 2));
    const maxDistance = Math.min(rect.width, rect.height) / 2;
    
    return Math.max(0, 100 - (distance / maxDistance) * 100);
}

function trackMouseMovement(x, y) {
    const now = Date.now();
    
    if (mousePositions.length > 0) {
        const lastPos = mousePositions[mousePositions.length - 1];
        const dt = (now - lastPos.time) / 1000; // Convert to seconds
        
        if (dt > 0) {
            const dx = x - lastPos.x;
            const dy = y - lastPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const velocity = distance / dt;
            
            velocities.push(velocity);
            
            if (velocities.length > 1) {
                const lastVelocity = velocities[velocities.length - 2];
                const acceleration = Math.abs(velocity - lastVelocity) / dt;
                accelerations.push(acceleration);
            }
        }
    }
    
    mousePositions.push({ x, y, time: now });
    
    // Keep only recent positions to avoid memory issues
    if (mousePositions.length > 100) {
        mousePositions = mousePositions.slice(-50);
    }
}

function calculatePathDeviation(start, end) {
    if (mousePositions.length < 2) return 0;
    
    const idealDistance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    let actualDistance = 0;
    
    for (let i = 1; i < mousePositions.length; i++) {
        const prev = mousePositions[i - 1];
        const curr = mousePositions[i];
        actualDistance += Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
    }
    
    return actualDistance > 0 ? ((actualDistance - idealDistance) / idealDistance) * 100 : 0;
}

function updateMetricsDisplay() {
    // Average time between clicks (latency)
    let avgLatency = 0;
    if (clickTimes.length > 1) {
        const intervals = [];
        for (let i = 1; i < clickTimes.length; i++) {
            intervals.push(clickTimes[i] - clickTimes[i - 1]);
        }
        avgLatency = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        document.getElementById('avgTime').textContent = (avgLatency / 1000).toFixed(2) + 's';
    }

    // Click accuracy (placeholder for now)
    document.getElementById('accuracy').textContent = '95%'; // TODO: compute properly if needed

    // Max velocity
    if (velocities.length > 0) {
        const maxVel = Math.max(...velocities);
        document.getElementById('maxVelocity').textContent = Math.round(maxVel) + ' px/s';
    }

    // Max acceleration
    if (accelerations.length > 0) {
        const maxAccel = Math.max(...accelerations);
        document.getElementById('maxAccel').textContent = Math.round(maxAccel) + ' px/s²';
    }

    // Average path deviation
    if (pathDeviations.length > 0) {
        const avgDev = pathDeviations.reduce((a, b) => a + b, 0) / pathDeviations.length;
        document.getElementById('avgDeviation').textContent = avgDev.toFixed(1) + '%';
    }

    // Total clicks
    document.getElementById('totalClicks').textContent = totalClicks;

    // --- Collect features for model prediction ---
    if (velocities.length > 0 && clickTimes.length > 1 && pathDeviations.length > 0) {
        const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
        const speedStd = Math.sqrt(
            velocities.map(v => Math.pow(v - avgVel, 2)).reduce((a, b) => a + b, 0) / velocities.length
        );

        const pathEfficiency = 100 - (
            pathDeviations.reduce((a, b) => a + b, 0) / pathDeviations.length
        );

        const features = {
            speedStd: speedStd,
            pathEfficiency: pathEfficiency,
            avgClickLatency: avgLatency
        };

        // Send to Flask model API
        sendPrediction(features);
    }
}


function sendPrediction(features) {
    fetch("http://localhost:5000/predict", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(features)
    })
    .then(res => res.json())
    .then(data => {
        if (data.error || data.adhd_probability === undefined) {
            console.warn("Backend prediction failed, using fallback.");
            useFallbackPrediction(features);
            return;
        }

        const prob = data.adhd_probability;
        updateResultUI(prob);
    })
    .catch(err => {
        console.error("Prediction error:", err);
        useFallbackPrediction(features);
    });
}

// -----------------------------
// Fallback rule-based classifier
// -----------------------------
function useFallbackPrediction(features) {
    let { speedStd, pathEfficiency, avgClickLatency } = features;

    // Default to "low"
    let score = 0.2; // 20% baseline

    // High tolerance → only flag strong ADHD-like patterns
    if (speedStd > 40) score += 0.2;          // very erratic motion
    if (pathEfficiency < 30) score += 0.3;    // very inefficient paths
    if (avgClickLatency > 4000) score += 0.2; // very long hesitations

    // Clamp between 0–1
    score = Math.min(1, Math.max(0, score));

    console.log("Fallback ADHD likelihood:", score);
    updateResultUI(score);
}

// -----------------------------
// Shared UI updater
// -----------------------------
function updateResultUI(prob) {
    const percent = (prob * 100).toFixed(1);

    document.querySelector("#result h3").textContent = `ADHD Likelihood: ${percent}%`;
    document.querySelector("#result .fill").style.width = `${percent}%`;

    document.querySelector("#result p").textContent =
        prob < 0.4 ? "Low ADHD-like signals" :
        prob < 0.7 ? "Moderate ADHD-like signals" :
        "High ADHD-like signals";
}


