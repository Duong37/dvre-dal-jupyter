/**
 * DAL Project Session - Bridge between Smart Contracts and AL-Engine
 * 
 * This service orchestrates the complete Active Learning workflow by:
 * - Coordinating between smart contracts (voting, storage) and AL-Engine (iterations)
 * - Managing AL iteration lifecycle (start → query → vote → aggregate → repeat)
 * - Handling real-time event listening and API communication
 * - Providing clean APIs to the UI layer
 */

import { EventEmitter } from 'events';
import { alContractService } from './ALContractService';
import { config } from '../../../config';

export interface ALEngineStatus {
  project_id: string;
  computation_mode: string;
  work_dir: string;
  config_path: string;
  running: boolean;
  timestamp: number;
}

export interface ALIterationResult {
  success: boolean;
  iteration: number;
  result?: {
    execution_method: string;
    outputs: {
      model_out?: string;
      query_samples?: string;
    };
    stdout: string;
  };
  error?: string;
  message: string;
}

export interface QuerySample {
  sepal_length?: number;
  sepal_width?: number;
  petal_length?: number;
  petal_width?: number;
  original_index: number;
  features?: number[];
  [key: string]: any;
}

export interface SessionState {
  projectId: string;
  userAddress?: string;
  phase: 'idle' | 'generating_samples' | 'voting' | 'aggregating' | 'completed' | 'ending' | 'error' | 'final_training' | 'final_training_completed';
  isActive: boolean;
  querySamples?: QuerySample[];
  batchProgress?: {
    totalSamples: number;
    completedSamples: number;
    currentSampleIndex: number;
    sampleIds: string[];
    round: number;
  };
  error?: string;
  lastUpdate: Date;
  // Project end fields
  shouldEnd?: boolean;
  projectEndReason?: string;
}

export interface SessionEvents {
  'state-changed': (state: SessionState) => void;
  'iteration-started': (iteration: number) => void;
  'samples-generated': (samples: QuerySample[]) => void;
  'voting-started': (sampleId: string, sampleData: any) => void;
  'vote-submitted': (sampleId: string, voter: string, label: string) => void;
  'sample-completed': (sampleId: string, finalLabel: string) => void;
  'iteration-completed': (iteration: number, samplesLabeled: number) => void;
  'session-ended': () => void;
  'error': (error: string) => void;
  'project-should-end': (details: { trigger: string; reason: string; currentRound: number; timestamp: number; }) => void;
}

export class DALProjectSession extends EventEmitter {
  private state: SessionState;
  private contractListeners: Array<() => void> = [];
  private alEngineBaseUrl: string;
  private userAddress: string;

  constructor(projectId: string, userAddress: string, alEnginePort: number = 5050) {
    super();
    
    this.alEngineBaseUrl = config.alEngine.apiUrl || `http://localhost:${alEnginePort}`;
    this.userAddress = userAddress;
    this.state = {
      projectId,
      isActive: false,
      phase: 'idle',
      lastUpdate: new Date()
    };

    this.setupContractEventListeners();
    this.startProjectEndMonitoring(); // Re-enabled: voting issue was fixed
    
    // Initialize and restore active session state if voting is ongoing
    this.initializeSessionState();
  }

  /**
   * Initialize and restore session state by checking for active voting sessions
   */
  private async initializeSessionState(): Promise<void> {
    try {
      console.log('Initializing DAL session state...');
      
      // Check if there's an active batch voting session
      const activeBatch = await this.getActiveBatch();
      
      if (activeBatch) {
        console.log('Found active voting session, restoring state:', activeBatch);
        
        // Update state to indicate voting is active
        this.updateState({
          isActive: true,
          phase: 'voting',
          batchProgress: {
            totalSamples: activeBatch.batchSize,
            completedSamples: 0, // Will be updated by event listeners
            currentSampleIndex: 0,
            sampleIds: activeBatch.sampleIds,
            round: activeBatch.round
          }
        });
      } else {
        console.log('No active voting session found');
      }
    } catch (error) {
      console.error(' Failed to initialize session state:', error);
      // Don't throw - let the session work normally even if initialization fails
    }
  }

