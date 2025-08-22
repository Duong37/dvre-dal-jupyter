import React from 'react';
import { InvitationInfo } from '../../hooks/useUserRegistry';

interface JoinRequestInfo {
  requester: string;
  role: string;
  timestamp: number;
  projectAddress: string;
  projectName: string;
}

interface InvitationsAndRequestsListProps {
  userInvitations: InvitationInfo[];
  joinRequests: JoinRequestInfo[];
  loading?: boolean;
  onAcceptInvitation: (projectAddress: string) => void;
  onRejectInvitation: (projectAddress: string) => void;
  onApproveJoinRequest: (projectAddress: string, memberAddress: string) => void;
  onRejectJoinRequest: (projectAddress: string, memberAddress: string) => void;
}

export const InvitationsAndRequestsList: React.FC<InvitationsAndRequestsListProps> = ({
  userInvitations,
  joinRequests,
  loading = false,
  onAcceptInvitation,
  onRejectInvitation,
  onApproveJoinRequest,
  onRejectJoinRequest
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ color: 'var(--jp-ui-font-color2)' }}>Loading invitations and requests...</div>
      </div>
    );
  }

  const totalItems = userInvitations.length + joinRequests.length;

  return (
    <div style={{
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '4px',
      padding: '16px',
      maxWidth: '500px'
    }}>
      <h3 style={{ 
        margin: '0 0 16px 0',
        color: 'var(--jp-ui-font-color1)'
      }}>
        Invitations and Join Requests
      </h3>
      
      {totalItems === 0 ? (
        <div style={{ 
          color: 'var(--jp-ui-font-color2)',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '20px',
          fontSize: '14px'
        }}>
          No pending invitations or join requests
          <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
            Project owners can invite you to collaborate, and users can request to join your projects
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* User Invitations */}
          {userInvitations.map((invitation) => (
            <InvitationCard
              key={`invitation-${invitation.projectAddress}`}
              invitation={invitation}
              onAccept={() => onAcceptInvitation(invitation.projectAddress)}
              onReject={() => onRejectInvitation(invitation.projectAddress)}
            />
          ))}

          {/* Join Requests for User's Projects */}
          {joinRequests.map((request) => (
            <JoinRequestCard
              key={`join-${request.projectAddress}-${request.requester}`}
              request={request}
              onApprove={() => onApproveJoinRequest(request.projectAddress, request.requester)}
              onReject={() => onRejectJoinRequest(request.projectAddress, request.requester)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface InvitationCardProps {
  invitation: InvitationInfo;
  onAccept: () => void;
  onReject: () => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  onAccept,
  onReject
}) => {
  return (
    <div style={{
      background: 'var(--jp-layout-color0)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '6px',
      padding: '16px',
      transition: 'border-color 0.2s ease'
    }}>
      {/* Invitation header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}>
            <div style={{
              background: 'var(--jp-brand-color3, #dbeafe)',
              color: 'var(--jp-brand-color1, #2563eb)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '500'
            }}>
              INVITATION
            </div>
            <h4 style={{
              margin: '0',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {invitation.projectName}
            </h4>
          </div>
          <div style={{
            color: 'var(--jp-ui-font-color2)',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {invitation.projectAddress.slice(0, 10)}...{invitation.projectAddress.slice(-8)}
          </div>
        </div>
        <div style={{
          background: 'var(--jp-brand-color3, #dbeafe)',
          color: 'var(--jp-brand-color1, #2563eb)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {invitation.role}
        </div>
      </div>

      {/* Invitation details */}
      <div style={{
        color: 'var(--jp-ui-font-color2)',
        fontSize: '13px',
        marginBottom: '16px'
      }}>
        <div>Invited by: {invitation.inviter.slice(0, 10)}...{invitation.inviter.slice(-8)}</div>
        <div>Date: {new Date(invitation.timestamp * 1000).toLocaleDateString()}</div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onReject}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-layout-color0)',
            color: 'var(--jp-ui-font-color1)',
            border: '1px solid var(--jp-border-color2)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-brand-color1, #2563eb)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
};

interface JoinRequestCardProps {
  request: JoinRequestInfo;
  onApprove: () => void;
  onReject: () => void;
}

const JoinRequestCard: React.FC<JoinRequestCardProps> = ({
  request,
  onApprove,
  onReject
}) => {
  return (
    <div style={{
      background: 'var(--jp-layout-color0)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '6px',
      padding: '16px',
      transition: 'border-color 0.2s ease'
    }}>
      {/* Request header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}>
            <div style={{
              background: 'var(--jp-brand-color3, #dbeafe)',
              color: 'var(--jp-brand-color1, #2563eb)',
              padding: '2px 6px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: '500'
            }}>
              JOIN REQUEST
            </div>
            <h4 style={{
              margin: '0',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {request.projectName}
            </h4>
          </div>
          <div style={{
            color: 'var(--jp-ui-font-color2)',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {request.projectAddress.slice(0, 10)}...{request.projectAddress.slice(-8)}
          </div>
        </div>
        <div style={{
          background: 'var(--jp-warn-color3, #fef3c7)',
          color: 'var(--jp-warn-color1, #f59e0b)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {request.role}
        </div>
      </div>

      {/* Request details */}
      <div style={{
        color: 'var(--jp-ui-font-color2)',
        fontSize: '13px',
        marginBottom: '16px'
      }}>
        <div>Requested by: {request.requester.slice(0, 10)}...{request.requester.slice(-8)}</div>
        <div>Date: {new Date(request.timestamp * 1000).toLocaleDateString()}</div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onReject}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-layout-color0)',
            color: 'var(--jp-ui-font-color1)',
            border: '1px solid var(--jp-border-color2)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-brand-color1, #2563eb)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
};

export default InvitationsAndRequestsList; 