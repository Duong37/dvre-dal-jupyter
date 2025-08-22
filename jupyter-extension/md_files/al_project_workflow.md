# Active Learning Project Workflow - Holistic View

## RO-Crate Structure

```
ro-crate-dal-project/
├── ro-crate-metadata.json
├── workflows/
│   └── al_iteration.cwl
├── inputs/
│   └── inputs.json
├── config/
│   └── config.json

```

## System Components Interaction

The workflow involves interaction between Smart Contract, Orchestrator, Client ALEngine, and Client Jupyter Extension.

### Client ALEngine (Coordinator Only)

**Responsibilities:**
- Listens to **Orchestrator** for workflow instructions about training and querying
- Listens to **Smart Contract** about newly labeled samples (e.g., label1 → positive)
- Trains model and queries samples using modAL and scikit-learn
- Stores model updates, datasets (training and labeling), and newly labeled samples for training

### Orchestrator

**Responsibilities:**
- Receives workflow file from DVRE Client Jupyter Extension
- Listens to Smart Contract about events regarding when to trigger the next AL round/iteration

### Smart Contract

**Responsibilities:**
- Listens to Client Jupyter Extension for actions:
  - Submit vote
  - Query sample
  - Train model
- Collects votes and aggregates them
- Determines label results
- Stores project information:
  - Users
  - ROCrate IPFS hash
  - Workflow ID
  - Project parameters:
    - AL scenario
    - Query strategy
    - Voting consensus
    - Label space (set of class labels)
    - Max iterations (can be infinite, meaning when coordinator stops or when samples run out)
- Emits events

### DAL Client Jupyter Extension

**Responsibilities:**
- **Listening Functions:**
  - Listens to Smart Contract about voting status
  - Listens to Smart Contract about voting results
  - Listens to Smart Contract about history of voting (all voted labels and their voting distribution, their chosen label)
  - Listens to Smart Contract about users
  - Displays received information using dashboards

- **UI Provision:**
  - Provides UI for conducting the project
  - **Coordinator capabilities:** voting, querying, training, dashboards
  - **Contributor capabilities:** voting, dashboards

- **Final Results:**
  - Allows user to upload final results with associated resources to IPFS

## CWL Workflow File

### al_iteration.cwl

```yaml
cwlVersion: v1.2
class: CommandLineTool
label: "Active Learning Iteration (Train + Query)"
doc: "One-step AL iteration using modAL and scikit-learn"

baseCommand: python3
arguments: [al_iteration.py]

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
      glob: model_out.pkl
  
  query_indices:
    type: File
    outputBinding:
      glob: query_indices.npy

requirements:
  DockerRequirement:
    dockerPull: python:3.9-slim
```

### CWL Workflow Execution

**Process:**
- Runs a Python script `al_iteration.py`
- **Inputs:**
  - Labeled data
  - Unlabeled data
  - Optional model file
  - Config file
- **Outputs:**
  - Updated model file
  - Selected query indices
- **Config file contains:** AL scenario, query strategy, model parameters

## Model Handling Logic

### Built-in Model Selection

If user chooses a built-in model from modAL, the following logic applies:

```python
if args.model_in:
    # Use provided trained model
    learner = joblib.load(args.model_in)
else:
    # Build model from config
    model_type = config["model_type"]
    training_args = config.get("training_args", {})
    
    if model_type == "LogisticRegression":
        model = LogisticRegression(**training_args)
    elif model_type == "SVC":
        model = SVC(**training_args)
    # ... additional model types
    
    learner = ActiveLearner(estimator=model, query_strategy=chosen_strategy)
```

**Model Flow:**
1. **First round:** Model is read from config file
2. **Subsequent rounds:** Model is fetched from the output pkl file

## Runtime Configuration

### CWL Input Mapping

The CWL file does not hardcode exact filenames or paths. Instead, these are provided at runtime via input objects.

**CWL Input Definition:**
```yaml
inputs:
  labeled_data:
    type: File
    inputBinding:
      position: 1
      prefix: --labeled_data
```

**Runtime Input Mapping (inputs.yml):**
```yaml
labeled_data:
  class: File
  path: /home/user/project/labeled.npy

model_in:
  class: File
  path: /home/user/models/model_round_2.pkl
```

This approach provides flexibility by defining placeholders in the CWL file while injecting actual file paths at runtime through the input mapping configuration.