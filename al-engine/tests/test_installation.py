#!/usr/bin/env python3
"""
AL-Engine Installation and Basic Functionality Test (Fixed Version)

Tests the fixed AL-Engine implementation without legacy components.
"""

import os
import sys
import json
import tempfile
import subprocess
from pathlib import Path

# Add the src directory to Python path
current_dir = Path(__file__).parent
src_dir = current_dir.parent / "src"
sys.path.insert(0, str(src_dir))

def test_imports():
    """Test that all required packages can be imported"""
    print("Testing package imports...")
    
    required_packages = [
        "numpy", "pandas", "sklearn", "modAL", 
        "flask", "pathlib", "subprocess", "yaml"
    ]
    
    failed_imports = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✓ {package}")
        except ImportError as e:
            print(f"  ✗ {package}: {e}")
            failed_imports.append(package)
    
    if failed_imports:
        print(f"\n Failed to import: {failed_imports}")
        return False
    else:
        print("All required packages imported successfully")
        return True

def test_al_iteration_script():
    """Test the core al_iteration.py script"""
    print("\nTesting al_iteration.py script...")
    
    try:
        # Check if al_iteration.py exists
        al_script = src_dir / "al_iteration.py"
        if not al_script.exists():
            print(f"  ✗ al_iteration.py not found at {al_script}")
            return False
        
        # Test help command
        result = subprocess.run([
            sys.executable, str(al_script), "--help"
        ], capture_output=True, text=True, cwd=src_dir)
        
        if result.returncode == 0:
            print("✓ al_iteration.py help command works")
            
            # Check for required arguments
            help_text = result.stdout
            required_args = ["--labeled_data", "--unlabeled_data", "--config", "--iteration"]
            missing_args = [arg for arg in required_args if arg not in help_text]
            
            if missing_args:
                print(f"  ✗ Missing required arguments: {missing_args}")
                return False
            else:
                print("✓ All required arguments present")
                return True
        else:
            print(f"  ✗ al_iteration.py help failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"  ✗ al_iteration.py test failed: {e}")
        return False

def test_server_import():
    """Test ALEngineServer import"""
    print("\nTesting ALEngineServer import...")
    
    try:
        from server import ALEngineServer
        print("✓ ALEngineServer import successful")
        
        # Test basic instantiation (without starting server)
        server = ALEngineServer(port=5051)  # Use different port to avoid conflicts
        print("✓ ALEngineServer instantiation successful")
        
        return True
        
    except Exception as e:
        print(f"  ✗ ALEngineServer test failed: {e}")
        return False

def test_main_script():
    """Test the main.py script"""
    print("\nTesting main.py script...")
    
    try:
        main_script = src_dir / "main.py"
        if not main_script.exists():
            print(f"  ✗ main.py not found at {main_script}")
            return False
        
        # Test help command
        result = subprocess.run([
            sys.executable, str(main_script), "--help"
        ], capture_output=True, text=True, cwd=src_dir)
        
        if result.returncode == 0:
            print("✓ main.py help command works")
            
            # Check that legacy options are removed
            help_text = result.stdout
            if "--service" in help_text:
                print("Warning: Legacy --service option still present")
            
            required_options = ["--server", "--iteration", "--workflow"]
            missing_options = [opt for opt in required_options if opt not in help_text]
            
            if missing_options:
                print(f"  ✗ Missing options: {missing_options}")
                return False
            else:
                print("✓ All required options present")
                return True
        else:
            print(f"  ✗ main.py help failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"  ✗ main.py test failed: {e}")
        return False

def test_config_creation():
    """Test creating a basic AL configuration"""
    print("\nTesting AL configuration creation...")
    
    try:
        config = {
            "query_batch_size": 2,
            "max_iterations": 5,
            "model_type": "RandomForestClassifier",
            "training_args": {"n_estimators": 10, "random_state": 42},
            "label_space": ["0", "1", "2"]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config, f, indent=2)
            config_path = f.name
        
        # Verify config can be loaded
        with open(config_path, 'r') as f:
            loaded_config = json.load(f)
        
        os.unlink(config_path)
        
        if loaded_config == config:
            print("✓ Configuration creation and loading successful")
            return True
        else:
            print("✗ Configuration mismatch")
            return False
            
    except Exception as e:
        print(f"  ✗ Configuration test failed: {e}")
        return False

def run_all_tests():
    """Run all tests and return overall result"""
    print("AL-Engine Fixed Installation Test")
    print("=" * 50)
    
    tests = [
        ("Package Imports", test_imports),
        ("AL Iteration Script", test_al_iteration_script),
        ("Server Import", test_server_import),
        ("Main Script", test_main_script),
        ("Config Creation", test_config_creation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f" {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Results Summary:")
    
    passed = 0
    for test_name, success in results:
        status = " PASS" if success else " FAIL"
        print(f"  {status}: {test_name}")
        if success:
            passed += 1
    
    total = len(results)
    print(f"\n Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("ALL TESTS PASSED! AL-Engine is properly installed.")
        return True
    else:
        print("Some tests failed. Please check the installation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 