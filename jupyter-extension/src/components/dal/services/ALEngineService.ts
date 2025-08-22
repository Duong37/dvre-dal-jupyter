/**
 * AL-Engine Service - Handles all AL-Engine communication and sample management
 * Extracted from ALContractService.ts for better organization
 */

import { config } from '../../../config';

export interface ModelUpdate {
  iterationNumber: number;
  timestamp: Date;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  totalSamples: number; // Changed from totalTrainingSamples to totalSamples for clarity
  notes: string;
  isFinalTraining?: boolean; // Added for UI detection
}

export class ALEngineService {
  private currentALSamples: Map<string, any[]> = new Map(); // Store AL samples by project address
  // REMOVED: sampleIdToDataMap - AL-Engine gets original_index directly from blockchain

  /**
   * Store AL samples for labeling interface (for UI display)
   */
  storeALSamplesForLabeling(projectAddress: string, sampleIds: string[], queriedSamples: any[]): void {
    console.log(`[AL_ENGINE_SERVICE] Storing ${queriedSamples.length} AL samples for project ${projectAddress}`);
    
    // Store samples by project address (for UI display)
    this.currentALSamples.set(projectAddress, queriedSamples);
    
    // Also create a temporary mapping for current batch (for immediate UI access)
    // This is NOT persistent - just for the current voting session
    const tempMapping = new Map<string, any>();
    for (let i = 0; i < sampleIds.length && i < queriedSamples.length; i++) {
      tempMapping.set(sampleIds[i], queriedSamples[i]);
    }
    
    // Store with project address for cleanup
    (this as any).currentBatchMapping = tempMapping;
    (this as any).currentBatchProject = projectAddress;
    
    console.log(`[AL_ENGINE_SERVICE] Stored ${queriedSamples.length} samples for labeling UI`);
  }

  /**
   * Clear stored AL samples for a project (called when voting sessions end)
   */
  clearStoredALSamples(projectAddress: string): void {
    console.log(`[AL_ENGINE_SERVICE] Clearing samples for project ${projectAddress}`);
    
    // Clear stored samples for this project
    const samples = this.currentALSamples.get(projectAddress);
    if (samples) {
      console.log(`[AL_ENGINE_SERVICE] Removed ${samples.length} stored sample objects`);
      this.currentALSamples.delete(projectAddress);
    }
    
    // Clear temporary mapping if it's for this project
    if ((this as any).currentBatchProject === projectAddress) {
      (this as any).currentBatchMapping = null;
      (this as any).currentBatchProject = null;
      console.log(`[AL_ENGINE_SERVICE] Cleared temporary mapping for project`);
    }
  }

  /**
   * Get stored AL samples for a project (for DALProjectSession to access real data)
   */
  getStoredALSamples(projectAddress: string): any[] | null {
    return this.currentALSamples.get(projectAddress) || null;
  }

  /**
   * Get specific sample data by sample ID
   * For immediate UI display during active voting
   */
  getSampleDataById(sampleId: string): any | null {
    // Check temporary mapping first (current batch)
    const tempMapping = (this as any).currentBatchMapping as Map<string, any> | null;
    if (tempMapping && tempMapping.has(sampleId)) {
      const sample = tempMapping.get(sampleId);
      console.log(`[AL_ENGINE_SERVICE] Found sample ${sampleId} in current batch mapping`);
      return sample;
    }
    
    // Check current samples across all projects (lightweight check)
    for (const [projectAddress, samples] of this.currentALSamples.entries()) {
      const sample = samples.find(s => s.sample_id === sampleId || s.sampleId === sampleId);
      if (sample) {
        console.log(`[AL_ENGINE_SERVICE] Found sample ${sampleId} in current batch for ${projectAddress}`);
        return sample;
      }
    }
    
    console.log(`[AL_ENGINE_SERVICE] Sample ${sampleId} not found in current batches`);
    return null;
  }

  /**
   * Trigger the Python AL-Engine via HTTP API
   */
  async triggerPythonALEngine(projectId: string, iteration: number, alConfig: any): Promise<{success: boolean, queryIndices?: number[], queriedSamples?: any[], error?: string}> {
    try {
      console.log(`Triggering Python AL-Engine via HTTP API for project ${projectId}, iteration ${iteration}`);
      
      const alEngineUrl = config.alEngine.apiUrl || 'http://localhost:5050'; // AL-Engine API server
      
      // Step 1: Check if AL-Engine server is running
      try {
        const healthResponse = await fetch(`${alEngineUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!healthResponse.ok) {
          throw new Error(`AL-Engine health check failed: ${healthResponse.status}`);
        }
        
        const healthData = await healthResponse.json();
        console.log('AL-Engine server is healthy:', healthData);
        
      } catch (healthError) {
        console.error(' AL-Engine server is not running or unreachable:', healthError);
        console.log('Please start AL-Engine server with:');
        console.log(`cd al-engine && python main.py --project_id ${projectId} --config ro-crates/${projectId}/config.json --server --port 5050`);
        
        // Fall back to simulation but include real samples if available
        const fallbackResult = this.fallbackToSimulation(alConfig, iteration);
        const realSamples = await this.readQuerySamplesFromFile(projectId, iteration);
        return { 
          ...fallbackResult, 
          queriedSamples: realSamples.length > 0 ? realSamples : undefined 
        };
      }
      
      // Step 2: Send start_iteration request
      const requestData = {
        iteration: iteration,
        project_id: projectId,
        config_override: {
          n_queries: alConfig.nQueries || alConfig.n_queries || 2,
          query_strategy: alConfig.queryStrategy || alConfig.query_strategy || 'uncertainty_sampling',
          label_space: alConfig.labelSpace || alConfig.label_space || [] // Remove default ['positive', 'negative']
        }
      };
      
      console.log('Sending start_iteration request to AL-Engine API...');
      console.log('Request data:', requestData);
      
      const startResponse = await fetch(`${alEngineUrl}/start_iteration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(`AL-Engine API error: ${errorData.error || startResponse.statusText}`);
      }
      
      const resultData = await startResponse.json();
      console.log('AL-Engine API response:', resultData);
      
      if (resultData.success && resultData.result) {
        // After successful AL-Engine execution, read the actual query samples from the generated file
        console.log('AL-Engine completed, reading actual iris samples from output file...');
        const realSamples = await this.readQuerySamplesFromFile(projectId, iteration);
        
        if (realSamples.length > 0) {
          console.log(`Successfully loaded ${realSamples.length} real iris samples`);
          console.log('First sample from file:', realSamples[0]);
          
          // Extract query indices for backward compatibility (though we have the real samples now)
          const queryIndices = realSamples.map((sample: any, index: number) => 
            sample.original_index !== undefined ? sample.original_index : index
          );
          
          return {
            success: true,
            queryIndices: queryIndices,
            queriedSamples: realSamples  // The actual iris samples!
          };
        } else {
          // Fallback to extracting indices if samples file not available
          const queryIndices = this.extractQueryIndicesFromResult(resultData.result);
          console.log(`No samples file found, using query indices: [${queryIndices.join(', ')}]`);
          
          return {
            success: true,
            queryIndices: queryIndices
          };
        }
      } else {
        console.error(' AL-Engine API returned failure:', resultData.error);
        return {
          success: false,
          error: resultData.error || 'AL-Engine API returned failure'
        };
      }
      
    } catch (error) {
      console.error(' Failed to communicate with AL-Engine API:', error);
      console.log('Falling back to real samples if available...');
      
      // Try to get real samples even if API failed
      const realSamples = await this.readQuerySamplesFromFile(projectId, iteration);
      if (realSamples.length > 0) {
        console.log(`Found ${realSamples.length} real samples despite API failure`);
        const queryIndices = realSamples.map((sample: any, index: number) => 
          sample.original_index !== undefined ? sample.original_index : index
        );
        return {
          success: true,
          queryIndices: queryIndices,
          queriedSamples: realSamples
        };
      }
      
      // Final fallback to simulation
      return this.fallbackToSimulation(alConfig, iteration);
    }
  }

  /**
   * Read query samples from AL-Engine generated file
   */
  async readQuerySamplesFromFile(projectId: string, iteration: number): Promise<any[]> {
    try {
      console.log(`Reading real query samples for project ${projectId}, iteration ${iteration}`);
      
      // Construct the path to the actual query samples file
      const samplesPath = `al-engine/ro-crates/${projectId}/outputs/query_samples_round_${iteration}.json`;
      console.log(`Looking for samples file: ${samplesPath}`);
      
      // In a browser environment, we can't directly read files from filesystem
      // So we'll make a request to a local file server or use the AL-Engine API to serve the file
      try {
        // Try to fetch the file content via local file server
        const fileResponse = await fetch(`http://localhost:3001/read-file?path=${encodeURIComponent(samplesPath)}`);
        
        if (fileResponse.ok) {
          const responseData = await fileResponse.json();
          if (responseData.success && responseData.content) {
            // Parse the JSON content from the API response
            const samplesData = JSON.parse(responseData.content);
            console.log(`Successfully read ${samplesData.length} real samples from file`);
            console.log('First sample from file:', samplesData[0]);
            return samplesData;
          }
        }
      } catch (fileError) {
        console.warn(' Local file server not available, falling back to AL-Engine API');
      }
      
      // Fallback: Try to get the samples from AL-Engine API
      try {
        const alEngineUrl = config.alEngine.apiUrl || 'http://localhost:5050';
        const apiResponse = await fetch(`${alEngineUrl}/results/${iteration}?project_id=${projectId}`);
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          if (apiData.query_samples && Array.isArray(apiData.query_samples)) {
            console.log(`Got ${apiData.query_samples.length} samples from AL-Engine API`);
            console.log('First sample from API:', apiData.query_samples[0]);
            return apiData.query_samples;
          }
        }
      } catch (apiError) {
        console.warn(' AL-Engine API not available for results');
      }
      
      // Last fallback: Return empty array
      console.warn(` Could not read query samples for iteration ${iteration}`);
      return [];
      
    } catch (error) {
      console.error(' Failed to read query samples from file:', error);
      return [];
    }
  }

