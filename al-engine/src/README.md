## Documentation

- Guide on how the AL-Engine handles class imbalance scenarios, small datasets, and performance evaluation strategies

## File Structure

### Core Files

- **`main.py`** - Entry point and command line argument parsing
- **`server.py`** - ALEngineServer class for HTTP API server mode
- **`endpoints.py`** - Flask route handlers and API endpoints

### Supporting Files

- **`workflow_runner.py`** - CWL workflow execution
- **`al_iteration.py`** - AL iteration logic
- **`__init__.py`** - Package initialization

## API Endpoints

The refactored AL-Engine provides the following HTTP API endpoints:

### Core Endpoints
- `GET /health` - Health check
- `GET /status` - AL-Engine status
- `GET /config` - Current AL configuration
- `POST /start_iteration` - Start AL iteration
- `POST /submit_labels` - Submit labeled samples

### Data Retrieval
- `GET /results/<iteration>` - Get iteration results
- `GET /model_performance/<iteration>` - Get real model performance metrics

## Usage Examples

### HTTP API Server Mode (Recommended)
```bash
python main.py --server --port 5050
```

