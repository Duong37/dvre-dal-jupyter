import React, { useState, useEffect } from 'react';
import { ProjectInfo } from '../../hooks/useProjects';

interface JoinProjectDialogProps {
  project: ProjectInfo;
  availableRoles: string[];
  onJoin: (role: string) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
}

export const JoinProjectDialog: React.FC<JoinProjectDialogProps> = ({
  project,
  availableRoles,
  onJoin,
  onCancel,
  loading = false
}) => {
  const [selectedRole, setSelectedRole] = useState<string>('');

  // Check if this is an active learning project
  const isActiveLearningProject = project.projectData?.project_type === 'active_learning';

  useEffect(() => {
    if (availableRoles.length > 0 && !selectedRole) {
      setSelectedRole(availableRoles[0]);
    }
  }, [availableRoles, selectedRole]);

  const handleJoin = async () => {
    if (!selectedRole) {
      alert('Please select a role');
      return;
    }
    
    const success = await onJoin(selectedRole);
    if (success) {
      onCancel(); // Close dialog on success
    }
  };

  return (
    <div style={{
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '4px',
      padding: '20px',
      maxWidth: '500px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{
          margin: '0',
          color: 'var(--jp-ui-font-color1)'
        }}>
          Request to Join Project
        </h2>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: 'var(--jp-layout-color2)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '12px',
            opacity: loading ? 0.6 : 1
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: 'var(--jp-ui-font-color1)',
          marginBottom: '8px'
        }}>
          {project.objective}
        </h3>
        <div style={{
          padding: '12px',
          background: 'var(--jp-layout-color0)',
          border: '1px solid var(--jp-border-color2)',
          borderRadius: '3px',
          marginBottom: '16px'
        }}>
          <div style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '4px' }}>
            <strong>Creator:</strong> {project.creator.slice(0, 6)}...{project.creator.slice(-4)}
          </div>
          <div style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '4px' }}>
            <strong>Created:</strong> {new Date(project.created * 1000).toLocaleDateString()}
          </div>
          <div style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '4px' }}>
            <strong>Members:</strong> {project.memberCount}
          </div>
          <div style={{ color: 'var(--jp-ui-font-color1)' }}>
            <strong>Project Type:</strong> {project.projectData?.projectType || 'Standard'}
          </div>
        </div>
      </div>

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
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}></span>
            Active Learning Project
          </h4>
          <p style={{ margin: 0, color: '#01579b', fontSize: '14px' }}>
            For Active Learning projects, participants can only join as <strong>contributors</strong>. 
            The coordinator role is reserved for the project creator to ensure proper AL workflow management.
          </p>
        </div>
      )}

      {availableRoles.length > 0 ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'var(--jp-ui-font-color1)',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Select your role:
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--jp-layout-color0)',
                border: '1px solid var(--jp-border-color2)',
                borderRadius: '3px',
                color: 'var(--jp-ui-font-color1)',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
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
                <strong>Contributor role:</strong> You'll be able to participate in voting sessions, 
                label samples, and view model updates, but cannot start new iterations or end the project.
              </div>
            )}
          </div>

          <div style={{ 
            background: 'var(--jp-layout-color0)',
            padding: '16px',
            borderRadius: '4px',
            border: '1px solid var(--jp-border-color2)',
            marginBottom: '20px'
          }}>
            <p style={{ 
              color: 'var(--jp-ui-font-color1)',
              margin: '0 0 12px 0',
              fontSize: '14px'
            }}>
              You are requesting to join this project with the role: <strong>{selectedRole}</strong>
            </p>
            <p style={{ 
              color: 'var(--jp-ui-font-color2)',
              margin: 0,
              fontSize: '12px'
            }}>
              Note: Your request will be sent to the project creator for approval. You will be notified once your request is reviewed.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: 'var(--jp-layout-color2)',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'var(--jp-ui-font-color1)',
                fontSize: '13px',
                opacity: loading ? 0.6 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleJoin}
              disabled={loading || !selectedRole}
              style={{
                padding: '8px 16px',
                background: loading || !selectedRole ? 'var(--jp-ui-font-color3)' : 'var(--jp-brand-color1)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: loading || !selectedRole ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: loading || !selectedRole ? 0.6 : 1
              }}
            >
              {loading ? 'Sending Request...' : 'Request to Join'}
            </button>
          </div>
        </>
      ) : (
        <div style={{
          background: 'var(--jp-warn-color3)',
          border: '1px solid var(--jp-warn-color1)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{
            color: 'var(--jp-warn-color1)',
            margin: '0 0 8px 0',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            No Available Roles
          </p>
          <p style={{
            color: 'var(--jp-ui-font-color2)',
            margin: 0,
            fontSize: '12px'
          }}>
            This project doesn't have any available roles configured, or there was an error loading the roles.
          </p>
        </div>
      )}
    </div>
  );
};

export default JoinProjectDialog;
