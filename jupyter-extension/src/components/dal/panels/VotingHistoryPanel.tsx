import React, { useState, useEffect } from 'react';
import { VotingHistoryPanelProps } from './PanelTypes';
import { VotingService } from '../services/VotingService';
import { VotingRecord } from '../types';

export const VotingHistoryPanel: React.FC<VotingHistoryPanelProps> = ({
  votingHistory: propVotingHistory,
  projectAddress
}) => {
  const [votingHistory, setVotingHistory] = useState<VotingRecord[]>(propVotingHistory || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const votingService = new VotingService();

  // Update local state when props change
  useEffect(() => {
    if (propVotingHistory && propVotingHistory.length > 0) {
      setVotingHistory(propVotingHistory);
      setError(null);
    } else if (projectAddress) {
      // Only fetch from blockchain if no prop data is available
      fetchVotingHistory();
    }
  }, [projectAddress, propVotingHistory]);

  const fetchVotingHistory = async () => {
    if (!projectAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching voting history from blockchain for project:', projectAddress);
      const history = await votingService.getVotingHistory(projectAddress);
      setVotingHistory(history);
      console.log(`Loaded ${history.length} voting records from blockchain`);
    } catch (error) {
      console.error(' Failed to fetch voting history:', error);
      setError('Failed to load voting history from blockchain');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="voting-history-panel">
      <div className="panel-header">
        <h3>Voting History</h3>
        <p>All samples with their voting statistics and final labels</p>
      </div>
      <div className="history-list">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>[CONFIG]</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Loading Voting History...
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              This might take a moment depending on the network.
            </div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Error: {error}
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Please check the console for more details.
            </div>
          </div>
        ) : votingHistory.length > 0 ? (
          votingHistory.map(record => (
            <div key={record.sampleId} className="history-item" style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '16px',
              backgroundColor: 'white'
            }}>
              <div className="item-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div className="sample-info">
                  <h4 style={{ margin: '0 0 4px 0' }}>{record.sampleId}</h4>
                  <span className="iteration-badge" style={{
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    Iteration {record.iterationNumber}
                  </span>
                </div>
                <div className="final-result" style={{ textAlign: 'right' }}>
                  <span className="final-label" style={{
                    backgroundColor: '#dcfce7',
                    color: '#166534',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    marginRight: '8px'
                  }}>
                    Final: {record.finalLabel}
                  </span>
                  <span className={`consensus-badge ${record.consensusReached ? 'reached' : 'no-consensus'}`} style={{
                    backgroundColor: record.consensusReached ? '#dcfce7' : '#fee2e2',
                    color: record.consensusReached ? '#166534' : '#dc2626',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {record.consensusReached ? 'Consensus' : 'No Consensus'}
                  </span>
                </div>
              </div>
              
              <div className="voting-details" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: '20px',
                alignItems: 'start'
              }}>
                <div className="voter-breakdown">
                  <h5 style={{ margin: '0 0 8px 0', color: '#374151' }}>Votes Cast:</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {Object.entries(record.votes).map(([voter, vote]) => (
                      <div key={voter} className="vote-entry" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}>
                        <span className="voter" style={{ fontFamily: 'monospace' }}>{formatAddress(voter)}:</span>
                        <span className="vote" style={{ fontWeight: 'bold' }}>{vote}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="distribution">
                  <h5 style={{ margin: '0 0 8px 0', color: '#374151' }}>Distribution:</h5>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(record.votingDistribution).map(([label, count]) => (
                      <span key={label} className="dist-item" style={{
                        backgroundColor: '#e5e7eb',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {label}: {count as number}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="timestamp" style={{
                  fontSize: '14px',
                  color: '#666',
                  textAlign: 'right'
                }}>
                  {formatTimeAgo(record.timestamp)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              No Voting History Yet
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              This project was recently deployed. Voting history will appear here once samples are labeled.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingHistoryPanel; 