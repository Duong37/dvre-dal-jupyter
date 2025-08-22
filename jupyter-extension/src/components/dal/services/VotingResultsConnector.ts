/**
 * VotingResultsConnector - Browser-compatible service to export blockchain voting data to AL-Engine
 * Uses existing VotingService to get blockchain data and AL-Engine API to write files
 */

import { VotingService } from './VotingService';
import { config } from '../../../config';

export interface ALEngineVotingResult {
  original_index: number;
  final_label: string;
  // Removed: sample_data, votes, consensus, timestamp (AL-Engine only needs these two fields)
}

export class VotingResultsConnector {
  private votingService: VotingService;

  constructor() {
    this.votingService = new VotingService();
  }

  /**
   * Export all voting results to AL-Engine
   * OPTIMIZED: Fetch voting history once and process all rounds together
   */
  async exportAllVotingResults(projectAddress: string): Promise<number> {
    try {
      console.log(`[EXPORT] Exporting all voting results for project ${projectAddress}`);
      
      // OPTIMIZATION: Fetch voting history only once for all rounds
      const votingHistory = await this.votingService.getVotingHistory(projectAddress);
      
      if (votingHistory.length === 0) {
        console.log(`[EXPORT] No voting results found for project`);
        return 0;
      }
      
      // Group voting records by round
      const roundGroups = new Map<number, any[]>();
      votingHistory.forEach(record => {
        const round = record.iterationNumber;
        if (!roundGroups.has(round)) {
          roundGroups.set(round, []);
        }
        roundGroups.get(round)!.push(record);
      });
      
      console.log(`[EXPORT] Processing ${roundGroups.size} rounds with ${votingHistory.length} total records`);
      
      let successfulExports = 0;
      
      // Process all rounds in parallel for better performance
      const exportPromises = Array.from(roundGroups.entries()).map(async ([round, roundRecords]) => {
        try {
          // Convert to AL-Engine format
          const alEngineResults: ALEngineVotingResult[] = [];
          
          // Process all records in this round in parallel
          const conversionPromises = roundRecords.map(async (record) => {
            const original_index = await this.extractOriginalIndex(record.sampleId, record.sampleData, projectAddress);
            return {
              original_index,
              final_label: record.finalLabel,
            };
          });
          
          const convertedResults = await Promise.all(conversionPromises);
          alEngineResults.push(...convertedResults);
          
          console.log(`[EXPORT] Converted ${alEngineResults.length} voting results for round ${round}`);
          
          // Send to AL-Engine API to write the file
          const success = await this.sendToALEngine(projectAddress, round, alEngineResults);
          
          if (success) {
            console.log(`[EXPORT]  Successfully exported round ${round} to AL-Engine`);
            return 1;
          } else {
            console.warn(`[EXPORT]  Failed to export round ${round} to AL-Engine`);
            return 0;
          }
          
        } catch (roundError) {
          console.error(`[EXPORT] Error exporting round ${round}:`, roundError);
          return 0;
        }
      });
      
      // Wait for all rounds to complete
      const results = await Promise.all(exportPromises);
      successfulExports = results.reduce((sum: number, result: number) => sum + result, 0);
      
      console.log(`[EXPORT]  Successfully exported ${successfulExports}/${roundGroups.size} rounds to AL-Engine`);
      return successfulExports;
      
    } catch (error) {
      console.error(`[EXPORT] Error exporting all voting results:`, error);
      return 0;
    }
  }

