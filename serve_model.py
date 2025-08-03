from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)  # allow requests from your extension/frontend

# -----------------------------
# Load trained model pipeline
# -----------------------------
MODEL_PATH = "adhd_prob_pipeline.pkl"  # make sure this file exists

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file not found: {MODEL_PATH}. "
                            f"Check filename or training script.")

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Error loading model: {str(e)}")

# -----------------------------
# Prediction route
# -----------------------------
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No input data received"}), 400

        # Extract features in same order as training
        features = [
            float(data.get("speedStd", 0)),
            float(data.get("pathEfficiency", 0)),
            float(data.get("avgClickLatency", 0))
        ]
        features = np.array(features).reshape(1, -1)

        # Probability of ADHD (class 1)
        prob = model.predict_proba(features)[0][1]

        return jsonify({
            "adhd_probability": round(float(prob), 4)  # rounded for readability
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
