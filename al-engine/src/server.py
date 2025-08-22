# server.py - AL-Engine HTTP API Server (Fixed Version)

import json
import logging
import time
import os
import tempfile
import yaml
import subprocess
import numpy as np
from pathlib import Path
from flask import Flask
from endpoints import ALEngineEndpoints

logger = logging.getLogger(__name__)

class ALEngineServer:
    """
    AL-Engine with HTTP API server for DAL communication (Local execution only)
    """
    
    def __init__(self, project_id=None, config_path=None, port=5050):
        self.project_id = project_id
        self.config_path = config_path
        self.port = port
        self.running = False
        
        # These will be initialized when needed via API calls
        self.config = None
        self.work_dir = None
        self.signal_dir = None
        
        # Initialize project-specific resources if provided
        if project_id and config_path:
            self._initialize_project(project_id, config_path)
        
        # Initialize Flask app
        self.app = Flask(__name__)
        self.endpoints = ALEngineEndpoints(self)
        self.endpoints.setup_routes(self.app)
        
        logger.info(f"AL-Engine Server initialized")
        logger.info(f"Computation mode: local (only)")
        logger.info(f"API server port: {port}")
        if project_id:
            logger.info(f"Project: {project_id}")
        else:
            logger.info("Server mode: waiting for project-specific API calls")

    def _initialize_project(self, project_id, config_path):
        """Initialize project-specific resources"""
        self.project_id = project_id
        self.config_path = config_path
        
        # Load configuration
        self.config = self._load_config()
        
        # Create working directory inside the ro-crates project folder
        self.work_dir = Path(f"../ro-crates/{project_id}/work")
        self.work_dir.mkdir(parents=True, exist_ok=True)
        
        # Service mode paths
        self.signal_dir = Path(f"../ro-crates/{project_id}/signals")
        self.signal_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Initialized project resources for {project_id}")
        logger.info(f"Working directory: {self.work_dir}")

    def _load_config(self):
        """Load AL configuration from file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)
            logger.info(f"Configuration loaded from {self.config_path}")
            return config
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            raise

    def _execute_iteration_sync(self, iteration_number, request_data):
        """Execute AL iteration synchronously for API calls (local only)"""
        logger.info(f"Executing AL iteration {iteration_number} locally via API")
        
        try:
            # Check if we need to initialize project from request data
            project_id = request_data.get('project_id')
            if not self.project_id and project_id:
                # Initialize project dynamically from request
                config_path = f"../ro-crates/{project_id}/config.json"
                logger.info(f"Dynamically initializing project: {project_id}")
                self._initialize_project(project_id, config_path)
            elif not self.project_id:
                raise ValueError("No project_id provided in request and server not initialized with a project")
            
            # Use the original config file - inject iteration at runtime
            original_config_file = Path(self.config_path)
            
            # Execute the iteration locally, passing iteration number
            result = self._run_local_iteration(iteration_number, original_config_file)
            
            logger.info(f"AL iteration {iteration_number} completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"AL iteration {iteration_number} failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'iteration': iteration_number
            }

    def _execute_final_training_sync(self, iteration_number, project_id):
        """Execute final training synchronously for API calls (no sample querying)"""
        logger.info(f"Executing final training iteration {iteration_number} locally via API")
        
        try:
            # Initialize project if needed
            if not self.project_id and project_id:
                config_path = f"../ro-crates/{project_id}/config.json"
                logger.info(f"Dynamically initializing project for final training: {project_id}")
                self._initialize_project(project_id, config_path)
            elif not self.project_id:
                raise ValueError("No project_id provided and server not initialized with a project")
            
            # Use the original config file
            original_config_file = Path(self.config_path)
            
            # Execute final training locally (no sample querying)
            result = self._run_final_training_iteration(iteration_number, original_config_file)
            
            logger.info(f"Final training iteration {iteration_number} completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Final training iteration {iteration_number} failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'iteration': iteration_number
            }

    def _run_local_iteration(self, iteration_number, config_file):
        """Run iteration locally using cwltool to execute the CWL workflow"""
        logger.info(f"Running iteration {iteration_number} locally via CWL workflow")
        
        try:
            # Find the CWL workflow file for this project
            cwl_file = Path(f"../ro-crates/{self.project_id}/al_iteration.cwl")
            inputs_file = Path(f"../ro-crates/{self.project_id}/inputs.yml")
            
            if not cwl_file.exists():
                raise FileNotFoundError(f"CWL workflow not found: {cwl_file}")
            
            if not inputs_file.exists():
                raise FileNotFoundError(f"CWL inputs file not found: {inputs_file}")
            
            # Create simple job file with iteration number
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as temp_job:
                # Use absolute paths for all files
                datasets_dir = inputs_file.parent / 'inputs' / 'datasets'
                job_inputs = {
                    'labeled_data': {'class': 'File', 'path': str((datasets_dir / 'labeled_samples.csv').resolve())},
                    'labeled_labels': {'class': 'File', 'path': str((datasets_dir / 'labeled_samples.csv').resolve())},
                    'unlabeled_data': {'class': 'File', 'path': str((datasets_dir / 'unlabeled_samples.csv').resolve())},
                    'config': {'class': 'File', 'path': str(config_file.resolve())},
                    'iteration': iteration_number,
                    'project_id': self.project_id  # Add project_id parameter
                }
                yaml.dump(job_inputs, temp_job, default_flow_style=False)
                temp_job_path = temp_job.name
            
            # Execute CWL workflow using cwltool
            # Create outputs directory in ro-crate structure
            outputs_dir = inputs_file.parent / "outputs"
            outputs_dir.mkdir(exist_ok=True)
            
            cmd = [
                "cwltool",
                "--outdir", str(outputs_dir),
                str(cwl_file),
                temp_job_path
            ]
            
            logger.info(f"Executing CWL workflow: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd="."
            )
            
            # Cleanup temporary files
            try:
                os.unlink(temp_job_path)
            except:
                pass
            
            if result.returncode == 0:
                logger.info("CWL workflow completed successfully")
                logger.info(f"CWL stdout: {result.stdout}")
                
                # Parse CWL outputs
                outputs = self._parse_cwl_outputs(result.stdout, outputs_dir)
                
                # Return workflow result
                return {
                    'success': True,
                    'outputs': outputs,
                    'stdout': result.stdout,
                    'execution_method': 'cwltool'
                }
            else:
                logger.error(f"CWL workflow failed with return code {result.returncode}")
                logger.error(f"CWL stderr: {result.stderr}")
                
                return {
                    'success': False,
                    'error': f"CWL execution failed: {result.stderr}",
                    'returncode': result.returncode,
                    'execution_method': 'cwltool'
                }
                
        except FileNotFoundError as e:
            logger.error(f"CWL workflow files not found: {e}")
            
            # Fallback to WorkflowRunner if CWL files are missing
            logger.info("Falling back to WorkflowRunner execution")
            return self._run_fallback_iteration(iteration_number, config_file)
            
        except Exception as e:
            logger.error(f"Error executing CWL workflow: {e}")
            
            # Fallback to WorkflowRunner
            logger.info("Falling back to WorkflowRunner execution")
            return self._run_fallback_iteration(iteration_number, config_file)

    def _parse_cwl_outputs(self, stdout, outputs_dir):
        """Parse CWL outputs from stdout"""
        outputs = {}
        
        try:
            # FIXED: Parse the iteration number from stdout to get the correct file
            iteration_number = None
            
            # Try to extract iteration number from stdout JSON
            import json
            try:
                # Look for JSON output in stdout that contains the iteration info
                lines = stdout.strip().split('\n')
                for line in lines:
                    if line.strip().startswith('{') and 'query_samples' in line:
                        cwl_output = json.loads(line)
                        if 'query_samples' in cwl_output and 'path' in cwl_output['query_samples']:
                            # Extract iteration number from path: .../query_samples_round_3.json
                            import re
                            match = re.search(r'query_samples_round_(\d+)\.json', cwl_output['query_samples']['path'])
                            if match:
                                iteration_number = int(match.group(1))
                                break
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning(f"Could not parse iteration number from stdout: {e}")
            
            # Look for output files - use specific iteration if found, otherwise fallback to latest
            if iteration_number:
                # Use the specific iteration file
                query_samples_file = outputs_dir / f"query_samples_round_{iteration_number}.json"
                if query_samples_file.exists():
                    outputs['query_samples'] = str(query_samples_file)
                    logger.info(f"Using specific iteration file: {query_samples_file}")
                else:
                    logger.warning(f"Expected iteration file not found: {query_samples_file}")
            else:
                # Fallback: Look for query samples files and use the latest (highest number)
                query_samples_files = list(outputs_dir.glob("query_samples_round_*.json"))
                if query_samples_files:
                    # Sort by iteration number (extract number from filename)
                    import re
                    def extract_iteration(filepath):
                        match = re.search(r'query_samples_round_(\d+)\.json', str(filepath))
                        return int(match.group(1)) if match else 0
                    
                    latest_file = max(query_samples_files, key=extract_iteration)
                    outputs['query_samples'] = str(latest_file)
                    logger.info(f"Using latest query samples file: {latest_file}")
                
            # Look for model files in output directory (not in model subdirectory)
            if iteration_number:
                model_file = outputs_dir / f"model_round_{iteration_number}.pkl"
                if model_file.exists():
                    outputs['model_out'] = str(model_file)
            else:
                # Fallback for model files
                model_files = list(outputs_dir.glob("model_round_*.pkl"))
                if model_files:
                    # Sort by iteration number and take latest
                    import re
                    def extract_model_iteration(filepath):
                        match = re.search(r'model_round_(\d+)\.pkl', str(filepath))
                        return int(match.group(1)) if match else 0
                    
                    latest_model = max(model_files, key=extract_model_iteration)
                    outputs['model_out'] = str(latest_model)
                
            logger.info(f"CWL outputs found: {list(outputs.keys())}")
            
        except Exception as e:
            logger.warning(f"Error parsing CWL outputs: {e}")
            
        return outputs

    def _run_fallback_iteration(self, iteration_number, config_file):
        """Fallback execution using direct call to al_iteration.py if CWL is not available"""
        logger.info(f"Running fallback iteration {iteration_number} using direct al_iteration.py call")
        
        try:
            # Set up file paths
            project_dir = Path(f"../ro-crates/{self.project_id}")
            labeled_data = project_dir / "inputs" / "datasets" / "labeled_samples.csv"
            unlabeled_data = project_dir / "inputs" / "datasets" / "unlabeled_samples.csv"
            outputs_dir = project_dir / "outputs"
            outputs_dir.mkdir(exist_ok=True)
            
            # Build command to run our fixed al_iteration.py
            cmd = [
                "python", "al_iteration.py",
                "--labeled_data", str(labeled_data),
                "--labeled_labels", str(labeled_data),  # Same file for iris dataset
                "--unlabeled_data", str(unlabeled_data),
                "--config", str(config_file),
                "--iteration", str(iteration_number),
                "--project_id", self.project_id
            ]
            
            # Add model input for iterations > 1
            if iteration_number > 1:
                model_file = outputs_dir / f"model_round_{iteration_number-1}.pkl"
                if model_file.exists():
                    cmd.extend(["--model_in", str(model_file)])
            
            logger.info(f"Fallback executing: {' '.join(cmd)}")
            
            # Execute our fixed AL iteration script
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent  # Run from src directory
            )
            
            if result.returncode == 0:
                logger.info(f"Fallback iteration {iteration_number} completed successfully")
                
                # Check for expected outputs
                query_file = outputs_dir / f"query_samples_round_{iteration_number}.json"
                model_file = outputs_dir / f"model_round_{iteration_number}.pkl"
                perf_file = outputs_dir / f"performance_round_{iteration_number}.json"
                
                outputs = {}
                if query_file.exists():
                    outputs['query_samples'] = str(query_file)
                if model_file.exists():
                    outputs['model_out'] = str(model_file)
                if perf_file.exists():
                    outputs['performance'] = str(perf_file)
                
                return {
                    'success': True,
                    'outputs': outputs,
                    'stdout': result.stdout,
                    'execution_method': 'direct_python'
                }
            else:
                logger.error(f"Fallback iteration {iteration_number} failed")
                logger.error(f"STDERR: {result.stderr}")
                return {
                    'success': False,
                    'error': result.stderr,
                    'stdout': result.stdout,
                    'execution_method': 'direct_python'
                }
                
        except Exception as e:
            logger.error(f"Fallback execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'execution_method': 'direct_python'
            }

    def _run_final_training_iteration(self, iteration_number, config_file):
        """Run final training iteration - trains on all labeled data without querying new samples"""
        logger.info(f"Running final training iteration {iteration_number} using direct al_iteration.py call")
        
        try:
            # Set up file paths
            project_dir = Path(f"../ro-crates/{self.project_id}")
            labeled_data = project_dir / "inputs" / "datasets" / "labeled_samples.csv"
            unlabeled_data = project_dir / "inputs" / "datasets" / "unlabeled_samples.csv"
            outputs_dir = project_dir / "outputs"
            outputs_dir.mkdir(exist_ok=True)
            
            # Build command to run al_iteration.py with final training flag
            cmd = [
                "python", "al_iteration.py",
                "--labeled_data", str(labeled_data),
                "--labeled_labels", str(labeled_data),  # Same file for iris dataset
                "--unlabeled_data", str(unlabeled_data),
                "--config", str(config_file),
                "--iteration", str(iteration_number),
                "--project_id", self.project_id,
                "--final_training"  # Special flag for final training
            ]
            
            # Add model input from previous iteration
            if iteration_number > 1:
                model_file = outputs_dir / f"model_round_{iteration_number-1}.pkl"
                if model_file.exists():
                    cmd.extend(["--model_in", str(model_file)])
            
            logger.info(f"Final training executing: {' '.join(cmd)}")
            
            # Execute AL iteration script with final training flag
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent  # Run from src directory
            )
            
            if result.returncode == 0:
                logger.info(f"Final training iteration {iteration_number} completed successfully")
                
                # Check for expected outputs (no query samples for final training)
                model_file = outputs_dir / f"model_round_{iteration_number}.pkl"
                perf_file = outputs_dir / f"performance_round_{iteration_number}.json"
                
                outputs = {}
                if model_file.exists():
                    outputs['model_out'] = str(model_file)
                if perf_file.exists():
                    outputs['performance'] = str(perf_file)
                
                # Load performance metrics if available
                performance = None
                if perf_file.exists():
                    try:
                        with open(perf_file, 'r') as f:
                            performance = json.load(f)
                        logger.info(f"Final training performance: Accuracy={performance.get('accuracy', 'N/A'):.3f}")
                    except Exception as e:
                        logger.warning(f"Could not load performance metrics: {e}")
                
                return {
                    'success': True,
                    'outputs': outputs,
                    'performance': performance,
                    'stdout': result.stdout,
                    'execution_method': 'final_training_direct_python',
                    'final_training': True
                }
            else:
                logger.error(f"Final training iteration {iteration_number} failed")
                logger.error(f"STDERR: {result.stderr}")
                return {
                    'success': False,
                    'error': result.stderr,
                    'stdout': result.stdout,
                    'execution_method': 'final_training_direct_python'
                }
                
        except Exception as e:
            logger.error(f"Final training execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'execution_method': 'final_training_direct_python'
            }

    def _process_labeled_samples(self, iteration_number, labeled_samples, project_id):
        """Process and store labeled samples for the next training iteration"""
        logger.info(f"Processing {len(labeled_samples)} labeled samples for iteration {iteration_number}")
        
        try:
            # Create directory for iteration data
            iteration_dir = self.work_dir / f"iteration_{iteration_number}"
            iteration_dir.mkdir(exist_ok=True)
            
            # Process labeled samples - expected format:
            # [{"sample_id": "...", "sample_data": {...}, "label": "positive", "original_index": 123}, ...]
            processed_samples = []
            features_list = []
            labels_list = []
            
            for sample in labeled_samples:
                try:
                    sample_id = sample.get('sample_id')
                    sample_data = sample.get('sample_data', sample.get('features'))
                    label = sample.get('label')
                    original_index = sample.get('original_index', -1)
                    
                    if not sample_data or not label:
                        logger.warn(f"Skipping incomplete sample: {sample}")
                        continue
                    
                    # Extract features (handle different data formats)
                    if isinstance(sample_data, dict):
                        if 'features' in sample_data:
                            features = sample_data['features']
                        else:
                            # Use all numeric values from the dict as features
                            features = [v for v in sample_data.values() if isinstance(v, (int, float))]
                    elif isinstance(sample_data, list):
                        features = sample_data
                    else:
                        features = [sample_data]  # Single feature
                    
                    features_list.append(features)
                    labels_list.append(label)
                    
                    processed_samples.append({
                        'sample_id': sample_id,
                        'features': features,
                        'label': label,
                        'original_index': original_index,
                        'processed_at': time.time()
                    })
                    
                except Exception as sample_error:
                    logger.error(f"Error processing sample: {sample_error}")
                    continue
            
            if not processed_samples:
                return {
                    'success': False,
                    'error': 'No valid samples could be processed'
                }
            
            # Save processed samples as JSON
            samples_file = iteration_dir / f"labeled_samples_{iteration_number}.json"
            with open(samples_file, 'w') as f:
                json.dump(processed_samples, f, indent=2)
            
            # Save features and labels as numpy arrays for next training iteration
            features_array = np.array(features_list)
            labels_array = np.array(labels_list)
            
            features_file = iteration_dir / f"labeled_data_iter_{iteration_number + 1}.npy"
            labels_file = iteration_dir / f"labeled_labels_iter_{iteration_number + 1}.npy"
            
            np.save(features_file, features_array)
            np.save(labels_file, labels_array)
            
            logger.info(f"Saved {len(processed_samples)} samples for next iteration")
            logger.info(f"Features: {features_file}")
            logger.info(f"Labels: {labels_file}")
            logger.info(f"JSON: {samples_file}")
            
            # Check if we have enough samples for next iteration
            next_iteration_ready = len(processed_samples) > 0
            
            return {
                'success': True,
                'samples_processed': len(processed_samples),
                'features_shape': features_array.shape,
                'unique_labels': list(set(labels_list)),
                'next_iteration_ready': next_iteration_ready,
                'saved_files': [str(samples_file), str(features_file), str(labels_file)]
            }
            
        except Exception as e:
            logger.error(f"Failed to process labeled samples: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def start_server(self):
        """Start the Flask API server"""
        logger.info(f"   Starting AL-Engine API server on port {self.port}")
        logger.info(f"   API endpoints available:")
        logger.info(f"   GET  http://localhost:{self.port}/health")
        logger.info(f"   POST http://localhost:{self.port}/start_iteration")
        logger.info(f"   POST http://localhost:{self.port}/final_training")
        logger.info(f"   GET  http://localhost:{self.port}/status")
        logger.info(f"   GET  http://localhost:{self.port}/config")
        logger.info(f"   GET  http://localhost:{self.port}/results/<iteration>")
        logger.info(f"   POST http://localhost:{self.port}/submit_labels")
        logger.info(f"   GET  http://localhost:{self.port}/model_performance/<iteration>")
        
        try:
            self.app.run(
                host='0.0.0.0',
                port=self.port,
                debug=False,
                threaded=True
            )
        except Exception as e:
            logger.error(f"Failed to start API server: {e}")
            raise 