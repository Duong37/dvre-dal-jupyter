# Project Deployment: Computation Mode and Data Handling

When deploying a new project using the DVRE Jupyter Extension, the user (Coordinator) must select how Active Learning computations will be executed and how project data is managed.

This document outlines the available computation modes and the expected handling of configuration, workflow, and dataset files.

---

##  Computation Mode Options

### 1. **Local (Own Device)**

- **Description**: Computation is performed locally on the Coordinator's device.
- **When to Use**: Suitable for prototyping, small-scale projects, or users with sufficient compute resources.
- **How It Works**:
  - CWL workflows are executed via a local `al-engine` instance (Dockerized or native).
  - No orchestration or remote delegation is required.

### 2. **Infra Sharing (Remote Node)**

- **Description**: Computation is delegated to a remote node via the Orchestrator.
- **When to Use**: Best for larger-scale projects or when the Coordinator lacks computational resources.
- **How It Works**:
  - CWL workflows and input files are sent to the Orchestrator server.
  - Execution is assigned to a remote compute node.
  - Results are returned and processed locally.

---

##  What Happens on Project Deployment

When the user clicks **Deploy** in the DVRE Jupyter Extension:

- The following files are saved **locally** on the client:
  - `al_iteration.cwl` (CWL workflow)
  - `project_config.json` (project and AL configuration)
  - `voting_config.json` (voting rules and consensus thresholds)
  - `model_info.json` (optional initial model metadata)
  - Initial AL inputs (e.g., empty labeled sets, unlabeled dataset split)
- The files are placed in a **standard project folder** inside the Jupyter environment (e.g., `~/dvre-projects/<project-name>/`).

---

##  Dataset and Model Upload (Precondition)

To ensure reproducibility and auditing, the user **must upload datasets (and optionally model files) to IPFS** **before** configuring and deploying the project.

This includes:
- Training data
- Unlabeled pool
- Pre-trained models (if available)

Upon uploading, **IPFS hashes (CIDs)** are recorded in the smart contract or project metadata.

---

##  Why Download Datasets from IPFS?

Although the user could technically select files from local storage, DVRE enforces re-downloading from IPFS for the following reasons:

- **Transparency**: All participants can verify the dataset content via its CID.
- **Reproducibility**: Ensures that all runs operate on identical data versions.
- **User Experience**: Avoids issues with manual file path selection in Jupyter, which can be error-prone.
- **Standardization**: Keeps all datasets in a predictable project folder structure.

The downloaded datasets are stored in the project's local folder, e.g.:

