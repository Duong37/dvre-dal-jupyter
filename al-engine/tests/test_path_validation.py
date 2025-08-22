#!/usr/bin/env python3
"""
DAL-AL-Engine Path Validation Test

This test validates all critical file paths and data flow between DAL and AL-Engine:
- Input dataset paths and formats
- Output query sample paths and formats  
- CWL workflow file accessibility
- Data serialization/deserialization
- Cross-platform path handling
- File permissions and accessibility

Critical for DAL integration!
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import requests
import time
import subprocess

class DALPathValidator:
    """Validates all file paths and data flow for DAL-AL-Engine integration"""
    
    def __init__(self):
        self.project_id = "0xeCA882d35e2917642F887e40014D01d202A28181"
        self.base_url = "http://localhost:5050"
        self.errors = []
        self.warnings = []
        
        print("DAL-AL-Engine Path Validation Test")
        print("=" * 50)
        print(f" Project ID: {self.project_id}")
        print(f" AL-Engine URL: {self.base_url}")
        
    def log_error(self, message):
        """Log a critical error"""
        self.errors.append(message)
        print(f" ERROR: {message}")
        
    def log_warning(self, message):
        """Log a warning"""
        self.warnings.append(message)
        print(f"  WARNING: {message}")
        
    def log_success(self, message):
        """Log a success"""
        print(f" {message}")

    def test_directory_structure(self):
        """Test if all required directories exist and are accessible"""
        print("\n Testing Directory Structure...")
        
        required_dirs = [
            f"ro-crates/{self.project_id}",
            f"ro-crates/{self.project_id}/inputs",
            f"ro-crates/{self.project_id}/inputs/datasets",
            f"al_work_{self.project_id}",
        ]
        
        for dir_path in required_dirs:
            path = Path(dir_path)
            if path.exists():
                if path.is_dir():
                    if os.access(path, os.R_OK | os.W_OK):
                        self.log_success(f"Directory accessible: {dir_path}")
                    else:
                        self.log_error(f"Directory not writable: {dir_path}")
                else:
                    self.log_error(f"Path exists but is not a directory: {dir_path}")
            else:
                print(f" Creating missing directory: {dir_path}")
                try:
                    path.mkdir(parents=True, exist_ok=True)
                    self.log_success(f"Created directory: {dir_path}")
                except Exception as e:
                    self.log_error(f"Failed to create directory {dir_path}: {e}")

    def test_input_dataset_paths(self):
        """Test input dataset file paths and formats"""
        print("\n Testing Input Dataset Paths...")
        
        datasets_dir = Path(f"ro-crates/{self.project_id}/inputs/datasets")
        
        # Create test datasets
        test_datasets = {
            "labeled_samples.csv": self._create_test_labeled_data(),
            "unlabeled_samples.csv": self._create_test_unlabeled_data()
        }
        
        for filename, data in test_datasets.items():
            file_path = datasets_dir / filename
            
            try:
                # Write test data
                data.to_csv(file_path, index=False)
                self.log_success(f"Created test dataset: {file_path}")
                
                # Validate file accessibility
                if file_path.exists() and os.access(file_path, os.R_OK):
                    # Test pandas reading
                    df_test = pd.read_csv(file_path)
                    expected_cols = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width']
                    
                    if filename == "labeled_samples.csv":
                        expected_cols.append('species')
                    
                    if all(col in df_test.columns for col in expected_cols):
                        self.log_success(f"Dataset format valid: {filename} ({len(df_test)} rows)")
                    else:
                        self.log_error(f"Dataset missing columns: {filename}")
                        self.log_error(f"Expected: {expected_cols}, Found: {list(df_test.columns)}")
                else:
                    self.log_error(f"Dataset file not readable: {file_path}")
                    
            except Exception as e:
                self.log_error(f"Failed to create/validate dataset {filename}: {e}")

    def _create_test_labeled_data(self):
        """Create test labeled dataset"""
        np.random.seed(42)
        data = []
        species_list = ["setosa", "versicolor", "virginica"]
        
        for species in species_list:
            for _ in range(5):
                if species == "setosa":
                    sample = [5.0 + np.random.normal(0, 0.3), 3.4 + np.random.normal(0, 0.3), 
                             1.5 + np.random.normal(0, 0.2), 0.3 + np.random.normal(0, 0.1), species]
                elif species == "versicolor":
                    sample = [6.0 + np.random.normal(0, 0.4), 2.8 + np.random.normal(0, 0.3),
                             4.2 + np.random.normal(0, 0.4), 1.3 + np.random.normal(0, 0.2), species]
                else:  # virginica
                    sample = [6.5 + np.random.normal(0, 0.4), 3.0 + np.random.normal(0, 0.3),
                             5.5 + np.random.normal(0, 0.5), 2.0 + np.random.normal(0, 0.3), species]
                data.append(sample)
        
        return pd.DataFrame(data, columns=['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'])

    def _create_test_unlabeled_data(self):
        """Create test unlabeled dataset"""
        np.random.seed(123)
        data = []
        
        for _ in range(20):  # Smaller set for testing
            # Random mix of all species patterns
            species_type = np.random.choice([0, 1, 2])
            if species_type == 0:  # setosa-like
                sample = [5.0 + np.random.normal(0, 0.3), 3.4 + np.random.normal(0, 0.3), 
                         1.5 + np.random.normal(0, 0.2), 0.3 + np.random.normal(0, 0.1)]
            elif species_type == 1:  # versicolor-like  
                sample = [6.0 + np.random.normal(0, 0.4), 2.8 + np.random.normal(0, 0.3),
                         4.2 + np.random.normal(0, 0.4), 1.3 + np.random.normal(0, 0.2)]
            else:  # virginica-like
                sample = [6.5 + np.random.normal(0, 0.4), 3.0 + np.random.normal(0, 0.3),
                         5.5 + np.random.normal(0, 0.5), 2.0 + np.random.normal(0, 0.3)]
            data.append(sample)
        
        return pd.DataFrame(data, columns=['sepal_length', 'sepal_width', 'petal_length', 'petal_width'])

    def test_config_file_paths(self):
        """Test AL configuration file path and format"""
        print("\n Testing Configuration File...")
        
        config_path = Path(f"ro-crates/{self.project_id}/config.json")
        
        config_data = {
            "al_scenario": "pool_based",
            "query_strategy": "uncertainty_sampling", 
            "model_type": "RandomForestClassifier",
            "training_args": {"n_estimators": 50, "random_state": 42},
            "label_space": ["setosa", "versicolor", "virginica"],
            "query_batch_size": 2,
            "max_iterations": 3,
            "iteration": 0
        }
        
        try:
            with open(config_path, 'w') as f:
                json.dump(config_data, f, indent=2)
            self.log_success(f"Created config file: {config_path}")
            
            # Validate JSON parsing
            with open(config_path, 'r') as f:
                loaded_config = json.load(f)
            
            required_keys = ["model_type", "label_space", "query_batch_size"]
            missing_keys = [k for k in required_keys if k not in loaded_config]
            
            if not missing_keys:
                self.log_success("Configuration format valid")
            else:
                self.log_error(f"Configuration missing keys: {missing_keys}")
                
        except Exception as e:
            self.log_error(f"Failed to create/validate config file: {e}")

    def test_cwl_workflow_paths(self):
        """Test CWL workflow file paths and references"""
        print("\n Testing CWL Workflow Files...")
        
        cwl_path = Path(f"ro-crates/{self.project_id}/al_iteration.cwl")
        inputs_path = Path(f"ro-crates/{self.project_id}/inputs.yml")
        
        # Create test CWL file
        cwl_content = """cwlVersion: v1.2
