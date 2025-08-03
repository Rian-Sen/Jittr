#!/usr/bin/env python3
"""
Helper script to start the FastAPI model server for the Dryft extension.
Run this script to start the server before using the extension.
"""

import subprocess
import sys
import os
from pathlib import Path

def check_dependencies():
    """Check if required packages are installed."""
    required_packages = ['fastapi', 'uvicorn', 'joblib', 'numpy', 'pydantic']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Install them with: pip install " + " ".join(missing_packages))
        return False
    
    print("✅ All required packages are installed")
    return True

def check_model_files():
    """Check if model files exist."""
    model_file = Path("/Users/shai/Desktop/TerraHacks/TerraHacks/logreg_pipeline.pkl")
    if not model_file.exists():
        print("❌ Model file 'logreg_pipeline.pkl' not found!")
        print("Make sure you have trained your model and saved it as 'logreg_pipeline.pkl'")
        return False
    
    print("✅ Model file found")
    return True

def start_server():
    """Start the FastAPI server."""
    print("🚀 Starting Dryft Model Server...")
    print("📍 Server will be available at: http://127.0.0.1:8000")
    print("📊 API endpoint: http://127.0.0.1:8000/predict")
    print("📖 API docs: http://127.0.0.1:8000/docs")
    print("\n" + "="*50)
    print("Press Ctrl+C to stop the server")
    print("="*50 + "\n")
    
    try:
        # Start the server using uvicorn
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "serve_model:app", 
            "--host", "127.0.0.1", 
            "--port", "8000",
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")

def main():
    """Main function."""
    print("🔧 Dryft Model Server Setup")
    print("="*30)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Check model files
    if not check_model_files():
        sys.exit(1)
    
    # Start server
    start_server()

if __name__ == "__main__":
    main() 