import React, { useState, useEffect } from 'react';
import { UserDashboardPanelProps } from './PanelTypes';
import { VotingService } from '../services/VotingService';

export const UserDashboardPanel: React.FC<UserDashboardPanelProps> = ({
  userContributions: propUserContributions,
  currentUser,
  project
}) => {
  const [userContributions, setUserContributions] = useState(propUserContributions || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const votingService = new VotingService();

  // Update local state when props change, or fetch from blockchain if needed
  useEffect(() => {
    if (propUserContributions && propUserContributions.length > 0) {
      setUserContributions(propUserContributions);
      setError(null);
    } else if (project?.contractAddress) {
      // Fetch real data from blockchain if prop data is not available
      fetchUserContributions();
    }
  }, [project?.contractAddress, propUserContributions]);

  const fetchUserContributions = async () => {
    if (!project?.contractAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching user contributions from blockchain for project:', project.contractAddress);
      const contributions = await votingService.getUserContributions(project.contractAddress);
      setUserContributions(contributions);
      console.log(`Loaded ${contributions.length} user contributions from blockchain`);
    } catch (error) {
      console.error(' Failed to fetch user contributions:', error);
      setError('Failed to load user contributions from blockchain');
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

  // Calculate summary statistics
  const totalVotes = userContributions.reduce((sum, user) => sum + user.votesCount, 0);

  return (
    <div className="users-panel">
      <div className="panel-header">
        <h3>User Dashboard</h3>
        <p>All users, their roles, and contribution statistics from blockchain data</p>
        
        {/* Summary Statistics */}
        {userContributions.length > 0 && (
          <div className="summary-stats" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{userContributions.length}</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Total Users</div>
            </div>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{totalVotes}</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Total Votes</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="users-table">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>[CONFIG]</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              Loading User Data...
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Fetching real contribution data from the blockchain.
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
        ) : userContributions.length > 0 ? (
          <>
            <div className="table-header" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 80px 100px',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '14px',
              color: '#374151',
              marginBottom: '8px'
            }}>
              <div>Address</div>
              <div>Role</div>
              <div>Votes</div>
              <div>Joined</div>
            </div>
            {userContributions.map(user => (
              <div key={user.address} className="table-row" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 80px 100px',
                gap: '12px',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                marginBottom: '4px',
                backgroundColor: user.address.toLowerCase() === currentUser?.toLowerCase() ? '#f0f9ff' : 'white'
              }}>
                <div className="col-address" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="address" style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                    {formatAddress(user.address)}
                  </span>
                  {user.address.toLowerCase() === currentUser?.toLowerCase() && (
                    <span className="you-badge" style={{
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      YOU
                    </span>
                  )}
                </div>
                <div className="col-role">
                  <span className={`role-badge ${user.role}`} style={{
                    backgroundColor: user.role === 'coordinator' ? '#fef3c7' : '#e0e7ff',
                    color: user.role === 'coordinator' ? '#92400e' : '#3730a3',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {user.role.toUpperCase()}
                  </span>
                </div>
                <div className="col-votes" style={{ 
                  fontWeight: 'bold',
                  color: user.votesCount > 0 ? '#166534' : '#6b7280'
                }}>{user.votesCount}</div>
                <div className="col-joined" style={{ fontSize: '14px', color: '#666' }}>
                  {formatTimeAgo(user.joinedAt)}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              No User Activity Yet
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              This project was recently deployed. User contributions will appear here once voting activity begins.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboardPanel; 