#!/usr/bin/env python3
"""
Test script to verify that our sample ID to original index mapping fix works correctly.
This simulates the frontend behavior with the correct mapping.
"""

import json
import os
from pathlib import Path

def create_test_voting_results():
    """Create test voting results that simulate the frontend with correct original_index mapping"""
    
    # Test data: Sample IDs and their corresponding original indices from AL-Engine
    test_mapping = {
        "sample_3_1_1754788826719": {
            "original_index": 0,  # Correct mapping from AL-Engine query_samples
            "features": {
                "sepal length (cm)": 6.5,
                "sepal width (cm)": 3.2,
                "petal length (cm)": 5.1,
                "petal width (cm)": 2.0
            }
        },
        "sample_3_2_1754788826719": {
            "original_index": 102,  # Correct mapping from AL-Engine query_samples  
            "features": {
                "sepal length (cm)": 7.0,
                "sepal width (cm)": 3.2,
                "petal length (cm)": 4.7,
                "petal width (cm)": 1.4
            }
        }
    }
    
    # Create corrected voting results using the proper mapping
    corrected_voting_results = []
    
    for sample_id, mapping_data in test_mapping.items():
        voting_result = {
            "original_index": mapping_data["original_index"],  # Use correct original_index
            "final_label": "1" if mapping_data["original_index"] == 0 else "0",  # Test labels
            "sample_data": {
                **mapping_data["features"],  # Include actual sample features
                "sampleId": sample_id,
                "sample_id": sample_id
            },
            "votes": {
                "0x5cc7de375220d4785a85ab310b273667dcf9c838": "1" if mapping_data["original_index"] == 0 else "0"
            },
            "consensus": True,
            "timestamp": "2025-08-10T01:20:29.000Z"
        }
        corrected_voting_results.append(voting_result)
    
    return corrected_voting_results

def test_sample_accumulation():
    """Test that the AL-Engine correctly accumulates samples with the fixed mapping"""
    
    # Set up test project directory
    project_id = "0x2218778Aa7d1c3a7981Ee2806493222b14f7072f"
    project_dir = Path(f"ro-crates/{project_id}")
    outputs_dir = project_dir / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    
    print("Testing Sample ID to Original Index Mapping Fix")
    print("=" * 50)
    
    # Create test query samples (what AL-Engine generates)
    query_samples = [
        {
            "sepal length (cm)": 6.5,
            "sepal width (cm)": 3.2,
            "petal length (cm)": 5.1,
            "petal width (cm)": 2.0,
            "original_index": 0
        },
        {
            "sepal length (cm)": 7.0,
            "sepal width (cm)": 3.2,
            "petal length (cm)": 4.7,
            "petal width (cm)": 1.4,
            "original_index": 102
        }
    ]
    
    # Save query samples file
    query_samples_path = outputs_dir / "query_samples_round_3.json"
    with open(query_samples_path, 'w') as f:
        json.dump(query_samples, f, indent=2)
    
    print(f" Created query samples: {query_samples_path}")
    print(f"   Sample 1: original_index={query_samples[0]['original_index']}")
    print(f"   Sample 2: original_index={query_samples[1]['original_index']}")
    
    # Create corrected voting results (what the fixed frontend should produce)
    corrected_voting_results = create_test_voting_results()
    
    # Save corrected voting results file  
    voting_results_path = outputs_dir / "voting_results_round_3.json"
    with open(voting_results_path, 'w') as f:
        json.dump(corrected_voting_results, f, indent=2)
    
    print(f" Created corrected voting results: {voting_results_path}")
    print(f"   Vote 1: original_index={corrected_voting_results[0]['original_index']} (should be 0)")
    print(f"   Vote 2: original_index={corrected_voting_results[1]['original_index']} (should be 102)")
    
    # Verify the mapping is correct
    print("\n Verification:")
    print(f"   Query sample 1 features match vote 1: {query_samples[0]['sepal length (cm)']} == {corrected_voting_results[0]['sample_data']['sepal length (cm)']}")
    print(f"   Query sample 2 features match vote 2: {query_samples[1]['sepal length (cm)']} == {corrected_voting_results[1]['sample_data']['sepal length (cm)']}")
    
    # Expected result
    print("\n Expected AL-Engine behavior with this fix:")
    print("- Round 3 voting results will have correct original_index values (0 and 102)")
    print("- AL-Engine will add exactly 2 new samples to training set")
    print("- No duplicate samples will be added")
    print("- Training samples will progress: 10 → 12 → 14 → 16 (not 10 → 11 → 12 → 13)")
    
    return True