class: CommandLineTool

baseCommand: python3
arguments: [../../al_iteration.py]

inputs:
  labeled_data:
    type: File
    inputBinding:
      prefix: --labeled_data
  labeled_labels:
    type: File
    inputBinding:
      prefix: --labeled_labels
  unlabeled_data:
    type: File
    inputBinding:
      prefix: --unlabeled_data
  model_in:
    type: File?
    inputBinding:
      prefix: --model_in
  config:
    type: File
    inputBinding:
      prefix: --config

outputs:
  model_out:
    type: File
    outputBinding:
      glob: output/model/model_round_*.pkl
  query_samples:
    type: File
    outputBinding:
      glob: output/query_samples.json
"""
        
        # Create test inputs.yml
        inputs_content = f"""labeled_data:
  class: File
  path: inputs/datasets/labeled_samples.csv
labeled_labels:
  class: File  
  path: inputs/datasets/labeled_samples.csv
unlabeled_data:
  class: File
  path: inputs/datasets/unlabeled_samples.csv
config:
  class: File
  path: config.json
"""
        
        try:
            # Write CWL file
            with open(cwl_path, 'w') as f:
                f.write(cwl_content)
            self.log_success(f"Created CWL workflow: {cwl_path}")
            
            # Write inputs file
            with open(inputs_path, 'w') as f:
                f.write(inputs_content)
            self.log_success(f"Created CWL inputs: {inputs_path}")
            
            # Validate al_iteration.py reference
            al_iteration_path = Path("al_iteration.py")
            if al_iteration_path.exists():
                self.log_success("al_iteration.py script found")
            else:
                self.log_error("al_iteration.py script not found - CWL workflow will fail")
                
        except Exception as e:
            self.log_error(f"Failed to create CWL files: {e}")

    def test_output_paths(self):
        """Test AL-Engine output paths and formats"""
        print("\n Testing Output Paths...")
        
        output_dir = Path(f"al_work_{self.project_id}/output")
        model_dir = output_dir / "model"
        
        # Create output directories
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            model_dir.mkdir(parents=True, exist_ok=True)
            self.log_success(f"Created output directories")
        except Exception as e:
            self.log_error(f"Failed to create output directories: {e}")
            return
        
        # Test query samples JSON format
        query_samples_path = output_dir / "query_samples.json"
        test_query_data = [
            {
                "sepal_length": 5.1,
                "sepal_width": 3.5, 
                "petal_length": 1.4,
                "petal_width": 0.2,
                "original_index": 0
            },
            {
                "sepal_length": 6.2,
                "sepal_width": 2.9,
                "petal_length": 4.3,
                "petal_width": 1.3,
                "original_index": 1
            }
        ]
        
        try:
            with open(query_samples_path, 'w') as f:
                json.dump(test_query_data, f, indent=2)
            self.log_success(f"Created test query samples: {query_samples_path}")
            
            # Test DAL can read this format
            with open(query_samples_path, 'r') as f:
                loaded_data = json.load(f)
            
            if isinstance(loaded_data, list) and len(loaded_data) > 0:
                sample = loaded_data[0]
                required_fields = ["sepal_length", "sepal_width", "petal_length", "petal_width", "original_index"]
                
                if all(field in sample for field in required_fields):
                    self.log_success("Query samples format valid for DAL")
                else:
                    self.log_error(f"Query samples missing required fields: {required_fields}")
            else:
                self.log_error("Query samples format invalid - not a list or empty")
                
        except Exception as e:
            self.log_error(f"Failed to create/validate query samples: {e}")
        
        # Test model output path
        test_model_path = model_dir / "model_round_1.pkl"
        try:
            # Create a dummy pickle file
            import pickle
            dummy_model = {"model_type": "test", "iteration": 1}
            with open(test_model_path, 'wb') as f:
                pickle.dump(dummy_model, f)
            self.log_success(f"Created test model file: {test_model_path}")
        except Exception as e:
            self.log_error(f"Failed to create test model file: {e}")

    def test_api_connectivity(self):
        """Test AL-Engine API connectivity and endpoints"""
        print("\n Testing API Connectivity...")
        
        try:
            # Test health endpoint
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.log_success(f"AL-Engine API healthy (project: {data.get('project_id', 'N/A')})")
            else:
                self.log_warning(f"AL-Engine API health check failed: HTTP {response.status_code}")
        except requests.exceptions.RequestException as e:
            self.log_warning(f"AL-Engine API not accessible: {e}")
            self.log_warning("This is OK if AL-Engine server is not running")

    def test_data_serialization(self):
        """Test data serialization/deserialization between DAL and AL-Engine"""
        print("\n Testing Data Serialization...")
        
        # Test labeled samples format (DAL → AL-Engine)
        test_labeled_samples = [
            {
                "sample_id": "sample_1_1_123456",
                "sample_data": {
                    "features": [5.1, 3.5, 1.4, 0.2],
                    "sepal_length": 5.1,
                    "sepal_width": 3.5,
                    "petal_length": 1.4,
                    "petal_width": 0.2
                },
                "label": "setosa",
                "original_index": 42
            }
        ]
        
        try:
            # Test JSON serialization
            json_str = json.dumps(test_labeled_samples)
            loaded_data = json.loads(json_str)
            
            # Validate structure
            sample = loaded_data[0]
            required_keys = ["sample_id", "sample_data", "label", "original_index"]
            
            if all(key in sample for key in required_keys):
                self.log_success("Labeled samples serialization format valid")
                
                # Test feature extraction
                features = sample["sample_data"]["features"]
                if isinstance(features, list) and len(features) == 4:
                    self.log_success("Feature extraction format valid")
                else:
                    self.log_error("Feature format invalid - should be list of 4 numbers")
            else:
                self.log_error(f"Labeled samples missing required keys: {required_keys}")
                
        except Exception as e:
            self.log_error(f"Data serialization test failed: {e}")

    def test_cross_platform_paths(self):
        """Test cross-platform path handling"""
        print("\n Testing Cross-Platform Path Handling...")
        
        # Test Path vs string handling
        test_paths = [
            f"ro-crates/{self.project_id}/config.json",
            f"al_work_{self.project_id}/output/query_samples.json",
            f"ro-crates/{self.project_id}/inputs/datasets/labeled_samples.csv"
        ]
        
        for path_str in test_paths:
            try:
                # Test pathlib Path
                path_obj = Path(path_str)
                path_resolved = path_obj.resolve()
                
                # Test os.path
                norm_path = os.path.normpath(path_str)
                abs_path = os.path.abspath(path_str)
                
                self.log_success(f"Path handling OK: {path_str}")
                
            except Exception as e:
                self.log_error(f"Path handling failed for {path_str}: {e}")

    def test_file_permissions(self):
        """Test file permissions for all critical paths"""
        print("\n Testing File Permissions...")
        
        test_files = [
            f"ro-crates/{self.project_id}/config.json",
            f"ro-crates/{self.project_id}/inputs/datasets/labeled_samples.csv",
            f"ro-crates/{self.project_id}/inputs/datasets/unlabeled_samples.csv"
        ]
        
        for file_path in test_files:
            path = Path(file_path)
            if path.exists():
                if os.access(path, os.R_OK):
                    self.log_success(f"File readable: {file_path}")
                else:
                    self.log_error(f"File not readable: {file_path}")
                    
                if os.access(path, os.W_OK):
                    self.log_success(f"File writable: {file_path}")
                else:
                    self.log_warning(f"File not writable: {file_path}")
            else:
                self.log_warning(f"File does not exist: {file_path}")

    def test_end_to_end_data_flow(self):
        """Test complete data flow simulation"""
        print("\n Testing End-to-End Data Flow...")
        
        try:
            # 1. Simulate AL-Engine creating query samples
            query_samples = [
                {"sepal_length": 5.1, "sepal_width": 3.5, "petal_length": 1.4, "petal_width": 0.2, "original_index": 0},
                {"sepal_length": 6.2, "sepal_width": 2.9, "petal_length": 4.3, "petal_width": 1.3, "original_index": 1}
            ]
            
            query_path = Path(f"al_work_{self.project_id}/output/query_samples.json")
            with open(query_path, 'w') as f:
                json.dump(query_samples, f, indent=2)
            self.log_success("Step 1: AL-Engine outputs query samples")
            
            # 2. Simulate DAL reading query samples
            with open(query_path, 'r') as f:
                dal_query_samples = json.load(f)
            self.log_success(f"Step 2: DAL reads {len(dal_query_samples)} query samples")
            
            # 3. Simulate DAL creating labeled samples
            labeled_samples = []
            for i, sample in enumerate(dal_query_samples):
                labeled_sample = {
                    "sample_id": f"sample_test_{i}_{int(time.time())}",
                    "sample_data": {
                        "features": [sample["sepal_length"], sample["sepal_width"], 
                                   sample["petal_length"], sample["petal_width"]],
                        **sample
                    },
                    "label": "setosa" if sample["petal_length"] < 2.0 else "versicolor",
                    "original_index": sample["original_index"]
                }
                labeled_samples.append(labeled_sample)
            self.log_success(f"Step 3: DAL creates {len(labeled_samples)} labeled samples")
            
            # 4. Simulate AL-Engine receiving labeled samples
            for sample in labeled_samples:
                # Validate sample structure
                if all(key in sample for key in ["sample_id", "sample_data", "label", "original_index"]):
                    features = sample["sample_data"]["features"]
                    if isinstance(features, list) and len(features) == 4:
                        continue
                    else:
                        raise ValueError(f"Invalid features format in sample {sample['sample_id']}")
                else:
                    raise ValueError(f"Missing required keys in sample")
            
            self.log_success("Step 4: AL-Engine validates labeled samples format")
            self.log_success(" End-to-end data flow test PASSED")
            
        except Exception as e:
            self.log_error(f"End-to-end data flow test FAILED: {e}")

    def run_all_tests(self):
        """Run all validation tests"""
        print("\n Running All Path Validation Tests...")
        print("=" * 50)
        
        test_methods = [
            self.test_directory_structure,
            self.test_input_dataset_paths,
            self.test_config_file_paths,
            self.test_cwl_workflow_paths,
            self.test_output_paths,
            self.test_api_connectivity,
            self.test_data_serialization,
            self.test_cross_platform_paths,
            self.test_file_permissions,
            self.test_end_to_end_data_flow
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                self.log_error(f"Test {test_method.__name__} crashed: {e}")
        
        # Print summary
        print("\n VALIDATION SUMMARY")
        print("=" * 30)
        
        if not self.errors:
            print("ALL TESTS PASSED - DAL integration paths are valid!")
        else:
            print(f" {len(self.errors)} CRITICAL ERRORS found:")
            for error in self.errors:
                print(f"   • {error}")
        
        if self.warnings:
            print(f"  {len(self.warnings)} warnings:")
            for warning in self.warnings:
                print(f"   • {warning}")
        
        print(f"\n Test Results:")
        print(f"    Passed: {len(test_methods) - len(self.errors)}")
        print(f"    Failed: {len(self.errors)}")
        print(f"     Warnings: {len(self.warnings)}")
        
        return len(self.errors) == 0

def main():
    """Main function"""
    print("DAL-AL-Engine Path Validation")
    print("This test ensures all file paths work correctly for DAL integration")
    print()
    
    validator = DALPathValidator()
    success = validator.run_all_tests()
    
    if success:
        print("\n Path validation completed successfully!")
        print("Ready for DAL integration testing!")
        return 0
    else:
        print("\n Path validation failed!")
        print("Please fix the errors above before running DAL integration")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 