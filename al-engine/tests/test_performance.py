#!/usr/bin/env python3
"""
Test script to verify performance evaluation implementation
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
import tempfile
import sys

# Add the current directory to path so we can import al_iteration
sys.path.append('.')

def create_test_data():
    """Create simple test datasets for AL iteration"""
    # Create simple synthetic dataset
    np.random.seed(42)
    
    # Features: 2D data for simplicity
    X = np.random.rand(50, 2)
    y = (X[:, 0] + X[:, 1] > 1).astype(int)  # Simple binary classification
    
    # Split into labeled and unlabeled
    X_labeled = X[:20]
    y_labeled = y[:20]
    X_unlabeled = X[20:]
    
    return X_labeled, y_labeled, X_unlabeled

def create_test_config():
    """Create test AL configuration"""
    config = {
        "model_type": "RandomForestClassifier",
        "training_args": {
            "n_estimators": 10,
            "random_state": 42
        },
        "label_space": [0, 1],
        "query_batch_size": 2,
        "max_iterations": 3
    }
    return config

def test_performance_evaluation():
    """Test the performance evaluation functionality"""
    print("Testing Performance Evaluation Implementation")
    
    try:
        # Import our updated AL iteration module
        from al_iteration import evaluate_model_performance, get_model
        from modAL import ActiveLearner
        
        print("Successfully imported al_iteration module")
        
        # Create test data
        X_labeled, y_labeled, X_unlabeled = create_test_data()
        config = create_test_config()
        
        print(f" Created test data: {len(X_labeled)} labeled, {len(X_unlabeled)} unlabeled")
        
        # Initialize and train model
        model = get_model(config)
        learner = ActiveLearner(
            estimator=model,
            X_training=X_labeled,
            y_training=y_labeled
        )
        
        print("Initialized ActiveLearner")
        
        # Test performance evaluation
        performance_metrics = evaluate_model_performance(learner, X_labeled, y_labeled, config)
        
        print("Performance evaluation completed")
        print("Performance metrics:")
        for key, value in performance_metrics.items():
            if isinstance(value, float):
                print(f"   {key}: {value:.3f}")
            else:
                print(f"   {key}: {value}")
        
        # Verify required keys are present
        required_keys = ['accuracy', 'precision', 'recall', 'f1_score', 'timestamp']
        missing_keys = [key for key in required_keys if key not in performance_metrics]
        
        if missing_keys:
            print(f" Missing required keys: {missing_keys}")
            return False
        
        # Verify values are reasonable
        if not (0 <= performance_metrics['accuracy'] <= 1):
            print(f" Invalid accuracy: {performance_metrics['accuracy']}")
            return False
            
        print("All performance metrics are valid")
        
        # Test saving to JSON
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(performance_metrics, f, indent=2)
            temp_file = f.name
        
        # Read back and verify
        with open(temp_file, 'r') as f:
            loaded_metrics = json.load(f)
        
        if loaded_metrics == performance_metrics:
            print("JSON serialization/deserialization successful")
        else:
            print("JSON serialization failed")
            return False
        
        # Cleanup
        Path(temp_file).unlink()
        
        print("Performance evaluation test PASSED!")
        return True
        
    except Exception as e:
        print(f" Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_performance_evaluation()
    exit(0 if success else 1) 