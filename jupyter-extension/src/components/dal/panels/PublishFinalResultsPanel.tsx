import React, { useState, useEffect } from 'react';
import { PublishFinalResultsPanelProps } from './PanelTypes';

export const PublishFinalResultsPanel: React.FC<PublishFinalResultsPanelProps> = ({
  project,
  currentUser,
  isCoordinator,
  onPublishFinalResults,
  onError
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [finalRoCrateHash, setFinalRoCrateHash] = useState<string>('');
  const [checkingPublishStatus, setCheckingPublishStatus] = useState(true);

  // Check if project has been published by looking at rocrateHashFinal
  useEffect(() => {
    const checkPublishStatus = async () => {
      if (!project?.contractAddress) return;
      
      try {
        setCheckingPublishStatus(true);
        
        // Import required dependencies
        const { ethers } = await import('ethers');
        const { RPC_URL } = await import('../../../config/contracts');
        const { getBaseProjectAddress } = await import('../utils/AddressResolver');
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Get base Project address (rocrateHashFinal is stored on base Project contract)
        let baseProjectAddress: string;
        try {
          // First, try to check if project.contractAddress is already a base Project address
          const Project = (await import('../../../abis/Project.json')).default;
          const testProjectContract = new ethers.Contract(project.contractAddress, Project.abi, provider);
          await testProjectContract.creator(); // This should work if it's a base Project
          
          // If we get here, project.contractAddress is already a base Project address
          baseProjectAddress = project.contractAddress;
        } catch {
          // If that failed, it might be an ALProject address, so resolve the base Project address
          try {
            baseProjectAddress = await getBaseProjectAddress(project.contractAddress, provider);
          } catch (resolveError) {
            // If both fail, assume it's a base Project address and use it directly
            baseProjectAddress = project.contractAddress;
          }
        }
        
        // Get the final RO-Crate hash from base Project contract
        const Project = (await import('../../../abis/Project.json')).default;
        const projectContract = new ethers.Contract(baseProjectAddress, Project.abi, provider);
        const rocrateHashFinal = await projectContract.getFinalROCrateHash();
        
        if (rocrateHashFinal && rocrateHashFinal.length > 0) {
          setIsPublished(true);
          setFinalRoCrateHash(rocrateHashFinal);
          console.log('Project has been published with final RO-Crate hash:', rocrateHashFinal);
        } else {
          setIsPublished(false);
          setFinalRoCrateHash('');
          console.log('Project has not been published yet');
        }
      } catch (error) {
        console.error(' Failed to check publish status:', error);
        // Assume not published if we can't check
        setIsPublished(false);
        setFinalRoCrateHash('');
      } finally {
        setCheckingPublishStatus(false);
      }
    };

    checkPublishStatus();
  }, [project?.contractAddress]);

  const handlePublishFinalResults = async () => {
    // Check if project has ended before allowing publication
    if (project?.isActive) {
      onError('Cannot publish final results while project is still active. Please end the project first.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to publish the final results?\n\n' +
      'This will:\n' +
      '• Upload the updated RO-Crate with all AL iterations to IPFS\n' +
      '• Make the final results publicly available\n' +
      '• Update the project contract with the final RO-Crate hash\n\n' +
      'This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      setIsPublishing(true);
      await onPublishFinalResults();
      
      // Refresh publish status after successful publication
      setTimeout(() => {
        const refreshStatus = async () => {
          try {
            const { ethers } = await import('ethers');
            const { RPC_URL } = await import('../../../config/contracts');
            const { getBaseProjectAddress } = await import('../utils/AddressResolver');
            
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            
            let baseProjectAddress: string;
            try {
              const Project = (await import('../../../abis/Project.json')).default;
              const testProjectContract = new ethers.Contract(project.contractAddress, Project.abi, provider);
              await testProjectContract.creator();
              baseProjectAddress = project.contractAddress;
            } catch {
              try {
                baseProjectAddress = await getBaseProjectAddress(project.contractAddress, provider);
              } catch {
                baseProjectAddress = project.contractAddress;
              }
            }
            
            const Project = (await import('../../../abis/Project.json')).default;
            const projectContract = new ethers.Contract(baseProjectAddress, Project.abi, provider);
            const rocrateHashFinal = await projectContract.getFinalROCrateHash();
            
            if (rocrateHashFinal && rocrateHashFinal.length > 0) {
              setIsPublished(true);
              setFinalRoCrateHash(rocrateHashFinal);
            }
          } catch (error) {
            console.error('Failed to refresh publish status:', error);
          }
        };
        refreshStatus();
      }, 2000);
      
    } catch (error) {
      console.error(' Failed to publish final results:', error);
      onError(error instanceof Error ? error.message : 'Failed to publish final results');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isCoordinator) {
    return (
      <div className="publish-results-panel">
        <div className="panel-header">
          <h3>Publish Final Results</h3>
          <p>Access restricted to project coordinators</p>
        </div>
        <div style={{ 
          textAlign: 'center', 
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
          <h4>Coordinator Access Required</h4>
          <p style={{ color: '#666' }}>
            Only project coordinators can publish final results.
          </p>
        </div>
      </div>
    );
  }

  // Check if project is still active (not ended)
  const projectIsActive = project?.isActive !== false;
  const canPublish = !projectIsActive;

  return (
    <div className="publish-results-panel">
      <div className="panel-header">
        <h3>Publish Final Results</h3>
        <p>Make your Active Learning project results publicly available</p>
      </div>

      <div className="panel-content">
        {/* Loading state while checking publish status */}
        {checkingPublishStatus && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}></div>
            <h4>Checking Publication Status...</h4>
            <p style={{ color: '#666' }}>Please wait while we verify if this project has been published.</p>
          </div>
        )}

        {/* Published State - Show final results info and Storage link */}
        {!checkingPublishStatus && isPublished && (
          <div style={{
            backgroundColor: '#d1fae5',
            border: '2px solid #22c55e',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h4 style={{ 
              marginTop: 0, 
              marginBottom: '16px',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '20px'
            }}>
              <span style={{ fontSize: '24px' }}></span>
              Final Results Published
            </h4>
            <p style={{ margin: '0 0 16px 0', color: '#166534', fontSize: '16px', fontWeight: 'bold' }}>
              Your Active Learning project results have been successfully published to IPFS!
            </p>
            <div style={{ margin: '16px 0', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #22c55e' }}>
              <p style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '14px', fontWeight: 'bold' }}>
                 IPFS Hash: <code style={{ backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{finalRoCrateHash}</code>
              </p>
            </div>
            
            {/* Storage Access Instructions */}
            <div style={{ 
              backgroundColor: '#f0f9ff', 
              border: '1px solid #3b82f6', 
              borderRadius: '6px',
              padding: '16px',
              marginTop: '16px'
            }}>
              <h5 style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '16px' }}>
                 Access Your Final Results
              </h5>
              <p style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '14px' }}>
                To download and explore your complete AL project results:
              </p>
              <ol style={{ margin: '0 0 12px 20px', color: '#1e40af', fontSize: '14px' }}>
                <li>Navigate to the <strong>Storage</strong> tab in the main JupyterLab interface</li>
                <li>Look for the asset named: <code style={{ backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>ro-crate-{project.contractAddress}-final</code></li>
                <li>Click on the asset to view details and download the complete RO-Crate folder</li>
              </ol>
              <p style={{ margin: 0, color: '#1e40af', fontSize: '14px', fontStyle: 'italic' }}>
                 All project participants can access the final results from their Storage tab.
              </p>
            </div>
          </div>
        )}

        {/* Not Published State - Show publish interface */}
        {!checkingPublishStatus && !isPublished && (
          <>
            {/* Project Status Check */}
            {projectIsActive && (
              <div className="warning-section" style={{
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h4 style={{ 
                  marginTop: 0, 
                  marginBottom: '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}></span>
                  Project Still Active
                </h4>
                <p style={{ margin: '0 0 12px 0', color: '#92400e', fontSize: '16px', fontWeight: 'bold' }}>
                  Cannot publish final results while the project is still active.
                </p>
                <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
                  Please end the project first using the "End Project" button in the Control Panel, then return here to publish the final results.
                </p>
              </div>
            )}

            {/* Information Section */}
            <div className="info-section" style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h4 style={{ 
                marginTop: 0, 
                marginBottom: '16px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '18px' }}></span>
                What happens when you publish?
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#374151' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>RO-Crate Collection:</strong> The complete project RO-Crate including all AL iterations, models, and performance metrics will be collected from the AL-Engine
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>IPFS Upload:</strong> The updated RO-Crate will be uploaded to IPFS, making it permanently accessible
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Blockchain Update:</strong> The project smart contract will be updated with the final RO-Crate hash
                </li>
                <li style={{ marginBottom: 0 }}>
                  <strong>Public Access:</strong> The final results will be discoverable and downloadable by anyone
                </li>
              </ul>
            </div>

            {/* Important Note */}
            <div className="warning-section" style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h4 style={{ 
                marginTop: 0, 
                marginBottom: '12px',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '18px' }}></span>
                Important Note
              </h4>
              <p style={{ margin: 0, color: '#991b1b', fontSize: '16px', fontWeight: 'bold' }}>
                This action cannot be undone. Make sure your Active Learning project is complete and you're ready to share the final results.
              </p>
            </div>

            {/* Action Button */}
            <div className="action-section" style={{ textAlign: 'center' }}>
              <button
                onClick={handlePublishFinalResults}
                disabled={isPublishing || !canPublish}
                style={{
                  backgroundColor: (!canPublish || isPublishing) ? '#94a3b8' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '12px 32px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: (!canPublish || isPublishing) ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto',
                  opacity: !canPublish ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (canPublish && !isPublishing) {
                    (e.target as HTMLElement).style.backgroundColor = '#047857';
                  }
                }}
                onMouseOut={(e) => {
                  if (canPublish && !isPublishing) {
                    (e.target as HTMLElement).style.backgroundColor = '#059669';
                  }
                }}
              >
                <span style={{ fontSize: '18px' }}>
                  {isPublishing ? '' : !canPublish ? '' : ''}
                </span>
                {isPublishing ? 'Publishing Final Results...' : 
                 !canPublish ? 'Project Must Be Ended First' : 
                 'Publish Final Results'}
              </button>
              
              {!canPublish && (
                <p style={{ 
                  marginTop: '12px', 
                  fontSize: '14px', 
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  End the project in the Control Panel to enable publishing
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublishFinalResultsPanel; 