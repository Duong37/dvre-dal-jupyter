import React, { useState, useEffect } from 'react';
import { ConfigurationPanelProps } from './PanelTypes';
import { ALContractService } from '../services/ALContractService';

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  project,
  onRefresh
}) => {
  const [alConfiguration, setAlConfiguration] = useState(project.alConfiguration || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alContractService = ALContractService.getInstance();

  // Fetch real AL configuration from smart contracts
  useEffect(() => {
    if (project?.contractAddress) {
      fetchALConfiguration();
    }
  }, [project?.contractAddress]);

  const fetchALConfiguration = async () => {
    if (!project?.contractAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching AL configuration from blockchain for project:', project.contractAddress);
      const config = await alContractService.getALConfiguration(project.contractAddress);
      
      if (config) {
        setAlConfiguration(config);
        console.log('Loaded AL configuration from blockchain:', config);
      } else {
        setAlConfiguration(null);
        setError('No AL configuration found - project may not be deployed yet');
      }
    } catch (error) {
      console.error(' Failed to fetch AL configuration:', error);
      setError('Failed to load AL configuration from blockchain');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchALConfiguration();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="configuration-panel">
        <div className="panel-header">
          <h3>Project Configuration</h3>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            Loading Configuration...
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            Fetching AL configuration from smart contracts
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="configuration-panel">
        <div className="panel-header">
          <h3>Project Configuration</h3>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#dc2626' }}>
            Configuration Error
          </div>
          <div style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
          <button 
            onClick={handleRefresh}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
             Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="configuration-panel">
      <div className="panel-header">
        <h3>Project Configuration</h3>
      </div>
      {alConfiguration ? (
        <div className="config-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '16px' 
        }}>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>AL Scenario:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.scenario}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Query Strategy:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.queryStrategy}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Model:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.model.type}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Query Batch Size:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.queryBatchSize}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Max Iterations:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.maxIterations}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Voting Consensus:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.votingConsensus}</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Voting Timeout:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.votingTimeout}s</span>
          </div>
          <div className="config-item" style={{ 
            padding: '12px', 
            border: '1px solid #d1d5db', 
            borderRadius: '6px' 
          }}>
            <label style={{ fontWeight: 'bold', color: '#374151' }}>Label Space:</label>
            <span style={{ marginLeft: '8px' }}>{alConfiguration.labelSpace?.join(', ') || 'Not configured'}</span>
          </div>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>[CONFIG]</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
            No Configuration Available
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>
            This project doesn't have Active Learning configuration data available.
            <br />
            The project may not be deployed yet or AL contracts are not linked.
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel; 