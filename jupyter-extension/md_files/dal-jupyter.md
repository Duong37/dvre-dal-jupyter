# DAL Jupyter Extension Design Holistic View

1. **Landing Page:**
    - shows user’s projects - both those that they own as a coordinator, those that they joined as a contributor (fetched from ProjectFactory)
    - contains basic metadata about the projects (fetched from project’s main smart contract Project)
    - user is able to select a project, then a project page loads
2. **Project Page -** once selected, it shows several features and panels:
    - a panel called **Project Configuration**:
        - shows configuration of the project such as: AL scenario, query strategy, model, query batch size, max iteration rounds, voting consensus, voting timeout
    - a panel called **Control Panel (visible to Coordinator only):**
        - button ‘**Start next iteration’**, which essentially triggers a new AL round. This sends a signal to the smart contract that a new round has been triggered by the coordinator. (Note: The smart contract then emits an event that lets the orchestrator know. The orchestrator (streamflow) then sends a cwl workflow and instructions to the AL-Engine on the client side which uses cwltool to execute.)
        - button ‘**End project**’, which the coordinator can use to manually end the project. This would trigger the smart contract to deactivate the project.
    - a panel called **Labeling:**
        - shows the current sample to be labeled (e.g in json format or string, or image)
        - shows label set, user can select a label and press Submit Vote
        - Show AL iteration round number
        - Show live voting distribution for the current sample
    - a panel called **Model Updates (visible to Coordinator only):**
        - Show a list of a history of all model updates - performance statistics (latest on top)
    - a panel called **User Dashboard**:
        - shows a list of all users, their roles, their contribution - number of votes so far
    - a panel called **Voting History**:
        - shows a list of all samples, can be expanded to see their statistics: voter addresses, votes cast, final label, voting distribution (e.g 3 votes for label1, 2 votes for label2).
    - the project ends by 3 options:
        - the coordinator presses End Project
        - max iteration gets reached
        - unlabeled samples run out
    - After the project ends, the Coordinator is prompted via a pop-up window in the Jupyter extension to **save the final results** to **IPFS**.
    - The AL-Engine stores all local output — including the datasets, final model, model updates — in a shared volume accessible to both containers. The Jupyter extension reads this data directly from the shared output folder, assembles the `ro-crate-final-results/` directory, and uploads it to IPFS. Once uploaded, it stores the resulting CID onto the Project smart contract. Below is a representation of the final RO-Crate:
        
        ```solidity
        ro-crate-final-results/
        │
        ├── ro-crate-metadata.jsonld          # RO-Crate metadata file (main descriptor)
        │
        ├── config/
        │   ├── project_config.json           # AL settings: scenario, strategy, batch size, etc.
        │   ├── voting_config.json            # Voting consensus method, timeout, thresholds
        │   └── model_info.json               # Info about model used (e.g., sklearn-Logistic Regression)
        │
        ├── data/
        │   ├── final_model.pkl               # Final trained model
        │   ├── final_labeled_data.json       # Final labeled dataset
        │   └── datasets_ipfs_hash.txt        # IPFS hashes of used datasets for training and labeling
        │
        ├── results/
        │   ├── voting_history.json           # All voting rounds: per sample breakdown
        │   └── audit_trail.json              # Detailed timeline of each AL iteration (model update, queried sample, votes, final label)
        │
        └── provenance/
            ├── cwl_workflow.cwl              # Final CWL file executed (or reference to it)
            └── project_manifest.json         # Project metadata (title, creator, timestamps, etc.)
        
        ```
        
        ### 1. **Project Metadata - project**
        
        - Project title, description, type (e.g., ACTIVE_LEARNING)
        - Timestamps: createdAt, startTime, endTime
        - Project creator address
        - Final status (`completed` / `terminated`)
        - Original `rocrateHash` CID (from start of project)
        
        ### 2. **Project Configuration**
        
        - AL scenario, query strategy
        - Model architecture/identifier (name or hash)
        - Query batch size
        - Max iterations
        - Voting parameters (consensus method, timeout)
        
        ### 3. **Final Model (optional but ideal)**
        
        - Trained model artifact (e.g., `.pkl`, `.onnx`)
        
        ### 4. **Final Labeled Dataset**
        
        - CSV format containing:
            - Final labels of various samples
        
        ### 5. **Voting History**
        
        - For each labeled sample:
            - Voter addresses
            - Votes cast (label)
            - Final consensus label
            - Distribution (e.g., `{"label1": 3, "label2": 2}`)
        
        ### 6. **User Contributions**
        
        - Table or JSON of:
            - User address
            - Role
            - Number of votes cast
        
        ### 7. **Audit Trail (good for reproducibility)**
        
        - Log of each AL iteration:
            - Queried samples
            - Labels selected
            - Model performance