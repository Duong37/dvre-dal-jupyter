import React, { useState, useEffect } from 'react';
import { useUserRegistry, UserInfo } from '../../hooks/useUserRegistry';
import { useAuth } from '../../hooks/useAuth';

export const UserRegistryWidget: React.FC = () => {
  const { users, loading, error, loadAllUsers } = useUserRegistry();
  const { account } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (account) {
      loadAllUsers();
    }
  }, [account, loadAllUsers]);

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.institution.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!account) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--jp-ui-font-color2)'
      }}>
        Please connect your wallet to view the user registry.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--jp-ui-font-color2)'
      }}>
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: 'var(--jp-error-color3)',
        color: 'var(--jp-error-color1)',
        borderRadius: '4px',
        margin: '10px'
      }}>
        <div style={{ marginBottom: '10px' }}>Error: {error}</div>
        <button
          onClick={() => loadAllUsers()}
          style={{
            padding: '6px 12px',
            background: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        borderBottom: '1px solid var(--jp-border-color1)',
        paddingBottom: '12px'
      }}>
        <h2 style={{
          margin: '0',
          color: 'var(--jp-ui-font-color1)',
          fontSize: '1.2rem'
        }}>
          D-VRE User Registry
        </h2>
        <button
          onClick={() => loadAllUsers()}
          disabled={loading}
          style={{
            padding: '6px 12px',
            background: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          Refresh
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search users by name, email, institution, or address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* User count */}
      <div style={{
        marginBottom: '12px',
        color: 'var(--jp-ui-font-color2)',
        fontSize: '13px'
      }}>
        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
        {searchTerm && ` (filtered from ${users.length} total)`}
      </div>

      {/* Users list */}
      <div style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {filteredUsers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--jp-ui-font-color2)',
            padding: '40px 20px'
          }}>
            {searchTerm ? 'No users match your search criteria.' : 'No registered users found.'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '12px'
          }}>
            {filteredUsers.map((user) => (
              <UserCard key={user.address} user={user} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface UserCardProps {
  user: UserInfo;
}

const UserCard: React.FC<UserCardProps> = ({ user }) => {
  return (
    <div style={{
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '6px',
      padding: '12px',
      transition: 'border-color 0.2s ease'
    }}>
      {/* User info header */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '4px'
        }}>
          <h3 style={{
            margin: '0',
            color: 'var(--jp-ui-font-color1)',
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            {user.name}
          </h3>
        </div>
        
        <div style={{
          color: 'var(--jp-ui-font-color2)',
          fontSize: '12px',
          fontFamily: 'monospace',
          marginBottom: '4px'
        }}>
          {user.address.slice(0, 10)}...{user.address.slice(-8)}
        </div>
      </div>

      {/* User details */}
      <div style={{
        display: 'grid',
        gap: '4px',
        marginBottom: '8px'
      }}>
        <div style={{
          color: 'var(--jp-ui-font-color1)',
          fontSize: '13px'
        }}>
          <span style={{ fontWeight: '500' }}>Email:</span> {user.email}
        </div>
        <div style={{
          color: 'var(--jp-ui-font-color1)',
          fontSize: '13px'
        }}>
          <span style={{ fontWeight: '500' }}>Institution:</span> {user.institution}
        </div>
      </div>

      {/* Projects */}
      <div style={{
        marginTop: '8px',
        paddingTop: '8px',
        borderTop: '1px solid var(--jp-border-color2)'
      }}>
        <div style={{
          color: 'var(--jp-ui-font-color2)',
          fontSize: '12px',
          marginBottom: '4px'
        }}>
          Projects: {user.projects.length}
        </div>
        {user.projects.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px'
          }}>
            {user.projects.slice(0, 3).map((projectAddress, index) => (
              <span
                key={projectAddress}
                style={{
                  background: 'var(--jp-brand-color3)',
                  color: 'var(--jp-brand-color1)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
              >
                {projectAddress.slice(0, 6)}...{projectAddress.slice(-4)}
              </span>
            ))}
            {user.projects.length > 3 && (
              <span style={{
                color: 'var(--jp-ui-font-color2)',
                fontSize: '11px'
              }}>
                +{user.projects.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
