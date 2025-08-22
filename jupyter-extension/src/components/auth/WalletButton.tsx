import { useEffect, useState } from "react";
import {useAuth} from "../../hooks/useAuth";
import { useFactoryRegistry } from "../../hooks/useFactoryRegistry";
import { ethers } from "ethers";
import UserMetadataFactory from "../../abis/UserMetadataFactory.json";

import UserMetadataForm from "./UserMetadataForm";
import UserMetadataDisplay from "./UserMetadataDisplay";
import React from "react";

export default function WalletButton({ setUserAccount }: { setUserAccount: (account: string | null) => void }) {
  const { 
    account, 
    connect, 
    disconnect, 
    register, 
    isConnecting, 
    connectionError, 
    isMetaMaskAvailable,
    clearError 
  } = useAuth();
  const { getFactoryAddress, loading: registryLoading, error: registryError } = useFactoryRegistry();

  const [metadata, setMetadata] = useState<{ email: string; name: string; institution: string } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);

  // Fetch user metadata if connected
  useEffect(() => {
    if (account) {
      setUserAccount(account);
      fetchMetadata(account);
    } else {
      setUserAccount(null);
      setMetadata(null);
      setShowRegister(false);
    }
  }, [account]);

  // Check if user is registered and fetch metadata
  const fetchMetadata = async (userAddress: string) => {
    setFetchingMetadata(true);
    try {
      // Get UserMetadataFactory address from registry
      const userMetadataFactoryAddress = await getFactoryAddress("UserMetadataFactory");
      
      if (!userMetadataFactoryAddress) {
        console.error("UserMetadataFactory not found in registry");
        setShowRegister(true);
        setMetadata(null);
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(userMetadataFactoryAddress, UserMetadataFactory.abi, provider);
      const metadataAddr = await contract.getUserMetadataContract(userAddress);
      if (metadataAddr === ethers.ZeroAddress || metadataAddr === "0x0000000000000000000000000000000000000000") {
        setShowRegister(true);
        setMetadata(null);
      } else {
        const metadataJSON = await contract.getUserMetadataJSON(userAddress);
        const parsed = JSON.parse(metadataJSON);
        setMetadata(parsed);
        setShowRegister(false);
      }
    } catch (err) {
      console.error("Error fetching metadata:", err);
      setShowRegister(true);
      setMetadata(null);
    } finally {
      setFetchingMetadata(false);
    }
  };

  // Handle registration form submission
  const handleRegister = async (email: string, name: string, institution: string) => {
    const success = await register(email, name, institution);
    if (success && account) {
      await fetchMetadata(account);
    }
  };

  // Handle connect button click
  const handleConnect = async () => {
    clearError();
    await connect();
  };

  return (
    <div>
      {/* Registry Error */}
      {registryError && (
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--jp-error-color3)',
          color: 'var(--jp-error-color1)',
          borderRadius: '4px',
          marginBottom: '12px',
          fontSize: '13px',
          border: '1px solid var(--jp-error-color1)'
        }}>
          <strong>Registry Error:</strong> {registryError}
        </div>
      )}

      {/* Connection Error */}
      {connectionError && (
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--jp-error-color3)',
          color: 'var(--jp-error-color1)',
          borderRadius: '4px',
          marginBottom: '12px',
          fontSize: '13px',
          border: '1px solid var(--jp-error-color1)'
        }}>
          <strong>Connection Error:</strong> {connectionError}
          <button
            onClick={clearError}
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              color: 'var(--jp-error-color1)',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* MetaMask Not Available */}
      {isMetaMaskAvailable === false && (
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--jp-warn-color3)',
          color: 'var(--jp-warn-color1)',
          borderRadius: '4px',
          marginBottom: '12px',
          fontSize: '13px',
          border: '1px solid var(--jp-warn-color1)'
        }}>
          <strong>MetaMask Required:</strong> Please install the MetaMask browser extension to use this application.
          <br />
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--jp-warn-color1)', textDecoration: 'underline' }}
          >
            Download MetaMask
          </a>
        </div>
      )}
      
      {account ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '16px',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '4px',
          backgroundColor: 'var(--jp-layout-color0)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                Connected Wallet
              </p>
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px' }}>
                {account.slice(0, 6)}...{account.slice(-4)}
              </p>
            </div>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--jp-success-color1)'
            }} />
          </div>
          
          {fetchingMetadata ? (
            <div style={{ 
              padding: '8px', 
              textAlign: 'center', 
              color: 'var(--jp-ui-font-color2)',
              fontSize: '12px'
            }}>
              Loading user metadata...
            </div>
          ) : metadata ? (
            <UserMetadataDisplay metadata={metadata} />
          ) : showRegister ? (
            <UserMetadataForm onRegister={handleRegister} />
          ) : null}
          
          <button
            style={{
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '8px 12px',
              transition: 'opacity 0.2s',
              backgroundColor: 'var(--jp-error-color1)',
              color: 'var(--jp-ui-inverse-font-color1)',
              border: 'none',
              fontSize: '12px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            onClick={disconnect}
          >
            Disconnect Wallet
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <button
            style={{
              borderRadius: '4px',
              cursor: isConnecting || registryLoading ? 'not-allowed' : 'pointer',
              padding: '12px 24px',
              transition: 'opacity 0.2s',
              backgroundColor: isConnecting || registryLoading ? 'var(--jp-layout-color2)' : 'var(--jp-brand-color1)',
              color: 'var(--jp-ui-inverse-font-color1)',
              border: 'none',
              opacity: isConnecting || registryLoading ? 0.6 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => !isConnecting && !registryLoading && (e.currentTarget.style.opacity = '0.75')}
            onMouseLeave={(e) => !isConnecting && !registryLoading && (e.currentTarget.style.opacity = '1')}
            onClick={handleConnect}
            disabled={isConnecting || registryLoading}
          >
            {isConnecting ? 'Connecting...' : 
             registryLoading ? 'Loading Registry...' : 
             isMetaMaskAvailable === false ? 'MetaMask Not Found' :
             'Connect MetaMask'}
          </button>
          
          {isMetaMaskAvailable === false && (
            <p style={{
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--jp-ui-font-color2)'
            }}>
              Install MetaMask extension to connect your wallet
            </p>
          )}
        </div>
      )}
    </div>
  );
}