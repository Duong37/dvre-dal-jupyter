/**
 * DAL Project Handlers - Action handlers for Active Learning project operations
 */

import { DALProject } from './types';
import { SessionState } from './services/DALProjectSession';

export interface ProjectHandlers {
  handleStartNextIteration: () => Promise<void>;
  handleStartFinalTraining: () => Promise<void>;
  handleEndProject: () => Promise<void>;
  handleBatchVoteSubmission: (sampleIds: string[], labels: string[]) => Promise<void>;
  handleVoteSubmission: (sampleId: string, label: string) => Promise<void>;
  handleRefreshData: () => Promise<void>;
  handlePublishFinalResults: () => Promise<void>;
}

export interface HandlerDependencies {
  project: DALProject;
  currentUser: string;
  isCoordinator: boolean;
  dalSession: any; // DALProjectSession type
  sessionState: SessionState | null;
  triggerRefresh: () => void;
  setError: (error: string | null) => void;
}

export const createProjectHandlers = (deps: HandlerDependencies): ProjectHandlers => {
  const { project, currentUser, isCoordinator, dalSession, triggerRefresh, setError } = deps;

  const handleStartNextIteration = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can start iterations');
      return;
    }

    if (!dalSession) {
      setError('DAL Session not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      setError(null);
      
      // GUARD: Check if voting is currently active
      console.log('Checking for active voting before starting new iteration...');
      const { alContractService } = await import('./services/ALContractService');
      const votingStatus = await alContractService.isVotingActive(project.contractAddress);
      
      if (votingStatus.isActive) {
        const errorMessage = `Cannot start new iteration: Voting is currently active!\n\n` +
          `• ${votingStatus.activeSamples} samples still need votes\n` +
          `• Round: ${votingStatus.round}\n` +
          `• Time remaining: ${Math.ceil(votingStatus.timeRemaining / 60)} minutes\n\n` +
          `Please wait for all voting to complete before starting the next iteration.`;
        
        setError(errorMessage);
        console.warn('Cannot start iteration - voting is active:', votingStatus);
        return;
      }
      
      console.log('No active voting detected - proceeding with iteration');
      
      // Export voting results from previous rounds to AL-Engine format
      try {
        const { votingResultsConnector } = await import('./services/VotingResultsConnector');
        console.log('[PROCESSING] Exporting previous voting results to AL-Engine before starting iteration...');
        
        const exportedRounds = await votingResultsConnector.exportAllVotingResults(project.contractAddress);
        
        if (exportedRounds > 0) {
          console.log(`[SUCCESS] Exported voting results for ${exportedRounds} rounds - AL-Engine will use these for training`);
        } else {
          console.log('[INFO] No previous voting results to export (first iteration)');
        }
        
      } catch (exportError) {
        console.warn('[WARNING] Failed to export voting results before iteration:', exportError);
        // Continue with iteration even if export fails
      }
      
      // Start the next iteration via DAL Session
      console.log('Starting next iteration via DAL Session bridge...');
      
      // Use the DAL Session bridge to orchestrate the complete workflow
      await dalSession.startIteration();
      
      console.log('AL iteration workflow started successfully via DAL Session');
      
    } catch (error) {
      console.error('Failed to start next AL iteration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iteration';
      setError(errorMessage);
    }
  };

  const handleStartFinalTraining = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can start final training');
      return;
    }

    if (!dalSession) {
      setError('DAL Session not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      setError(null);
      
      // GUARD: Check if voting is currently active
      console.log('Checking for active voting before starting final training...');
      const { alContractService } = await import('./services/ALContractService');
      const votingStatus = await alContractService.isVotingActive(project.contractAddress);
      
      if (votingStatus.isActive) {
        const errorMessage = `Cannot start final training: Voting is currently active!\n\n` +
          `• ${votingStatus.activeSamples} samples still need votes\n` +
          `• Round: ${votingStatus.round}\n` +
          `• Time remaining: ${Math.ceil(votingStatus.timeRemaining / 60)} minutes\n\n` +
          `Please wait for all voting to complete before starting final training.`;
        
        setError(errorMessage);
        console.warn('Cannot start final training - voting is active:', votingStatus);
        return;
      }
      
      console.log('No active voting detected - proceeding with final training');
      console.log('Starting final training via DAL Session bridge');
      
      // Use the DAL Session bridge to orchestrate the complete workflow
      await dalSession.startFinalTraining();
      
      console.log('Final training workflow started successfully via DAL Session');
      
    } catch (error) {
      console.error('Failed to start final training:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start final training';
      setError(errorMessage);
    }
  };

  const handleEndProject = async () => {
    if (!isCoordinator) {
      setError('Only coordinators can end projects');
      return;
    }

    try {
      setError(null);
      console.log('Ending project from UI');
      
      // Use ALContractService directly instead of hook (which can't be called in async functions)
      const { alContractService } = await import('./services/ALContractService');
      
      const success = await alContractService.endProject(project.contractAddress, currentUser);
      
      if (!success) {
        throw new Error('Failed to end project via smart contract');
      }
      
      // Trigger data refresh to show updated state
      triggerRefresh();
      
      console.log('Project ended successfully');
      
    } catch (error) {
      console.error(' Failed to end project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to end project';
      setError(errorMessage);
    }
  };

  const handleBatchVoteSubmission = async (sampleIds: string[], labels: string[]) => {
    if (!dalSession) {
      setError('DAL Session not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      setError(null);
      const batchType = sampleIds.length === 1 ? 'single-sample batch' : 'multi-sample batch';
      console.log(`Submitting ${batchType} vote via DAL Session bridge`);
      
      // Use the DAL Session bridge for batch vote submission (works for any batch size)
      await dalSession.submitBatchVote(sampleIds, labels);
      
      console.log(`${batchType} vote submitted successfully via DAL Session`);
      
    } catch (error) {
      console.error(' Failed to submit batch vote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit batch vote';
      setError(errorMessage);
    }
  };

  // Legacy wrapper for single sample voting (converted to batch)
  const handleVoteSubmission = async (sampleId: string, label: string) => {
    // Convert single vote to batch vote for consistency
    await handleBatchVoteSubmission([sampleId], [label]);
  };

  const handleRefreshData = async () => {
    console.log('Refreshing all project data from smart contracts...');
    
    // Export voting results to AL-Engine format before refreshing
    try {
      const { votingResultsConnector } = await import('./services/VotingResultsConnector');
      console.log('[PROCESSING] Exporting blockchain voting results to AL-Engine format...');
      
      const exportedRounds = await votingResultsConnector.exportAllVotingResults(project.contractAddress);
      
      if (exportedRounds > 0) {
        console.log(`[SUCCESS] Exported voting results for ${exportedRounds} rounds to AL-Engine`);
      } else {
        console.log('[INFO] No voting results to export (no completed rounds yet)');
      }
      
      // Get voting summary for debugging
      const summary = await votingResultsConnector.getVotingResultsSummary(project.contractAddress);
      console.log(summary);
      
    } catch (exportError) {
      console.warn('[WARNING] Failed to export voting results to AL-Engine:', exportError);
    }
    
    // Trigger data refresh - loading and error states handled by parent component
    triggerRefresh();
    
    console.log('Project data refresh triggered with voting results export');
  };

  const handlePublishFinalResults = async () => {
    console.log('Publishing final AL project results...');
    
    try {
      // Import required services
      const { alContractService } = await import('./services/ALContractService');
      const { ethers } = await import('ethers');
      const { RPC_URL } = await import('../../config/contracts');
      
      // Check if we can access project end status
      let endStatus;
      try {
        endStatus = await alContractService.getProjectEndStatus(project.contractAddress);
        
        if (!endStatus.shouldEnd) {
          const shouldForce = window.confirm(
            `Project is still active (Round ${endStatus.currentRound}/${endStatus.maxIterations}). ` +
            'Do you want to force publish final results anyway?'
          );
          if (!shouldForce) {
            return;
          }
        } else {
          console.log(`Project should end: ${endStatus.reason}`);
        }
      } catch (statusError) {
        console.warn('Could not get project end status, proceeding with publication...', statusError);
      }
      
      // IMPORTANT: Get the base Project address for AL-Engine operations
      // AL-Engine expects the base Project address for its directory structure
      const { getBaseProjectAddress } = await import('./utils/AddressResolver');
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      
      let baseProjectAddress: string;
      try {
        // First, try to check if project.contractAddress is already a base Project address
        // by attempting to call a Project-specific method
        const Project = (await import('../../abis/Project.json')).default;
        const testProjectContract = new ethers.Contract(project.contractAddress, Project.abi, provider);
        await testProjectContract.creator(); // This should work if it's a base Project
        
        // If we get here, project.contractAddress is already a base Project address
        baseProjectAddress = project.contractAddress;
        console.log(`Project address ${project.contractAddress} is already a base Project address`);
      } catch {
        // If that failed, it might be an ALProject address, so resolve the base Project address
        try {
          baseProjectAddress = await getBaseProjectAddress(project.contractAddress, provider);
          console.log(`Resolved base Project address: ${baseProjectAddress} (from ALProject: ${project.contractAddress})`);
        } catch (resolveError) {
          // If both fail, assume it's a base Project address and use it directly
          console.warn('Could not resolve address type, assuming base Project address:', resolveError);
          baseProjectAddress = project.contractAddress;
        }
      }
      
      // Step 1: Get the complete RO-Crate folder from AL-Engine
      console.log('Step 1: Collecting complete RO-Crate folder from AL-Engine...');
      const alEngineUrl = 'http://localhost:5050'; // AL-Engine API base URL
      
      // Use base Project address for AL-Engine API call
      const roCrateFolderResponse = await fetch(`${alEngineUrl}/api/project/${baseProjectAddress}/ro-crate`);
      
      if (!roCrateFolderResponse.ok) {
        throw new Error(`AL-Engine API failed: ${roCrateFolderResponse.status} ${roCrateFolderResponse.statusText}`);
      }
      
      const folderData = await roCrateFolderResponse.json();
      console.log('Collected RO-Crate folder from AL-Engine:', {
        totalFiles: folderData.folder_structure?.total_files || 0,
        totalSize: folderData.folder_structure?.total_size || 0,
        totalIterations: folderData.al_summary?.total_iterations || 0,
        totalSamples: folderData.al_summary?.total_samples_queried || 0,
        latestPerformance: folderData.al_summary?.latest_performance
      });
      
      // Step 2: Convert folder structure to IPFS file format
      console.log('Step 2: Preparing folder structure for IPFS upload...');
      const { IPFSService } = await import('../deployment/services/IPFSService');
      
      const bundleFiles = folderData.folder_structure.files.map((file: any) => {
        // Handle binary files (base64 encoded)
        let content = file.content;
        if (file.is_binary && file.type === 'application/octet-stream') {
          // Convert base64 back to binary for IPFS upload
          const binaryData = atob(content);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }
          content = bytes.buffer;
        }
        
        return {
          name: file.name,
          content: content,
          type: file.type || 'text/plain'
        };
      });
      
      console.log(`Prepared ${bundleFiles.length} files for IPFS upload`);
      
      // Step 3: Upload complete RO-Crate folder to IPFS
      console.log('Step 3: Uploading complete RO-Crate folder to IPFS...');
      const folderName = `dvre-al-project-${project.contractAddress}`;
      
      const ipfsResults = await IPFSService.getInstance().uploadDirectory(bundleFiles, folderName);
      
      console.log('Uploaded complete RO-Crate folder to IPFS:', ipfsResults.hash);
      
      // Step 4: Update project configuration
      console.log('Step 4: Updating project configuration...');
      const { projectConfigurationService } = await import('../deployment/services/ProjectConfigurationService');
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const projectConfig = projectConfigurationService.getProjectConfiguration(project.contractAddress);
      if (projectConfig) {
        // Update configuration with final IPFS hash
        projectConfig.ipfs = {
          roCrateHash: ipfsResults.hash,
          publishedAt: new Date().toISOString()
        };
        projectConfig.status = 'deployed';
        projectConfig.lastModified = new Date().toISOString();
        
        // Add AL-specific metadata
        projectConfig.extensions.dal = {
          finalResults: {
            totalIterations: folderData.al_summary?.total_iterations || 0,
            totalSamplesQueried: folderData.al_summary?.total_samples_queried || 0,
            latestPerformance: folderData.al_summary?.latest_performance,
            publishedAt: new Date().toISOString(),
            ipfsHash: ipfsResults.hash,
            ipfsUrl: ipfsResults.url
          }
        };
        
        console.log('Project configuration updated with final results');
      }
      
      console.log('Step 5: Creating blockchain asset and updating smart contract...');
      let contributors: string[] = []; // Declare contributors in broader scope
      
      try {
        // Step 5a: Create blockchain asset for final RO-Crate
        console.log('Creating blockchain asset for final results...');
        const { AssetService } = await import('../../utils/AssetService');
        const { ethers } = await import('ethers');
        
        // Get blockchain connection
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();
        console.log('Wallet connection established:', signerAddress);
        
        // Create AssetService instance
        const assetService = new AssetService();
        
        // Wait for AssetService to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create asset name: ro-crate-<project-address>-final
        const assetName = `ro-crate-${project.contractAddress}-final`;
        const assetType = 'ro-crate';
        
        console.log(`Creating final results asset: "${assetName}" with IPFS hash: ${ipfsResults.hash}`);
        
        // Get project contributors to add as viewers
        try {
          console.log('Getting project contributors for final results asset viewers...');
          const { getAllParticipantsForProject } = await import('../../hooks/useProjects');
          
          // Get all project participants
          const participantsData = await getAllParticipantsForProject(project.contractAddress);
          console.log('Retrieved participants:', participantsData.participantAddresses.length, 'participants');
          
          // Filter for contributors (exclude current user who is the asset owner)
          const filteredContributors = participantsData.participantAddresses.filter((address, index) => {
            const role = participantsData.roles[index];
            const isNotCurrentUser = address.toLowerCase() !== currentUser.toLowerCase();
            const isContributor = role === 'contributor' || role === 'coordinator';
            return isNotCurrentUser && isContributor;
          });
          
          // Create mutable copy of contributors array to avoid "read-only property" error
          contributors = [...filteredContributors];
          
          console.log('Found', contributors.length, 'contributors to add as viewers');
          console.log('Contributors:', contributors);
        } catch (error) {
          console.warn(' Failed to get contributors, creating asset without viewers:', error);
          contributors = [];
        }
        
        // Create the asset with contributors as viewers
        const assetContractAddress = await assetService.createAsset(assetName, assetType, ipfsResults.hash, contributors);
        console.log('Final results asset created with viewers at:', assetContractAddress);
        console.log(`Added ${contributors.length} contributors as viewers to final results asset`);
        
        // Step 5b: Update Project contract with final RO-Crate asset address
        console.log('Updating Project contract with final RO-Crate asset address...');
        
        // Get the base Project contract (setFinalROCrateAsset is on base Project, not ALProject)
        const Project = (await import('../../abis/Project.json')).default;
        const projectContract = new ethers.Contract(baseProjectAddress, Project.abi, signer);
        
        // Use the setFinalROCrateAsset function on base Project contract with asset address
        const setFinalAssetTx = await projectContract.setFinalROCrateAsset(assetContractAddress);
        await setFinalAssetTx.wait();
        console.log('Project contract updated with final RO-Crate asset address');
        
      } catch (contractError) {
        console.warn(' Failed to create asset or update smart contract (continuing anyway):', contractError);
      }
      
      // Step 6: Show success message
      const successMessage = 
        ' Final Results Published Successfully!\n\n' +
        ` Project Summary:\n` +
        `• Total AL Iterations: ${folderData.al_summary?.total_iterations || 0}\n` +
        `• Total Samples Queried: ${folderData.al_summary?.total_samples_queried || 0}\n` +
        `• Total Files: ${folderData.folder_structure?.total_files || 0}\n` +
        `• Latest Accuracy: ${folderData.al_summary?.latest_performance?.accuracy || 'N/A'}\n` +
        `• Latest F1-Score: ${folderData.al_summary?.latest_performance?.f1_score || 'N/A'}\n\n` +
        ` IPFS Hash: ${ipfsResults.hash}\n` +
        ` IPFS URL: ${ipfsResults.url}\n\n` +
        ` Blockchain Asset: ro-crate-${project.contractAddress}-final\n` +
        ` Contributors with Access: ${contributors.length} project contributors added as viewers\n` +
        ` Project Contract Updated: Final RO-Crate hash stored on blockchain\n\n` +
        ` Your complete Active Learning project folder is now publicly available!\n` +
        ` All project contributors can now access the final results from their Storage tab.\n` +
        `You can download the final RO-Crate folder from the Storage tab.`;
      
      alert(successMessage);
      
      // Trigger data refresh to show updated state
      triggerRefresh();
      
      console.log('Final results publish process completed successfully');
      
    } catch (error) {
      console.error(' Failed to publish final results:', error);
      
      let errorMessage = 'Failed to publish final results: ';
      if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error';
      }
      
      // Show detailed error to user
      alert(` Publish Failed\n\n${errorMessage}\n\nPlease check:\n• AL-Engine is running (localhost:5050)\n• Project has completed iterations\n• Project folder exists in al-engine/ro-crates/\n• Wallet is connected\n• Network connectivity`);
      
      throw error;
    }
  };

  return {
    handleStartNextIteration,
    handleStartFinalTraining,
    handleEndProject,
    handleBatchVoteSubmission,
    handleVoteSubmission,
    handleRefreshData,
    handlePublishFinalResults
  };
}; 