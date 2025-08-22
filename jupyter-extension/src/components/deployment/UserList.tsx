import React, { useState, useCallback, useEffect } from 'react';
import { DVREProjectConfiguration } from './services/ProjectConfigurationService';
import { useAuth } from '../../hooks/useAuth';

interface UserListProps {
  project: DVREProjectConfiguration;
  onUserAction?: (action: string, userAddress: string) => void;
}

interface ProjectMember {
  address: string;
  role: string;
  joinedAt?: number;
  isOwner?: boolean;
}

interface JoinRequest {
  requester: string;
  role: string;
  timestamp: number;
  message?: string;
}

const UserList: React.FC<UserListProps> = ({ project, onUserAction }) => {
  const { account } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);

  // Load participants from smart contract
  const loadParticipants = useCallback(async () => {
    if (!project.contractAddress) {
      // Fallback to basic owner info if no contract address
      setMembers([{
        address: project.owner || '',
        role: 'Coordinator',
        joinedAt: typeof project.created === 'number' ? project.created : Date.now() / 1000,
        isOwner: true
      }]);
      return;
    }

    setLoading(true);
    try {
      const { getAllParticipantsForProject } = await import('../../hooks/useProjects');
      const participantsData = await getAllParticipantsForProject(project.contractAddress);
      
      console.log('Loaded participants for project:', project.contractAddress, participantsData);
      
      // Convert the smart contract data to member objects
      const contractMembers: ProjectMember[] = participantsData.participantAddresses.map((address, index) => ({
        address,
        role: participantsData.roles[index],
        joinedAt: Number(participantsData.joinTimestamps[index]),
        isOwner: address.toLowerCase() === project.owner?.toLowerCase()
      }));
      
      setMembers(contractMembers);
    } catch (error) {
      console.error('Failed to load participants from contract:', error);
      // Fallback to basic owner info
      setMembers([{
      address: project.owner || '',
      role: 'Coordinator',
        joinedAt: typeof project.created === 'number' ? project.created : Date.now() / 1000,
      isOwner: true
      }]);
    } finally {
      setLoading(false);
    }
  }, [project.contractAddress, project.owner, project.created]);

  // Load participants when component mounts or project changes
  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const joinRequests: JoinRequest[] = [
    // Mock pending requests - would come from contract
  ];

  const isProjectOwner = project.owner?.toLowerCase() === account?.toLowerCase();
  const userCount = members.length;
  const pendingCount = joinRequests.length;

  const truncateAddress = (address: string, startChars: number = 6, endChars: number = 4): string => {
    if (!address || address.length <= startChars + endChars) return address;
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  };

  const copyToClipboard = async (text: string, successMessage: string = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log(successMessage);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleApproveRequest = useCallback((requester: string) => {
    console.log('Approving join request for:', requester);
    onUserAction?.('approve', requester);
  }, [onUserAction]);

  const handleRejectRequest = useCallback((requester: string) => {
    console.log('Rejecting join request for:', requester);
    onUserAction?.('reject', requester);
  }, [onUserAction]);

  const handleRemoveUser = useCallback((userAddress: string) => {
    console.log('Removing user:', userAddress);
    onUserAction?.('remove', userAddress);
  }, [onUserAction]);

  const getRoleColor = (role: string): string => {
    switch (role.toLowerCase()) {
      case 'owner': return '#4caf50';
      case 'admin': return '#2196f3';
      case 'coordinator': return '#6f42c1';
      case 'contributor': return '#ff9800';
      case 'annotator': return '#ff9800';
      case 'viewer': return '#9c27b0';
      default: return '#757575';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="config-section">
      <h4>Project Users</h4>
      
      {/* Summary Stats */}
      <div className="user-stats">
        <div className="stat-item">
          <span className="stat-value">{userCount}</span>
          <span className="stat-label">Active Members</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{pendingCount}</span>
          <span className="stat-label">Pending Requests</span>
        </div>
        <div className="stat-item">
          <button
            onClick={loadParticipants}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: loading ? '#6b7280' : 'var(--jp-brand-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Loading...' : 'Refresh Members'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members ({userCount})
        </button>
        <button
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Join Requests ({pendingCount})
        </button>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="members-list">
          {loading ? (
            <div className="empty-state">
              <p>Loading members from smart contract...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state">
              <p>No members found in this project.</p>
            </div>
          ) : (
            <div className="user-grid">
              {members.map((member, index) => (
                <div key={index} className="user-card">
                  <div className="user-header">
                    <div className="user-address">
                      <span
                        className="address-text"
                        title={member.address}
                        onClick={() => member.address && copyToClipboard(member.address, 'Address copied!')}
                      >
                        {truncateAddress(member.address)}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => member.address && copyToClipboard(member.address, 'Address copied!')}
                        title="Copy address"
                      >
                        
                      </button>
                    </div>
                    <div 
                      className="user-role"
                      style={{ backgroundColor: getRoleColor(member.role), color: 'white' }}
                    >
                      {member.role}
                    </div>
                  </div>
                  
                  <div className="user-details">
                    {member.joinedAt && (
                      <div className="user-meta">
                        <span className="meta-label">Joined:</span>
                        <span className="meta-value">{formatTimestamp(member.joinedAt)}</span>
                      </div>
                    )}
                    
                    {member.address?.toLowerCase() === account?.toLowerCase() && (
                      <div className="user-badge">You</div>
                    )}
                    
                    {member.isOwner && (
                      <div className="user-badge" style={{ background: '#6f42c1', marginLeft: '8px' }}>Owner</div>
                    )}
                  </div>

                  {/* Actions for project owner */}
                  {isProjectOwner && !member.isOwner && member.address?.toLowerCase() !== account?.toLowerCase() && (
                    <div className="user-actions">
                      <button
                        className="action-btn remove-btn"
                        onClick={() => handleRemoveUser(member.address)}
                        title="Remove user from project"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Join Requests Tab */}
      {activeTab === 'requests' && (
        <div className="requests-list">
          {joinRequests.length === 0 ? (
            <div className="empty-state">
              <p>No pending join requests.</p>
            </div>
          ) : (
            <div className="request-grid">
              {joinRequests.map((request, index) => (
                <div key={index} className="request-card">
                  <div className="request-header">
                    <div className="requester-address">
                      <span
                        className="address-text"
                        title={request.requester}
                        onClick={() => copyToClipboard(request.requester, 'Address copied!')}
                      >
                        {truncateAddress(request.requester)}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(request.requester, 'Address copied!')}
                        title="Copy address"
                      >
                        
                      </button>
                    </div>
                    <div className="request-timestamp">
                      {formatTimestamp(request.timestamp)}
                    </div>
                  </div>
                  
                  <div className="request-details">
                    <div className="requested-role">
                      Requested Role: <span className="role-badge">{request.role}</span>
                    </div>
                    {request.message && (
                      <div className="request-message">
                        <strong>Message:</strong> {request.message}
                      </div>
                    )}
                  </div>

                  {/* Actions for project owner */}
                  {isProjectOwner && (
                    <div className="request-actions">
                      <button
                        className="action-btn approve-btn"
                        onClick={() => handleApproveRequest(request.requester)}
                      >
                        Approve
                      </button>
                      <button
                        className="action-btn reject-btn"
                        onClick={() => handleRejectRequest(request.requester)}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project Access Info */}
      <div className="access-info">
        <h5>Project Access</h5>
        <div className="access-details">
          <div className="access-item">
            <span className="access-label">Join Requests:</span>
            <span className="access-value">
              {project.projectData?.joinPolicy || 'Manual Approval'}
            </span>
          </div>
          <div className="access-item">
            <span className="access-label">Visibility:</span>
            <span className="access-value">
              {project.projectData?.visibility || 'Public'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .user-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #2196f3;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }

        .tab-navigation {
          display: flex;
          border-bottom: 1px solid #ddd;
          margin-bottom: 20px;
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 10px 20px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: #f5f5f5;
        }

        .tab-btn.active {
          border-bottom-color: #2196f3;
          color: #2196f3;
          font-weight: 600;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .user-grid, .request-grid {
          display: grid;
          gap: 15px;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        }

        .user-card, .request-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 15px;
          background: white;
          transition: box-shadow 0.2s;
        }

        .user-card:hover, .request-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .user-header, .request-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .user-address, .requester-address {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .address-text {
          font-family: monospace;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          background: #f5f5f5;
        }

        .address-text:hover {
          background: #e0e0e0;
        }

        .copy-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          border-radius: 2px;
        }

        .copy-btn:hover {
          background: #f0f0f0;
        }

        .user-role, .role-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-badge {
          background: #e3f2fd;
          color: #1976d2;
        }

        .user-details {
          margin: 10px 0;
        }

        .user-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #666;
          margin-bottom: 5px;
        }

        .user-badge {
          display: inline-block;
          background: #4caf50;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }

        .user-actions, .request-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .action-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: background-color 0.2s;
        }

        .approve-btn {
          background: #4caf50;
          color: white;
        }

        .approve-btn:hover {
          background: #45a049;
        }

        .reject-btn, .remove-btn {
          background: #f44336;
          color: white;
        }

        .reject-btn:hover, .remove-btn:hover {
          background: #da190b;
        }

        .request-timestamp {
          font-size: 12px;
          color: #666;
        }

        .request-details {
          margin: 10px 0;
        }

        .requested-role {
          margin-bottom: 8px;
        }

        .request-message {
          font-size: 12px;
          color: #666;
          padding: 8px;
          background: #f9f9f9;
          border-radius: 4px;
        }

        .access-info {
          margin-top: 30px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fafafa;
        }

        .access-info h5 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .access-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .access-item {
          display: flex;
          justify-content: space-between;
        }

        .access-label {
          font-weight: 600;
          color: #666;
        }

        .access-value {
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default UserList; 