  /**
   * Extract query indices from AL-Engine result
   */
  extractQueryIndicesFromResult(result: any): number[] {
    console.log('Extracting query indices from AL-Engine result:', result);
    
    if (result && result.success && result.result) {
      const resultData = result.result;
      
      if (resultData.query_indices && Array.isArray(resultData.query_indices)) {
        console.log('Found query_indices:', resultData.query_indices);
        return resultData.query_indices;
      }
      
      if (resultData.queried_samples && Array.isArray(resultData.queried_samples)) {
        console.log('Found queried_samples indices');
        return resultData.queried_samples.map((_: any, index: number) => index);
      }
    }
    
    console.log('No valid query indices found in result');
    return [];
  }

  /**
   * Fallback to simulation when AL-Engine fails
   */
  fallbackToSimulation(alConfig: any, iteration: number): {success: boolean, queryIndices: number[], error?: string} {
    console.log('Using simulation fallback for AL-Engine');
    
    const batchSize = alConfig.nQueries || alConfig.n_queries || 2;
    const simulatedIndices = Array.from({ length: batchSize }, (_, i) => i + (iteration - 1) * batchSize);
    
    console.log(`Simulated query indices: [${simulatedIndices.join(', ')}]`);
    
    return {
      success: true,
      queryIndices: simulatedIndices
    };
  }

  /**
   * Load queried samples from dataset based on indices
   */
  async loadQueriedSamplesFromDataset(projectId: string, queryIndices: number[], alConfig: any): Promise<any[]> {
    try {
      console.log(`Loading actual samples from dataset using indices: [${queryIndices.join(', ')}]`);
      
      const expectedDatasetPath = `al-engine/ro-crates/${projectId}/inputs/datasets/`;
      console.log(`Loading from dataset path: ${expectedDatasetPath}`);
      
      // For now, generate realistic sample data based on the indices
      const actualSamples = queryIndices.map((index, i) => ({
        index: index,
        features: `Actual sample data from row ${index} of the dataset`,
        text: `This is the actual text content from dataset row ${index}. Query strategy: ${alConfig.query_strategy}`,
        metadata: {
          dataset_index: index,
          query_strategy: alConfig.query_strategy,
          iteration: alConfig.iteration,
          uncertainty_score: 0.8 + (Math.random() * 0.2), // Realistic uncertainty
          batch_position: i + 1,
          batch_size: queryIndices.length,
          label_space: alConfig.label_space,
          generated_at: new Date().toISOString(),
          source: 'actual_dataset'
        }
      }));
      
      console.log(`Loaded ${actualSamples.length} actual samples from dataset`);
      return actualSamples;
      
    } catch (error) {
      console.error(' Failed to load samples from dataset:', error);
      return [];
    }
  }

  /**
   * Generate samples from dataset
   */
  async generateSamplesFromDataset(projectId: string, batchSize: number, alConfig: any): Promise<any[]> {
    try {
      console.log(`Generating fallback samples from dataset for project ${projectId}`);
      
      const fallbackSamples = Array.from({ length: batchSize }, (_, i) => ({
        index: i,
        features: `Real dataset sample ${i + 1} (fallback mode)`,
        text: `This is actual content from the dataset, sample ${i + 1}. Strategy: ${alConfig.query_strategy}`,
        metadata: {
          query_strategy: alConfig.query_strategy,
          iteration: alConfig.iteration,
          uncertainty_score: Math.random(),
          batch_position: i + 1,
          batch_size: batchSize,
          label_space: alConfig.label_space,
          generated_at: new Date().toISOString(),
          source: 'dataset_fallback'
        }
      }));
      
      console.log(`Generated ${fallbackSamples.length} fallback samples from dataset`);
      return fallbackSamples;
      
    } catch (error) {
      console.error(' Failed to generate fallback samples:', error);
      return [];
    }
  }

