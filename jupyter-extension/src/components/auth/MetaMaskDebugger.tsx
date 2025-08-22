import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

export const MetaMaskDebugger: React.FC = () => {
  const { 
    account, 
    isConnecting, 
    connectionError, 
    isMetaMaskAvailable,
    connect,
    clearError 
  } = useAuth();
  
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    updateDebugInfo();
  }, [account, isConnecting, connectionError, isMetaMaskAvailable]);

  const updateDebugInfo = () => {
    const info: any = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isMetaMaskAvailable: isMetaMaskAvailable,
      account: account,
      isConnecting: isConnecting,
      connectionError: connectionError,
    };

    // Check MetaMask details
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      info.ethereum = {
        isMetaMask: ethereum.isMetaMask,
        selectedAddress: ethereum.selectedAddress,
        networkVersion: ethereum.networkVersion,
        chainId: ethereum.chainId,
        // Additional debugging info
        hasRequest: typeof ethereum.request === 'function',
        hasOn: typeof ethereum.on === 'function',
        hasRemoveListener: typeof ethereum.removeListener === 'function',
        // Check for common MetaMask properties
        hasIsMetaMask: 'isMetaMask' in ethereum,
        hasSelectedAddress: 'selectedAddress' in ethereum,
        hasNetworkVersion: 'networkVersion' in ethereum,
        hasChainId: 'chainId' in ethereum
      };
    }

    setDebugInfo(info);
  };

  const testConnection = async () => {
    try {
      clearError();
      await connect();
      updateDebugInfo();
    } catch (error) {
      console.error('Test connection failed:', error);
      updateDebugInfo();
    }
  };

  const copyDebugInfo = () => {
    const debugText = JSON.stringify(debugInfo, null, 2);
    navigator.clipboard.writeText(debugText);
    alert('Debug information copied to clipboard!');
  };

  if (!showDebug) {
    return (
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        right: '20px', 
        zIndex: 1000 
      }}>
        <button
          onClick={() => setShowDebug(true)}
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Debug MetaMask
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '600px',
      maxHeight: '80vh',
      backgroundColor: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '8px',
      padding: '20px',
      zIndex: 1001,
      overflow: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--jp-ui-font-color1)' }}>MetaMask Debug Information</h3>
        <button
          onClick={() => setShowDebug(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--jp-ui-font-color2)'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <button
          onClick={testConnection}
          disabled={isConnecting}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            marginRight: '8px',
            opacity: isConnecting ? 0.6 : 1
          }}
        >
          {isConnecting ? 'Connecting...' : 'Test Connection'}
        </button>
        
        <button
          onClick={updateDebugInfo}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--jp-layout-color2)',
            color: 'var(--jp-ui-font-color1)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Refresh Info
        </button>
        
        <button
          onClick={copyDebugInfo}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--jp-success-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Copy Debug Info
        </button>
      </div>

      <div style={{
        backgroundColor: 'var(--jp-layout-color0)',
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '4px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        maxHeight: '400px',
        overflow: 'auto'
      }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Troubleshooting Tips:</h4>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Make sure MetaMask is installed and unlocked</li>
          <li>Check if you're on the correct network</li>
          <li>Try refreshing the page if connection seems stuck</li>
          <li>Check browser console for additional error messages</li>
          <li>Ensure MetaMask has permission to connect to this site</li>
        </ul>
      </div>
    </div>
  );
}; 