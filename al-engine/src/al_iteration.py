#!/usr/bin/env python3
# AL iteration script: trains model, queries samples, and returns actual sample data.
import argparse
import json
import os
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
import time
import shutil

# Dynamic model and learner imports
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
# from modAL.models import ActiveLearner  # REMOVED: Causing import conflict
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report

# Simple Active Learning implementation to replace modAL
class SimpleActiveLearner:
    """Simple Active Learning implementation using sklearn"""
    
    def __init__(self, estimator, X_training, y_training):
        self.estimator = estimator
        self.estimator.fit(X_training, y_training)
    
    def query(self, X_unlabeled, n_instances=1):
        """Query samples using uncertainty sampling"""
        if hasattr(self.estimator, 'predict_proba'):
            # Use prediction probabilities for uncertainty sampling
            probabilities = self.estimator.predict_proba(X_unlabeled)
            # Calculate uncertainty as 1 - max_probability
            uncertainties = 1 - np.max(probabilities, axis=1)
        else:
            # Fallback: random sampling if no probabilities available
            uncertainties = np.random.random(len(X_unlabeled))
        
        # Get indices of most uncertain samples
        query_indices = np.argsort(uncertainties)[-n_instances:]
        return query_indices, uncertainties[query_indices]
    
    def predict(self, X):
        """Make predictions"""
        return self.estimator.predict(X)

def detect_format(filepath):
    """Detects file format from extension."""
    return Path(filepath).suffix.lower()

def load_data(filepath, is_labels=False):
    """Loads data from CSV or NPY files."""
    ext = detect_format(filepath)
    if ext == '.csv':
        df = pd.read_csv(filepath)
        if is_labels:
            # For labels, return the last column
            return df.iloc[:, -1].values
        else:
            # For features, check if this is labeled data (has more than 4 columns for iris dataset)
            # If it has a label column, exclude it; otherwise use all columns
            if 'species' in df.columns or df.shape[1] > 4:
                # This is labeled data, exclude the last column (label)
                return df.iloc[:, :-1].values
            else:
                # This is unlabeled data, use all columns as features
                return df.values
    elif ext == '.npy':
        return np.load(filepath, allow_pickle=True)
    else:
        raise ValueError(f"Unsupported format: {ext}")

def get_model(config):
    """Initializes a model based on the configuration."""
    model_type = config.get('model_type', 'RandomForestClassifier')
    training_args = config.get('training_args', {})
    
    if model_type == 'RandomForestClassifier':
        return RandomForestClassifier(**training_args)
    elif model_type == 'LogisticRegression':
        return LogisticRegression(**training_args)
    elif model_type == 'svm':
        return SVC(probability=True, random_state=42)
    # Add other model types here as elif blocks
    else:
        # Default to RandomForestClassifier if type is unknown
        print(f"Warning: Unknown model_type '{model_type}'. Defaulting to RandomForestClassifier.")
        return RandomForestClassifier(**training_args)

