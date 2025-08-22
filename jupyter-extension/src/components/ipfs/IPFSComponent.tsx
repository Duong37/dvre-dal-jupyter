import React, { useState, useEffect } from 'react';
import { ipfsService } from '../../utils/IPFSService';
import { assetService, AssetInfo } from '../../utils/AssetService';
import { useAuth } from '../../hooks/useAuth';

interface IPFSComponentProps {
  title?: string;
}

export const IPFSComponent: React.FC<IPFSComponentProps> = ({ 
  title = 'Storage' 
}) => {
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('dataset');
  const [ipfsHealthy, setIpfsHealthy] = useState<boolean | null>(null);
  const [blockchainAvailable, setBlockchainAvailable] = useState<boolean>(false);

  // Use auth hook to get user's wallet address
  const { account } = useAuth();

  useEffect(() => {
    checkIPFSHealth();
    checkBlockchainAvailability(); // This will also try to load assets
  }, []);

  // Reload assets when account changes (connect/disconnect/switch accounts)
  useEffect(() => {
    if (blockchainAvailable) {
      loadAssets();
    } else if (!account) {
      // Clear assets when user disconnects
      setAssets([]);
    }
  }, [account, blockchainAvailable]);

  const checkBlockchainAvailability = async () => {
    const hasMetaMask = typeof window !== 'undefined' && (window as any).ethereum;
    const isConfigured = assetService.isConfigured();
    setBlockchainAvailable(hasMetaMask && isConfigured);
    
    // If blockchain is available and user is connected, try to load user's assets immediately
    if (hasMetaMask && isConfigured && account) {
      try {
        const assetList = await assetService.getUserAssets(account);
        setAssets(assetList);
        console.log('User blockchain assets loaded:', assetList.length);
      } catch (error) {
        console.warn('Failed to load user blockchain assets on startup:', error);
      }
    }
  };

  const checkIPFSHealth = async () => {
    try {
      const healthy = await ipfsService.healthCheck();
      setIpfsHealthy(healthy);
    } catch (error) {
      setIpfsHealthy(false);
    }
  };

  const loadAssets = async () => {
    if (!account) {
      console.warn('Cannot load assets - no user account connected');
      setAssets([]);
      return;
    }
    
    try {
      const assetList = await assetService.getUserAssets(account);
      setAssets(assetList);
    } catch (error) {
      console.warn('Failed to load user assets (blockchain may not be available):', error);
      // Don't set error for this, as blockchain is optional
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Upload to IPFS first
      const uploadResult = await ipfsService.uploadFile(selectedFile);
      
      // If blockchain is available and asset name is provided, create blockchain asset
      if (blockchainAvailable && assetName.trim()) {
        try {
          if (!account) {
            // Try to connect wallet first - this should not happen normally since auth handles connection
            console.warn('No account available for blockchain registration');
            throw new Error('Wallet not connected');
          }
          
          console.log('IPFSComponent: Creating blockchain asset...');
          console.log('IPFSComponent: Asset name:', assetName);
          console.log('IPFSComponent: Asset type:', assetType);
          console.log('IPFSComponent: IPFS hash:', uploadResult.Hash);
          console.log('IPFSComponent: User account:', account);
          
          const result = await assetService.createAsset(assetName, assetType, uploadResult.Hash);
          console.log('IPFSComponent: Asset creation result:', result);
          console.log('IPFSComponent: Result type:', typeof result);
          
          // Reload assets to show the new one
          try {
            await loadAssets();
            console.log('IPFSComponent: Assets reloaded successfully');
          } catch (loadError) {
            console.warn('IPFSComponent: Failed to reload assets after creation, but asset was created successfully:', loadError);
          }
          
          if (result.startsWith('SUCCESS_')) {
            const txHash = result.replace('SUCCESS_', '');
            console.log('IPFSComponent: Asset creation successful, transaction hash:', txHash);
            alert(`Asset "${assetName}" created successfully on blockchain!\nTransaction Hash: ${txHash}\nIPFS Hash: ${uploadResult.Hash}`);
          } else {
            console.log('IPFSComponent: Asset creation successful, asset address:', result);
            alert(`Asset "${assetName}" created successfully on blockchain!\nAsset Address: ${result}\nIPFS Hash: ${uploadResult.Hash}`);
          }
        } catch (blockchainError) {
          console.error('IPFSComponent: Blockchain asset creation failed');
          console.error('IPFSComponent: Error type:', typeof blockchainError);
          console.error('IPFSComponent: Error message:', blockchainError instanceof Error ? blockchainError.message : 'Unknown error');
          console.error('IPFSComponent: Full error object:', blockchainError);
          
          alert(`File uploaded to IPFS successfully, but blockchain registration failed: ${blockchainError instanceof Error ? blockchainError.message : 'Unknown error'}\nIPFS Hash: ${uploadResult.Hash}\n\nYour file is still accessible via IPFS.`);
        }
      } else if (blockchainAvailable && !assetName.trim()) {
        alert(`File uploaded to IPFS successfully! IPFS Hash: ${uploadResult.Hash}\n\nTip: Provide an asset name to register it on the blockchain.`);
      } else {
        alert(`File uploaded to IPFS successfully! IPFS Hash: ${uploadResult.Hash}`);
      }

      // Reset form
      setSelectedFile(null);
      setAssetName('');
      
    } catch (error) {
      console.error('Upload failed:', error);
      setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (hash: string) => {
    try {
      setLoading(true);
      
      // Find the asset info to get the name and type
      const asset = assets.find(a => a.ipfsHash === hash);
      const assetName = asset?.name || `ipfs-${hash}`;
      const assetType = asset?.assetType || 'unknown';
      
      console.log(`Downloading asset: ${assetName} (${assetType})`);
      const blob = await ipfsService.downloadFile(hash, assetType);
      
      // Create download link with appropriate filename
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Determine filename based on asset type
      if (assetType === 'ro-crate') {
        // RO-Crates are directories, so they're downloaded as tar.gz
        a.download = `${assetName}.tar.gz`;
      } else {
        // Individual files (datasets, models, etc.) - preserve or guess extension
        const hasExtension = assetName.includes('.');
        a.download = hasExtension ? assetName : `${assetName}.bin`;
      }
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`Successfully downloaded: ${a.download}`);
    } catch (error) {
      console.error('Download failed:', error);
      setError(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getPublicUrl = (hash: string) => {
    return ipfsService.getPublicUrl(hash);
  };

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <h1 style={{ 
        fontSize: '2em',
        margin: '20px 0',
        color: 'var(--jp-ui-font-color1)',
        textAlign: 'center'
      }}>
        {title}
      </h1>

      {/* Health Status */}
      <div style={{ marginBottom: '20px', textAlign: 'center', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px',
          backgroundColor: ipfsHealthy ? '#4caf50' : '#f44336',
          color: 'white',
          fontSize: '12px'
        }}>
          IPFS: {ipfsHealthy ? 'Connected' : 'Disconnected'}
        </span>
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px',
          backgroundColor: blockchainAvailable ? '#4caf50' : '#f44336',
          color: 'white',
          fontSize: '12px'
        }}>
          Blockchain: {blockchainAvailable ? 'Connected' : 'Not Available'}
        </span>
      </div>

      {error && (
        <div style={{ 
          color: '#f44336', 
          background: '#ffebee',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Upload Section */}
      <div style={{ 
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        background: 'var(--jp-layout-color0)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--jp-ui-font-color1)' }}>
          Upload File
        </h3>
        
        <div style={{ marginBottom: '15px' }}>
          <input 
            type="file" 
            onChange={handleFileSelect}
            style={{ marginBottom: '10px', width: '100%' }}
          />
        </div>

        {/* Asset metadata (required for blockchain) */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold', color: 'var(--jp-ui-font-color1)' }}>
            {blockchainAvailable ? 'Asset Details (Blockchain Registration)' : 'Asset Details (Optional)'}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder={blockchainAvailable ? "Asset name (required for blockchain)" : "Asset name (optional)"}
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              style={{ 
                padding: '8px',
                border: `2px solid ${blockchainAvailable && !assetName ? '#f44336' : 'var(--jp-border-color1)'}`,
                borderRadius: '4px',
                flex: '1',
                minWidth: '200px',
                backgroundColor: blockchainAvailable ? 'var(--jp-layout-color0)' : 'var(--jp-layout-color1)'
              }}
            />
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              style={{ 
                padding: '8px',
                border: '1px solid var(--jp-border-color1)',
                borderRadius: '4px',
                backgroundColor: blockchainAvailable ? 'var(--jp-layout-color0)' : 'var(--jp-layout-color1)'
              }}
            >
              <option value="dataset">Dataset</option>
              <option value="model">Model</option>
              <option value="script">Script</option>
              <option value="document">Document</option>
              <option value="other">Other</option>
            </select>
          </div>
          {blockchainAvailable && (
            <div style={{ 
              marginTop: '5px',
              fontSize: '12px',
              color: 'var(--jp-brand-color1)',
              fontStyle: 'italic'
            }}>
              Asset name is required to register on the blockchain. Leave empty for IPFS-only storage.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedFile && !loading ? 'var(--jp-brand-color1)' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedFile && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Uploading...' : blockchainAvailable ? 'Upload & Register Asset' : 'Upload to IPFS'}
          </button>

          {blockchainAvailable && account && (
            <div style={{ 
              padding: '8px 12px',
              backgroundColor: 'var(--jp-brand-color1)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              Connected: {account.substring(0, 6)}...{account.substring(38)}
            </div>
          )}
        </div>
      </div>

      {/* Blockchain Assets (Primary) */}
      {blockchainAvailable && (
        <div style={{ 
          border: '2px solid var(--jp-brand-color1)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          background: 'var(--jp-layout-color0)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--jp-ui-font-color1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            My Assets ({assets.length})
            <button
              onClick={loadAssets}
              disabled={loading || !account}
              style={{
                padding: '4px 8px',
                backgroundColor: (loading || !account) ? '#ccc' : 'var(--jp-brand-color1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (loading || !account) ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </h3>
          
          {assets.length === 0 ? (
            <div style={{ 
              padding: '20px',
              textAlign: 'center',
              color: 'var(--jp-ui-font-color2)',
              background: 'var(--jp-layout-color2)',
              borderRadius: '4px'
            }}>
              {!account ? (
                <>
                  <p>Connect your wallet to view your assets.</p>
                  <p style={{ fontSize: '14px', margin: '10px 0' }}>
                    Your uploaded assets are tied to your wallet address for security.
                  </p>
                </>
              ) : (
                <>
                  <p>You haven't uploaded any assets yet.</p>
                  <p style={{ fontSize: '14px', margin: '10px 0' }}>
                    Upload a file with an asset name to create your first blockchain asset.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {assets.map((asset, index) => (
                <div
                  key={index}
                  style={{
                    padding: '15px',
                    border: '1px solid var(--jp-border-color2)',
                    borderRadius: '4px',
                    marginBottom: '10px',
                    background: 'var(--jp-layout-color1)'
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <strong style={{ color: 'var(--jp-ui-font-color1)' }}>
                      {asset.name}
                    </strong>
                    <span style={{ 
                      marginLeft: '10px',
                      padding: '2px 6px',
                      backgroundColor: 'var(--jp-brand-color1)',
                      color: 'white',
                      borderRadius: '3px',
                      fontSize: '10px'
                    }}>
                      {asset.assetType}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: 'var(--jp-ui-font-color2)',
                    wordBreak: 'break-all',
                    marginBottom: '8px'
                  }}>
                    IPFS: {asset.ipfsHash}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleDownload(asset.ipfsHash)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--jp-brand-color1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => window.open(getPublicUrl(asset.ipfsHash), '_blank')}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--jp-accept-color1)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IPFS Files (Fallback/Additional) - COMMENTED OUT */}
      {/* 
      <div style={{ 
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        background: 'var(--jp-layout-color0)',
        opacity: blockchainAvailable ? 0.7 : 1
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: 'var(--jp-ui-font-color1)' }}>
          Raw IPFS Files ({files.length}) {blockchainAvailable && '(Unregistered)'}
        </h3>
        
        <button
          onClick={loadFiles}
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '15px'
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>

        {files.length === 0 && !loading && !error ? (
          <div style={{ 
            padding: '20px',
            textAlign: 'center',
            color: 'var(--jp-ui-font-color2)',
            background: 'var(--jp-layout-color2)',
            borderRadius: '4px'
          }}>
            <p style={{ marginBottom: '10px' }}>No files found or IPFS not accessible.</p>
            <p style={{ fontSize: '14px', margin: '10px 0' }}>
              If you have IPFS hashes, you can still access files directly:
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Enter IPFS hash (QmXXXXXX...)"
                style={{ 
                  padding: '8px',
                  border: '1px solid var(--jp-border-color1)',
                  borderRadius: '4px',
                  minWidth: '300px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const hash = (e.target as HTMLInputElement).value.trim();
                    if (hash.startsWith('Qm') || hash.startsWith('bafy')) {
                      window.open(getPublicUrl(hash), '_blank');
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="Enter IPFS hash"]') as HTMLInputElement;
                  const hash = input?.value.trim();
                  if (hash && (hash.startsWith('Qm') || hash.startsWith('bafy'))) {
                    window.open(getPublicUrl(hash), '_blank');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--jp-brand-color1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Open
              </button>
            </div>
          </div>
        ) : (
          <div style={{ 
            maxHeight: '400px',
            overflowY: 'auto',
            border: '1px solid var(--jp-border-color2)',
            borderRadius: '4px'
          }}>
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  borderBottom: index < files.length - 1 ? '1px solid var(--jp-border-color2)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: index % 2 === 0 ? 'var(--jp-layout-color0)' : 'var(--jp-layout-color2)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {file.Name || `File ${index + 1}`}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: 'var(--jp-ui-font-color2)',
                    fontFamily: 'monospace'
                  }}>
                    {file.Hash}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                    Size: {formatSize(file.Size)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleDownload(file.Hash)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--jp-brand-color1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Download
                  </button>
                  <button
                    onClick={() => window.open(getPublicUrl(file.Hash), '_blank')}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--jp-warn-color1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      */}
    </div>
  );
};

export default IPFSComponent;
