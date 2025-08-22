import React, { useState, useEffect } from 'react';
import { useUserRegistry } from '../../hooks/useUserRegistry';
import { useAuth } from '../../hooks/useAuth';

interface UserInvitationDialogProps {
  projectAddress: string;
  projectName: string;
  availableRoles: string[];
  onClose: () => void;
  onInviteSent?: () => void;
}

export const UserInvitationDialog: React.FC<UserInvitationDialogProps> = ({
  projectAddress,
  projectName,
  availableRoles,
  onClose,
  onInviteSent
}) => {
  const { users, loading, error, loadAllUsers, sendInvitation } = useUserRegistry();
  const { account } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedRole, setSelectedRole] = useState(availableRoles[0] || '');
  const [inviting, setInviting] = useState(false);
  const [projectDetails, setProjectDetails] = useState<any>(null);

  // Check if this is an Active Learning project
  const isActiveLearningProject = projectDetails?.projectData?.project_type === 'active_learning';

  useEffect(() => {
    if (account) {
      loadAllUsers();
    }
  }, [account, loadAllUsers]);

  useEffect(() => {
    if (availableRoles.length > 0 && !selectedRole) {
      setSelectedRole(availableRoles[0]);
    }
  }, [availableRoles, selectedRole]);

  // Load project details to determine project type
  useEffect(() => {
    const loadProjectInfo = async () => {
      try {
        // We need to create a temporary instance to get project info
        // This is a workaround since we can't use hooks conditionally
        const provider = new (await import('ethers')).ethers.JsonRpcProvider(
          (await import('../../config/contracts')).RPC_URL
        );
        const Project = (await import('../../abis/Project.json')).default;
        const projectContract = new (await import('ethers')).ethers.Contract(
          projectAddress, 
          Project.abi, 
          provider
        );
        
        const projectDataString = await projectContract.getProjectData();
        const projectData = JSON.parse(projectDataString);
        
        setProjectDetails({ projectData });
      } catch (error) {
        console.warn('Could not load project details for invitation dialog:', error);
      }
    };

    if (projectAddress) {
      loadProjectInfo();
    }
  }, [projectAddress]);

  // Filter users (exclude current user and those already invited)
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.institution.toLowerCase().includes(searchTerm.toLowerCase());
    const isNotCurrentUser = user.address.toLowerCase() !== account?.toLowerCase();
    
    return matchesSearch && isNotCurrentUser;
  });

  const handleUserToggle = (userAddress: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userAddress)) {
      newSelected.delete(userAddress);
    } else {
      newSelected.add(userAddress);
    }
    setSelectedUsers(newSelected);
  };

  const handleSendInvitations = async () => {
    if (selectedUsers.size === 0 || !selectedRole) {
      alert('Please select at least one user and a role');
      return;
    }

    setInviting(true);
    let successCount = 0;

    try {
      for (const userAddress of selectedUsers) {
        try {
          const success = await sendInvitation(projectAddress, userAddress, selectedRole);
          if (success) {
            successCount++;
          }
        } catch (err) {
          console.error(`Failed to invite ${userAddress}:`, err);
        }
      }

      if (successCount > 0) {
        alert(`Successfully sent ${successCount} invitation${successCount !== 1 ? 's' : ''}!`);
        onInviteSent?.();
        onClose();
      } else {
        alert('Failed to send invitations. Please try again.');
      }
    } catch (err) {
      console.error('Error sending invitations:', err);
      alert('Failed to send invitations. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'var(--jp-layout-color1)',
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--jp-border-color1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: '0',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '1.1rem'
          }}>
            Invite Users to "{projectName}"
          </h2>
          <button
            onClick={onClose}
            disabled={inviting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--jp-ui-font-color2)',
              fontSize: '18px',
              cursor: inviting ? 'not-allowed' : 'pointer',
              opacity: inviting ? 0.5 : 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Role selection */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--jp-border-color2)' }}>
          {/* Active Learning Project Notice */}
          {isActiveLearningProject && (
            <div style={{
              backgroundColor: '#e0f2fe',
              border: '1px solid #0288d1',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <h4 style={{ 
                marginTop: 0, 
                marginBottom: '8px',
                color: '#01579b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px'
              }}>
                <span style={{ fontSize: '16px' }}></span>
                Active Learning Project
              </h4>
              <p style={{ margin: 0, color: '#01579b', fontSize: '13px' }}>
                For Active Learning projects, invited users can only join as <strong>contributors</strong>. 
                The coordinator role is reserved for the project creator to ensure proper AL workflow management.
              </p>
            </div>
          )}

          <label style={{
            display: 'block',
            color: 'var(--jp-ui-font-color1)',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Select role for invited users:
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={inviting}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--jp-layout-color0)',
              border: '1px solid var(--jp-border-color2)',
              borderRadius: '4px',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '14px'
            }}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          {/* Role explanation for Active Learning projects */}
          {isActiveLearningProject && selectedRole === 'contributor' && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '3px',
              fontSize: '12px',
              color: '#374151'
            }}>
              <strong>Contributor role:</strong> Invited users will be able to participate in voting sessions, 
              label samples, and view model updates, but cannot start new iterations or end the project.
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: '16px', paddingBottom: '12px' }}>
          <input
            type="text"
            placeholder="Search users by name, email, or institution..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={inviting}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '4px',
              background: 'var(--jp-layout-color0)',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Selected users summary */}
        {selectedUsers.size > 0 && (
          <div style={{
            padding: '0 16px 12px',
            color: 'var(--jp-ui-font-color2)',
            fontSize: '13px'
          }}>
            {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
          </div>
        )}

        {/* Users list */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 16px'
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--jp-ui-font-color2)'
            }}>
              Loading users...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--jp-error-color1)'
            }}>
              Error: {error}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--jp-ui-font-color2)'
            }}>
              {searchTerm ? 'No users match your search criteria.' : 'No users available to invite.'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '8px',
              paddingBottom: '16px'
            }}>
              {filteredUsers.map((user) => (
                <div
                  key={user.address}
                  onClick={() => !inviting && handleUserToggle(user.address)}
                  style={{
                    background: selectedUsers.has(user.address) 
                      ? 'var(--jp-brand-color3)' 
                      : 'var(--jp-layout-color0)',
                    border: selectedUsers.has(user.address)
                      ? '2px solid var(--jp-brand-color1)'
                      : '1px solid var(--jp-border-color2)',
                    borderRadius: '6px',
                    padding: '12px',
                    cursor: inviting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: inviting ? 0.6 : 1
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: 'var(--jp-ui-font-color1)',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        {user.name}
                      </div>
                      <div style={{
                        color: 'var(--jp-ui-font-color2)',
                        fontSize: '12px',
                        marginBottom: '2px'
                      }}>
                        {user.email}
                      </div>
                      <div style={{
                        color: 'var(--jp-ui-font-color2)',
                        fontSize: '12px'
                      }}>
                        {user.institution}
                      </div>
                    </div>
                    <div style={{
                      color: selectedUsers.has(user.address) 
                        ? 'var(--jp-brand-color1)' 
                        : 'var(--jp-ui-font-color2)',
                      fontSize: '16px'
                    }}>
                      {selectedUsers.has(user.address) ? '✓' : '○'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--jp-border-color1)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={inviting}
            style={{
              padding: '8px 16px',
              background: 'var(--jp-layout-color2)',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '4px',
              color: 'var(--jp-ui-font-color1)',
              cursor: inviting ? 'not-allowed' : 'pointer',
              opacity: inviting ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvitations}
            disabled={inviting || selectedUsers.size === 0 || !selectedRole}
            style={{
              padding: '8px 16px',
              background: (inviting || selectedUsers.size === 0 || !selectedRole) 
                ? 'var(--jp-ui-font-color3)' 
                : 'var(--jp-brand-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (inviting || selectedUsers.size === 0 || !selectedRole) 
                ? 'not-allowed' 
                : 'pointer'
            }}
          >
            {inviting 
              ? 'Sending Invitations...' 
              : `Send ${selectedUsers.size} Invitation${selectedUsers.size !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
};
