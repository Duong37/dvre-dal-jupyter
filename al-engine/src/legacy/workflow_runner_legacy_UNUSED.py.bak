# workflow_runner.py - CWL Workflow Execution

import os
import subprocess
import json
import logging
import tempfile
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)

class WorkflowRunner:
    def __init__(self):
        """Initialize the workflow runner"""
        self.cwl_tool_path = "cwltool"  # Assumes cwltool is in PATH
        
    def _create_al_iteration_cwl(self):
        """Create CWL workflow for AL iteration"""
        cwl_content = {
            "cwlVersion": "v1.2",
            "class": "CommandLineTool",
            "baseCommand": ["python", "al_iteration.py"],
            "inputs": {
                "labeled_data": {
                    "type": "File",
                    "inputBinding": {
                        "prefix": "--labeled_data"
                    }
                },
                "labeled_labels": {
                    "type": "File", 
                    "inputBinding": {
                        "prefix": "--labeled_labels"
                    }
                },
                "unlabeled_data": {
                    "type": "File",
                    "inputBinding": {
                        "prefix": "--unlabeled_data"
                    }
                },
                "config": {
                    "type": "File",
                    "inputBinding": {
                        "prefix": "--config"
                    }
                },
                "model_in": {
                    "type": "File?",
                    "inputBinding": {
                        "prefix": "--model_in"
                    }
                }
            },
            "outputs": {
                "model_out": {
                    "type": "File",
                    "outputBinding": {
                        "glob": "model_out.pkl"
                    }
                },
                "query_indices": {
                    "type": "File",
                    "outputBinding": {
                        "glob": "query_indices.npy"
                    }
                }
            },
            "requirements": {
                "InlineJavascriptRequirement": {},
                "InitialWorkDirRequirement": {
                    "listing": [
                        {
                            "entryname": "al_iteration.py",
                            "entry": {
                                "$include": str(Path(__file__).parent / "al_iteration.py")
                            }
                        }
                    ]
                }
            }
        }
        return cwl_content

    def _create_job_inputs(self, inputs):
        """Create CWL job input file"""
        job_inputs = {}
        
        for key, value in inputs.items():
            if value and os.path.exists(value):
                job_inputs[key] = {
                    "class": "File",
                    "path": os.path.abspath(value)
                }
            elif key == "model_in" and not value:
                # model_in is optional, skip if not provided
                continue
            else:
                logger.warning(f"Input file not found: {value}")
        
        return job_inputs

    def run_al_iteration(self, inputs, work_dir):
        """
        Run AL iteration using cwltool
        
        Args:
            inputs (dict): Input files for the AL iteration
            work_dir (Path): Working directory for outputs
            
        Returns:
            dict: Execution result with output file paths
        """
        logger.info("Running AL iteration with cwltool")
        
        try:
            # Create temporary CWL file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.cwl', delete=False) as cwl_file:
                cwl_content = self._create_al_iteration_cwl()
                yaml.dump(cwl_content, cwl_file, default_flow_style=False)
                cwl_file_path = cwl_file.name
            
            # Create job inputs file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as job_file:
                job_inputs = self._create_job_inputs(inputs)
                yaml.dump(job_inputs, job_file, default_flow_style=False)
                job_file_path = job_file.name
            
            # Prepare cwltool command
            cmd = [
                self.cwl_tool_path,
                "--outdir", str(work_dir),
                "--preserve-environment", "PATH",
                cwl_file_path,
                job_file_path
            ]
            
            logger.info(f"Executing: {' '.join(cmd)}")
            
            # Run cwltool
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=work_dir
            )
            
            if result.returncode == 0:
                logger.info("CWL workflow completed successfully")
                
                # Parse output and return result
                output_files = {
                    'model_out': work_dir / 'model_out.pkl',
                    'query_indices': work_dir / 'query_indices.npy'
                }
                
                # Verify outputs exist
                for name, path in output_files.items():
                    if not path.exists():
                        logger.warning(f"Expected output file not found: {path}")
                
                return {
                    'success': True,
                    'outputs': output_files,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
            else:
                logger.error(f"CWL workflow failed with return code {result.returncode}")
                logger.error(f"STDERR: {result.stderr}")
                return {
                    'success': False,
                    'error': result.stderr,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
                
        except Exception as e:
            logger.error(f"Failed to run CWL workflow: {e}")
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            # Cleanup temporary files
            try:
                os.unlink(cwl_file_path)
                os.unlink(job_file_path)
            except:
                pass

    def run_direct_python(self, inputs, work_dir):
        """
        Run AL iteration directly with Python (fallback if cwltool is not available)
        
        Args:
            inputs (dict): Input files for the AL iteration
            work_dir (Path): Working directory for outputs
            
        Returns:
            dict: Execution result
        """
        logger.info("Running AL iteration directly with Python")
        
        try:
            # Build command arguments
            cmd = [
                "python", 
                str(Path(__file__).parent / "al_iteration.py"),
                "--labeled_data", inputs['labeled_data'],
                "--labeled_labels", inputs['labeled_labels'],
                "--unlabeled_data", inputs['unlabeled_data'],
                "--config", inputs['config']
            ]
            
            # Add model input if provided
            if 'model_in' in inputs and inputs['model_in']:
                cmd.extend(["--model_in", inputs['model_in']])
            
            logger.info(f"Executing: {' '.join(cmd)}")
            
            # Run the command
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=work_dir
            )
            
            if result.returncode == 0:
                logger.info("Direct Python execution completed successfully")
                
                output_files = {
                    'model_out': work_dir / 'model_out.pkl',
                    'query_indices': work_dir / 'query_indices.npy'
                }
                
                return {
                    'success': True,
                    'outputs': output_files,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
            else:
                logger.error(f"Direct Python execution failed with return code {result.returncode}")
                return {
                    'success': False,
                    'error': result.stderr,
                    'stdout': result.stdout,
                    'stderr': result.stderr
                }
                
        except Exception as e:
            logger.error(f"Failed to run direct Python execution: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def check_cwltool_available(self):
        """Check if cwltool is available"""
        try:
            result = subprocess.run(
                [self.cwl_tool_path, "--version"], 
                capture_output=True, 
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            return False 