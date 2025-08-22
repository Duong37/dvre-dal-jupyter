import React, { useState } from 'react';
import { DVREProjectConfiguration } from './services/ProjectConfigurationService';

interface WorkflowsPanelProps {
  project: DVREProjectConfiguration;
}

const WorkflowsPanel: React.FC<WorkflowsPanelProps> = ({ project }) => {
  const [showCWLContent, setShowCWLContent] = useState(false);
  const [showConfigContent, setShowConfigContent] = useState(false);

  // Check if this is an Active Learning project
  const isActivelearning = () => {
    return project.extensions?.dal !== undefined;
  };

  // Predefined CWL workflow for Active Learning projects
  const getALWorkflowCWL = () => {
    return `cwlVersion: v1.2
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
    doc: "Training dataset with labels"
  
  labeled_labels:
    type: File
    inputBinding:
      prefix: --labeled_labels
    doc: "Labels corresponding to training data"
  
  unlabeled_data:
    type: File
    inputBinding:
      prefix: --unlabeled_data
    doc: "Unlabeled dataset for active learning queries"
  
  model_in:
    type: File?
    inputBinding:
      prefix: --model_in
    doc: "Pre-trained model file (optional for first iteration)"
  
  config:
    type: File
    inputBinding:
      prefix: --config
    doc: "Configuration file with AL parameters"

outputs:
  model_out:
    type: File
    outputBinding:
      glob: model_out.pkl
    doc: "Updated model after training"
  
  query_indices:
    type: File
    outputBinding:
      glob: query_indices.npy
    doc: "Indices of samples selected for labeling"

requirements:
  DockerRequirement:
    dockerPull: python:3.9-slim`;
  };

  // Get workflow description based on project configuration
  const getWorkflowDescription = () => {
    const dalConfig = project.extensions?.dal;
    if (!dalConfig) return "No Active Learning configuration found.";

    return `Preconfigured Active Learning workflow with parameters defined in the configuration panel.`;
  };

  // Generate config.json content based on project's DAL configuration
  const getConfigJSON = () => {
    const dalConfig = project.extensions?.dal;
    if (!dalConfig) return "{}";

    const config = {
      query_strategy: dalConfig.queryStrategy || 'uncertainty_sampling',
      AL_scenario: dalConfig.AL_scenario || 'pool_based',
      model_type: dalConfig.model?.type || 'LogisticRegression',
      max_iterations: dalConfig.max_iterations || 10,
      query_batch_size: dalConfig.labeling_budget || 2,
      training_dataset: dalConfig.training_dataset || 'dataset1',
      labeling_dataset: dalConfig.labeling_dataset || 'dataset3',
      label_space: dalConfig.label_space || []
    };

    return JSON.stringify(config, null, 2);
  };

  const copyToClipboard = async (text: string, successMessage: string = 'Copied to clipboard!') => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        console.log(successMessage);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log(successMessage);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (!isActivelearning()) {
    return (
      <div className="config-section">
        <h4>Workflows</h4>
        <div className="workflow-message">
          <p>Workflow configuration is only available for Active Learning projects.</p>
          <p>This project type does not have predefined workflows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="config-section">
      <h4>Workflows</h4>
      
      <div className="workflow-info">
        <div className="workflow-summary">
          <div className="workflow-header">
            <h5> Active Learning Iteration Workflow</h5>
            <span className="workflow-badge">Predefined</span>
          </div>
          
          <p className="workflow-description">
            {getWorkflowDescription()}
          </p>
          
          <div className="workflow-details">
            <div className="detail-item">
              <strong>Workflow File:</strong> <code>al_iteration.cwl</code>
            </div>
            <div className="detail-item">
              <strong>Type:</strong> CWL CommandLineTool
            </div>
            <div className="detail-item">
              <strong>Base Command:</strong> <code>python3 al_iteration.py</code>
            </div>
            <div className="detail-item">
              <strong>Docker Image:</strong> <code>python:3.9-slim</code>
            </div>
          </div>
        </div>

        <div className="workflow-inputs-outputs">
          <div className="workflow-section">
            <h6>Inputs</h6>
            <ul className="io-list">
              <li><code>labeled_data</code> - Training dataset with labels</li>
              <li><code>labeled_labels</code> - Labels corresponding to training data</li>
              <li><code>unlabeled_data</code> - Unlabeled dataset for queries</li>
              <li><code>model_in</code> - Pre-trained model (optional)</li>
              <li><code>config</code> - AL configuration parameters</li>
            </ul>
          </div>

          <div className="workflow-section">
            <h6> Outputs</h6>
            <ul className="io-list">
              <li><code>model_out.pkl</code> - Updated trained model</li>
              <li><code>query_indices.npy</code> - Selected sample indices for labeling</li>
            </ul>
          </div>
        </div>

        <div className="workflow-actions">
          <button
            className="toggle-cwl-button"
            onClick={() => setShowCWLContent(!showCWLContent)}
          >
            {showCWLContent ? 'Hide' : 'Show'} CWL Content
          </button>
          
          <button
            className="toggle-config-button"
            onClick={() => setShowConfigContent(!showConfigContent)}
          >
            {showConfigContent ? 'Hide' : 'Show'} Config
          </button>
          
          <button
            className="copy-cwl-button"
            onClick={() => copyToClipboard(getALWorkflowCWL(), 'CWL workflow copied to clipboard!')}
          >
             Copy CWL
          </button>
          
          <button
            className="copy-config-button"
            onClick={() => copyToClipboard(getConfigJSON(), 'Config JSON copied to clipboard!')}
          >
             Copy Config
          </button>
        </div>

        {showCWLContent && (
          <div className="cwl-content">
            <div className="cwl-header">
              <h6>CWL Workflow Definition</h6>
              <small>This workflow is automatically configured for your Active Learning project</small>
            </div>
            <pre className="cwl-code">
              {getALWorkflowCWL()}
            </pre>
          </div>
        )}

        {showConfigContent && (
          <div className="config-content">
            <div className="config-header">
              <h6>Configuration (config.json)</h6>
              <small>This configuration is automatically generated for your Active Learning project</small>
            </div>
            <pre className="config-code">
              {getConfigJSON()}
            </pre>
          </div>
        )}

        <div className="workflow-runtime">
          <h6> Runtime Configuration</h6>
          <p>
            The workflow will be executed with runtime input mapping based on your project's 
            datasets and model configuration. File paths are injected at deployment time.
          </p>
          
          <div className="runtime-example">
            <details>
              <summary>Example Runtime Input Mapping (inputs.yml)</summary>
              <pre className="runtime-code">
{`labeled_data:
  class: File
  path: /project/datasets/labeled_samples.csv

labeled_labels:
  class: File
  path: /project/datasets/labeled_labels.csv

unlabeled_data:
  class: File
  path: /project/datasets/unlabeled_samples.csv

config:
  class: File
  path: /project/config.json`}
              </pre>
            </details>
          </div>
        </div>

        <div className="workflow-note">
          <p>
            <strong>Note:</strong> This workflow is preconfigured and optimized for Active Learning projects. 
            It integrates with modAL and scikit-learn to provide a complete AL iteration cycle including 
            model training and query selection.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsPanel; 