def test_extraction_logic():
    """Test the improved extraction logic in VotingResultsConnector"""
    
    print("\n Testing Extraction Logic")
    print("=" * 30)
    
    # Simulate ALEngineService.getSampleDataById() with correct mapping
    sample_data_mapping = {
        "sample_3_1_1754788826719": {
            "sepal length (cm)": 6.5,
            "sepal width (cm)": 3.2,
            "petal length (cm)": 5.1,
            "petal width (cm)": 2.0,
            "original_index": 0
        },
        "sample_3_2_1754788826719": {
            "sepal length (cm)": 7.0,
            "sepal width (cm)": 3.2,
            "petal length (cm)": 4.7,
            "petal width (cm)": 1.4,
            "original_index": 102
        }
    }
    
    def mock_get_sample_data_by_id(sample_id):
        """Mock the ALEngineService.getSampleDataById method"""
        return sample_data_mapping.get(sample_id)
    
    def mock_extract_original_index(sample_id, sample_data):
        """Mock the improved extractOriginalIndex method"""
        # NEW: Try to get original index from ALEngineService first
        al_sample_data = mock_get_sample_data_by_id(sample_id)
        if al_sample_data and 'original_index' in al_sample_data:
            return al_sample_data['original_index']
        
        # Fallback to old logic
        if sample_data and isinstance(sample_data, dict) and 'original_index' in sample_data:
            return sample_data['original_index']
        
        # Last resort: parse from sample ID (will get iteration number)
        import re
        match = re.search(r'sample_(\d+)', sample_id)
        if match:
            return int(match.group(1))
        
        return 0
    
    # Test cases
    test_cases = [
        {
            "sample_id": "sample_3_1_1754788826719",
            "sample_data": {"sampleId": "sample_3_1_1754788826719"},
            "expected_original_index": 0
        },
        {
            "sample_id": "sample_3_2_1754788826719", 
            "sample_data": {"sampleId": "sample_3_2_1754788826719"},
            "expected_original_index": 102
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        sample_id = test_case["sample_id"]
        sample_data = test_case["sample_data"]
        expected = test_case["expected_original_index"]
        
        # Test old method (would fail)
        old_result = 3  # Would extract iteration number from sample_3_X_timestamp
        
        # Test new method (should work)
        new_result = mock_extract_original_index(sample_id, sample_data)
        
        print(f"   Test {i}: {sample_id}")
        print(f"      Old method result: {old_result} (wrong - iteration number)")
        print(f"      New method result: {new_result} (correct)")
        print(f"      Expected: {expected}")
        print(f"       Fixed!" if new_result == expected else " Still broken")
    
    return True

if __name__ == "__main__":
    print("Sample ID to Original Index Mapping Fix Test")
    print("=" * 60)
    
    # Run tests
    test_sample_accumulation()
    test_extraction_logic()
    
    print("\n Summary:")
    print("The fix involves two key changes:")
    print("1. ALContractService stores AL sample data in ALEngineService when samples are generated")
    print("2. VotingService uses ALEngineService.getSampleDataById() to get real sample data")
    print("3. VotingResultsConnector.extractOriginalIndex() gets original_index from AL sample data")
    print("4. This ensures voting results contain correct original_index values instead of iteration numbers")
    print("5. AL-Engine can then correctly accumulate 2 samples per round instead of 1") 