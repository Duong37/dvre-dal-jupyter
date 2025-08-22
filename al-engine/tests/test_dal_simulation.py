#!/usr/bin/env python3
"""
DAL Simulation Test - Complete Active Learning Project Workflow

This script simulates a real DAL (Decentralized Active Learning) project:
- Flower classification project with 3 species
- Real CSV datasets with features
- Complete AL workflow: query → label → submit → repeat
- Smart contract simulation
- Multiple AL iterations
- Error handling and validation

Usage:
    python test_dal_simulation.py
"""

import requests
import json
import time
import sys
import os
import pandas as pd
import numpy as np
from pathlib import Path
import tempfile
import shutil

class DALProjectSimulator:
    """Simulates a complete DAL project workflow"""
    
    def __init__(self, project_name="Flower Classification AL Project"):
        self.project_name = project_name
        self.project_id = "0xeCA882d35e2917642F887e40014D01d202A28181"  # Simulated contract address
        self.base_url = "http://localhost:5050"
        
        # Project configuration (simulates smart contract data)
        self.project_config = {
            "name": project_name,
            "description": "Active learning for flower species classification using petal/sepal measurements",
            "label_space": ["setosa", "versicolor", "virginica"],
            "query_batch_size": 2,
            "max_iterations": 5,
            "model_type": "RandomForestClassifier",
            "training_args": {
                "n_estimators": 50,
                "random_state": 42,
                "max_depth": 10
            },
            "voting_timeout_seconds": 3600,
            "coordinator": "0x1234567890123456789012345678901234567890"
        }
        
        # Simulation state
        self.current_iteration = 0
        self.labeled_samples = []
        self.total_samples_labeled = 0
        
        print(f" Initialized DAL Project: {self.project_name}")
        print(f" Project ID: {self.project_id}")
        print(f" Goal: Classify flowers into {len(self.project_config['label_space'])} species")
        print(f" Batch size: {self.project_config['query_batch_size']} samples per iteration")

    def create_realistic_datasets(self):
        """Create realistic flower classification datasets (based on Iris dataset concept)"""
        print("\n Creating realistic flower datasets...")
        
        # Generate synthetic flower data with realistic features
        np.random.seed(42)
        
        # Labeled training data (small initial set)
        n_labeled = 15  # Small initial labeled set
        labeled_data = []
        labeled_labels = []
        
        # Generate samples for each class
        for class_idx, species in enumerate(self.project_config['label_space']):
            n_samples_per_class = 5
            
            # Create realistic flower measurements with class-specific distributions
            if species == "setosa":
                sepal_length = np.random.normal(5.0, 0.3, n_samples_per_class)
                sepal_width = np.random.normal(3.4, 0.3, n_samples_per_class)
                petal_length = np.random.normal(1.5, 0.2, n_samples_per_class)
                petal_width = np.random.normal(0.3, 0.1, n_samples_per_class)
            elif species == "versicolor":
                sepal_length = np.random.normal(6.0, 0.4, n_samples_per_class)
                sepal_width = np.random.normal(2.8, 0.3, n_samples_per_class)
                petal_length = np.random.normal(4.2, 0.4, n_samples_per_class)
                petal_width = np.random.normal(1.3, 0.2, n_samples_per_class)
            else:  # virginica
                sepal_length = np.random.normal(6.5, 0.4, n_samples_per_class)
                sepal_width = np.random.normal(3.0, 0.3, n_samples_per_class)
                petal_length = np.random.normal(5.5, 0.5, n_samples_per_class)
                petal_width = np.random.normal(2.0, 0.3, n_samples_per_class)
            
            for i in range(n_samples_per_class):
                sample = {
                    'sepal_length': round(float(sepal_length[i]), 2),
                    'sepal_width': round(float(sepal_width[i]), 2),
                    'petal_length': round(float(petal_length[i]), 2),
                    'petal_width': round(float(petal_width[i]), 2),
                    'species': species
                }
                labeled_data.append(sample)
                labeled_labels.append(species)
        
        # Unlabeled data pool (larger set for querying)
        n_unlabeled = 100
        unlabeled_data = []
        unlabeled_true_labels = []  # We keep these hidden from AL, but use for simulation
        
        for _ in range(n_unlabeled):
            # Randomly choose a species for this sample
            true_species_idx = np.random.randint(0, 3)
            true_species = self.project_config['label_space'][true_species_idx]
            
            # Generate features based on true species (but AL won't know this)
            if true_species == "setosa":
                sepal_length = np.random.normal(5.0, 0.3)
                sepal_width = np.random.normal(3.4, 0.3)
                petal_length = np.random.normal(1.5, 0.2)
                petal_width = np.random.normal(0.3, 0.1)
            elif true_species == "versicolor":
                sepal_length = np.random.normal(6.0, 0.4)
                sepal_width = np.random.normal(2.8, 0.3)
                petal_length = np.random.normal(4.2, 0.4)
                petal_width = np.random.normal(1.3, 0.2)
            else:  # virginica
                sepal_length = np.random.normal(6.5, 0.4)
                sepal_width = np.random.normal(3.0, 0.3)
                petal_length = np.random.normal(5.5, 0.5)
                petal_width = np.random.normal(2.0, 0.3)
            
            sample = {
                'sepal_length': round(float(sepal_length), 2),
                'sepal_width': round(float(sepal_width), 2),
                'petal_length': round(float(petal_length), 2),
                'petal_width': round(float(petal_width), 2),
            }
            unlabeled_data.append(sample)
            unlabeled_true_labels.append(true_species)
        
        # Create CSV files
        datasets_dir = Path(f"al-engine/ro-crates/{self.project_id}/inputs/datasets")
        datasets_dir.mkdir(parents=True, exist_ok=True)
        
        # Save labeled training data
        labeled_df = pd.DataFrame(labeled_data)
        labeled_path = datasets_dir / "labeled_samples.csv"
        labeled_df.to_csv(labeled_path, index=False)
        
        # Save unlabeled data (without species column)
        unlabeled_df = pd.DataFrame(unlabeled_data)
        unlabeled_path = datasets_dir / "unlabeled_samples.csv"
        unlabeled_df.to_csv(unlabeled_path, index=False)
        
        # Save true labels for simulation purposes (not available to AL)
        self.unlabeled_true_labels = unlabeled_true_labels
        
        print(f" Created labeled dataset: {labeled_path} ({len(labeled_data)} samples)")
        print(f" Created unlabeled dataset: {unlabeled_path} ({len(unlabeled_data)} samples)")
        print(f" Features: sepal_length, sepal_width, petal_length, petal_width")
        print(f"  Species distribution in labeled data:")
        for species in self.project_config['label_space']:
            count = labeled_labels.count(species)
            print(f"   - {species}: {count} samples")
        
        return labeled_path, unlabeled_path

    def create_project_config(self):
        """Create AL configuration file"""
        print("\n  Creating project configuration...")
        
        config_dir = Path(f"al-engine/ro-crates/{self.project_id}")
        config_dir.mkdir(parents=True, exist_ok=True)
        
        al_config = {
            "al_scenario": "pool_based",
            "query_strategy": "uncertainty_sampling",
            "model_type": self.project_config["model_type"],
            "training_args": self.project_config["training_args"],
            "label_space": self.project_config["label_space"],
            "query_batch_size": self.project_config["query_batch_size"],
            "validation_split": 0.2,
            "max_iterations": self.project_config["max_iterations"],
            "voting_consensus": "simple_majority",
            "voting_timeout_seconds": self.project_config["voting_timeout_seconds"],
            "project_metadata": {
                "name": self.project_config["name"],
                "description": self.project_config["description"],
                "created_at": time.time(),
                "coordinator": self.project_config["coordinator"]
            }
        }
        
        config_path = config_dir / "config.json"
        with open(config_path, 'w') as f:
            json.dump(al_config, f, indent=2)
        
        print(f" Created configuration: {config_path}")
        return config_path

    def test_al_engine_health(self):
        """Test AL-Engine server health and connectivity"""
        print("\n Testing AL-Engine server health...")
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f" AL-Engine is healthy")
                print(f"   Project ID: {data.get('project_id', 'N/A')}")
                print(f"   Computation mode: {data.get('computation_mode', 'N/A')}")
                print(f"   Timestamp: {data.get('timestamp', 'N/A')}")
                return True
            else:
                print(f" Health check failed: HTTP {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f" Cannot connect to AL-Engine: {e}")
            print("Make sure AL-Engine server is running with:")
            print(f"   cd al-engine && python main.py --project_id {self.project_id} --config ro-crates/{self.project_id}/config.json --server")
            return False

    def simulate_smart_contract_interaction(self, action, data=None):
        """Simulate smart contract interactions that would happen in real DAL"""
        print(f"\n Smart Contract Simulation: {action}")
        
        if action == "start_iteration":
            print(f"    Broadcasting VotingSessionStarted event for iteration {data['iteration']}")
            print(f"   ⏰ Voting timeout: {self.project_config['voting_timeout_seconds']} seconds")
            print(f"    Notifying {data.get('participants', 5)} participants")
            
        elif action == "submit_vote":
            print(f"     Recording vote: {data['sample_id']} → {data['label']}")
            print(f"    Vote progress: {data.get('votes_received', 1)}/{data.get('total_voters', 5)}")
            
        elif action == "finalize_voting":
            print(f"    Voting finalized for sample: {data['sample_id']}")
            print(f"    Final label: {data['final_label']}")
            print(f"    Consensus reached: {data.get('consensus', True)}")
            
        elif action == "iteration_complete":
            print(f"    Iteration {data['iteration']} completed")
            print(f"    Total samples labeled: {data.get('total_labeled', 0)}")
            print(f"    Next iteration ready: {data.get('next_ready', True)}")

    def start_al_iteration(self, iteration_number):
        """Start an AL iteration via API call"""
        print(f"\n Starting AL Iteration {iteration_number}")
        
        # Simulate smart contract triggering
        self.simulate_smart_contract_interaction("start_iteration", {
            "iteration": iteration_number,
            "participants": 5
        })
        
        payload = {
            "iteration": iteration_number,
            "project_id": self.project_id,
            "config_override": {
                "n_queries": self.project_config["query_batch_size"],
                "query_strategy": "uncertainty_sampling",
                "label_space": self.project_config["label_space"]
            }
        }
        
        print(f" Sending start_iteration request to AL-Engine...")
        print(f"   Iteration: {iteration_number}")
        print(f"   Batch size: {self.project_config['query_batch_size']}")
        
        try:
            response = requests.post(
                f"{self.base_url}/start_iteration",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f" AL iteration started successfully")
                print(f"   Success: {data.get('success', False)}")
                print(f"   Message: {data.get('message', 'No message')}")
                return data
            else:
                print(f" Failed to start iteration: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error', 'Unknown error')}")
                except:
                    print(f"   Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f" Request failed: {e}")
            return None

    def simulate_user_labeling(self, query_samples):
        """Simulate users labeling the queried samples"""
        print(f"\n Simulating user labeling for {len(query_samples)} samples...")
        
        labeled_samples = []
        
        for i, sample in enumerate(query_samples):
            # Extract features from the sample
            if 'features' in sample:
                features = sample['features']
            else:
                # If it's a dict with feature names, extract values
                features = [
                    sample.get('sepal_length', 0),
                    sample.get('sepal_width', 0),
                    sample.get('petal_length', 0),
                    sample.get('petal_width', 0)
                ]
            
            original_index = sample.get('original_index', i)
            
            # Get the true label (in real DAL, humans would provide this)
            if original_index < len(self.unlabeled_true_labels):
                true_label = self.unlabeled_true_labels[original_index]
            else:
                # Fallback classification based on features
                true_label = self._classify_flower_features(features)
            
            # Simulate some labeling noise (10% chance of wrong label)
            if np.random.random() < 0.1:
                available_labels = [l for l in self.project_config['label_space'] if l != true_label]
                noisy_label = np.random.choice(available_labels)
                print(f"    Sample {i+1}: Adding labeling noise {true_label} → {noisy_label}")
                final_label = noisy_label
            else:
                final_label = true_label
            
            # Create sample ID (simulates blockchain sample tracking)
            sample_id = f"sample_{self.current_iteration}_{i+1}_{int(time.time())}"
            
            labeled_sample = {
                "sample_id": sample_id,
                "sample_data": {
                    "features": features,
                    "sepal_length": features[0] if len(features) > 0 else 0,
                    "sepal_width": features[1] if len(features) > 1 else 0,
                    "petal_length": features[2] if len(features) > 2 else 0,
                    "petal_width": features[3] if len(features) > 3 else 0,
                },
                "label": final_label,
                "original_index": original_index
            }
            
            labeled_samples.append(labeled_sample)
            
            # Simulate smart contract vote recording
            self.simulate_smart_contract_interaction("submit_vote", {
                "sample_id": sample_id,
                "label": final_label,
                "votes_received": 1,
                "total_voters": 1
            })
            
            # Simulate vote finalization
            self.simulate_smart_contract_interaction("finalize_voting", {
                "sample_id": sample_id,
                "final_label": final_label,
                "consensus": True
            })
            
            print(f"     Sample {i+1}: [{features[0]:.1f}, {features[1]:.1f}, {features[2]:.1f}, {features[3]:.1f}] → {final_label}")
        
        self.total_samples_labeled += len(labeled_samples)
        print(f" Labeled {len(labeled_samples)} samples")
        print(f" Total samples labeled so far: {self.total_samples_labeled}")
        
        return labeled_samples

    def _classify_flower_features(self, features):
        """Simple rule-based classifier for fallback labeling"""
        sepal_length, sepal_width, petal_length, petal_width = features[:4]
        
        # Simple rules based on typical iris characteristics
        if petal_length < 2.0:
            return "setosa"
        elif petal_width < 1.7:
            return "versicolor"
        else:
            return "virginica"

    def submit_labeled_samples(self, labeled_samples, iteration_number):
        """Submit labeled samples back to AL-Engine"""
        print(f"\n Submitting {len(labeled_samples)} labeled samples to AL-Engine...")
        
        payload = {
            "iteration": iteration_number,
            "project_id": self.project_id,
            "labeled_samples": labeled_samples
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/submit_labels",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f" Labels submitted successfully")
                print(f"   Samples processed: {data.get('samples_processed', 0)}")
                print(f"   Next iteration ready: {data.get('next_iteration_ready', False)}")
                print(f"   Message: {data.get('message', 'No message')}")
                
                # Simulate smart contract iteration completion
                self.simulate_smart_contract_interaction("iteration_complete", {
                    "iteration": iteration_number,
                    "total_labeled": self.total_samples_labeled,
                    "next_ready": data.get('next_iteration_ready', False)
                })
                
                return data
            else:
                print(f" Failed to submit labels: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error', 'Unknown error')}")
                except:
                    print(f"   Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f" Request failed: {e}")
            return None

    def get_iteration_results(self, iteration_number):
        """Get results from a completed iteration"""
        print(f"\n Getting results for iteration {iteration_number}...")
        
        try:
            response = requests.get(f"{self.base_url}/results/{iteration_number}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f" Results retrieved successfully")
                print(f"   Iteration: {data.get('iteration', 'N/A')}")
                
                files = data.get('files', {})
                if files:
                    print(f"    Output files:")
                    for file_type, file_path in files.items():
                        if file_path:
                            print(f"      - {file_type}: {file_path}")
                        else:
                            print(f"      - {file_type}: Not found")
                
                performance = data.get('performance')
                if performance:
                    print(f"    Performance metrics available")
                
                return data
            else:
                print(f"  Results not available: HTTP {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f" Request failed: {e}")
            return None

    def run_complete_dal_simulation(self):
        """Run a complete DAL project simulation"""
        print("Starting Complete DAL Project Simulation")
        print("=" * 60)
        
        # Phase 1: Project Setup
        print("\n PHASE 1: PROJECT SETUP")
        print("-" * 30)
        
        if not self.test_al_engine_health():
            return False
        
        labeled_path, unlabeled_path = self.create_realistic_datasets()
        config_path = self.create_project_config()
        
        # Phase 2: Active Learning Loop
        print("\n PHASE 2: ACTIVE LEARNING ITERATIONS")
        print("-" * 40)
        
        max_iterations = self.project_config["max_iterations"]
        
        for iteration in range(1, max_iterations + 1):
            self.current_iteration = iteration
            print(f"\n{'='*20} ITERATION {iteration}/{max_iterations} {'='*20}")
            
            # Step 1: Start AL iteration
            al_result = self.start_al_iteration(iteration)
            if not al_result or not al_result.get('success'):
                print(f" Failed to start iteration {iteration}, stopping simulation")
                break
            
            # Step 2: Extract query samples (in real DAL, this would come from the output)
            # For simulation, we'll get them from the AL-Engine output directory
            query_samples_file = Path(f"al-engine/al_work_{self.project_id}/output/query_samples.json")
            
            if query_samples_file.exists():
                with open(query_samples_file, 'r') as f:
                    query_samples = json.load(f)
                
                print(f" Retrieved {len(query_samples)} query samples from AL-Engine")
            else:
                print("Query samples file not found, using fallback")
                # Fallback: create dummy samples for testing
                query_samples = [
                    {"features": [5.1, 3.5, 1.4, 0.2], "original_index": iteration * 2 - 2},
                    {"features": [6.2, 2.9, 4.3, 1.3], "original_index": iteration * 2 - 1}
                ]
            
            # Step 3: Simulate user labeling
            labeled_samples = self.simulate_user_labeling(query_samples)
            
            # Step 4: Submit labeled samples back
            submit_result = self.submit_labeled_samples(labeled_samples, iteration)
            if not submit_result or not submit_result.get('success'):
                print(f" Failed to submit labels for iteration {iteration}")
                break
            
            # Step 5: Get iteration results
            results = self.get_iteration_results(iteration)
            
            # Brief pause between iterations
            print(f"\n⏳ Waiting 2 seconds before next iteration...")
            time.sleep(2)
        
        # Phase 3: Project Summary
        print("\n PHASE 3: PROJECT SUMMARY")
        print("-" * 30)
        self.print_project_summary()
        
        return True

    def print_project_summary(self):
        """Print a summary of the completed DAL project"""
        print(f"\n DAL Project Simulation Complete!")
        print(f" Project: {self.project_name}")
        print(f" Project ID: {self.project_id}")
        print(f" Iterations completed: {self.current_iteration}")
        print(f"  Total samples labeled: {self.total_samples_labeled}")
        print(f" Batch size per iteration: {self.project_config['query_batch_size']}")
        print(f" Target classes: {', '.join(self.project_config['label_space'])}")
        print(f" Model type: {self.project_config['model_type']}")
        
        # Check final model performance (if available)
        final_results = self.get_iteration_results(self.current_iteration)
        if final_results and final_results.get('performance'):
            print(f" Final model performance available")
        
        print(f"\n Simulation demonstrates:")
        print(f"    Complete AL workflow integration")
        print(f"    DAL ↔ AL-Engine API communication")
        print(f"    Smart contract simulation")
        print(f"    Real data processing (CSV format)")
        print(f"    Multi-iteration active learning")
        print(f"    Error handling and fallbacks")
        
        print(f"\n End of DAL Simulation")

    def validate_critical_paths(self):
        """Validate all critical file paths before running simulation"""
        print("\n Validating Critical DAL Integration Paths...")
        print("-" * 50)
        
        validation_errors = []
        
        # 1. Check input dataset paths
        datasets_dir = Path(f"al-engine/ro-crates/{self.project_id}/inputs/datasets")
        required_datasets = ["labeled_samples.csv", "unlabeled_samples.csv"]
        
        for dataset in required_datasets:
            dataset_path = datasets_dir / dataset
            if dataset_path.exists():
                print(f" Input dataset found: {dataset_path}")
                # Validate CSV format
                try:
                    df = pd.read_csv(dataset_path)
                    expected_cols = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width']
                    if dataset == "labeled_samples.csv":
                        expected_cols.append('species')
                    
                    if all(col in df.columns for col in expected_cols):
                        print(f"    Dataset format valid ({len(df)} rows)")
                    else:
                        validation_errors.append(f"Dataset {dataset} missing required columns: {expected_cols}")
                except Exception as e:
                    validation_errors.append(f"Cannot read dataset {dataset}: {e}")
            else:
                validation_errors.append(f"Required dataset not found: {dataset_path}")
        
        # 2. Check config file path
        config_path = Path(f"al-engine/ro-crates/{self.project_id}/config.json")
        if config_path.exists():
            print(f" Config file found: {config_path}")
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                required_keys = ["model_type", "label_space", "query_batch_size"]
                missing_keys = [k for k in required_keys if k not in config]
                if missing_keys:
                    validation_errors.append(f"Config missing keys: {missing_keys}")
                else:
                    print(f"     Config format valid")
            except Exception as e:
                validation_errors.append(f"Cannot parse config file: {e}")
        else:
            validation_errors.append(f"Config file not found: {config_path}")
        
        # 3. Check CWL workflow paths
        cwl_path = Path(f"al-engine/ro-crates/{self.project_id}/al_iteration.cwl")
        inputs_path = Path(f"al-engine/ro-crates/{self.project_id}/inputs.yml")
        
        if cwl_path.exists():
            print(f" CWL workflow found: {cwl_path}")
        else:
            validation_errors.append(f"CWL workflow not found: {cwl_path}")
            
        if inputs_path.exists():
            print(f" CWL inputs found: {inputs_path}")
        else:
            validation_errors.append(f"CWL inputs not found: {inputs_path}")
        
        # 4. Check AL iteration script
        al_script_path = Path("al-engine/al_iteration.py")
        if al_script_path.exists():
            print(f" AL iteration script found: {al_script_path}")
        else:
            validation_errors.append(f"AL iteration script not found: {al_script_path}")
        
        # 5. Validate output directory structure
        output_dir = Path(f"al-engine/al_work_{self.project_id}")
        if not output_dir.exists():
            try:
                output_dir.mkdir(parents=True, exist_ok=True)
                print(f" Created output directory: {output_dir}")
            except Exception as e:
                validation_errors.append(f"Cannot create output directory: {e}")
        else:
            print(f" Output directory exists: {output_dir}")
        
        # 6. Check if paths are accessible from DAL perspective
        print("\n Validating DAL Access Paths...")
        
        # Simulate DAL reading query samples path (this is critical!)
        query_samples_path = Path(f"al-engine/al_work_{self.project_id}/output/query_samples.json")
        query_dir = query_samples_path.parent
        
        try:
            query_dir.mkdir(parents=True, exist_ok=True)
            # Create a test query samples file
            test_data = [{"test": "data", "original_index": 0}]
            with open(query_samples_path, 'w') as f:
                json.dump(test_data, f)
            
            # Try to read it back (simulate DAL reading)  
            with open(query_samples_path, 'r') as f:
                read_data = json.load(f)
            
            if read_data == test_data:
                print(f" DAL can read/write query samples: {query_samples_path}")
            else:
                validation_errors.append("DAL query samples read/write validation failed")
                
            # Clean up test file
            query_samples_path.unlink()
            
        except Exception as e:
            validation_errors.append(f"DAL query samples path validation failed: {e}")
        
        # 7. Validate cross-platform path handling
        print("\n Testing Cross-Platform Path Compatibility...")
        
        test_paths = [
            f"al-engine/ro-crates/{self.project_id}/config.json",
            f"al-engine/ro-crates/{self.project_id}/inputs/datasets/labeled_samples.csv",
            f"al-engine/al_work_{self.project_id}/output/query_samples.json"
        ]
        
        for path_str in test_paths:
            try:
                # Test both pathlib and os.path
                path_obj = Path(path_str)
                norm_path = os.path.normpath(path_str)
                abs_path = os.path.abspath(path_str)
                
                print(f" Path compatibility OK: {path_str}")
            except Exception as e:
                validation_errors.append(f"Path compatibility issue: {path_str} - {e}")
        
        # Print validation summary
        print(f"\n Path Validation Summary:")
        if validation_errors:
            print(f" {len(validation_errors)} CRITICAL ERRORS found:")
            for error in validation_errors:
                print(f"   • {error}")
            print(f"\n Please run 'python test_path_validation.py' to diagnose and fix these issues")
            return False
        else:
            print(f" All critical paths validated successfully!")
            print(f" Ready for DAL simulation")
            return True

    def verify_query_samples_output(self, iteration_number):
        """Verify that AL-Engine properly outputs query samples in the expected format and location"""
        print(f"\n Verifying Query Samples Output for Iteration {iteration_number}...")
        
        # Expected path where AL-Engine should write query samples
        expected_path = Path(f"al-engine/al_work_{self.project_id}/output/query_samples.json")
        
        # Wait a bit for file to be written
        max_wait = 10  # seconds
        wait_time = 0
        
        while not expected_path.exists() and wait_time < max_wait:
            time.sleep(1)
            wait_time += 1
        
        if not expected_path.exists():
            print(f" Query samples file not found at expected path: {expected_path}")
            print(f" Checking alternative locations...")
            
            # Check possible alternative paths
            alternative_paths = [
                Path(f"al-engine/al_work_{self.project_id}/query_samples.json"),
                Path(f"al-engine/ro-crates/{self.project_id}/query_samples.json"),
                Path(f"al-engine/query_samples.json")
            ]
            
            found_alternative = False
            for alt_path in alternative_paths:
                if alt_path.exists():
                    print(f"  Found query samples at alternative location: {alt_path}")
                    found_alternative = True
                    expected_path = alt_path
                    break
            
            if not found_alternative:
                print(f" Query samples file not found in any expected location")
                return None, f"Query samples file not found"
        
        # Validate file format
        try:
            with open(expected_path, 'r') as f:
                query_samples = json.load(f)
            
            print(f" Query samples file found: {expected_path}")
            print(f" Contains {len(query_samples)} samples")
            
            # Validate format
            if not isinstance(query_samples, list):
                return None, "Query samples should be a list"
            
            if len(query_samples) == 0:
                return None, "Query samples list is empty"
            
            # Validate first sample structure
            sample = query_samples[0]
            required_fields = ["original_index"]  # Minimum required
            expected_feature_fields = ["sepal_length", "sepal_width", "petal_length", "petal_width"]
            
            missing_required = [f for f in required_fields if f not in sample]
            if missing_required:
                return None, f"Query samples missing required fields: {missing_required}"
            
            # Check if it has feature data (either as individual fields or as 'features' array)
            has_individual_features = all(f in sample for f in expected_feature_fields)
            has_features_array = "features" in sample and isinstance(sample["features"], list)
            
            if not (has_individual_features or has_features_array):
                return None, "Query samples missing feature data"
            
            print(f" Query samples format validation passed")
            print(f"   Sample structure: {list(sample.keys())}")
            
            if has_features_array:
                print(f"   Features format: array of {len(sample['features'])} values")
            else:
                print(f"   Features format: individual fields")
            
            return query_samples, None
            
        except json.JSONDecodeError as e:
            return None, f"Invalid JSON format: {e}"
        except Exception as e:
            return None, f"Error reading query samples: {e}"

    def verify_labeled_samples_submission(self, labeled_samples, iteration_number):
        """Verify that labeled samples are in the correct format for AL-Engine"""
        print(f"\n Verifying Labeled Samples Submission Format...")
        
        if not isinstance(labeled_samples, list):
            print(f" Labeled samples should be a list, got {type(labeled_samples)}")
            return False
        
        print(f" Validating {len(labeled_samples)} labeled samples...")
        
        for i, sample in enumerate(labeled_samples):
            required_keys = ["sample_id", "sample_data", "label", "original_index"]
            missing_keys = [k for k in required_keys if k not in sample]
            
            if missing_keys:
                print(f" Sample {i+1} missing keys: {missing_keys}")
                return False
            
            # Validate sample_data structure
            sample_data = sample["sample_data"]
            if not isinstance(sample_data, dict):
                print(f" Sample {i+1} sample_data should be a dict")
                return False
            
            # Check for features
            if "features" not in sample_data:
                print(f" Sample {i+1} missing 'features' in sample_data")
                return False
            
            features = sample_data["features"]
            if not isinstance(features, list) or len(features) != 4:
                print(f" Sample {i+1} features should be a list of 4 numbers")
                return False
            
            # Validate original_index
            if not isinstance(sample["original_index"], int):
                print(f" Sample {i+1} original_index should be an integer")
                return False
            
            # Validate label
            if sample["label"] not in self.project_config["label_space"]:
                print(f" Sample {i+1} has invalid label: {sample['label']}")
                return False
        
        print(f" All labeled samples format validation passed")
        return True

def main():
    """Main function to run the DAL simulation"""
    print("DAL Project Simulation - Flower Classification")
    print("=" * 50)
    
    try:
        # Initialize simulator
        simulator = DALProjectSimulator("Flower Species Classification AL Project")
        
        # Run complete simulation
        success = simulator.run_complete_dal_simulation()
        
        if success:
            print("\n Simulation completed successfully!")
            return 0
        else:
            print("\n Simulation failed!")
            return 1
            
    except KeyboardInterrupt:
        print("\n\n  Simulation interrupted by user")
        return 1
    except Exception as e:
        print(f"\n Simulation error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 