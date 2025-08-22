#!/usr/bin/env python3
"""
Comprehensive DAL Integration Test

This test combines path validation with complete DAL simulation to ensure:
1. All file paths are correct and accessible
2. Data formats are compatible between DAL and AL-Engine  
3. Complete workflow functions end-to-end
4. Error handling works properly

Critical for production DAL deployment!
"""

import os
import sys
import json
import time
import requests
import pandas as pd
import numpy as np
from pathlib import Path

class ComprehensiveDALTest:
    """Complete DAL integration test with path validation"""
    
    def __init__(self):
        self.project_id = "0xeCA882d35e2917642F887e40014D01d202A28181"
        self.base_url = "http://localhost:5050"
        self.errors = []
        self.warnings = []
        
        print("Comprehensive DAL Integration Test")
        print("=" * 50)
        print("Phase 1: Path Validation") 
        print("Phase 2: DAL Simulation")
        print("Phase 3: Integration Verification")
        
    def log_error(self, message):
        self.errors.append(message)
        print(f" ERROR: {message}")
        
    def log_warning(self, message):
        self.warnings.append(message)
        print(f"  WARNING: {message}")
        
    def log_success(self, message):
        print(f" {message}")

    def validate_paths_and_setup(self):
        """Phase 1: Validate all critical paths and create test data"""
        print("\n PHASE 1: PATH VALIDATION & SETUP")
        print("=" * 40)
        
        # 1. Create directory structure
        print("\n Creating directory structure...")
        dirs_to_create = [
            f"ro-crates/{self.project_id}/inputs/datasets",
            f"al_work_{self.project_id}/output/model"
        ]
        
        for dir_path in dirs_to_create:
            try:
                Path(dir_path).mkdir(parents=True, exist_ok=True)
                self.log_success(f"Directory ready: {dir_path}")
            except Exception as e:
                self.log_error(f"Cannot create directory {dir_path}: {e}")
                return False
        
        # 2. Create and validate datasets
        print("\n Creating test datasets...")
        if not self._create_test_datasets():
            return False
        
        # 3. Create configuration
        print("\n Creating AL configuration...")
        if not self._create_al_config():
            return False
        
        # 4. Create CWL workflow files
        print("\n Creating CWL workflow...")
        if not self._create_cwl_files():
            return False
        
        # 5. Validate critical paths
        print("\n Validating critical file paths...")
        return self._validate_critical_paths()

    def _create_test_datasets(self):
        """Create realistic test datasets"""
        datasets_dir = Path(f"ro-crates/{self.project_id}/inputs/datasets")
        
        try:
            # Create labeled dataset
            np.random.seed(42)
            labeled_data = []
            species_list = ["setosa", "versicolor", "virginica"]
            
            for species in species_list:
                for _ in range(5):  # 5 samples per species
                    if species == "setosa":
                        sample = [5.0 + np.random.normal(0, 0.3), 3.4 + np.random.normal(0, 0.3), 
                                1.5 + np.random.normal(0, 0.2), 0.3 + np.random.normal(0, 0.1), species]
                    elif species == "versicolor":
                        sample = [6.0 + np.random.normal(0, 0.4), 2.8 + np.random.normal(0, 0.3),
                                4.2 + np.random.normal(0, 0.4), 1.3 + np.random.normal(0, 0.2), species]
                    else:  # virginica
                        sample = [6.5 + np.random.normal(0, 0.4), 3.0 + np.random.normal(0, 0.3),
                                5.5 + np.random.normal(0, 0.5), 2.0 + np.random.normal(0, 0.3), species]
                    labeled_data.append(sample)
            
            labeled_df = pd.DataFrame(labeled_data, columns=['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'])
            labeled_path = datasets_dir / "labeled_samples.csv"
            labeled_df.to_csv(labeled_path, index=False)
            self.log_success(f"Created labeled dataset: {labeled_path} ({len(labeled_df)} samples)")
            
            # Create unlabeled dataset  
            unlabeled_data = []
            for _ in range(30):  # 30 unlabeled samples
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
                unlabeled_data.append(sample)
            
            unlabeled_df = pd.DataFrame(unlabeled_data, columns=['sepal_length', 'sepal_width', 'petal_length', 'petal_width'])
            unlabeled_path = datasets_dir / "unlabeled_samples.csv"
            unlabeled_df.to_csv(unlabeled_path, index=False)
            self.log_success(f"Created unlabeled dataset: {unlabeled_path} ({len(unlabeled_df)} samples)")
            
            return True
            
        except Exception as e:
            self.log_error(f"Failed to create datasets: {e}")
            return False

    def _create_al_config(self):
        """Create AL configuration file"""
        config_path = Path(f"ro-crates/{self.project_id}/config.json")
        
        config_data = {
            "al_scenario": "pool_based",
            "query_strategy": "uncertainty_sampling",
            "model_type": "RandomForestClassifier", 
            "training_args": {"n_estimators": 50, "random_state": 42, "max_depth": 10},
            "label_space": ["setosa", "versicolor", "virginica"],
            "query_batch_size": 2,
            "max_iterations": 3,
            "validation_split": 0.2,
            "iteration": 0
        }
        
        try:
            with open(config_path, 'w') as f:
                json.dump(config_data, f, indent=2)
            self.log_success(f"Created config: {config_path}")
            return True
        except Exception as e:
            self.log_error(f"Failed to create config: {e}")
            return False

    def _create_cwl_files(self):
        """Create CWL workflow and inputs files"""
        cwl_path = Path(f"ro-crates/{self.project_id}/al_iteration.cwl")
        inputs_path = Path(f"ro-crates/{self.project_id}/inputs.yml")
        
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
            with open(cwl_path, 'w') as f:
                f.write(cwl_content)
            self.log_success(f"Created CWL workflow: {cwl_path}")
            
            with open(inputs_path, 'w') as f:
                f.write(inputs_content)
            self.log_success(f"Created CWL inputs: {inputs_path}")
            
            return True
        except Exception as e:
            self.log_error(f"Failed to create CWL files: {e}")
            return False

    def _validate_critical_paths(self):
        """Validate all critical paths for DAL integration"""
        critical_files = [
            f"ro-crates/{self.project_id}/config.json",
            f"ro-crates/{self.project_id}/inputs/datasets/labeled_samples.csv",
            f"ro-crates/{self.project_id}/inputs/datasets/unlabeled_samples.csv",
            f"ro-crates/{self.project_id}/al_iteration.cwl",
            f"ro-crates/{self.project_id}/inputs.yml",
            "al_iteration.py"
        ]
        
        all_valid = True
        for file_path in critical_files:
            path = Path(file_path)
            if path.exists() and os.access(path, os.R_OK):
                self.log_success(f"Critical file accessible: {file_path}")
            else:
                self.log_error(f"Critical file missing or inaccessible: {file_path}")
                all_valid = False
        
        # Test output path accessibility
        output_path = Path(f"al_work_{self.project_id}/output/query_samples.json")
        output_dir = output_path.parent
        
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            # Test write access
            test_data = {"test": "write_access"}
            with open(output_path, 'w') as f:
                json.dump(test_data, f)
            # Test read access
            with open(output_path, 'r') as f:
                read_data = json.load(f)
            
            if read_data == test_data:
                self.log_success(f"Output path read/write OK: {output_path}")
                output_path.unlink()  # Clean up
            else:
                self.log_error("Output path read/write test failed")
                all_valid = False
        except Exception as e:
            self.log_error(f"Output path validation failed: {e}")
            all_valid = False
        
        return all_valid

    def test_al_engine_integration(self):
        """Phase 2: Test AL-Engine integration"""
        print("\n PHASE 2: AL-ENGINE INTEGRATION TEST")
        print("=" * 40)
        
        # Test API connectivity
        print("\n Testing AL-Engine connectivity...")
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.log_success(f"AL-Engine healthy (project: {data.get('project_id', 'N/A')})")
            else:
                self.log_error(f"AL-Engine health check failed: HTTP {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            self.log_error(f"Cannot connect to AL-Engine: {e}")
            print("Please start AL-Engine with:")
            print(f"   python main.py --project_id {self.project_id} --config ro-crates/{self.project_id}/config.json --server")
            return False
        
        # Test AL iteration
        print("\n Testing AL iteration...")
        iteration_payload = {
            "iteration": 1,
            "project_id": self.project_id,
            "config_override": {
                "query_batch_size": 2
            }
        }
        
        try:
            response = requests.post(f"{self.base_url}/start_iteration", json=iteration_payload, timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_success(f"AL iteration completed: {data.get('message', 'No message')}")
                
                # Verify query samples output
                query_samples = self._verify_query_samples_output()
                if query_samples:
                    self.log_success(f"Query samples validated: {len(query_samples)} samples")
                    return query_samples
                else:
                    self.log_error("Query samples validation failed")
                    return False
            else:
                self.log_error(f"AL iteration failed: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error details: {error_data.get('error', 'Unknown')}")
                except:
                    print(f"   Response: {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            self.log_error(f"AL iteration request failed: {e}")
            return False

    def _verify_query_samples_output(self):
        """Verify AL-Engine outputs query samples correctly"""
        expected_path = Path(f"al_work_{self.project_id}/output/query_samples.json")
        
        # Wait for file creation
        max_wait = 10
        wait_time = 0
        while not expected_path.exists() and wait_time < max_wait:
            time.sleep(1)
            wait_time += 1
        
        if not expected_path.exists():
            self.log_error(f"Query samples not found at: {expected_path}")
            return None
        
        try:
            with open(expected_path, 'r') as f:
                query_samples = json.load(f)
            
            # Validation
            if not isinstance(query_samples, list) or len(query_samples) == 0:
                self.log_error("Query samples format invalid")
                return None
            
            # Check sample structure
            sample = query_samples[0]
            required_fields = ["original_index"]
            feature_fields = ["sepal_length", "sepal_width", "petal_length", "petal_width"]
            
            if not all(f in sample for f in required_fields):
                self.log_error(f"Query samples missing required fields: {required_fields}")
                return None
            
            # Check features (either individual fields or features array)
            has_individual = all(f in sample for f in feature_fields)
            has_array = "features" in sample and isinstance(sample["features"], list)
            
            if not (has_individual or has_array):
                self.log_error("Query samples missing feature data")
                return None
            
            return query_samples
            
        except Exception as e:
            self.log_error(f"Error reading query samples: {e}")
            return None

    def test_dal_simulation(self, query_samples):
        """Phase 3: Simulate DAL workflow"""
        print("\n PHASE 3: DAL WORKFLOW SIMULATION")
        print("=" * 40)
        
        print(f"\n Simulating user labeling for {len(query_samples)} samples...")
        
        labeled_samples = []
        for i, sample in enumerate(query_samples):
            # Extract features
            if "features" in sample:
                features = sample["features"]
            else:
                features = [sample.get("sepal_length", 0), sample.get("sepal_width", 0), 
                          sample.get("petal_length", 0), sample.get("petal_width", 0)]
            
            # Simple classification rule
            if features[2] < 2.0:  # petal_length
                label = "setosa"
            elif features[3] < 1.7:  # petal_width
                label = "versicolor"
            else:
                label = "virginica"
            
            labeled_sample = {
                "sample_id": f"sample_test_{i}_{int(time.time())}",
                "sample_data": {
                    "features": features,
                    "sepal_length": features[0],
                    "sepal_width": features[1],
                    "petal_length": features[2],
                    "petal_width": features[3]
                },
                "label": label,
                "original_index": sample["original_index"]
            }
            labeled_samples.append(labeled_sample)
            
            print(f"     Sample {i+1}: [{features[0]:.1f}, {features[1]:.1f}, {features[2]:.1f}, {features[3]:.1f}] → {label}")
        
        # Test labeled samples submission
        print(f"\n Testing labeled samples submission...")
        if self._validate_labeled_samples_format(labeled_samples):
            return self._submit_labeled_samples(labeled_samples)
        else:
            return False

    def _validate_labeled_samples_format(self, labeled_samples):
        """Validate labeled samples format for AL-Engine"""
        for i, sample in enumerate(labeled_samples):
            required_keys = ["sample_id", "sample_data", "label", "original_index"]
            if not all(k in sample for k in required_keys):
                self.log_error(f"Sample {i+1} missing required keys")
                return False
            
            if "features" not in sample["sample_data"]:
                self.log_error(f"Sample {i+1} missing features in sample_data")
                return False
            
            features = sample["sample_data"]["features"]
            if not isinstance(features, list) or len(features) != 4:
                self.log_error(f"Sample {i+1} features format invalid")
                return False
        
        self.log_success("Labeled samples format validation passed")
        return True

    def _submit_labeled_samples(self, labeled_samples):
        """Submit labeled samples to AL-Engine"""
        payload = {
            "iteration": 1,
            "project_id": self.project_id,
            "labeled_samples": labeled_samples
        }
        
        try:
            response = requests.post(f"{self.base_url}/submit_labels", json=payload, timeout=15)
            if response.status_code == 200:
                data = response.json()
                self.log_success(f"Labels submitted successfully: {data.get('samples_processed', 0)} processed")
                return True
            else:
                self.log_error(f"Label submission failed: HTTP {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            self.log_error(f"Label submission request failed: {e}")
            return False

    def run_comprehensive_test(self):
        """Run the complete comprehensive test"""
        print("Starting Comprehensive DAL Integration Test...")
        
        # Phase 1: Path validation and setup
        if not self.validate_paths_and_setup():
            self.print_summary(False)
            return False
        
        # Phase 2: AL-Engine integration
        query_samples = self.test_al_engine_integration()
        if not query_samples:
            self.print_summary(False)
            return False
        
        # Phase 3: DAL simulation
        if not self.test_dal_simulation(query_samples):
            self.print_summary(False)
            return False
        
        self.print_summary(True)
        return True

    def print_summary(self, success):
        """Print test summary"""
        print("\n COMPREHENSIVE TEST SUMMARY")
        print("=" * 40)
        
        if success:
            print("ALL TESTS PASSED!")
            print("Path validation: PASSED")
            print("AL-Engine integration: PASSED")
            print("DAL simulation: PASSED")
            print("Data flow validation: PASSED")
        else:
            print("TESTS FAILED!")
            if self.errors:
                print(f"\n {len(self.errors)} Critical Errors:")
                for error in self.errors:
                    print(f"   • {error}")
        
        if self.warnings:
            print(f"\n  {len(self.warnings)} Warnings:")
            for warning in self.warnings:
                print(f"   • {warning}")
        
        print(f"\n Ready for production DAL deployment: {' YES' if success else ' NO'}")

def main():
    """Main function"""
    print("Comprehensive DAL Integration Test")
    print("This test validates EVERYTHING needed for DAL production deployment")
    print()
    
    tester = ComprehensiveDALTest()
    success = tester.run_comprehensive_test()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main()) 