  /**
   * Send voting results to AL-Engine API to write voting_results_round_X.json file
   */
  private async sendToALEngine(
    projectAddress: string, 
    round: number, 
    votingResults: ALEngineVotingResult[]
  ): Promise<boolean> {
    try {
      const alEngineUrl = config.alEngine.apiUrl || 'http://localhost:5050';
      
      // Check if AL-Engine is running
      try {
        const healthResponse = await fetch(`${alEngineUrl}/health`);
        if (!healthResponse.ok) {
          throw new Error('AL-Engine health check failed');
        }
      } catch (healthError) {
        console.warn('[AL-ENGINE] Not running, cannot export voting results');
        return false;
      }
      
      // Send voting results to AL-Engine
      const response = await fetch(`${alEngineUrl}/api/voting-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectAddress,
          round: round,
          voting_results: votingResults
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`[AL-ENGINE]  Saved to: ${result.file_path}`);
        return true;
      } else {
        console.error(`[AL-ENGINE]  API error: ${response.status}`);
        return false;
      }
      
    } catch (error) {
      console.error(`[AL-ENGINE]  Failed to send voting results:`, error);
      return false;
    }
  }

  /**
   * Extract original dataset index from blockchain storage
   * SIMPLIFIED: Only use blockchain data - no fallbacks needed
   */
  private async extractOriginalIndex(sampleId: string, sampleData: any, projectAddress: string): Promise<number> {
    try {
      // Import required modules
      const { ethers } = await import('ethers');
      const { RPC_URL } = await import('../../../config/contracts');
      const { resolveALProjectAddress } = await import('../utils/AddressResolver');
      const ALProject = (await import('../../../abis/ALProject.json')).default;
      const ALProjectVoting = (await import('../../../abis/ALProjectVoting.json')).default;
      
      // Set up provider and contracts
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const alProjectAddress = await resolveALProjectAddress(projectAddress, provider);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, provider);
      
      // Check if project has AL contracts
      const hasALContracts = await projectContract.hasALContracts();
      if (!hasALContracts) {
        console.log(`[BLOCKCHAIN] Project has no AL contracts`);
        return 0;
      }
      
      // Get voting contract address and query original index
      const votingContractAddress = await projectContract.votingContract();
      const votingContract = new ethers.Contract(votingContractAddress, ALProjectVoting.abi, provider);
      
      // Get original index directly from blockchain - this is the single source of truth
      const originalIndex = await votingContract.getSampleOriginalIndex(sampleId);
      console.log(`[BLOCKCHAIN]  Got original_index ${originalIndex} for ${sampleId}`);
      
      return Number(originalIndex);
      
    } catch (error) {
      console.error(`[BLOCKCHAIN] Failed to read original_index for ${sampleId}:`, error);
      
      // If blockchain fails, we cannot reliably determine original_index
      // Return 0 as fallback (AL-Engine will handle this gracefully)
      console.warn(`[ERROR]  Could not extract original_index for ${sampleId}, returning 0`);
      return 0;
    }
  }

  /**
   * Create a minimal summary for a single voting record
   */
  private async createSampleSummary(record: any, projectAddress: string): Promise<any> {
    if (record.sampleId && record.finalLabel) {
      const original_index = await this.extractOriginalIndex(record.sampleId, null, projectAddress);
      return {
        sample_id: record.sampleId,
        original_index
      };
    }
    
    console.warn('[SUMMARY] Invalid voting record:', record);
    return {
      sample_id: 'unknown',
      original_index: 0
    };
  }

  /**
   * Get voting results summary
   */
  async getVotingResultsSummary(projectAddress: string): Promise<string> {
    try {
      const votingHistory = await this.votingService.getVotingHistory(projectAddress);
      
      // Create summaries async - pass projectAddress to createSampleSummary
      const samples = [];
      for (const record of votingHistory) {
        const sampleSummary = await this.createSampleSummary(record, projectAddress);
        samples.push(sampleSummary);
      }
      
      const summary = {
        totalVotes: votingHistory.length,
        byRound: {} as { [round: number]: number },
        samples
      };
      
      // Group by round
      votingHistory.forEach(record => {
        const round = record.iterationNumber;
        summary.byRound[round] = (summary.byRound[round] || 0) + 1;
      });
      
      return JSON.stringify(summary, null, 2);
    } catch (error) {
      console.error('Error generating voting results summary:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

// Export singleton instance
export const votingResultsConnector = new VotingResultsConnector();