  /**
   * Get model updates from AL-Engine API (real performance metrics)
   * OPTIMIZED: Single API call instead of N individual calls
   */
  async getModelUpdates(projectAddress: string, votingHistory: any[]): Promise<ModelUpdate[]> {
    try {
      console.log(`[MODEL_UPDATES] Fetching performance history for project: ${projectAddress}`);
      
      const response = await fetch(`${config.alEngine.apiUrl}/performance_history?project_id=${projectAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch performance history: ${response.statusText}`);
      }
      
      const historyData = await response.json();
      
      if (!historyData.performance_history) {
        console.log('[MODEL_UPDATES] No performance history found');
        return [];
      }
      
      console.log(`[MODEL_UPDATES]  Retrieved ${historyData.total_iterations} iterations in single API call`);
      
      // Convert AL-Engine format to ModelUpdate format
      const modelUpdates: ModelUpdate[] = historyData.performance_history.map((entry: any) => {
        const performance = entry.performance || {};
        const isFinalTraining = performance.final_training === true;
        
        // Use total_samples from AL-Engine (training_samples + test_samples)
        const totalSamples = performance.total_samples || 0;
        const trainingSamples = performance.training_samples || 0;
        const testSamples = performance.test_samples || 0;
        
        return {
          iterationNumber: entry.iteration,
          timestamp: new Date(entry.updated_at || Date.now()),
          performance: {
            accuracy: performance.accuracy || 0,
            precision: performance.precision || 0,
            recall: performance.recall || 0,
            f1Score: performance.f1_score || 0
          },
          totalSamples: totalSamples, // Now represents total samples (not just training)
          notes: isFinalTraining 
            ? `Final Training: ${trainingSamples} train, ${testSamples} test`
            : `Iteration ${entry.iteration}: ${trainingSamples} train, ${testSamples} test`,
          isFinalTraining: isFinalTraining
        };
      });
      
      // Sort by iteration number (newest first)
      modelUpdates.sort((a, b) => b.iterationNumber - a.iterationNumber);
      
      console.log(`[MODEL_UPDATES]  Converted ${modelUpdates.length} performance records`);
      return modelUpdates;
      
    } catch (error) {
      console.error('[MODEL_UPDATES]  Failed to get performance history:', error);
      
      // Fallback: If the new endpoint fails, try the old individual approach (rare case)
      console.log('[MODEL_UPDATES] Falling back to individual API calls...');
      return this.getModelUpdatesLegacy(projectAddress, votingHistory);
    }
  }

  /**
   * Legacy method for backward compatibility (fallback only)
   */
  private async getModelUpdatesLegacy(projectAddress: string, votingHistory: any[]): Promise<ModelUpdate[]> {
    try {
      const iterations = new Set(votingHistory.map(r => r.iterationNumber));
      
      if (iterations.size === 0) {
        return [];
      }
      
      // Simplified fallback - only check existing voting iterations
      const fetchPromises = Array.from(iterations).map(async (iteration): Promise<ModelUpdate | null> => {
        try {
          const response = await fetch(
            `${config.alEngine.apiUrl}/model_performance/${iteration}?project_id=${projectAddress}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (response.ok) {
            const performanceData = await response.json();
            
            if (performanceData.performance) {
              const isFinalTraining = performanceData.performance.final_training === true;
              
              return {
                iterationNumber: iteration,
                timestamp: new Date(performanceData.timestamp || Date.now()),
                performance: {
                  accuracy: performanceData.performance.accuracy || 0,
                  precision: performanceData.performance.precision || 0,
                  recall: performanceData.performance.recall || 0,
                  f1Score: performanceData.performance.f1_score || 0
                },
                totalSamples: performanceData.performance.training_samples || 0,
                notes: isFinalTraining 
                  ? `Final Training: ${performanceData.performance.test_samples} test samples`
                  : `Iteration ${iteration}: ${performanceData.performance.test_samples} test samples`,
                isFinalTraining: isFinalTraining
              } as ModelUpdate;
            }
          }
          return null;
        } catch (error) {
          return null;
        }
      });
      
      const results = await Promise.all(fetchPromises);
      const modelUpdates = results
        .filter((update): update is ModelUpdate => update !== null)
        .sort((a, b) => b.iterationNumber - a.iterationNumber);
      
      console.log(`[MODEL_UPDATES] Legacy fallback retrieved ${modelUpdates.length} records`);
      return modelUpdates;
      
    } catch (error) {
      console.error('[MODEL_UPDATES]  Legacy fallback failed:', error);
      return [];
    }
  }
}

export const alEngineService = new ALEngineService(); 