  // =====================================================================
  // PUBLIC API - Session Management
  // =====================================================================

  /**
   * Start a new AL iteration - orchestrates the complete workflow
   */
  async startIteration(): Promise<void> {
    try {
      console.log('Starting AL iteration workflow');

      this.updateState({
        phase: 'generating_samples',
        isActive: true,
        error: undefined
      });

      // Step 1: Get enhanced project status from contract
      const projectStatus = await alContractService.getEnhancedProjectStatus(this.state.projectId);
      const nextIteration = projectStatus.currentIteration + 1;

      this.emit('iteration-started', nextIteration);

      // Step 2: Call AL-Engine to start next iteration (train model + query samples)
      console.log(`Starting AL iteration ${nextIteration} with AL-Engine`);
      const samples = await this.startNextIteration(nextIteration);
      
      // Step 3: Start batch voting on smart contracts (this increments currentRound in Project)
      await this.startBatchVoting(samples);
      
      // Step 4: Get the updated batch progress from contracts after voting started
      const enhancedStatus = await alContractService.getEnhancedProjectStatus(this.state.projectId);
      console.log(`Contract state after batch voting:`, enhancedStatus.currentBatch);
      
      // Step 5: Update session state with contract state
      this.updateState({
        phase: 'voting',
        querySamples: samples,
        batchProgress: {
          totalSamples: enhancedStatus.currentBatch.totalSamples,
          completedSamples: enhancedStatus.currentBatch.completedSamples,
          currentSampleIndex: enhancedStatus.currentBatch.activeSamples > 0 ? 
            enhancedStatus.currentBatch.totalSamples - enhancedStatus.currentBatch.activeSamples : 
            enhancedStatus.currentBatch.completedSamples,
          sampleIds: enhancedStatus.currentBatch.sampleIds,
          round: enhancedStatus.currentBatch.round
        }
      });

      this.emit('samples-generated', samples);

      console.log(`AL iteration ${nextIteration} workflow started (Contract round ${enhancedStatus.currentBatch.round})`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iteration';
      console.error('Failed to start AL iteration:', error);
      
      this.updateState({
        phase: 'error',
        error: errorMessage,
        isActive: false
      });

      this.emit('error', errorMessage);
      throw error;
    }
  }

  /**
   * Start final training round - trains model on all labeled data without querying new samples
   */
  async startFinalTraining(): Promise<void> {
    try {
      console.log('Starting final training workflow');

      this.updateState({
        phase: 'final_training',
        isActive: true,
        error: undefined
      });

      // Step 1: CRITICAL - Export any remaining voting results to AL-Engine format first
      console.log('Exporting final voting results to AL-Engine before training...');
      try {
        const { votingResultsConnector } = await import('./VotingResultsConnector');
        const exportedRounds = await votingResultsConnector.exportAllVotingResults(this.state.projectId);
        
        if (exportedRounds > 0) {
          console.log(`Exported voting results for ${exportedRounds} rounds before final training`);
        } else {
          console.log('No additional voting results to export');
        }
      } catch (exportError) {
        console.warn(' Failed to export voting results before final training:', exportError);
        // Continue with final training - maybe results are already exported
      }

      // Step 2: Get project status to determine the final iteration number
      const projectStatus = await alContractService.getEnhancedProjectStatus(this.state.projectId);
      const finalIteration = projectStatus.currentIteration + 1;

      this.emit('final-training-started', finalIteration);

      // Step 3: Call AL-Engine for final training (no sample querying)
      console.log(`Starting final training iteration ${finalIteration} with AL-Engine`);
      
      const response = await fetch(`${this.alEngineBaseUrl}/final_training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iteration: finalIteration,
          project_id: this.state.projectId,
          final_training: true // Flag to indicate this is final training
        })
      });

      if (!response.ok) {
        throw new Error(`Final training failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Final training failed: ${result.error || 'Unknown error'}`);
      }

      // Step 4: Update session state to indicate completion
      this.updateState({
        phase: 'final_training_completed',
        isActive: false,
        error: undefined
      });

      // Step 5: Update smart contract to mark final training as completed
      try {
        console.log('Marking final training as completed in smart contract...');
        const success = await alContractService.markFinalTrainingCompleted(this.state.projectId);
        if (success) {
          console.log('Successfully marked final training as completed in contract');
        } else {
          console.warn('Failed to mark final training in contract, but training completed');
        }
      } catch (contractError) {
        console.warn('Contract update failed but final training completed:', contractError);
      }

      this.emit('final-training-completed', { 
        iteration: finalIteration, 
        performance: result.performance || null 
      });

      console.log(`Final training iteration ${finalIteration} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start final training';
      console.error('Failed to start final training:', error);
      
      this.updateState({
        phase: 'error',
        error: errorMessage,
        isActive: false
      });

      this.emit('error', errorMessage);
      throw error;
    }
  }

  /**
   * Submit votes for multiple samples in a batch - this is now the ONLY voting method!
   * Works for batch size 1 or more, providing consistency across all voting scenarios
   */
  async submitBatchVote(sampleIds: string[], labels: string[]): Promise<void> {
    try {
      const batchType = sampleIds.length === 1 ? 'single-sample batch' : 'multi-sample batch';
      console.log(`Submitting ${batchType} vote for ${sampleIds.length} samples:`, sampleIds.map((id, i) => `${id}: ${labels[i]}`));
      
      // Validate inputs
      if (sampleIds.length !== labels.length) {
        throw new Error('Sample IDs and labels arrays must have the same length');
      }
      
      if (sampleIds.length === 0) {
        throw new Error('No samples provided for batch voting');
      }
      
      // Submit batch vote to smart contract
      await alContractService.submitBatchVote(this.state.projectId, sampleIds, labels, this.userAddress);
      
      console.log(`${batchType} vote submitted successfully for ${sampleIds.length} samples`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit batch vote';
      console.error(' Failed to submit batch vote:', error);
      this.emit('error', errorMessage);
      throw error;
    }
  }

  /**
   * Get active batch for batch voting UI
   */
  async getActiveBatch(): Promise<{
    sampleIds: string[];
    sampleData: any[];
    labelOptions: string[];
    timeRemaining: number;
    round: number;
    batchSize: number;
  } | null> {
    try {
      return await alContractService.getActiveBatch(this.state.projectId);
    } catch (error) {
      console.error(' Failed to get active batch:', error);
      return null;
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    try {
      console.log('Ending DAL project session');
      
      this.cleanupContractListeners();
      
      this.updateState({
        isActive: false,
        phase: 'idle'
      });

      this.emit('session-ended');
      
    } catch (error) {
      console.error(' Failed to end session:', error);
      throw error;
    }
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Check if AL-Engine is healthy and responsive
   */
  async checkALEngineHealth(): Promise<ALEngineStatus> {
    try {
      const response = await fetch(`${this.alEngineBaseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`AL-Engine health check failed: ${response.statusText}`);
      }

      const status: ALEngineStatus = await response.json();
      console.log('AL-Engine health check:', status);
      
      return status;
      
    } catch (error) {
      console.error(' AL-Engine health check failed:', error);
      throw error;
    }
  }

  // =====================================================================
  // PRIVATE METHODS - AL-Engine Communication
  // =====================================================================

  private async startNextIteration(iteration: number): Promise<QuerySample[]> {
    try {
      console.log(`🔬 Starting AL iteration ${iteration} (train model + query samples)`);
      
      const response = await fetch(`${this.alEngineBaseUrl}/start_iteration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          iteration,
          project_id: this.state.projectId // Add the missing project_id!
        })
      });

      if (!response.ok) {
        throw new Error(`AL-Engine request failed: ${response.statusText}`);
      }

      const result: ALIterationResult = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'AL iteration failed');
      }

      // Load the query samples from the output file
      const querySamplesPath = result.result?.outputs?.query_samples;
      if (!querySamplesPath) {
        throw new Error('No query samples generated');
      }

      const samples = await this.loadQuerySamplesFile(querySamplesPath);
      console.log(`Generated ${samples.length} query samples`);
      
      return samples;
      
    } catch (error) {
      console.error(' Failed to start AL iteration:', error);
      throw error;
    }
  }

