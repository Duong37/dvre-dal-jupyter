# AL-Engine Package
"""
AL-Engine - Decentralized Active Learning Engine (Fixed Version)

This package provides a fixed AL-Engine with proper cumulative learning that:
- Accumulates newly labeled samples from voting results
- Removes previously queried samples from the unlabeled pool
- Ensures each iteration queries genuinely different samples

Components:
- ALEngineServer: HTTP API server for DAL integration (recommended)
- Direct execution: Run AL iterations directly using fixed al_iteration.py

Example usage:

# HTTP API Server mode (recommended):
from al_engine import ALEngineServer
server = ALEngineServer(port=5050)
server.start_server()

# Direct execution via main.py:
# python main.py --project_id <project_id> --config <config.json> --iteration 1

The legacy ALEngine class has been removed in favor of the fixed implementation.
"""

from .server import ALEngineServer

__version__ = "2.0.0-fixed"
__all__ = [
    "ALEngineServer",
] 