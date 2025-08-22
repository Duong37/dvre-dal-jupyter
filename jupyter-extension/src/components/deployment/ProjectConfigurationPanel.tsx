import React, { useState, useEffect, useCallback } from 'react';
import { DVREProjectConfiguration, projectConfigurationService } from './services/ProjectConfigurationService';
import { useAuth } from '../../hooks/useAuth';
import { assetService, AssetInfo } from '../../utils/AssetService';

interface ProjectConfigurationPanelProps {
  projectId: string;
  projectConfig: DVREProjectConfiguration;
  onConfigurationChange?: (config: DVREProjectConfiguration) => void;
}

interface ActiveLearningConfig {
  queryStrategy: string;
  alScenario: string;
  maxIterations: number;
  queryBatchSize: number;
  votingConsensus: string;
  votingTimeout: number;
  trainingDataset: string;
  labelingDataset: string;
  model: string;
  labelSpace: string[];
}

interface Dataset {
  id: string;
  name: string;
  ipfsHash?: string;
  description?: string;
}

interface Model {
  id: string;
  name: string;
  type: string;
  ipfsHash?: string;
  description?: string;
}

const ProjectConfigurationPanel: React.FC<ProjectConfigurationPanelProps> = ({
  projectId,
  projectConfig,
  onConfigurationChange
}) => {
  const { account } = useAuth();
  
  // Check if project is deployed (read-only mode)
  const isDeployed = projectConfig.status === 'deployed';
  
  const [config, setConfig] = useState<ActiveLearningConfig>({
    queryStrategy: 'uncertainty_sampling',
    alScenario: 'pool_based',
    maxIterations: 5,
    queryBatchSize: 2,
    votingConsensus: 'simple_majority',
    votingTimeout: 300, // Default to 5 minutes
    trainingDataset: '',
    labelingDataset: '',
    model: 'logistic_regression',
    labelSpace: []
  });
  const [labelInput, setLabelInput] = useState('');
  const [isActivelearning, setIsActiveLearning] = useState(false);
  const [userAssets, setUserAssets] = useState<AssetInfo[]>([]);

  // Real datasets from user's blockchain assets (filtered for datasets only)
  const availableDatasets: Dataset[] = userAssets
    .filter(asset => asset.assetType === 'dataset')
    .map(asset => ({
      id: asset.address, // Use asset address as ID
      name: asset.name,
      description: `Dataset: ${asset.name}`,
      ipfsHash: asset.ipfsHash
    }));

  const availableModels: Model[] = [
    { id: 'logistic_regression', name: 'Logistic Regression', type: 'sklearn', description: 'Simple linear classifier' },
    { id: 'random_forest', name: 'Random Forest', type: 'sklearn', description: 'Ensemble tree-based classifier' },
    { id: 'svm', name: 'Support Vector Machine', type: 'sklearn', description: 'Support vector classifier' }
  ];

  // Detect if this is an Active Learning project
  const detectProjectType = useCallback(() => {
    const projectData = projectConfig.projectData;
    if (!projectData) return false;

    // Check explicit type markers
    if (projectData.templateType === 'active_learning' || 
        projectData.project_type === 'active_learning' || 
        projectData.type === 'active_learning') {
      return true;
    }

    // Check for AL indicators in text
    const indicators = [
      'active learning', 'al', 'dal', 'machine learning', 'annotation', 'labeling',
      'query strategy', 'uncertainty sampling', 'model training'
    ];
    
    const projectText = (
      (projectData.name || '') + ' ' + 
      (projectData.description || '') + ' ' +
      (projectData.objective || '')
    ).toLowerCase();
    
    return indicators.some(indicator => projectText.includes(indicator));
  }, [projectConfig.projectData]);

  // Load existing configuration
  useEffect(() => {
    setIsActiveLearning(detectProjectType());
    
    // Load existing DAL extension if available
    const dalConfig = projectConfig.extensions?.dal;
    if (dalConfig) {
      setConfig(prev => ({
        ...prev,
        queryStrategy: dalConfig.queryStrategy || prev.queryStrategy,
        alScenario: dalConfig.alScenario || prev.alScenario,
        maxIterations: dalConfig.maxIterations || prev.maxIterations,
        queryBatchSize: dalConfig.queryBatchSize || prev.queryBatchSize,
        votingConsensus: dalConfig.votingConsensus || prev.votingConsensus,
        votingTimeout: dalConfig.votingTimeout || prev.votingTimeout,
        model: typeof dalConfig.model === 'string' ? dalConfig.model : dalConfig.model?.type || prev.model
      }));
    }
  }, [projectConfig, detectProjectType]);

  // Load user's blockchain assets
  useEffect(() => {
    const loadUserAssets = async () => {
      try {
        const assets = await assetService.getAllAssets();
        setUserAssets(assets);
        console.log('Loaded user assets:', assets);
      } catch (error) {
        console.warn('Failed to load user assets:', error);
      }
    };

    loadUserAssets();
  }, []);

  // Helper function to format voting timeout
  const formatVotingTimeout = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}hr`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Save configuration to project
  const saveConfiguration = useCallback(async (newConfig: ActiveLearningConfig) => {
    if (!account || !isActivelearning) return;

    try {
      // Convert to DAL extension format
      const dalConfig = {
        queryStrategy: newConfig.queryStrategy,
        alScenario: newConfig.alScenario,
        model: {
          type: newConfig.model,
          parameters: getModelParameters(newConfig.model)
        },
        maxIterations: newConfig.maxIterations,
        queryBatchSize: newConfig.queryBatchSize,
        validation_split: 0.2,
        federated: false,
        contributors: [],
        votingConsensus: newConfig.votingConsensus,
        votingTimeout: newConfig.votingTimeout,
        trainingDataset: newConfig.trainingDataset,
        labelingDataset: newConfig.labelingDataset,
        labelSpace: newConfig.labelSpace
      };

      // Update project configuration
      await projectConfigurationService.updateExtensionConfiguration(
        projectId,
        'dal',
        dalConfig,
        account
      );

      // IMPORTANT: Add selected datasets to roCrate.datasets with IPFS hashes
      await updateProjectDatasets(newConfig);

      // Notify parent component
      const updatedConfig = projectConfigurationService.getProjectConfiguration(projectId);
      if (updatedConfig && onConfigurationChange) {
        onConfigurationChange(updatedConfig);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }, [account, isActivelearning, projectId, onConfigurationChange, userAssets]);

  // Update roCrate.datasets with selected datasets including IPFS hashes
  const updateProjectDatasets = async (newConfig: ActiveLearningConfig) => {
    if (!account) return;

    // Add training dataset if selected
    if (newConfig.trainingDataset) {
      const trainingAsset = userAssets.find(asset => asset.address === newConfig.trainingDataset);
      if (trainingAsset) {
        const trainingDataset = {
          name: trainingAsset.name,
          description: `Training dataset: ${trainingAsset.name}`,
          format: 'csv', // Default format, could be enhanced to detect from asset
          columns: [],
          size: 0,
          ipfsHash: trainingAsset.ipfsHash, // This is crucial for downloading!
          assetAddress: trainingAsset.address,
          type: 'training'
        };
        
        projectConfigurationService.addDataset(projectId, 'training-dataset', trainingDataset, account);
        console.log('Added training dataset to RO-Crate:', trainingAsset.name, 'IPFS:', trainingAsset.ipfsHash);
      }
    }

    // Add labeling dataset if selected
    if (newConfig.labelingDataset) {
      const labelingAsset = userAssets.find(asset => asset.address === newConfig.labelingDataset);
      if (labelingAsset) {
        const labelingDataset = {
          name: labelingAsset.name,
          description: `Labeling dataset: ${labelingAsset.name}`,
          format: 'csv', // Default format, could be enhanced to detect from asset
          columns: [],
          size: 0,
          ipfsHash: labelingAsset.ipfsHash, // This is crucial for downloading!
          assetAddress: labelingAsset.address,
          type: 'labeling'
        };
        
        projectConfigurationService.addDataset(projectId, 'labeling-dataset', labelingDataset, account);
        console.log('Added labeling dataset to RO-Crate:', labelingAsset.name, 'IPFS:', labelingAsset.ipfsHash);
      }
    }
  };

  const getModelParameters = (modelType: string) => {
    switch (modelType) {
      case 'logistic_regression':
        return { max_iter: 1000, random_state: 42 };
      case 'random_forest':
        return { n_estimators: 100, random_state: 42 };
      case 'svm':
        return { kernel: 'rbf', random_state: 42 };
      case 'neural_network':
        return { layers: [64, 32], learning_rate: 0.001, batch_size: 32 };
      default:
        return {};
    }
  };

  const handleConfigChange = (field: keyof ActiveLearningConfig, value: any) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    saveConfiguration(newConfig);
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !config.labelSpace.includes(labelInput.trim())) {
      const newLabelSpace = [...config.labelSpace, labelInput.trim()];
      handleConfigChange('labelSpace', newLabelSpace);
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    const newLabelSpace = config.labelSpace.filter(label => label !== labelToRemove);
    handleConfigChange('labelSpace', newLabelSpace);
  };

  if (!isActivelearning) {
    return (
      <div className="project-config-panel">
        <div className="config-message">
          <h3>Project Configuration</h3>
          <p>This project is not detected as an Active Learning project.</p>
          <p>Active Learning configuration is only available for Active Learning projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="project-config-panel">
      <div className="config-header">
        <h3>Active Learning Project Configuration</h3>
        {isDeployed ? (
          <div className="read-only-notice" style={{
            padding: '12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            marginTop: '8px'
          }}>
            <span className="read-only-badge" style={{
              display: 'inline-block',
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '4px',
              marginRight: '8px'
            }}>READ-ONLY</span>
            <p style={{ margin: '8px 0 0 0', color: '#856404', fontSize: '14px' }}>
              Project is deployed. Configuration cannot be modified.
            </p>
          </div>
        ) : (
          <p>Configure your Active Learning project parameters below.</p>
        )}
      </div>

      <div className="config-sections">
        {/* Core AL Configuration */}
        <div className="config-section">
          <h4>Core Active Learning Settings</h4>
          
          <div className="config-grid">
            <div className="config-field">
              <label htmlFor="query-strategy">Query Strategy</label>
              <select
                id="query-strategy"
                value={config.queryStrategy}
                onChange={(e) => handleConfigChange('queryStrategy', e.target.value)}
                disabled={isDeployed}
              >
                <option value="uncertainty_sampling">Uncertainty Sampling</option>
                <option value="query_by_committee">Query by Committee</option>
                <option value="expected_model_change">Expected Model Change</option>
                <option value="random_sampling">Random Sampling</option>
              </select>
              <small>Strategy for selecting samples to label</small>
            </div>

            <div className="config-field">
              <label htmlFor="al-scenario">AL Scenario</label>
              <select
                id="al-scenario"
                value={config.alScenario}
                onChange={(e) => handleConfigChange('alScenario', e.target.value)}
                disabled={isDeployed}
              >
                <option value="pool_based">Pool-based</option>
                <option value="stream_based">Stream-based</option>
              </select>
              <small>Active learning scenario type</small>
            </div>

            <div className="config-field">
              <label htmlFor="max-iterations">Max Iterations</label>
              <input
                id="max-iterations"
                type="number"
                min="0"
                max="100"
                value={config.maxIterations}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  handleConfigChange('maxIterations', isNaN(value) ? 0 : value);
                }}
                disabled={isDeployed}
              />
              <small>Maximum number of AL iterations (0 for infinite)</small>
            </div>

            <div className="config-field">
              <label htmlFor="query-batch-size">Query Batch Size</label>
              <input
                id="query-batch-size"
                type="number"
                min="0"
                max="1000"
                value={config.queryBatchSize}
                onChange={(e) => handleConfigChange('queryBatchSize', parseInt(e.target.value) || 2)}
                disabled={isDeployed}
              />
              <small>Number of samples to label per iteration</small>
            </div>

            <div className="config-field">
              <label htmlFor="voting-consensus">Voting Consensus</label>
              <select
                id="voting-consensus"
                value={config.votingConsensus}
                onChange={(e) => handleConfigChange('votingConsensus', e.target.value)}
                disabled={isDeployed}
              >
                <option value="simple_majority">Simple Majority</option>
              </select>
              <small>How to resolve labeling conflicts</small>
            </div>

            <div className="config-field">
              <label htmlFor="voting-timeout">Voting Timeout (seconds)</label>
              <div className="voting-timeout-container" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <input
                  id="voting-timeout"
                  type="number"
                  min="60"
                  max="86400"
                  value={config.votingTimeout}
                  onChange={(e) => handleConfigChange('votingTimeout', parseInt(e.target.value) || 300)}
                  disabled={isDeployed}
                  style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <div className="timeout-presets" style={{
                  display: 'flex',
                  gap: '4px',
                  flexWrap: 'wrap'
                }}>
                  <button 
                    type="button" 
                    onClick={() => handleConfigChange('votingTimeout', 300)}
                    disabled={isDeployed}
                    className={config.votingTimeout === 300 ? 'active' : ''}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      background: config.votingTimeout === 300 ? '#2196f3' : 'white',
                      color: config.votingTimeout === 300 ? 'white' : '#333',
                      fontSize: '12px',
                      cursor: isDeployed ? 'not-allowed' : 'pointer',
                      opacity: isDeployed ? 0.5 : 1
                    }}
                  >
                    5min
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleConfigChange('votingTimeout', 900)}
                    disabled={isDeployed}
                    className={config.votingTimeout === 900 ? 'active' : ''}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      background: config.votingTimeout === 900 ? '#2196f3' : 'white',
                      color: config.votingTimeout === 900 ? 'white' : '#333',
                      fontSize: '12px',
                      cursor: isDeployed ? 'not-allowed' : 'pointer',
                      opacity: isDeployed ? 0.5 : 1
                    }}
                  >
                    15min
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleConfigChange('votingTimeout', 3600)}
                    disabled={isDeployed}
                    className={config.votingTimeout === 3600 ? 'active' : ''}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      background: config.votingTimeout === 3600 ? '#2196f3' : 'white',
                      color: config.votingTimeout === 3600 ? 'white' : '#333',
                      fontSize: '12px',
                      cursor: isDeployed ? 'not-allowed' : 'pointer',
                      opacity: isDeployed ? 0.5 : 1
                    }}
                  >
                    1hr
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleConfigChange('votingTimeout', 86400)}
                    disabled={isDeployed}
                    className={config.votingTimeout === 86400 ? 'active' : ''}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      background: config.votingTimeout === 86400 ? '#2196f3' : 'white',
                      color: config.votingTimeout === 86400 ? 'white' : '#333',
                      fontSize: '12px',
                      cursor: isDeployed ? 'not-allowed' : 'pointer',
                      opacity: isDeployed ? 0.5 : 1
                    }}
                  >
                    24hr
                  </button>
                </div>
              </div>
              <small>Maximum time for annotators to reach consensus on a sample</small>
            </div>
          </div>
        </div>

        {/* Data Configuration */}
        <div className="config-section">
          <h4>Dataset Configuration</h4>
          
          <div className="config-grid">
            <div className="config-field">
              <label htmlFor="training-dataset">Training Dataset</label>
              <select
                id="training-dataset"
                value={config.trainingDataset}
                onChange={(e) => handleConfigChange('trainingDataset', e.target.value)}
                disabled={isDeployed}
              >
                <option value="">Select a dataset...</option>
                {availableDatasets.map(dataset => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <small>Dataset for training the model</small>
            </div>

            <div className="config-field">
              <label htmlFor="labeling-dataset">Labeling Dataset</label>
              <select
                id="labeling-dataset"
                value={config.labelingDataset}
                onChange={(e) => handleConfigChange('labelingDataset', e.target.value)}
                disabled={isDeployed}
              >
                <option value="">Select a dataset...</option>
                {availableDatasets.map(dataset => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              <small>Dataset for active learning labeling</small>
            </div>
          </div>
        </div>

        {/* Model Configuration */}
        <div className="config-section">
          <h4>Model Configuration</h4>
          
          <div className="config-field">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={config.model}
              onChange={(e) => handleConfigChange('model', e.target.value)}
              disabled={isDeployed}
            >
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.type})
                </option>
              ))}
            </select>
            <small>Machine learning model to use</small>
            
            {config.model && (
              <div className="model-info">
                <strong>Model Parameters:</strong>
                <pre>{JSON.stringify(getModelParameters(config.model), null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Label Space Configuration */}
        <div className="config-section">
          <h4>Label Space</h4>
          
          <div className="label-space-config">
            <div className="label-input-group">
              <input
                type="text"
                placeholder="Enter label name..."
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddLabel()}
                disabled={isDeployed}
              />
              <button 
                type="button" 
                onClick={handleAddLabel}
                disabled={isDeployed || !labelInput.trim() || config.labelSpace.includes(labelInput.trim())}
              >
                Add Label
              </button>
            </div>
            
            <div className="label-list">
              {config.labelSpace.length === 0 ? (
                <p className="no-labels">No labels defined yet. Add labels for your classification task.</p>
              ) : (
                <div className="label-tags">
                  {config.labelSpace.map((label, index) => (
                    <span key={index} className="label-tag">
                      {label}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLabel(label)}
                        className="remove-label"
                        disabled={isDeployed}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="config-section">
          <h4>Configuration Summary</h4>
          <div className="config-summary">
            <div className="summary-grid">
              <div><strong>Query Strategy:</strong> {config.queryStrategy.replace(/_/g, ' ')}</div>
              <div><strong>AL Scenario:</strong> {config.alScenario.replace(/_/g, ' ')}</div>
              <div><strong>Max Iterations:</strong> {config.maxIterations === 0 ? 'Infinite' : config.maxIterations}</div>
              <div><strong>Batch Size:</strong> {config.queryBatchSize}</div>
              <div><strong>Voting:</strong> {config.votingConsensus.replace(/_/g, ' ')}</div>
              <div><strong>Voting Timeout:</strong> {formatVotingTimeout(config.votingTimeout)}</div>
              <div><strong>Model:</strong> {availableModels.find(m => m.id === config.model)?.name || config.model}</div>
              <div><strong>Labels:</strong> {config.labelSpace.length} defined</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectConfigurationPanel; 