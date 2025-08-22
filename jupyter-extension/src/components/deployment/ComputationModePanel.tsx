/**
 * Computation Mode Panel - Handles computation mode selection
 * Based on comp_mode.md requirements
 */

import React, { useState, useEffect } from 'react';
import { DVREProjectConfiguration } from './services/ProjectConfigurationService';

interface ComputationModePanelProps {
  project: DVREProjectConfiguration;
  computationMode?: 'local' | 'remote';
  onModeChange?: (mode: 'local' | 'remote') => void;
}

export const ComputationModePanel: React.FC<ComputationModePanelProps> = ({
  project,
  computationMode,
  onModeChange
}) => {
  const [selectedMode, setSelectedMode] = useState<'local' | 'remote'>(computationMode || 'local');
  const [localProjectPath, setLocalProjectPath] = useState<string>('');

  useEffect(() => {
    // Update selectedMode when computationMode prop changes
    if (computationMode) {
      setSelectedMode(computationMode);
    }
  }, [computationMode]);

  useEffect(() => {
    // Generate local project path
    const projectName = project.projectData?.name || project.projectId;
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
    setLocalProjectPath(`~al-engine/ro-crates/${sanitizedName}/`);
  }, [project]);

  const handleModeChange = (mode: 'local' | 'remote') => {
    setSelectedMode(mode);
    onModeChange?.(mode);
  };

  return (
    <div className="config-section">
      <h4>Computation Mode</h4>
      <div className="computation-mode-panel">
        
        {/* Mode Selection */}
        <div className="mode-selection">
          <div className="mode-option">
            <label className="mode-label">
              <input
                type="radio"
                name="computation-mode"
                value="local"
                checked={selectedMode === 'local'}
                onChange={() => handleModeChange('local')}
              />
              <div className="mode-content">
                <strong> Local (Own Device)</strong>
                <p>Computation performed locally on your device. Suitable for prototyping and small-scale projects.</p>
                <ul>
                  <li>CWL workflows executed via local al-engine</li>
                  <li>All files automatically downloaded during deployment</li>
                  <li>No remote orchestration required</li>
                </ul>
              </div>
            </label>
          </div>
          
          <div className="mode-option disabled">
            <label className="mode-label">
              <input
                type="radio"
                name="computation-mode"
                value="remote"
                checked={selectedMode === 'remote'}
                onChange={() => handleModeChange('remote')}
                disabled
              />
              <div className="mode-content">
                <strong>Infra Sharing (Remote Node)</strong>
                <p>Computation delegated to remote nodes via Orchestrator. <em>(Coming Soon)</em></p>
                <ul>
                  <li>Workflows sent to Orchestrator server</li>
                  <li>Execution on remote compute nodes</li>
                  <li>Results processed remotely</li>
                </ul>
              </div>
            </label>
          </div>
        </div>

        {/* Local Mode Configuration */}
        {selectedMode === 'local' && (
          <div className="local-mode-config">
            <div className="local-info">
              <h5> Local Project Setup</h5>
              <p><strong>Project Folder:</strong> <code>{localProjectPath}</code></p>
              <p>When you deploy this project, all necessary files will be automatically downloaded from IPFS to ensure standardization and reproducibility.</p>
            </div>

            <div className="download-section">
              <h5>Automatic File Download</h5>
              <p>During deployment, the system will automatically download:</p>
              <ul> 
                <li><strong>RO-Crate:</strong> ro-crate-metadata.json</li>
                <li><strong>CWL Workflow:</strong> al_iteration.cwl</li>
                <li><strong>Configuration:</strong> project_config.json</li>
                <li><strong>Datasets:</strong> All project datasets from IPFS</li>
                <li><strong>Model:</strong> Model files and metadata (if available)</li>
              </ul>
              <p><em>No manual action required - files will be ready for local execution after deployment.</em></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComputationModePanel; 