# D-VRE (Decentralized Virtual Research Environment)

A JupyterLab Client Application for D-VRE and DAL.

### JupyterLab Installation

### Prerequisites
- Node.js (v16+)
- Python (3.9+)
- JupyterLab (4.0+)
- Yarn (v3.5.0+)

## Setup

cd jupyter-extension

# 1. Manual Clean (Optional)
npx rimraf lib tsconfig.tsbuildinfo
npx rimraf jupyter_dvre/labextension jupyter_dvre/_version.py
jupyter lab clean --all

# 2. Fresh dependencies (Optional)
rm -rf node_modules yarn.lock
yarn install

# 3. Build
npx tsc --sourceMap
jupyter labextension build .

# 4. Re-install
pip install -e .

# 5. Rebuild Core (if needed after cleaning)
jupyter lab build

### Starting AL-Engine Service

## Using script (Recommended):
chmod +x scripts/deploy-al-engine.sh
./scripts/deploy-al-engine.sh

## Manually:
cd al-engine

# Installing dependencies
pip install -r requirements.txt

# Start the local rocrate package saver
./local-rocrate-saver.js

cd src

# Start the local al-engine service
python main.py --server --port 5050

### MetaMask Hyperledger Besu Setup
Network Name: DVRE (your choice)
RPC URL: http://145.100.135.27:8550
Chain ID: 1337
Currency name: ETH

Available RPC URLs:
http://145.100.135.27:8550
http://145.100.135.39:8550
http://145.100.135.97:8550
http://49.12.44.119:8550
    
