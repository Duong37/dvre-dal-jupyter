import React from 'react';
import { DVREProjectConfiguration } from './services/ProjectConfigurationService';

interface ProjectInformationPanelProps {
  project: DVREProjectConfiguration;
}

const ProjectInformationPanel: React.FC<ProjectInformationPanelProps> = ({ project }) => {
  const truncateAddress = (address: string, startChars: number = 6, endChars: number = 4): string => {
    if (!address || address.length <= startChars + endChars) return address;
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  };

  const copyToClipboard = async (text: string, successMessage: string = 'Copied to clipboard!') => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        // You could add a toast notification here instead of alert
        console.log(successMessage);
      } else {
        // Fallback for older browsers
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

  return (
    <div className="config-section">
      <h4>Project Information</h4>
      <div className="project-info-grid">
        <div className="info-row">
          <div className="info-label">
            <strong>Contract Address:</strong>
          </div>
          <div className="info-value">
            <span 
              className="address-value" 
              title={project.contractAddress || 'Not available'}
              onClick={() => project.contractAddress && copyToClipboard(project.contractAddress, 'Contract address copied!')}
            >
              {project.contractAddress ? truncateAddress(project.contractAddress) : 'Not available'}
            </span>
            {project.contractAddress && (
              <button 
                className="copy-btn"
                onClick={() => project.contractAddress && copyToClipboard(project.contractAddress, 'Contract address copied!')}
                title="Copy full address"
              >
                
              </button>
            )}
          </div>
        </div>
        
        <div className="info-row">
          <div className="info-label">
            <strong>Owner:</strong>
          </div>
          <div className="info-value">
            <span 
              className="address-value"
              title={project.owner}
              onClick={() => copyToClipboard(project.owner, 'Owner address copied!')}
            >
              {truncateAddress(project.owner)}
            </span>
            <button 
              className="copy-btn"
              onClick={() => copyToClipboard(project.owner, 'Owner address copied!')}
              title="Copy full address"
            >
              
            </button>
          </div>
        </div>
        
        <div className="info-row">
          <div className="info-label">
            <strong>Project Type:</strong>
          </div>
          <div className="info-value">
            {getProjectTypeLabel(project)}
          </div>
        </div>
        
        <div className="info-row">
          <div className="info-label">
            <strong>Status:</strong>
          </div>
          <div className="info-value">
            <span 
              className="status-indicator"
              style={{ 
                backgroundColor: getStatusColor(project.status),
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {project.status.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div className="info-row">
          <div className="info-label">
            <strong>Created:</strong>
          </div>
          <div className="info-value">
            {new Date(project.created).toLocaleString()}
          </div>
        </div>
        
        <div className="info-row">
          <div className="info-label">
            <strong>Last Modified:</strong>
          </div>
          <div className="info-value">
            {new Date(project.lastModified).toLocaleString()}
          </div>
        </div>

        {/* IPFS Publication Status */}
        {project.ipfs && (
          <div className="info-row">
            <div className="info-label">
              <strong>IPFS Status:</strong>
            </div>
            <div className="info-value">
              <a 
                href={`https://ipfs.io/ipfs/${project.ipfs.roCrateHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ipfs-link"
              >
                Published on {new Date(project.ipfs.publishedAt || '').toLocaleDateString()}
              </a>
            </div>
          </div>
        )}

        {/* Deployment Status */}
        {project.deployment && (
          <div className="info-row">
            <div className="info-label">
              <strong>Deployment:</strong>
            </div>
            <div className="info-value">
              <span 
                className="deployment-status"
                style={{ 
                  color: getDeploymentStatusColor(project.deployment.status),
                  fontWeight: 'bold'
                }}
              >
                {project.deployment.status.toUpperCase()}
                {project.deployment.orchestrationWorkflowId && (
                  <span style={{ fontWeight: 'normal', marginLeft: '8px' }}>
                    (ID: {project.deployment.orchestrationWorkflowId.slice(0, 8)}...)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper functions
const getProjectTypeLabel = (project: DVREProjectConfiguration): string => {
  if (project.extensions?.dal) {
    return 'Active Learning';
  }
  if (project.extensions?.federated) {
    return 'Federated Learning';
  }
  return 'General Project';
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'deployed': return '#10b981'; // Green for deployed
    case 'not deployed': return '#f59e0b'; // Orange for not deployed
    default: return '#6b7280';
  }
};

const getDeploymentStatusColor = (status: string): string => {
  switch (status) {
    case 'pending': return '#f59e0b';
    case 'deploying': return '#3b82f6';
    case 'deployed': return '#10b981';
    case 'running': return '#8b5cf6';
    case 'failed': return '#ef4444';
    default: return '#6b7280';
  }
};

export default ProjectInformationPanel; 