#!/bin/bash
set -e

# ===== CONFIG =====
ROCRATE_PORT=3001      # adjust if your local-rocrate-saver uses another port
ALENGINE_PORT=5050
# ==================

echo "Checking and freeing ports ${ROCRATE_PORT} and ${ALENGINE_PORT}..."

# Kill processes on the given ports (ignore errors if no process found)
kill_port() {
    local port=$1
    if lsof -i :$port -t >/dev/null 2>&1; then
        echo "Port $port in use. Killing process..."
        lsof -i :$port -t | xargs kill -9
    else
        echo "Port $port is free."
    fi
}

kill_port $ROCRATE_PORT
kill_port $ALENGINE_PORT

echo "Navigating to al-engine directory..."
cd "al-engine"

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Starting local RO-Crate package saver..."
./local-rocrate-saver.js &

# Wait a bit to ensure the saver has started
sleep 2

echo "Navigating to src..."
cd src

echo "Starting local AL-Engine service..."
python main.py --server --port $ALENGINE_PORT
