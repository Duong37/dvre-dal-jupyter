import React, { useState } from 'react';
import { ModelUpdatesPanelProps } from './PanelTypes';

export const ModelUpdatesPanel: React.FC<ModelUpdatesPanelProps> = ({
  project,
  currentUser,
  isCoordinator,
  modelUpdates,
  onRefresh,
  onRefreshModelUpdates,
  onError
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      // Use targeted refresh if available, otherwise fall back to general refresh
      if (onRefreshModelUpdates) {
        await onRefreshModelUpdates();
      } else {
        await onRefresh();
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to refresh model updates');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isCoordinator) {
    return (
      <div className="model-updates-panel">
        <div className="panel-header">
          <h3>Model Updates History</h3>
          <p>Performance statistics and model updates information</p>
        </div>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
          <h4>Contributor Access</h4>
          <p style={{ color: '#666', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto' }}>
            Model updates are only available to project coordinators during active learning.
            <br /><br />
            After the project ends and final results are published, all model performance 
            data and updates will be visible and available in the project storage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="model-updates-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Model Updates History</h3>
          <p>Performance statistics for each iteration (latest on top)</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            backgroundColor: isRefreshing ? '#f3f4f6' : '#3b82f6',
            color: isRefreshing ? '#6b7280' : 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <span style={{
            display: 'inline-block',
            animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            transformOrigin: 'center'
          }}>
            ↻
          </span>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="updates-list">
        {modelUpdates.length > 0 ? (
          modelUpdates.map(update => (
            <div key={update.iterationNumber} className="update-item" style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
              backgroundColor: 'white'
            }}>
              <div className="update-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div className="iteration-info">
                  <h4 style={{
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {update.isFinalTraining ? 'Final Training Round' : `Iteration ${update.iterationNumber}`}
                  </h4>
                </div>
                <div className="samples-added" style={{
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {update.totalSamples} total samples
                </div>
              </div>
              <div className="performance-metrics" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
                marginBottom: '8px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Accuracy:</div>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {(update.performance.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Precision:</div>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {(update.performance.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Recall:</div>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {(update.performance.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>F1-Score:</div>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {(update.performance.f1Score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              {update.notes && (
                <div className="update-notes" style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  {update.notes}
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              No Model Updates Yet
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Model performance data will appear here after active learning iterations begin.
              <br />
              <button
                onClick={handleRefresh}
                style={{
                  marginTop: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Check for Updates
              </button>
            </div>
          </div>
        )}
      </div>
      
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ModelUpdatesPanel; 