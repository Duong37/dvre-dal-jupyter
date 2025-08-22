# main.py - AL-Engine Main Entrypoint (Refactored to use fixed al_iteration.py)

import argparse
import logging
import sys
import subprocess
import json
import tempfile
import yaml
from pathlib import Path
from server import ALEngineServer

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def run_iteration_direct(project_id, config_path, iteration_number, final_training=False):
    """
    Run a single AL iteration using our fixed al_iteration.py directly
    """
    logger.info(f"Running AL iteration {iteration_number} for project {project_id}")
    
    try:
        # Find the project directory structure
        project_dir = Path(f"../ro-crates/{project_id}")
        if not project_dir.exists():
            raise FileNotFoundError(f"Project directory not found: {project_dir}")
        
        # Set up file paths
        labeled_data = project_dir / "inputs" / "datasets" / "labeled_samples.csv"
        unlabeled_data = project_dir / "inputs" / "datasets" / "unlabeled_samples.csv"
        outputs_dir = project_dir / "outputs"
        outputs_dir.mkdir(exist_ok=True)
        
        # Verify input files exist
        if not labeled_data.exists():
            raise FileNotFoundError(f"Labeled data not found: {labeled_data}")
        if not unlabeled_data.exists():
            raise FileNotFoundError(f"Unlabeled data not found: {unlabeled_data}")
        if not Path(config_path).exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        # Build command to run our fixed al_iteration.py
        cmd = [
            "python", "al_iteration.py",
            "--labeled_data", str(labeled_data),
            "--labeled_labels", str(labeled_data),  # Same file for iris dataset
            "--unlabeled_data", str(unlabeled_data),
            "--config", str(config_path),
            "--iteration", str(iteration_number),
            "--project_id", project_id
        ]
        
        # Add final training flag if requested
        if final_training:
            cmd.append("--final_training")
            logger.info(f"Final training mode enabled for iteration {iteration_number}")
        
        # Add model input for iterations > 1
        if iteration_number > 1:
            model_file = outputs_dir / f"model_round_{iteration_number-1}.pkl"
            if model_file.exists():
                cmd.extend(["--model_in", str(model_file)])
        
        logger.info(f"Executing: {' '.join(cmd)}")
        
        # Execute our fixed AL iteration script
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent  # Run from src directory
        )
        
        if result.returncode == 0:
            if final_training:
                logger.info(f"Final training iteration {iteration_number} completed successfully")
            else:
                logger.info(f"AL iteration {iteration_number} completed successfully")
            
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
                'iteration': iteration_number,
                'outputs': outputs,
                'stdout': result.stdout,
                'final_training': final_training
            }
        else:
            if final_training:
                logger.error(f"Final training iteration {iteration_number} failed")
            else:
                logger.error(f"AL iteration {iteration_number} failed")
            logger.error(f"STDERR: {result.stderr}")
            return {
                'success': False,
                'iteration': iteration_number,
                'error': result.stderr,
                'stdout': result.stdout,
                'final_training': final_training
            }
            
    except Exception as e:
        logger.error(f"Failed to run iteration {iteration_number}: {e}")
        return {
            'success': False,
            'iteration': iteration_number,
            'error': str(e),
            'final_training': final_training
        }

def run_full_workflow(project_id, config_path, max_iterations=None):
    """
    Run the complete AL workflow for all iterations
    """
    # Load config to get max_iterations if not provided
    if max_iterations is None:
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            max_iterations = config.get('max_iterations', 10)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            max_iterations = 10
    
    logger.info(f"Starting full AL workflow - {max_iterations} iterations")
    
    results = []
    
    for iteration in range(1, max_iterations + 1):
        try:
            result = run_iteration_direct(project_id, config_path, iteration)
            results.append(result)
            
            if not result.get('success'):
                logger.error(f"Workflow failed at iteration {iteration}")
                break
                
            # Check if we should stop early (no more unlabeled data)
            # This would need to be implemented based on output analysis
                
        except Exception as e:
            logger.error(f"Workflow failed at iteration {iteration}: {e}")
            break
    
    logger.info(f"AL workflow completed. Processed {len(results)} iterations")
    return results

def main():
    parser = argparse.ArgumentParser(description="AL-Engine - Active Learning Engine (Fixed Version)")
    parser.add_argument('--project_id', type=str, help='Project identifier (required for non-server modes)')
    parser.add_argument('--config', type=str, help='AL configuration file (required for non-server modes)')
    parser.add_argument('--iteration', type=int, help='Run specific iteration (default: run all)')
    parser.add_argument('--final_training', action='store_true', help='Final training round - no sample querying')
    parser.add_argument('--workflow', action='store_true', help='Run full workflow')
    parser.add_argument('--max_iterations', type=int, help='Maximum iterations for workflow mode')
    parser.add_argument('--server', action='store_true', help='Run HTTP API server mode')
    parser.add_argument('--port', type=int, default=5050, help='API server port (default: 5050)')
    
    args = parser.parse_args()
    
    # Validate required arguments for non-server modes
    if not args.server and (not args.project_id or not args.config):
        parser.error("--project_id and --config are required for non-server modes")
    
    try:
        if args.server:
            # Run HTTP API server mode (uses our fixed system)
            logger.info("Starting AL-Engine in HTTP API server mode...")
            server = ALEngineServer(port=args.port)
            server.start_server()
        else:
            # Use our fixed direct execution approach
            if args.iteration:
                # Run specific iteration
                result = run_iteration_direct(args.project_id, args.config, args.iteration, args.final_training)
                if result.get('success'):
                    if args.final_training:
                        logger.info(f"Final training iteration {args.iteration} completed successfully")
                    else:
                        logger.info(f"Iteration {args.iteration} completed successfully")
                    if 'outputs' in result:
                        logger.info(f"Outputs: {list(result['outputs'].keys())}")
                else:
                    if args.final_training:
                        logger.error(f"Final training iteration {args.iteration} failed: {result.get('error')}")
                    else:
                        logger.error(f"Iteration {args.iteration} failed: {result.get('error')}")
                    sys.exit(1)
            elif args.workflow:
                # Run full workflow
                results = run_full_workflow(args.project_id, args.config, args.max_iterations)
                successful_iterations = sum(1 for r in results if r.get('success'))
                logger.info(f"Workflow completed: {successful_iterations}/{len(results)} iterations successful")
            else:
                logger.error("Please specify --iteration, --workflow, or --server")
                print("\nUsage examples:")
                print(f"# HTTP API server mode (recommended):")
                print(f"python main.py --server --port 5050")
                print(f"")
                print(f"# Run single iteration with cumulative learning:")
                print(f"python main.py --project_id <addr> --config <config.json> --iteration 1")
                print(f"")
                print(f"# Run final training iteration:")
                print(f"python main.py --project_id <addr> --config <config.json> --iteration 5 --final_training")
                print(f"")
                print(f"# Run full workflow:")
                print(f"python main.py --project_id <addr> --config <config.json> --workflow")
                sys.exit(1)
            
    except Exception as e:
        logger.error(f"AL-Engine failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 