  private async loadQuerySamplesFile(filePath: string): Promise<QuerySample[]> {
    try {
      console.log('📂 Loading fresh query samples from AL-Engine file:', filePath);
      
      // Extract the relative path from the full path returned by AL-Engine
      // filePath looks like: "../ro-crates/0xProject.../outputs/query_samples_round_1.json"
      const relativePath = filePath.replace('../', 'al-engine/');
      console.log('📂 Reading AL-Engine file via read-file endpoint:', relativePath);
      
      // Read the file content via local file server
      const fileResponse = await fetch(`http://localhost:3001/read-file?path=${encodeURIComponent(relativePath)}`);
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to read AL-Engine file: ${fileResponse.statusText}`);
      }

      const responseData = await fileResponse.json();
      if (!responseData.success || !responseData.content) {
        throw new Error('Invalid response from file server');
      }

      const samplesData = JSON.parse(responseData.content);
      console.log(`Successfully read ${samplesData.length} fresh samples from AL-Engine`);
      console.log('First sample:', samplesData[0]);
      
      // Convert AL-Engine iris format to QuerySample format
      const querySamples: QuerySample[] = samplesData.map((sample: any) => ({
        sepal_length: sample['sepal length (cm)'],
        sepal_width: sample['sepal width (cm)'],
        petal_length: sample['petal length (cm)'],
        petal_width: sample['petal width (cm)'],
        original_index: sample.original_index
      }));
      
      console.log('Converted to QuerySample format');
      console.log(`Fresh original indices: [${querySamples.map(s => s.original_index).join(', ')}]`);
      
      return querySamples;
      
    } catch (error) {
      console.error(' Failed to load query samples from AL-Engine file:', error);
      throw error;
    }
  }

  private async submitLabeledSamples(labeledSamples: Array<{
    sampleId: string;
    sampleData: QuerySample;
    label: string;
    originalIndex: number;
  }>): Promise<void> {
    try {
      // Get current iteration from smart contract
      const currentIteration = await this.getCurrentIterationFromContract();
      
      console.log(`Submitting ${labeledSamples.length} labeled samples to AL-Engine`);
      
      const response = await fetch(`${this.alEngineBaseUrl}/submit_labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          iteration: currentIteration,
          project_id: this.state.projectId,
          labeled_samples: labeledSamples.map(sample => ({
            sample_id: sample.sampleId,
            sample_data: sample.sampleData,
            label: sample.label,
            original_index: sample.originalIndex
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit labeled samples: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit labeled samples');
      }

      console.log(`Successfully submitted labeled samples to AL-Engine`);
      
    } catch (error) {
      console.error(' Failed to submit labeled samples:', error);
      throw error;
    }
  }

  // =====================================================================
  // PRIVATE METHODS - Smart Contract Integration
  // =====================================================================

  private async startBatchVoting(samples: QuerySample[]): Promise<void> {
    try {
      console.log(`Starting batch voting for ${samples.length} samples on blockchain`);
      console.log('Input samples original indices:', samples.map(s => s.original_index));
      
      // Get current iteration to create unique sample IDs
      const projectStatus = await alContractService.getEnhancedProjectStatus(this.state.projectId);
      const currentIteration = projectStatus.currentIteration + 1;
      
      // Extract sample information for blockchain transaction with UNIQUE sample IDs
      const sampleIds = samples.map((sample, index) => {
        // Use original_index if available for true uniqueness, otherwise use iteration+index
        const originalIndex = sample.original_index !== undefined ? sample.original_index : index;
        return sample.sample_id || sample.sampleId || `round_${currentIteration}_sample_${originalIndex}`;
      });
      
      const sampleDataHashes: string[] = [];
      const originalIndices: number[] = [];
      
      console.log(`Generated unique sample IDs for iteration ${currentIteration}:`, sampleIds);
      console.log('Corresponding original indices:', samples.map(s => s.original_index));
      
      // Upload samples to IPFS and extract original indices
      try {
        const { IPFSService } = await import('../../deployment/services/IPFSService');
        const ipfsService = IPFSService.getInstance();
        
        for (let i = 0; i < samples.length; i++) {
          const sampleData = samples[i];
          const sampleId = sampleIds[i];
          
          // Upload individual sample to IPFS
          const sampleIPFSResult = await ipfsService.uploadFile({
            name: `sample_${sampleId}.json`,
            content: JSON.stringify(sampleData),
            type: 'application/json'
          });
          sampleDataHashes.push(sampleIPFSResult.hash);
          
          // Extract original index from sample data
          const originalIndex = sampleData.original_index || i;
          originalIndices.push(originalIndex);
        }
        
        console.log(`Uploaded ${sampleDataHashes.length} samples to IPFS with ${originalIndices.length} original indices`);
        console.log('Final original indices for blockchain:', originalIndices);
      } catch (ipfsError) {
        console.error(' IPFS upload failed:', ipfsError);
        throw new Error(`IPFS upload failed: ${ipfsError}`);
      }
      
      // Perform blockchain transaction to start batch voting
      console.log(`Starting batch voting transaction with ${originalIndices.length} original indices`);
      
      // Get signer for transaction
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Get project contract with signer
      const ALProject = (await import('../../../abis/ALProject.json')).default;
      const { resolveALProjectAddress } = await import('../utils/AddressResolver');
      const alProjectAddress = await resolveALProjectAddress(this.state.projectId);
      const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, signer);
      
      // Execute blockchain transaction
      console.log('BLOCKCHAIN TRANSACTION DEBUG:');
      console.log('Sample IDs to send:', sampleIds);
      console.log('Original indices to send:', originalIndices);
      console.log('IPFS hashes to send:', sampleDataHashes);
      console.log('Current iteration from contract:', currentIteration);
      
      const tx = await projectContract.startBatchVoting(sampleIds, sampleDataHashes, originalIndices);
      console.log('Batch voting transaction submitted:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`Batch voting confirmed in block:`, receipt.blockNumber);
      
      //  PURE BLOCKCHAIN + IPFS: No caching needed
      // UI will load data directly from blockchain + IPFS via getActiveBatch()
      console.log('Sample data stored on blockchain + IPFS. UI will load via blockchain + IPFS only.');
      
      console.log(`Batch voting started successfully for ${samples.length} samples`);
      
    } catch (error) {
      console.error(' Failed to start batch voting:', error);
      throw error;
    }
  }

  private async getCurrentIterationFromContract(): Promise<number> {
    try {
      const projectStatus = await alContractService.getProjectStatus(this.state.projectId);
      console.log(`Current AL iteration from contract: ${projectStatus.currentIteration}`);
      return projectStatus.currentIteration;
    } catch (error) {
      console.error(' Failed to get current iteration from contract:', error);
      throw error;
    }
  }

  private setupContractEventListeners(): void {
    console.log('Setting up smart contract event listeners');

    // Listen for voting session started events - FIXED: Use correct event names
    const onVotingStarted = (event: any) => {
      const { round, sampleId } = event.detail || event;
      console.log('Voting session started:', { round, sampleId });
      
      if (this.state.batchProgress && this.state.querySamples) {
        const currentSample = this.state.querySamples[this.state.batchProgress.currentSampleIndex];
        
        this.emit('voting-started', sampleId, currentSample);
      }
    };

    // Listen for vote submitted events
    const onVoteSubmitted = (event: any) => {
      const { sampleId, voter, label } = event.detail || event;
      console.log('Vote submitted:', { sampleId, voter, label });
      
      this.emit('vote-submitted', sampleId, voter, label);
    };

    // Listen for voting session ended events (sample completed) - FIXED: Use correct event name
    const onVotingEnded = async (event: any) => {
      const { round, sampleId, finalLabel } = event.detail || event;
      console.log('Voting session ended:', { round, sampleId, finalLabel });
      
      this.emit('sample-completed', sampleId, finalLabel);
      
      // Sync with contract state instead of manually tracking
      try {
        const enhancedStatus = await alContractService.getEnhancedProjectStatus(this.state.projectId);
        console.log('Syncing with contract state after vote completion:', enhancedStatus.currentBatch);
        
        if (enhancedStatus.currentBatch.batchActive) {
          // Update batch progress with contract state
          const updatedProgress = {
            totalSamples: enhancedStatus.currentBatch.totalSamples,
            completedSamples: enhancedStatus.currentBatch.completedSamples,
            currentSampleIndex: enhancedStatus.currentBatch.activeSamples > 0 ? 
              enhancedStatus.currentBatch.totalSamples - enhancedStatus.currentBatch.activeSamples : 
              enhancedStatus.currentBatch.completedSamples,
            sampleIds: enhancedStatus.currentBatch.sampleIds,
            round: enhancedStatus.currentBatch.round
          };

          console.log(`Updated batch progress from contract: completed ${updatedProgress.completedSamples}/${updatedProgress.totalSamples}`);
          
          this.updateState({
            batchProgress: updatedProgress
          });

          // Check if batch is complete based on contract state
          //  FIX: Don't end batch just because contract says batchActive: false
          // Verify that completion is legitimate (all eligible voters participated)
          if (updatedProgress.completedSamples >= updatedProgress.totalSamples) {
            // All samples show as completed - this should be legitimate
            console.log('All samples completed, triggering handleBatchCompleted');
            await this.handleBatchCompleted();
          } else if (!enhancedStatus.currentBatch.batchActive && updatedProgress.completedSamples < updatedProgress.totalSamples) {
            // Batch inactive but not all samples completed - likely a premature finalization bug
            console.warn(' DETECTED PREMATURE BATCH FINALIZATION');
            console.warn(`   Batch inactive but only ${updatedProgress.completedSamples}/${updatedProgress.totalSamples} samples completed`);
            console.warn('   Keeping session active to allow more voters to participate');
            
            // Force the batch to stay active in the session state even if contract says otherwise
            this.updateState({
              phase: 'voting', // Keep in voting phase
              batchProgress: {
                ...updatedProgress,
                // Override the contract state to keep the batch appearing active in UI
                totalSamples: updatedProgress.totalSamples,
                completedSamples: 0, // Reset to 0 so UI shows all samples as available for voting
                currentSampleIndex: 0,
                sampleIds: updatedProgress.sampleIds,
                round: updatedProgress.round
              }
            });
            
            console.log('Session kept active for additional voter participation');
          }
        } else {
          console.log('Batch no longer active according to contract');
          await this.handleBatchCompleted();
        }
        
      } catch (error) {
        console.error(' Failed to sync with contract state:', error);
        // Fallback to manual state management if contract sync fails
        if (this.state.batchProgress) {
          const newCompletedSamples = this.state.batchProgress.completedSamples + 1;
          const newCurrentSampleIndex = this.state.batchProgress.currentSampleIndex + 1;
          
          const safeCompletedSamples = Math.min(newCompletedSamples, this.state.batchProgress.totalSamples);
          const safeCurrentSampleIndex = Math.min(newCurrentSampleIndex, this.state.batchProgress.totalSamples - 1);
          
          const updatedProgress = {
            ...this.state.batchProgress,
            completedSamples: safeCompletedSamples,
            currentSampleIndex: safeCurrentSampleIndex,
            round: round
          };

          this.updateState({
            batchProgress: updatedProgress
          });

          if (updatedProgress.completedSamples >= updatedProgress.totalSamples) {
            await this.handleBatchCompleted();
          }
        }
      }
    };

    // Listen for iteration completed events - NEW: Handle AL batch completion
    const onIterationCompleted = async (event: any) => {
      const { round, projectAddress, labeledSamples, message } = event.detail || event;
      console.log('AL iteration completed:', { round, projectAddress, labeledSamples, message });
      
      // Ensure batch completion is handled if not already done
      if (this.state.phase === 'voting' || this.state.phase === 'aggregating') {
        await this.handleBatchCompleted();
      }
    };

    // Listen for project end events - NEW: Handle project end conditions
    const onProjectEndTriggered = async (event: any) => {
      const { trigger, reason, currentRound, timestamp } = event.detail || event;
      console.log('Project end triggered:', { trigger, reason, currentRound, timestamp });
      
      // Update session state to indicate project should end
      this.updateState({
        phase: 'ending',
        projectEndReason: reason,
        shouldEnd: true
      });
      
      // Emit event for UI components
      this.emit('project-should-end', {
        trigger,
        reason,
        currentRound: Number(currentRound),
        timestamp: Number(timestamp)
      });
    };

    // FIXED: Add event listeners with correct event names matching ALContractService
    window.addEventListener('dal-voting-started', onVotingStarted);
    window.addEventListener('vote-submitted', onVoteSubmitted); // Keep this one as is
    window.addEventListener('dal-sample-completed', onVotingEnded);
    window.addEventListener('dal-iteration-completed', onIterationCompleted);
    window.addEventListener('dal-project-end-triggered', onProjectEndTriggered);

    // Store cleanup functions
    this.contractListeners = [
      () => window.removeEventListener('dal-voting-started', onVotingStarted),
      () => window.removeEventListener('vote-submitted', onVoteSubmitted),
      () => window.removeEventListener('dal-sample-completed', onVotingEnded),
      () => window.removeEventListener('dal-iteration-completed', onIterationCompleted),
      () => window.removeEventListener('dal-project-end-triggered', onProjectEndTriggered)
    ];
  }

  private cleanupContractListeners(): void {
    console.log('Cleaning up smart contract event listeners');
    this.contractListeners.forEach(cleanup => cleanup());
    this.contractListeners = [];
  }

  private async handleBatchCompleted(): Promise<void> {
    try {
      console.log('Batch voting completed, finalizing iteration');
      
      this.updateState({
        phase: 'aggregating'
      });

      // Collect all labeled samples from this iteration
      const labeledSamples = await this.collectLabeledSamples();
      
      // Submit labeled samples back to AL-Engine
      await this.submitLabeledSamples(labeledSamples);
      
      // Get current iteration from smart contract for events
      const currentIteration = await this.getCurrentIterationFromContract();
      
      this.updateState({
        phase: 'completed',
        isActive: false,
        batchProgress: undefined // FIXED: Explicitly clear batchProgress to prevent carryover
      });

      console.log('Batch progress cleared, session state updated to completed');

      this.emit('iteration-completed', currentIteration, labeledSamples.length);
      
      console.log(`AL iteration ${currentIteration} completed successfully`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete iteration';
      console.error(' Failed to complete iteration:', error);
      
      this.updateState({
        phase: 'error',
        error: errorMessage,
        isActive: false
      });

      this.emit('error', errorMessage);
    }
  }

  private async collectLabeledSamples(): Promise<Array<{
    sampleId: string;
    sampleData: QuerySample;
    label: string;
    originalIndex: number;
  }>> {
    try {
      console.log('Collecting labeled samples from completed voting sessions');
      
      // Get finalized labels from smart contracts
      const labeledSamples = [];
      
      if (this.state.batchProgress && this.state.querySamples) {
        console.log(`Processing ${this.state.batchProgress.totalSamples} samples from batch`);
        
        // Get voting history to extract final labels
        const votingHistory = await alContractService.getVotingHistory(this.state.projectId);
        console.log(`Found ${votingHistory.length} voting records in history`);
        
        for (let i = 0; i < this.state.batchProgress.totalSamples; i++) {
          const sampleId = this.state.batchProgress.sampleIds[i];
          const sampleData = this.state.querySamples[i];
          
          // Find the final label from voting history
          const votingRecord = votingHistory.find(record => record.sampleId === sampleId);
          
          if (votingRecord && votingRecord.finalLabel) {
            const finalLabel = votingRecord.finalLabel;
            console.log(`Sample ${i + 1}/${this.state.batchProgress.totalSamples}: ${sampleId} → ${finalLabel}`);
            
            labeledSamples.push({
              sampleId,
              sampleData,
              label: finalLabel,
              originalIndex: sampleData.original_index || i
            });
          } else {
            console.warn(` No final label found for sample ${sampleId}, using fallback`);
            
            // Fallback: Try to get from ALContractService or use 'unknown'
            const fallbackLabel = 'unknown';
            
            labeledSamples.push({
              sampleId,
              sampleData,
              label: fallbackLabel,
              originalIndex: sampleData.original_index || i
            });
          }
        }
      }
      
      console.log(`Collected ${labeledSamples.length} labeled samples for AL-Engine submission`);
      return labeledSamples;
      
    } catch (error) {
      console.error(' Failed to collect labeled samples:', error);
      throw error;
    }
  }

  /**
   * Check if project should end based on smart contract conditions
   */
  async checkProjectEndConditions(): Promise<void> {
    try {
      const endStatus = await alContractService.getProjectEndStatus(this.state.projectId);
      
      if (endStatus.shouldEnd && !this.state.shouldEnd) {
        console.log('Project should end:', endStatus);
        
        // Update state to indicate project should end
        this.updateState({
          phase: 'ending',
          shouldEnd: true,
          projectEndReason: endStatus.reason
        });
        
        // Emit event for UI components
        this.emit('project-should-end', {
          trigger: 'system',
          reason: endStatus.reason,
          currentRound: endStatus.currentRound,
          timestamp: Date.now()
        });
        
        // Dispatch custom event for other components
        const event = new CustomEvent('dal-project-should-end', {
          detail: {
            projectAddress: this.state.projectId,
            reason: endStatus.reason,
            currentRound: endStatus.currentRound,
            maxIterations: endStatus.maxIterations
          }
        });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Error checking project end conditions:', error);
    }
  }

  /**
   * Handle when AL-Engine reports that no more unlabeled samples are available
   */
  async handleUnlabeledSamplesExhausted(): Promise<void> {
    try {
      console.log('AL-Engine reports no more unlabeled samples available');
      
      // Notify the smart contract
      const success = await alContractService.notifyUnlabeledSamplesExhausted(this.state.projectId);
      
      if (success) {
        // The contract will emit ProjectEndTriggered event, which we'll catch
        console.log('Successfully notified contract about sample exhaustion');
      } else {
        // Fallback: manually trigger project end logic
        console.log('Failed to notify contract, handling locally');
        this.updateState({
          phase: 'ending',
          shouldEnd: true,
          projectEndReason: 'No more unlabeled samples available'
        });
        
        this.emit('project-should-end', {
          trigger: 'al-engine',
          reason: 'No more unlabeled samples available',
          currentRound: this.state.batchProgress?.round || 0,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error handling unlabeled samples exhausted:', error);
    }
  }

  /**
   * Periodic check for project end conditions (called during active session)
   */
  private startProjectEndMonitoring(): void {
    // Check project end conditions every 30 seconds during active session
    const checkInterval = setInterval(async () => {
      if (this.state.isActive && !this.state.shouldEnd) {
        await this.checkProjectEndConditions();
      } else {
        clearInterval(checkInterval);
      }
    }, 30000); // 30 seconds

    // Store cleanup function
    this.contractListeners.push(() => clearInterval(checkInterval));
  }

  // =====================================================================
  // PRIVATE METHODS - State Management
  // =====================================================================

  private updateState(updates: Partial<SessionState>): void {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdate: new Date()
    };
    
    console.log('Session state updated:', this.state);
    this.emit('state-changed', this.getState());
  }
}

// Export singleton factory for easy usage
export const createDALProjectSession = (projectId: string, userAddress: string, alEnginePort?: number): DALProjectSession => {
  return new DALProjectSession(projectId, userAddress, alEnginePort);
};

export default DALProjectSession; 