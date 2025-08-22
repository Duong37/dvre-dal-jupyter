/**
 * Off-Chain Contract Service
 * 
 * This service implements contract functions that were removed from Project.sol 
 * to reduce contract size and avoid EIP-170 deployment limits.
 * 
 * These functions now run off-chain in the frontend and call the necessary
 * contract methods directly to get the same data.
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import ALProject from '../../../abis/ALProject.json';
import ALProjectVoting from '../../../abis/ALProjectVoting.json';
import { resolveALProjectAddress } from '../utils/AddressResolver';

// Import utility functions from useProjects (single source of truth)
import { 
  getAllRequestersForProject, 
  getJoinRequestForProject, 
  getAllParticipantsForProject 
} from '../../../hooks/useProjects';

export class OffChainContractService {
  private static instance: OffChainContractService;
  private provider: ethers.JsonRpcProvider;

  private constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
  }

  static getInstance(): OffChainContractService {
    if (!OffChainContractService.instance) {
      OffChainContractService.instance = new OffChainContractService();
    }
    return OffChainContractService.instance;
  }

  /**
   * @dev Off-chain implementation of getCurrentBatchProgress
   * Calls ALProjectVoting contract directly instead of through Project contract
   */
  async getCurrentBatchProgress(projectAddress: string): Promise<{
    round: number;
    totalSamples: number;
    activeSamplesCount: number;
    completedSamples: number;
    sampleIds: string[];
    batchActive: boolean;
  } | null> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return null;
      }

      // Get the current round
      const currentRound = await projectContract.currentRound();
      
      // Get current batch sample IDs
      const currentBatchSampleIds = await projectContract.getCurrentBatchSampleIds();
      
      // Count active samples (simplified - in a full implementation you'd check the voting contract)
      const activeSamplesCount = currentBatchSampleIds.length;
      const totalSamples = currentBatchSampleIds.length;
      const completedSamples = 0; // Would need to check voting status for each sample
      const batchActive = activeSamplesCount > 0;
      
      return {
        round: Number(currentRound),
        totalSamples,
        activeSamplesCount,
        completedSamples,
        sampleIds: [...currentBatchSampleIds], // Create non-readonly copy
        batchActive
      };
      
    } catch (error) {
      console.error('Error getting current batch progress off-chain:', error);
      return null;
    }
  }

  /**
   * @dev Off-chain implementation of getActiveBatch
   * Calls ALProjectVoting contract directly
   */
  async getActiveBatch(projectAddress: string): Promise<{
    activeSampleIds: string[];
    sampleData: string[];
    labelOptions: string[];
    timeRemaining: number;
    round: number;
  } | null> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return null;
      }

      // Get necessary data from Project contract
      const votingContractAddress = await projectContract.votingContract();
      const currentRound = await projectContract.currentRound();
      const currentBatchSampleIdsRaw = await projectContract.getCurrentBatchSampleIds();
      const [
        , // queryStrategy (unused)
        , // alScenario (unused)
        , // maxIteration (unused)
        , // currentRoundFromConfig (unused)
        , // queryBatchSize (unused)
        votingTimeout,
        labelSpace
      ] = await projectContract.getALConfiguration();
      
      // Create new non-readonly arrays to avoid Ethers.js readonly property errors
      const currentBatchSampleIds = [...currentBatchSampleIdsRaw];
      const labelSpaceArray = [...labelSpace];
      
      // If currentBatchSampleIds is empty, check if there's an active batch in the voting contract
      if (currentBatchSampleIds.length === 0) {
        console.log('currentBatchSampleIds is empty, checking voting contract for active batch...');
        
        // Check if there's still an active batch in ALProjectVoting contract
        const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
        const batchStatus = await votingContract.getBatchStatus(currentRound);
        
        if (batchStatus.isActive && batchStatus.totalSamples > 0) {
          console.log(`Found active batch in voting contract: ${batchStatus.totalSamples} samples`);
          
          // Get the sample IDs from the voting contract instead
          const batchSampleIds = await votingContract.getBatchSamples(currentRound);
          if (batchSampleIds.length > 0) {
            // Build sample active states array
            const sampleActiveStates: boolean[] = [];
            for (const sampleId of batchSampleIds) {
              // Check if voting session is still active for this sample
              const session = await votingContract.getVotingSession(sampleId);
              const isActive = session[1] && !session[2]; // isActive && !isFinalized
              sampleActiveStates.push(isActive);
            }
            
            // Call computeActiveBatch with the recovered sample IDs
            const activeBatch = await votingContract.computeActiveBatch(
              batchSampleIds,
              sampleActiveStates,
              labelSpaceArray,
              votingTimeout,
              currentRound
            );
            
            if (activeBatch.activeSampleIds && activeBatch.activeSampleIds.length > 0) {
              console.log(`Recovered ${activeBatch.activeSampleIds.length} active samples from voting contract`);
              return {
                activeSampleIds: activeBatch.activeSampleIds,
                sampleData: activeBatch.sampleData,
                labelOptions: activeBatch.labelOptions,
                timeRemaining: Number(activeBatch.timeRemaining),
                round: Number(activeBatch.round)
              };
            }
          }
        }
        
        console.log('No active batch found in either contract');
        return null;
      }
      
      // Build sample active states array (already non-readonly since we create it)
      const sampleActiveStates: boolean[] = [];
      for (const sampleId of currentBatchSampleIds) {
        const isActive = await projectContract.isSampleActive(sampleId);
        sampleActiveStates.push(isActive);
      }
      
      // Call ALProjectVoting to compute active batch with non-readonly arrays
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
      const activeBatch = await votingContract.computeActiveBatch(
        currentBatchSampleIds,
        sampleActiveStates,
        labelSpaceArray,
        votingTimeout,
        currentRound
      );
      
      if (!activeBatch.activeSampleIds || activeBatch.activeSampleIds.length === 0) {
        return null;
      }
      
      return {
        activeSampleIds: activeBatch.activeSampleIds,
        sampleData: activeBatch.sampleData,
        labelOptions: activeBatch.labelOptions,
        timeRemaining: Number(activeBatch.timeRemaining),
        round: Number(activeBatch.round)
      };
      
    } catch (error) {
      console.error('Error getting active batch off-chain:', error);
      return null;
    }
  }

  /**
   * @dev Off-chain implementation of getAllRequesters
   * Delegates to utility function from useProjects (single source of truth)
   */
  async getAllRequesters(projectAddress: string): Promise<string[]> {
    return await getAllRequestersForProject(projectAddress);
  }

  /**
   * @dev Off-chain implementation of getAllParticipants
   * Delegates to utility function from useProjects (single source of truth)
   */
  async getAllParticipants(projectAddress: string): Promise<{
    participantAddresses: string[];
    roles: string[];
    weights: bigint[];
    joinTimestamps: bigint[];
  }> {
    return await getAllParticipantsForProject(projectAddress);
  }

  /**
   * @dev Get join request details for a specific requester
   * Delegates to utility function from useProjects (single source of truth)
   */
  async getJoinRequest(projectAddress: string, requesterAddress: string): Promise<{
    requester: string;
    role: string;
    timestamp: number;
    exists: boolean;
  }> {
    return await getJoinRequestForProject(projectAddress, requesterAddress);
  }

  /**
   * @dev Off-chain implementation of getActiveSamples
   * Gets active samples from the current batch
   */
  async getActiveSamples(projectAddress: string): Promise<string[]> {
    try {
      const activeBatch = await this.getActiveBatch(projectAddress);
      return activeBatch ? activeBatch.activeSampleIds : [];
    } catch (error) {
      console.error('Error getting active samples off-chain:', error);
      return [];
    }
  }

  /**
   * @dev Off-chain implementation of getVoterStats
   * Calls ALProjectVoting contract directly
   */
  async getVoterStats(projectAddress: string, voterAddress: string): Promise<{
    weight: number;
    totalVotes: number;
    isRegistered: boolean;
  }> {
    try {
      // Resolve ALProject address
      const alProjectAddress = await resolveALProjectAddress(projectAddress, this.provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, this.provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        return { weight: 0, totalVotes: 0, isRegistered: false };
      }

      // Get voting contract and check voter weight
      const votingContractAddress = await projectContract.votingContract();
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, this.provider);
      
      const voterWeight = await votingContract.voterWeights(voterAddress);
      const weight = Number(voterWeight);
      const isRegistered = weight > 0;
      
      return {
        weight,
        totalVotes: 0, // Would need to be tracked separately in ALProjectVoting
        isRegistered
      };
      
    } catch (error) {
      console.error('Error getting voter stats off-chain:', error);
      return { weight: 0, totalVotes: 0, isRegistered: false };
    }
  }
}

// Export singleton instance
export const offChainContractService = OffChainContractService.getInstance(); 