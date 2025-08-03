# 🛰️ JITTR — Neural Mouse Tracking for Cognitive Health

Jittr is a browser extension and interactive simulation that analyzes **mouse movements and clicks** to surface **ADHD-like behavioral patterns**. By tracking metrics such as reaction time, path efficiency, and motion variability, Jittr applies a **machine learning model trained on real ADHD datasets** to provide a **probability score** of ADHD-like signals.

⚠️ **Disclaimer**: Jittr is a research prototype — not a medical diagnosis tool.

## Features
- Real-time mouse tracking and analytics
- ADHD-like pattern detection
- Interactive simulation game
- Privacy-first: all data stays local

## Installation
1. Install the Jittr Chrome extension and launch the simulation interface.
2. Click **Load unpacked** → select the Jittr project folder
3. Launch Jittr from the Chrome extensions bar

## Usage
- Open the popup and click "Launch Simulation" to start the game
- Use the metrics panel to view your performance

## Development
- See `serve_model.py` for backend model serving
- See `simulation.js` for simulation logic
