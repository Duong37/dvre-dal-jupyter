/**
 * AL Contract Service - orchestrates interactions between smart contracts, AL-Engine, and UI components
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import ALProject from '../../../abis/ALProject.json';
import ALProjectVoting from '../../../abis/ALProjectVoting.json';

// Import our modular services
import { VotingService, ActiveVoting } from './VotingService';
import { ALEngineService, ModelUpdate } from './ALEngineService';
import { offChainContractService } from './OffChainContractService';
import { VotingRecord, UserContribution } from '../types';
import { resolveALProjectAddress } from '../utils/AddressResolver';

export { VotingRecord, UserContribution, ActiveVoting, ModelUpdate };

export class ALContractService {
  private static instance: ALContractService;
  private provider: ethers.JsonRpcProvider;
  
  // Modular services
  private votingService: VotingService;
  private alEngineService: ALEngineService;

  private constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.votingService = new VotingService();
    this.alEngineService = new ALEngineService();
  }

  static getInstance(): ALContractService {
    if (!ALContractService.instance) {
      ALContractService.instance = new ALContractService();
    }
    return ALContractService.instance;
  }

  // =====================================================================
  // PROJECT STATUS AND CONFIGURATION
  // =====================================================================

  // =====================================================================
  // VOTING OPERATIONS (delegated to VotingService)
  // =====================================================================

  async getVotingHistory(projectAddress: string): Promise<VotingRecord[]> {
    return this.votingService.getVotingHistory(projectAddress);
  }

  async getUserContributions(projectAddress: string): Promise<UserContribution[]> {
    return this.votingService.getUserContributions(projectAddress);
  }

  async submitBatchVote(projectAddress: string, sampleIds: string[], labels: string[], userAddress: string): Promise<boolean> {
    return this.votingService.submitBatchVote(projectAddress, sampleIds, labels, userAddress);
  }

  async getVotingSessionStatus(projectAddress: string, sampleId: string) {
    return this.votingService.getVotingSessionStatus(projectAddress, sampleId);
  }

  async getVoterInformation(projectAddress: string) {
    return this.votingService.getVoterInformation(projectAddress);
  }

  // =====================================================================
  // AL-ENGINE OPERATIONS (delegated to ALEngineService)
  // =====================================================================

  async getModelUpdates(projectAddress: string): Promise<ModelUpdate[]> {
      const votingHistory = await this.getVotingHistory(projectAddress);
    return this.alEngineService.getModelUpdates(projectAddress, votingHistory);
  }

  // =====================================================================
  // PROJECT STATUS & SMART CONTRACT OPERATIONS
  // =====================================================================

  async getActiveVoting(projectAddress: string): Promise<ActiveVoting | null> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return null;
      }

      // Use off-chain implementation instead of removed contract function
      const activeBatch = await this.getActiveBatch(alProjectAddress);
      if (!activeBatch || activeBatch.sampleIds.length === 0) {
        return null;
      }

      // For batch voting, return the first active sample as representative
      const sampleId = activeBatch.sampleIds[0];
      const sampleData = activeBatch.sampleData[0] || { sampleId, data: 'Sample data' };
        
      return {
        sampleId,
        sampleData,
        labelOptions: activeBatch.labelOptions,
        currentVotes: {},
        timeRemaining: Number(activeBatch.timeRemaining),
        voters: []
      };
    } catch (error) {
      console.error('Error getting active voting:', error);
      return null;
    }
  }

  /**
   * Check if any voting session is currently active for the project
   * This is used as a guard before starting new iterations or final training
   */
  async isVotingActive(projectAddress: string): Promise<{
    isActive: boolean;
    activeSamples: number;
    round: number;
    timeRemaining: number;
    reason?: string;
  }> {
    try {
      console.log('Checking if voting is currently active for project:', projectAddress);
      
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('[SAVED] Project has no AL contracts - no voting active');
        return {
          isActive: false,
          activeSamples: 0,
          round: 0,
          timeRemaining: 0,
          reason: 'No AL contracts found'
        };
      }

      // Get voting contract address
      const votingContractAddress = await projectContract.votingContract();
      if (!votingContractAddress || votingContractAddress === ethers.ZeroAddress) {
        console.log('[SAVED] No voting contract found - no voting active');
        return {
          isActive: false,
          activeSamples: 0,
          round: 0,
          timeRemaining: 0,
          reason: 'No voting contract found'
        };
      }

      // Check current round and batch status
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
      const currentRound = await votingContract.currentRound();
      
      // Get batch status for current round
      const batchStatus = await votingContract.getBatchStatus(currentRound);
      
      if (!batchStatus.isActive) {
        console.log(`[SAVED] No active batch in round ${currentRound} - no voting active`);
        return {
          isActive: false,
          activeSamples: 0,
          round: Number(currentRound),
          timeRemaining: 0,
          reason: `No active batch in round ${currentRound}`
        };
      }

      // Get active batch details
      const activeBatch = await this.getActiveBatch(alProjectAddress);
      if (!activeBatch || activeBatch.sampleIds.length === 0) {
        console.log('[SAVED] No active samples found - no voting active');
        return {
          isActive: false,
          activeSamples: 0,
          round: Number(currentRound),
          timeRemaining: 0,
          reason: 'No active samples found'
        };
      }

      // Check if any samples are actually still active for voting
      let activeSampleCount = 0;
      for (const sampleId of activeBatch.sampleIds) {
        try {
          const session = await votingContract.getVotingSession(sampleId);
          const isActive = session[1] && !session[2]; // isActive && !isFinalized
          if (isActive) {
            activeSampleCount++;
          }
        } catch (error) {
          console.warn(`[WARNING] Could not check status for sample ${sampleId}:`, error);
        }
      }

      const isVotingActive = activeSampleCount > 0;
      const timeRemaining = activeBatch.timeRemaining || 0;

      console.log(`[STATS] Voting status check result:`, {
        isActive: isVotingActive,
        activeSamples: activeSampleCount,
        totalSamples: activeBatch.sampleIds.length,
        round: Number(currentRound),
        timeRemaining
      });

      return {
        isActive: isVotingActive,
        activeSamples: activeSampleCount,
        round: Number(currentRound),
        timeRemaining,
        reason: isVotingActive 
          ? `${activeSampleCount} samples still need votes in round ${currentRound}` 
          : `All samples completed in round ${currentRound}`
      };

    } catch (error) {
      console.error('[ERROR] Error checking voting status:', error);
      return {
        isActive: false,
        activeSamples: 0,
        round: 0,
        timeRemaining: 0,
        reason: `Error checking voting status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getProjectStatus(projectAddress: string): Promise<{
    currentIteration: number;
    maxIterations: number;
    isActive: boolean;
    activeVoting: ActiveVoting | null;
  }> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      const currentRound = await projectContract.currentRound();
      const [
        ,  // queryStrategy (unused)
        ,  // alScenario (unused)
        maxIteration,
        ,  // currentRoundFromConfig (unused)
        ,  // queryBatchSize (unused)
        ,  // votingTimeout (unused)
        // labelSpace (unused)
      ] = await projectContract.getALConfiguration();
      const activeVoting = await this.getActiveVoting(projectAddress);

      let isActive = true;
      try {
        // Get isActive from base project contract
        const baseProjectAddress = await projectContract.baseProject();
        const Project = (await import('../../../abis/Project.json')).default;
        const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, this.provider);
        isActive = await baseProjectContract.isActive();
      } catch (activeError) {
        console.log('isActive method not available, assuming project is active');
      }

      return {
        currentIteration: Number(currentRound),
        maxIterations: Number(maxIteration) || 10,
        isActive,
        activeVoting
      };
    } catch (error) {
      console.error('Error getting project status:', error);
      return {
        currentIteration: 0,
        maxIterations: 10,
        isActive: false,
        activeVoting: null
      };
    }
  }

  // =====================================================================
  // PROJECT MANAGEMENT
  // =====================================================================

  async endProject(projectAddress: string, userAddress: string): Promise<boolean> {
    try {
      console.log(`Ending project ${projectAddress}`);
      
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // First resolve if this is ALProject address, get base Project address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const alProjectContract = new ethers.Contract(alProjectAddress, ALProject.abi, provider);
      const baseProjectAddress = await alProjectContract.baseProject();
      
      // deactivateProject() exists on base Project contract, not ALProject
      const Project = (await import('../../../abis/Project.json')).default;
      const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, signer);
      
      const tx = await baseProjectContract.deactivateProject();
      await tx.wait();
      
      console.log('Project ended successfully');
      await this.notifyProjectEnd(projectAddress);
      return true;
    } catch (error) {
      console.error(' Failed to end project:', error);
      return false;
    }
  }

  private async notifyProjectEnd(projectAddress: string): Promise<void> {
    //  No cache cleanup needed - using pure blockchain + IPFS
    
    // Trigger custom event for UI cleanup
    const event = new CustomEvent('dal-project-ended', {
      detail: { projectAddress }
    });
    window.dispatchEvent(event);
  }

  // =====================================================================
  // ENHANCED PROJECT STATUS (preserving original comprehensive method)
  // =====================================================================

  async getActiveBatch(projectAddress: string): Promise<{
    sampleIds: string[];
    sampleData: any[];
    labelOptions: string[];
    timeRemaining: number;
    round: number;
    batchSize: number;
  } | null> {
    try {
      // Use the off-chain contract service to get the active batch
      const activeBatch = await offChainContractService.getActiveBatch(projectAddress);
      
      if (!activeBatch || activeBatch.activeSampleIds.length === 0) {
        console.log('No active batch found');
        return null;
      }

      console.log(`Active batch found with ${activeBatch.activeSampleIds.length} samples`);
      console.log('Raw sample data from contract:', activeBatch.sampleData);

      // Process sample data from the smart contract
      const sampleData: any[] = [];
      
      for (let i = 0; i < activeBatch.activeSampleIds.length; i++) {
        const sampleId = activeBatch.activeSampleIds[i];
        const ipfsHashOrData = activeBatch.sampleData[i];
        
        // Check if this is an IPFS hash (starts with 'Qm' typically) or placeholder text
        if (ipfsHashOrData && !ipfsHashOrData.startsWith('Sample data for ')) {
          console.log(`📥 Fetching sample data from IPFS: ${sampleId} -> ${ipfsHashOrData}`);
          
          try {
            // Fetch the individual sample data from IPFS using private network
            const { config } = await import('../../../config');
            const ipfsUrl = `${config.ipfs.publicUrl}/${ipfsHashOrData}`;
            console.log(`📥 Fetching from private IPFS: ${ipfsUrl}`);
            
            const response = await fetch(ipfsUrl);
            if (response.ok) {
              const ipfsData = await response.json();
              
              // The uploaded data is the raw sample data (not wrapped in .data)
              // Since DALProjectSession uploads JSON.stringify(sampleData) directly
              if (ipfsData && typeof ipfsData === 'object') {
                sampleData.push(ipfsData);
                console.log(`Loaded sample data from IPFS for ${sampleId}`);
              } else {
                console.warn(` Invalid IPFS data structure for ${sampleId}:`, ipfsData);
                sampleData.push({ sampleId, data: 'Sample failed to load from IPFS' });
              }
            } else {
              console.warn(` Failed to fetch sample ${sampleId} from IPFS: ${response.status}`);
              sampleData.push({ sampleId, data: 'Sample failed to load from IPFS' });
            }
          } catch (ipfsError) {
            console.warn(` Failed to fetch sample ${sampleId} from IPFS:`, ipfsError);
            sampleData.push({ sampleId, data: 'Sample failed to load from IPFS' });
          }
        } else {
          // This is placeholder text from the contract
          console.log(`Using placeholder data for ${sampleId}: ${ipfsHashOrData}`);
          sampleData.push({ sampleId, data: ipfsHashOrData });
        }
      }

      // Adapt interface to match expected format
      return {
        sampleIds: activeBatch.activeSampleIds,
        sampleData: sampleData,
        labelOptions: activeBatch.labelOptions,
        timeRemaining: activeBatch.timeRemaining,
        round: activeBatch.round,
        batchSize: activeBatch.activeSampleIds.length
      };
    } catch (error) {
      console.error('Could not fetch active batch:', error);
      return null;
    }
  }

  async getEnhancedProjectStatus(projectAddress: string): Promise<{
    // Basic project info
    isActive: boolean;
    currentIteration: number;
    maxIterations: number;
    finalTraining: boolean; // Add final training flag
    
    // AL Configuration
    queryStrategy: string;
    alScenario: string;
    queryBatchSize: number;
    votingTimeout: number;
    labelSpace: string[];
    
    // Current batch info from Project contract
    currentBatch: {
      round: number;
      totalSamples: number;
      activeSamples: number;
      completedSamples: number;
      sampleIds: string[];
      batchActive: boolean;
    };
    
    // Member info
    members: {
      addresses: string[];
      roles: string[];
      weights: number[];
      joinTimestamps: number[];
    };
    
    // Active voting info
    activeVoting?: {
      sampleId: string;
      sampleData: any;
      labelOptions: string[];
      timeRemaining: number;
      currentVotes: Record<string, number>;
    };
  }> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts first
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('Project does not have AL contracts deployed yet');
        throw new Error('AL contracts not deployed yet');
      }
      
      // Get basic project info - call baseProject.isActive() through the interface
      const baseProjectAddress = await projectContract.baseProject();
      const Project = (await import('../../../abis/Project.json')).default;
      const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, this.provider);
      const isActive = await baseProjectContract.isActive();
      
      const [
        queryStrategy,
        alScenario,
        maxIteration,
        currentRound,
        queryBatchSize,
        votingTimeout,
        labelSpace
      ] = await projectContract.getALConfiguration();
      
      // Read final training flag
      const finalTraining = await projectContract.finalTraining();
      
      // Use off-chain contract service for participants - pass the ALProject address
      const participants = await offChainContractService.getAllParticipants(alProjectAddress);

      // Use off-chain implementation for current batch progress
      let currentBatch = null;
      try {
        const batchProgress = await offChainContractService.getCurrentBatchProgress(projectAddress);
        if (batchProgress) {
          currentBatch = {
            round: batchProgress.round,
            totalSamples: batchProgress.totalSamples,
            activeSamples: batchProgress.activeSamplesCount,
            completedSamples: batchProgress.completedSamples,
            sampleIds: batchProgress.sampleIds,
            batchActive: batchProgress.batchActive
          };
        } else {
          // Default batch info when no active batch
          currentBatch = {
            round: Number(currentRound),
            totalSamples: 0,
            activeSamples: 0,
            completedSamples: 0,
            sampleIds: [],
            batchActive: false
          };
        }
      } catch (error) {
        console.log('Could not get current batch progress');
        currentBatch = {
          round: Number(currentRound),
          totalSamples: 0,
          activeSamples: 0,
          completedSamples: 0,
          sampleIds: [],
          batchActive: false
        };
      }

      // Try to get active batch if available
      let activeVoting;
      try {
        const activeBatch = await this.getActiveBatch(alProjectAddress);
        if (activeBatch && activeBatch.sampleIds.length > 0) {
          const sampleId = activeBatch.sampleIds[0];
          const sampleData = activeBatch.sampleData[0] || { sampleId, data: 'Sample data' };
          
          activeVoting = {
            sampleId,
            sampleData,
            labelOptions: activeBatch.labelOptions,
            timeRemaining: Number(activeBatch.timeRemaining),
            currentVotes: {}
          };
        }
      } catch (error) {
        console.log('No active voting session');
      }

      return { 
        // Basic project info
        isActive,
        currentIteration: Number(currentRound),
        maxIterations: Number(maxIteration) || 10,
        finalTraining: Boolean(finalTraining),
        
        // AL Configuration  
        queryStrategy: queryStrategy || 'uncertainty_sampling',
        alScenario: alScenario || 'pool_based',
        queryBatchSize: Number(queryBatchSize) || 2,
        votingTimeout: Number(votingTimeout) || 3600,
        labelSpace: labelSpace ? [...labelSpace] : [],
        
        // Current batch info
        currentBatch: {
          round: Number(currentBatch.round),
          totalSamples: Number(currentBatch.totalSamples),
          activeSamples: Number(currentBatch.activeSamples),
          completedSamples: Number(currentBatch.completedSamples),
          sampleIds: currentBatch.sampleIds,
          batchActive: currentBatch.batchActive
        },
        
        // Member info
        members: {
          addresses: participants.participantAddresses,
          roles: participants.roles,
          weights: participants.weights.map((w: any) => Number(w)),
          joinTimestamps: participants.joinTimestamps.map((t: any) => Number(t))
        },
        
        // Active voting (if any)
        activeVoting
      };
      
    } catch (error) {
      console.error('Error getting enhanced project status:', error);
      throw error;
    }
  }

  /**
   * Get AL configuration from deployed smart contract
   */
  async getALConfiguration(projectAddress: string): Promise<{
    scenario: string;
    queryStrategy: string;
    model: { type: string; parameters: any };
    queryBatchSize: number;
    maxIterations: number;
    votingConsensus: string;
    votingTimeout: number;
    labelSpace: string[];
  } | null> {
    try {
      console.log(`[CONFIG] Fetching AL configuration from contract: ${projectAddress}`);
      
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log('Project has no AL contracts deployed');
        return null;
      }
      
      // Get AL configuration from contract using destructuring
      const [
        queryStrategy,
        alScenario, 
        maxIteration,
        currentRound,
        queryBatchSize,
        votingTimeout,
        labelSpace
      ] = await projectContract.getALConfiguration();
      
      console.log('Raw AL config from contract:', {
        queryStrategy,
        alScenario,
        maxIteration: maxIteration.toString(),
        currentRound: currentRound.toString(),
        queryBatchSize: queryBatchSize.toString(),
        votingTimeout: votingTimeout.toString(),
        labelSpace
      });
      
      return {
        scenario: alScenario || 'pool_based',
        queryStrategy: queryStrategy || 'uncertainty_sampling',
        model: {
          type: 'logistic_regression',  // Default since not stored in contract
          parameters: {}
        },
        queryBatchSize: Number(queryBatchSize) || 2,
        maxIterations: Number(maxIteration) || 10,
        votingConsensus: 'simple_majority',  // Default since not stored in ALProject
        votingTimeout: Number(votingTimeout) || 3600,
        labelSpace: labelSpace ? [...labelSpace] : []
      };
      
    } catch (error) {
      console.error(' Failed to fetch AL configuration from contract:', error);
      return null;
    }
  }

  async getBatchProgressFromVotingContract(projectAddress: string): Promise<{
    round: number;
    isActive: boolean;
    totalSamples: number;
    completedSamples: number;
    sampleIds: string[];
  } | null> {
    try {
      const projectContract = new ethers.Contract(projectAddress, ALProject.abi, this.provider);
      
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return null;
      }

      const votingContract = await projectContract.votingContract();
      const votingContractInstance = new ethers.Contract(votingContract, ALProjectVoting.abi, this.provider);
      
      const batchProgress = await votingContractInstance.getCurrentBatchProgress();
          
          return {
        round: Number(batchProgress.round),
        isActive: batchProgress.isActive,
        totalSamples: Number(batchProgress.totalSamples),
        completedSamples: Number(batchProgress.completedSamples),
        sampleIds: batchProgress.sampleIds
      };
      
    } catch (error) {
      console.error('Error getting batch progress from voting contract:', error);
      return null;
    }
  }

  /**
   * @dev Check if project should end based on smart contract conditions
   * Uses the shouldProjectEnd() function from ALProject.sol
   */
  async getProjectEndStatus(projectAddress: string): Promise<{
    shouldEnd: boolean;
    reason: string;
    currentRound: number;
    maxIterations: number;
  }> {
    try {
      // IMPORTANT: Resolve ALProject address first since shouldProjectEnd() exists only on ALProject
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Call the smart contract's shouldProjectEnd function
      const [shouldEnd, reason] = await projectContract.shouldProjectEnd();
      const [
        , // queryStrategy (unused)
        , // alScenario (unused)
        maxIteration,
        currentRound,
        , // queryBatchSize (unused)
        , // votingTimeout (unused)
        // labelSpace (unused)
      ] = await projectContract.getALConfiguration();
      
      return {
        shouldEnd,
        reason,
        currentRound: Number(currentRound),
        maxIterations: Number(maxIteration)
      };
    } catch (error) {
      console.error('Error checking project end status:', error);
      return {
        shouldEnd: false,
        reason: 'Error checking end conditions',
        currentRound: 0,
        maxIterations: 0
      };
    }
  }

  /**
   * @dev Notify the contract that unlabeled samples are exhausted
   * This is called from AL-Engine when no more samples are available
   */
  async notifyUnlabeledSamplesExhausted(projectAddress: string): Promise<boolean> {
    try {
      console.log('Notifying contract that unlabeled samples are exhausted');
      
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(projectAddress, ALProject.abi, signer);
      
      const tx = await projectContract.notifyUnlabeledSamplesExhausted();
      await tx.wait();
      
      console.log('Successfully notified contract about sample exhaustion');
      return true;
    } catch (error) {
      console.error(' Failed to notify unlabeled samples exhausted:', error);
      return false;
    }
  }

  /**
   * Mark final training as completed in the smart contract
   */
  async markFinalTrainingCompleted(projectAddress: string): Promise<boolean> {
    try {
      console.log(`Marking final training as completed for project: ${projectAddress}`);
      
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress);
      
      // Get signer for transaction
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      if (!signer) {
        throw new Error('No signer available for transaction');
      }
      
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, signer);
      
      // Call the contract method
      const tx = await projectContract.markFinalTrainingCompleted();
      console.log(`Transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Final training marked as completed. Transaction confirmed: ${receipt.transactionHash}`);
      
      return true;
      
    } catch (error) {
      console.error('Failed to mark final training as completed:', error);
      return false;
    }
  }

  // =====================================================================
  // OFF-CHAIN CONTRACT FUNCTION DELEGATES
  // These delegate to OffChainContractService for functions removed from Project.sol
  // =====================================================================

  /**
   * @dev Get all join requesters for a project
   */
  async getAllRequesters(projectAddress: string): Promise<string[]> {
    return await offChainContractService.getAllRequesters(projectAddress);
  }

  /**
   * @dev Get all active samples for a project
   */
  async getActiveSamples(projectAddress: string): Promise<string[]> {
    return await offChainContractService.getActiveSamples(projectAddress);
  }

  /**
   * @dev Get voter statistics for a specific address
   */
  async getVoterStats(projectAddress: string, voterAddress: string): Promise<{
    weight: number;
    totalVotes: number;
    isRegistered: boolean;
  }> {
    return await offChainContractService.getVoterStats(projectAddress, voterAddress);
  }

}

// Export singleton instance
export const alContractService = ALContractService.getInstance(); 