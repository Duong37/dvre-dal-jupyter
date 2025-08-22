#!/bin/bash
set -e

echo "Creating virtual environment..."
python3 -m venv venv

echo "Activating virtual environment..."
source venv/bin/activate

echo "Navigating to jupyter-extension directory..."
cd "jupyter-extension"

echo "Cleaning up..."
npx rimraf lib tsconfig.tsbuildinfo
npx rimraf jupyter_dvre/labextension jupyter_dvre/_version.py
jupyter lab clean --all

echo "Installing dependencies..."
rm -rf node_modules yarn.lock
yarn install

echo "Building frontend extension..."
npx tsc --sourceMap
jupyter labextension build .

echo "Installing Python package..."
pip install -e .

echo "Building core..."
jupyter lab build

echo "Starting Jupyter Lab..."
jupyter lab