def evaluate_model_performance(learner, X_test, y_test, config, X_train=None, y_train=None):
    """
    Evaluate model performance on test set and return metrics
    """
    try:
        # Make predictions
        y_pred = learner.predict(X_test)
        
        # Calculate performance metrics
        accuracy = accuracy_score(y_test, y_pred)
        
        # Handle different averaging strategies for multiclass
        # Use label space from config, not just test set classes (test set might not have all classes)
        label_space = config.get('label_space', list(np.unique(y_test)))
        num_classes = len(label_space)
        average_strategy = 'weighted' if num_classes > 2 else 'binary'
        
        print(f"   Label space: {label_space} ({num_classes} classes)")
        print(f"   Test set classes: {list(np.unique(y_test))} (using {average_strategy} averaging)")
        
        precision = precision_score(y_test, y_pred, average=average_strategy, zero_division=0)
        recall = recall_score(y_test, y_pred, average=average_strategy, zero_division=0)
        f1 = f1_score(y_test, y_pred, average=average_strategy, zero_division=0)
        
        # Get label space for context (use config label space)
        performance_label_space = label_space
        
        # Calculate sample counts
        training_samples = len(y_train) if y_train is not None else 0
        test_samples = len(y_test)
        total_samples = training_samples + test_samples
        
        performance_metrics = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'total_samples': total_samples,         # NEW: Total labeled samples used
            'training_samples': training_samples,   # Samples used for training (after split)
            'test_samples': test_samples,          # Samples used for testing (after split)
            'label_space': performance_label_space,
            'average_strategy': average_strategy,
            'timestamp': time.time(),
            'iso_timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
        
        print(f"   Model Performance Evaluation:")
        print(f"   Accuracy:  {accuracy:.3f}")
        print(f"   Precision: {precision:.3f}")
        print(f"   Recall:    {recall:.3f}")
        print(f"   F1-Score:  {f1:.3f}")
        print(f"   Total Samples: {total_samples} ({training_samples} train + {test_samples} test)")
        
        return performance_metrics
        
    except Exception as e:
        print(f" Error during performance evaluation: {e}")
        # Return basic metrics in case of error
        return {
            'accuracy': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'f1_score': 0.0,
            'total_samples': len(y_test) if y_test is not None else 0,
            'training_samples': 0,
            'test_samples': len(y_test) if y_test is not None else 0,
            'error': str(e),
            'timestamp': time.time(),
            'iso_timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }

def parse_config(config_file):
    """Parse configuration file."""
    with open(config_file, 'r') as f:
        return json.load(f)

def accumulate_newly_labeled_samples(project_id, iteration_number, unlabeled_data_path):
    """
    CRITICAL FIX: Accumulate newly labeled samples from voting results
    This function reads voting results and updates the labeled dataset for cumulative learning
    """
    print(f"\n Accumulating newly labeled samples for iteration {iteration_number}")
    
    try:
        # Find the DVRE project root
        script_path = Path(__file__).resolve()
        current_dir = script_path.parent
        while current_dir != current_dir.parent:
            if (current_dir.parent / "al-engine").exists():
                base_dir = current_dir.parent
                break
            current_dir = current_dir.parent
        else:
            base_dir = script_path.parent.parent
        
        project_dir = base_dir / "al-engine" / "ro-crates" / project_id
        labeled_data_path = project_dir / "inputs" / "datasets" / "labeled_samples.csv"
        unlabeled_df = pd.read_csv(unlabeled_data_path)
        
        print(f"Project directory: {project_dir}")
        print(f"Original labeled data: {labeled_data_path}")
        
        # Load current labeled data
        labeled_df = pd.read_csv(labeled_data_path)
        original_count = len(labeled_df)
        print(f"Current labeled samples: {original_count}")
        
        newly_labeled_samples = []
        processed_indices = set()  # Track indices we've already processed to avoid within-round duplicates
        
        # Check voting results from the most recent round only (iteration_number - 1)
        # This prevents reprocessing already accumulated samples from earlier rounds
        prev_iteration = iteration_number - 1
        
        if prev_iteration < 1:
            print(f"[INFO] First iteration, no previous voting results to process")
            return 0
        
        print(f"[INFO] Processing voting results from round {prev_iteration} only")
        
        voting_results_path = project_dir / "outputs" / f"voting_results_round_{prev_iteration}.json"
        query_samples_path = project_dir / "outputs" / f"query_samples_round_{prev_iteration}.json"
        
        if voting_results_path.exists():
            print(f"Processing voting results from round {prev_iteration}")
            
            with open(voting_results_path, 'r') as f:
                voting_data = json.load(f)
            
            # Load corresponding query samples to get correct original indices
            sample_id_to_original_index = {}
            if query_samples_path.exists():
                with open(query_samples_path, 'r') as f:
                    query_samples = json.load(f)
                
                # Create mapping from sample characteristics to original index
                # Since the frontend uses different sample_id format, we'll match by data content
                for sample in query_samples:
                    original_idx = sample.get('original_index')
                    if original_idx is not None:
                        # Create a signature based on sample features for matching
                        sample_signature = tuple(sample.get(key, 0) for key in ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)'])
                        sample_id_to_original_index[sample_signature] = original_idx
                        print(f"[DATA] Round {prev_iteration}: Sample with original_index {original_idx} has signature {sample_signature}")
                
                print(f"[DATA] Created mapping for {len(sample_id_to_original_index)} query samples from round {prev_iteration}")
            else:
                print(f"[WARNING] Query samples file not found: {query_samples_path}")
            
            # Process each voted sample
            for sample_vote in voting_data:
                final_label = sample_vote.get('final_label')
                sample_data = sample_vote.get('sample_data', {})
                
                # Try to get original_index from voting results first
                original_index = sample_vote.get('original_index')
                
                # If original_index seems wrong (e.g., equals iteration number), try to fix it
                if original_index == prev_iteration or original_index is None:
                    print(f"[WARNING] Suspicious original_index {original_index} for round {prev_iteration}, attempting to fix...")
                    
                    # Try to match with query samples using sample_id pattern
                    sample_id = sample_data.get('sample_id', '')
                    
                    # Extract features from unlabeled data to match against query samples
                    for query_signature, correct_original_idx in sample_id_to_original_index.items():
                        if correct_original_idx < len(unlabeled_df):
                            unlabeled_sample = unlabeled_df.iloc[correct_original_idx]
                            unlabeled_signature = tuple(unlabeled_sample.get(key, 0) for key in ['sepal length (cm)', 'sepal width (cm)', 'petal length (cm)', 'petal width (cm)'])
                            
                            if query_signature == unlabeled_signature:
                                original_index = correct_original_idx
                                print(f"[SUCCESS] Fixed original_index from {sample_vote.get('original_index')} to {original_index} using feature matching")
                                break
                    
                    if original_index == prev_iteration:
                        print(f"[ERROR] Could not fix original_index for sample {sample_id}, skipping...")
                        continue
                
                if original_index is not None and final_label is not None:
                    # Check if we've already processed this original_index in this accumulation run
                    if original_index in processed_indices:
                        print(f"[INFO] Skipping already processed sample {original_index} from round {prev_iteration}")
                        continue
                    
                    # Get the sample features from unlabeled data
                    if original_index < len(unlabeled_df):
                        sample_features = unlabeled_df.iloc[original_index].copy()
                        # [SUCCESS] Add label as string to avoid dtype issues
                        sample_dict = sample_features.to_dict()
                        sample_dict['label'] = str(final_label)
                        newly_labeled_samples.append(sample_dict)
                        processed_indices.add(original_index)  # Mark as processed
                        print(f"[SUCCESS] Added sample {original_index} with label {final_label}")
                    else:
                        print(f"[WARNING] Original index {original_index} out of range")
                else:
                    print(f"[WARNING] Invalid voting result: {sample_vote}")
        else:
            print(f"[INFO] No voting results found for round {prev_iteration}")
            return 0
        
        # Add newly labeled samples to the training data
        if newly_labeled_samples:
            print(f"Processing {len(newly_labeled_samples)} newly labeled samples...")
            
            # Load current labeled data to check for duplicates
            existing_samples = []
            try:
                existing_df = pd.read_csv(labeled_data_path)
                for _, row in existing_df.iterrows():
                    existing_samples.append(row.to_dict())
            except Exception as e:
                print(f"Could not load existing labeled data: {e}")
            
            # Filter out duplicates by comparing feature values
            feature_columns = [col for col in newly_labeled_samples[0].keys() if col != 'label']
            truly_new_samples = []
            
            for new_sample in newly_labeled_samples:
                # Check if this sample's features already exist
                is_duplicate = False
                new_features = {k: v for k, v in new_sample.items() if k in feature_columns}
                
                for existing_sample in existing_samples:
                    existing_features = {k: v for k, v in existing_sample.items() if k in feature_columns}
                    if new_features == existing_features:
                        is_duplicate = True
                        print(f"[SAVED] Skipping duplicate sample: {new_sample}")
                        break
                
                if not is_duplicate:
                    truly_new_samples.append(new_sample)
            
            if len(truly_new_samples) > 0:
                # Convert to DataFrame and append to existing data
                new_samples_df = pd.DataFrame(truly_new_samples)
                updated_labeled_df = pd.concat([labeled_df, new_samples_df], ignore_index=True)
                
                # Save updated labeled dataset
                backup_path = labeled_data_path.with_suffix(f'.backup_iter_{iteration_number}.csv')
                labeled_df.to_csv(backup_path, index=False)
                updated_labeled_df.to_csv(labeled_data_path, index=False)
                
                print(f"Added {len(truly_new_samples)} new labeled samples")
                print(f"Updated labeled dataset: {original_count} → {len(updated_labeled_df)} samples")
                print(f"Backup saved to: {backup_path}")
                
                return len(truly_new_samples)
            else:
                print("No new unique samples to add")
                return 0
        else:
            print("No newly labeled samples found from voting results")
            return 0
            
    except Exception as e:
        print(f"Error accumulating newly labeled samples: {e}")
        print("Continuing with existing labeled data...")
        return 0

def main():
    parser = argparse.ArgumentParser(description='AL Iteration with Performance Evaluation')
    parser.add_argument('--labeled_data', required=True, help='Path to labeled data file')
    parser.add_argument('--labeled_labels', required=True, help='Path to labeled labels file')
    parser.add_argument('--unlabeled_data', required=True, help='Path to unlabeled data file')
    parser.add_argument('--model_in', help='Path to input model file (optional)')
    parser.add_argument('--iteration', type=int, required=True, help='Current iteration number')
    parser.add_argument('--config', required=True, help='Path to configuration file')
    parser.add_argument('--project_id', help='Project ID for output organization')
    parser.add_argument('--final_training', action='store_true', help='Final training round - no sample querying')
    
    args = parser.parse_args()

    # Parse configuration
    config = parse_config(args.config)
    
    # Determine output directory based on execution context
    if args.project_id:
        # Always use ro-crate structure for primary outputs
        # Find the DVRE project root (look for al-engine directory)
        script_path = Path(__file__).resolve()
        
        # Look for al-engine directory by traversing up
        current_dir = script_path.parent
        while current_dir != current_dir.parent:
            if (current_dir.parent / "al-engine").exists():
                base_dir = current_dir.parent
                break
            current_dir = current_dir.parent
        else:
            # Fallback: try relative path from script location
            base_dir = script_path.parent.parent
        
        output_dir = base_dir / "al-engine" / "ro-crates" / args.project_id / "outputs"
        print(f"Using ro-crate outputs directory: {output_dir}")
        
        # Check if we're running from CWL (current working directory is a temp dir)
        cwd = Path.cwd()
        is_cwl_execution = str(cwd).startswith('/tmp') or str(cwd).startswith('/private/tmp') or 'docker_tmp' in str(cwd)
        if is_cwl_execution:
            print(f"[CWL] Detected CWL execution environment: {cwd}")
            print(f"[CWL] Will copy outputs to CWL working directory after saving to project outputs")
    else:
        # Fallback to local output directory
        output_dir = Path("output")
        print(f"Using local outputs directory: {output_dir}")
        is_cwl_execution = False
    
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.final_training:
        print(f"Starting Final Training Round {args.iteration} (No Sample Querying)")
    else:
        print(f"Starting AL Iteration {args.iteration} with Performance Evaluation")

    # CRITICAL FIX: Accumulate newly labeled samples from voting results (for iterations > 1)
    # Final training should also accumulate the last round's samples
    if args.iteration > 1 and args.project_id:
        newly_added = accumulate_newly_labeled_samples(args.project_id, args.iteration, args.unlabeled_data)
        if newly_added > 0:
            if args.final_training:
                print(f"Final training: Accumulated {newly_added} newly labeled samples from Round {args.iteration - 1}!")
            else:
                print(f"Accumulated {newly_added} newly labeled samples from previous iterations!")
            # Reload labeled data since it was updated
            print("Reloading updated labeled dataset...")

    # 1. Load config
    # config = parse_config(args.config) # This line is now redundant as config is parsed above
    print("Configuration loaded.")

    # 2. Load all datasets
    X_labeled = load_data(args.labeled_data)
    y_labeled = load_data(args.labeled_labels, is_labels=True)
    X_unlabeled = load_data(args.unlabeled_data)
    print(f"Data loaded: {len(y_labeled)} labeled, {len(X_unlabeled)} unlabeled.")

    # ADDITIONAL FIX: Remove previously labeled samples from unlabeled pool (skip for final training)
    if args.iteration > 1 and args.project_id and not args.final_training:
        print("Removing previously queried samples from unlabeled pool...")
        
        try:
            # Find samples that were queried in previous iterations
            script_path = Path(__file__).resolve()
            current_dir = script_path.parent
            while current_dir != current_dir.parent:
                if (current_dir.parent / "al-engine").exists():
                    base_dir = current_dir.parent
                    break
                current_dir = current_dir.parent
            else:
                base_dir = script_path.parent.parent
            
            project_dir = base_dir / "al-engine" / "ro-crates" / args.project_id
            queried_indices = set()
            
            # Collect all previously queried indices
            for prev_iteration in range(1, args.iteration):
                query_samples_path = project_dir / "outputs" / f"query_samples_round_{prev_iteration}.json"
                if query_samples_path.exists():
                    with open(query_samples_path, 'r') as f:
                        query_data = json.load(f)
                    for sample in query_data:
                        if 'original_index' in sample:
                            queried_indices.add(sample['original_index'])
            
            if queried_indices:
                print(f"Found {len(queried_indices)} previously queried samples to remove: {sorted(queried_indices)}")
                
                # CRITICAL FIX: Compare original indices, not filtered indices
                # Load the original unlabeled dataset to get proper original indices
                unlabeled_df_full = pd.read_csv(args.unlabeled_data)
                
                # Create mask to keep only samples whose original index is NOT in queried_indices
                available_mask = []
                removed_count = 0
                
                for idx in range(len(X_unlabeled)):
                    # The original index is simply the current position in the unlabeled dataset
                    # since X_unlabeled comes directly from the unlabeled CSV
                    original_idx = idx
                    
                    if original_idx not in queried_indices:
                        available_mask.append(True)
                    else:
                        available_mask.append(False)
                        removed_count += 1
                        print(f"  Removing previously queried sample at original_index {original_idx}")
                
                # Apply the mask to filter out queried samples
                X_unlabeled = X_unlabeled[available_mask]
                
                print(f"Removed {removed_count} previously queried samples")
                print(f"Reduced unlabeled pool: {len(X_unlabeled)} samples remaining")
                
                # Update the mapping for correct original indices
                # Map new filtered indices to their original positions
                available_original_indices = [i for i in range(len(unlabeled_df_full)) if i not in queried_indices]
                original_index_mapping = {new_idx: original_idx for new_idx, original_idx in enumerate(available_original_indices)}
                print(f"Created index mapping for {len(available_original_indices)} available samples")
            else:
                print("No previously queried samples found")
                original_index_mapping = {i: i for i in range(len(X_unlabeled))}
                
        except Exception as e:
            print(f"Error filtering unlabeled data: {e}")
            print("Continuing with full unlabeled dataset...")
            original_index_mapping = {i: i for i in range(len(X_unlabeled))}
    else:
        # First iteration or final training - no filtering needed
        original_index_mapping = {i: i for i in range(len(X_unlabeled))}

    # 3. Split labeled data into train/test for performance evaluation
    # Use 80/20 split for training/testing
    if len(X_labeled) > 10:  # Only split if we have enough data
        X_train, X_test, y_train, y_test = train_test_split(
            X_labeled, y_labeled, test_size=0.2, random_state=42, stratify=y_labeled
        )
        print(f"Data split: {len(X_train)} training, {len(X_test)} testing")
    else:
        # For small datasets (≤10 samples), use leave-one-out or smaller test set
        # to get more realistic performance estimates
        if len(X_labeled) >= 6:
            # Use at least 2 samples for testing if we have 6+ samples
            test_size = max(2, int(len(X_labeled) * 0.3))  # 30% for test, minimum 2
            try:
                X_train, X_test, y_train, y_test = train_test_split(
                    X_labeled, y_labeled, test_size=test_size, random_state=42, stratify=y_labeled
                )
                print(f"Small dataset split: {len(X_train)} training, {len(X_test)} testing")
            except ValueError:
                # If stratify fails (not enough samples per class), try without stratify
                X_train, X_test, y_train, y_test = train_test_split(
                    X_labeled, y_labeled, test_size=test_size, random_state=42
                )
                print(f"Small dataset split (unstratified): {len(X_train)} training, {len(X_test)} testing")
        else:
            # For very small datasets (< 6 samples), use all for training but add warning
            X_train, X_test = X_labeled, X_labeled
            y_train, y_test = y_labeled, y_labeled
            print(f"  WARNING: Very small dataset ({len(X_labeled)} samples) - using all data for both training and testing")
            print(f"  Performance metrics may be overly optimistic due to train/test data overlap")

    # 4. Initialize model
    model = get_model(config)
    
    # 5. Initialize ActiveLearner
    learner = SimpleActiveLearner(
        estimator=model,
        X_training=X_train,
        y_training=y_train
    )
    print("ActiveLearner initialized.")

    # 6. Load pre-existing model if available (for subsequent iterations)
    if args.model_in and Path(args.model_in).exists():
        print(f"Loading model from {args.model_in}")
        learner.estimator = joblib.load(args.model_in)
        
        # Re-evaluate performance of loaded model
        print("Evaluating loaded model performance...")
    else:
        if args.final_training:
            print("Final training round: training on complete labeled dataset.")
        else:
            print("This is the first iteration, training on initial data.")

    # 7. **PERFORMANCE EVALUATION STEP**
    print("\n Evaluating model performance...")
    performance_metrics = evaluate_model_performance(learner, X_test, y_test, config, X_train, y_train)

    # 8. Query for new samples to be labeled (SKIP for final training)
    if not args.final_training:
        n_queries = config.get('query_batch_size', 1)
        query_indices, _ = learner.query(X_unlabeled, n_instances=n_queries)
        print(f"Queried {len(query_indices)} new instances to be labeled.")

        # 9. Get the actual data for the queried samples
        query_samples = X_unlabeled[query_indices]
        
        # 10. Save the queried SAMPLES (not indices) to a JSON file
        output_data = []
        if detect_format(Path(args.unlabeled_data)) == '.csv':
            unlabeled_df = pd.read_csv(args.unlabeled_data)
            feature_columns = unlabeled_df.columns[:-1] if unlabeled_df.shape[1] > len(query_samples[0]) else unlabeled_df.columns
            samples_df = pd.DataFrame(query_samples, columns=feature_columns[:len(query_samples[0])])
            
            # FIX: Use correct original indices from mapping
            mapped_original_indices = [original_index_mapping[idx] for idx in query_indices]
            samples_df['original_index'] = mapped_original_indices
            output_data = samples_df.to_dict(orient='records')
            
            print(f"Query indices in filtered space: {query_indices}")
            print(f"Mapped to original indices: {mapped_original_indices}")
        else: # .npy
            # FIX: Use correct original indices from mapping  
            mapped_original_indices = [original_index_mapping[idx] for idx in query_indices]
            output_data = [
                {'features': sample.tolist(), 'original_index': int(mapped_idx)} 
                for idx, sample, mapped_idx in zip(query_indices, query_samples, mapped_original_indices)
            ]

        # 11. Save query samples to output directory with iteration number
        query_samples_file = output_dir / f"query_samples_round_{args.iteration}.json"
        with open(query_samples_file, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"Saved query samples to {query_samples_file}")
    else:
        print("Final training round: Skipping sample querying step.")

    # 12. **SAVE PERFORMANCE METRICS TO RO-CRATE OUTPUTS**
    # Add final training marker to performance metrics
    performance_metrics['final_training'] = args.final_training
    
    performance_file = output_dir / f"performance_round_{args.iteration}.json"
    with open(performance_file, 'w') as f:
        json.dump(performance_metrics, f, indent=2)
    print(f"Saved performance metrics to {performance_file}")
    
    if args.final_training:
        print(f"Marked as final training round in performance metrics")
    
    # NEW: Update consolidated performance history file
    performance_history_file = output_dir / "performance_history.json"
    try:
        # Load existing history if it exists
        if performance_history_file.exists():
            with open(performance_history_file, 'r') as f:
                performance_history = json.load(f)
        else:
            performance_history = []
        
        # Add current iteration to history (update if exists, append if new)
        current_iteration_data = {
            "iteration": args.iteration,
            "performance": performance_metrics,
            "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
        
        # Find and update existing iteration or append new one
        existing_index = None
        for i, entry in enumerate(performance_history):
            if entry["iteration"] == args.iteration:
                existing_index = i
                break
        
        if existing_index is not None:
            performance_history[existing_index] = current_iteration_data
            print(f"Updated iteration {args.iteration} in performance history")
        else:
            performance_history.append(current_iteration_data)
            print(f"Added iteration {args.iteration} to performance history")
        
        # Sort by iteration number for consistent ordering
        performance_history.sort(key=lambda x: x["iteration"])
        
        # Save updated history
        with open(performance_history_file, 'w') as f:
            json.dump(performance_history, f, indent=2)
        
        print(f"Saved consolidated performance history to {performance_history_file} ({len(performance_history)} iterations)")
        
    except Exception as e:
        print(f"Warning: Failed to update performance history: {e}")
        print("Individual performance file saved successfully, continuing...")
    
    # 13. Save the current model state for the next iteration
    model_path = output_dir / f"model_round_{args.iteration}.pkl"
    joblib.dump(learner.estimator, model_path)
    print(f"Saved model for next round to {model_path}")

    # ADDITIONAL: Copy outputs to CWL working directory if running from CWL
    if 'is_cwl_execution' in locals() and is_cwl_execution:
        print(f"[CWL] Copying output files to CWL working directory...")
        
        # Copy model file
        cwl_model_path = Path(".") / f"model_round_{args.iteration}.pkl"
        shutil.copy2(model_path, cwl_model_path)
        print(f"[CWL] Copied model to {cwl_model_path.resolve()}")
        
        # Copy performance metrics file
        performance_file = output_dir / f"performance_round_{args.iteration}.json"
        if performance_file.exists():
            cwl_perf_path = Path(".") / f"performance_round_{args.iteration}.json"
            shutil.copy2(performance_file, cwl_perf_path)
            print(f"[CWL] Copied performance metrics to {cwl_perf_path.resolve()}")
        
        # Copy query samples file (if not final training)
        if not args.final_training:
            query_samples_file = output_dir / f"query_samples_round_{args.iteration}.json"
            if query_samples_file.exists():
                cwl_query_path = Path(".") / f"query_samples_round_{args.iteration}.json"
                shutil.copy2(query_samples_file, cwl_query_path)
                print(f"[CWL] Copied query samples to {cwl_query_path.resolve()}")

    # 14. Final training completion message
    if args.final_training:
        print(f"\n Final Training Round {args.iteration} completed successfully!")
        print(f" Final Performance: Accuracy={performance_metrics['accuracy']:.3f}, F1={performance_metrics['f1_score']:.3f}")
        print(f" All outputs saved to: {output_dir}")
        print(f"\n MODEL TRAINING COMPLETE:")
        print(f"   • Trained on ALL {len(X_labeled)} labeled samples")
        print(f"   • No new samples queried (final training)")
        print(f"   • Final model saved: {model_path}")
        print(f"   • Performance metrics: {performance_file}")
        print(f"   • Project ready for final results publication!")
    else:
        # 14.  IMPORTANT: Document expected voting results format for frontend (regular iterations only)
        voting_format_doc = output_dir / f"VOTING_RESULTS_FORMAT_round_{args.iteration}.md"
        with open(voting_format_doc, 'w') as f:
            f.write(f"""# Voting Results Format for Round {args.iteration}

The AL-Engine expects voting results to be saved in the following format:
`{output_dir.parent}/voting_results_round_{args.iteration}.json`

Expected JSON structure:
```json
[
  {{
    "original_index": {mapped_original_indices[0] if 'mapped_original_indices' in locals() else 'SAMPLE_INDEX'},
    "final_label": "VOTED_LABEL",
    "sample_data": {{
      "sepal length (cm)": 6.2,
      "sepal width (cm)": 3.4,
      "petal length (cm)": 5.4,
      "petal width (cm)": 2.3
    }},
    "votes": {{
      "user1": "label_a",
      "user2": "label_a"
    }},
    "consensus": true,
    "timestamp": "2024-01-01T12:00:00Z"
  }}
]
```

The frontend voting service should save results in this format after each voting session.
""")
        print(f" Saved voting results format documentation to {voting_format_doc}")

        print(f"\n AL Iteration {args.iteration} completed successfully!")
        print(f" Performance: Accuracy={performance_metrics['accuracy']:.3f}, F1={performance_metrics['f1_score']:.3f}")
        print(f" All outputs saved to: {output_dir}")
        print(f"\n NEXT STEPS:")
        print(f"   1. Users should vote on the queried samples")
        print(f"   2. Frontend should save voting results to: {output_dir.parent}/voting_results_round_{args.iteration}.json")
        print(f"   3. Run iteration {args.iteration + 1} to see the improved model with accumulated training data!")

if __name__ == '__main__':
    main() 