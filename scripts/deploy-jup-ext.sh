#!/bin/bash
set -e

echo "Creating virtual environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Navigating to jupyter-extension directory..."
cd "jupyter-extension"

echo "Building frontend extension and installing Python package..."
yarn build & pip install .

echo "Starting Jupyter Lab..."
jupyter lab
