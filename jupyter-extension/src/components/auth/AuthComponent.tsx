import React, { useState } from 'react';
import WalletButton from './WalletButton';
import { MetaMaskDebugger } from './MetaMaskDebugger';

export interface AuthComponentProps {
  title?: string;
}

export const AuthComponent: React.FC<AuthComponentProps> = ({ 
  title = 'User Authentication' 
}) => {
 
  const [userAccount, setUserAccount] = useState<string | null>(null);
  const [showDebugger, setShowDebugger] = useState(false);

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ 
          fontSize: '2em',
          margin: '20px 0',
          color: 'var(--jp-ui-font-color1)',
          textAlign: 'center'
        }}>
          {title}
        </h1>
        <button
          onClick={() => setShowDebugger(!showDebugger)}
          style={{
            padding: '6px 12px',
            backgroundColor: showDebugger ? 'var(--jp-error-color1)' : 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {showDebugger ? 'Hide Debug' : 'Show Debug'}
        </button>
      </div>
      
      {userAccount && <h1>User info</h1>}
      <WalletButton setUserAccount={setUserAccount} />
      
      {showDebugger && <MetaMaskDebugger />}
    </div>
  );
};

export default AuthComponent;
