/**
 * Smart Contract Service - Handles smart contract interactions
 */

import { ethers } from 'ethers';
import Project from '../../../abis/Project.json';
import { RPC_URL } from '../../../config/contracts';
import { DVREProjectConfiguration } from '../../../shared/types/types';

export class SmartContractService {
  private static instance: SmartContractService;

  static getInstance(): SmartContractService {
    if (!SmartContractService.instance) {
      SmartContractService.instance = new SmartContractService();
    }
    return SmartContractService.instance;
  }

  /**
   * Generate config.json from smart contract data for AL projects
   * This replaces hardcoded configuration with actual smart contract data
   */
  async generateConfigFromSmartContract(
    projectId: string,
    config: DVREProjectConfiguration
  ): Promise<any> {
    try {
      // If not an AL project, return basic config
      if (!config.extensions?.dal) {
        return {
          project_id: projectId,
          project_type: config.projectData?.type || 'general',
          version: '1.0.0',
          created_at: config.created,
          updated_at: config.lastModified
        };
      }

      // For AL projects, try to get data from smart contract
      console.log('Fetching AL configuration from smart contract...');
      
      // Use JsonRpcProvider for read-only operations
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      
      let smartContractData: {
        queryStrategy?: string;
        alScenario?: string;
        maxIterations?: number;
        queryBatchSize?: number;
        labelSpace?: string[];
        votingContract?: string | null;
        storageContract?: string | null;
      } = {};
      
      if (config.contractAddress) {
        try {
          // Import ALProject ABI instead of Project ABI
          const ALProject = (await import('../../../abis/ALProject.json')).default;
          const projectContract = new ethers.Contract(
            config.contractAddress,
            ALProject.abi,
            provider
          );

          // Check if project has AL contracts deployed
          const hasALContracts = await projectContract.hasALContracts();
          if (hasALContracts) {
            // Get real AL configuration using correct method and destructuring
            const [
              queryStrategy,
              alScenario,
              maxIteration,
              , // currentRound (unused)
              queryBatchSize,
              , // votingTimeout (unused)
              labelSpace
            ] = await projectContract.getALConfiguration();
            
            smartContractData = {
              queryStrategy: queryStrategy || 'uncertainty_sampling',
              alScenario: alScenario || 'pool_based',
              maxIterations: Number(maxIteration) || 10,
              queryBatchSize: Number(queryBatchSize) || 5,
              labelSpace: labelSpace ? [...labelSpace] : [],
              votingContract: await projectContract.votingContract?.() || null,
              storageContract: await projectContract.storageContract?.() || null
            };
            console.log('Retrieved AL metadata from smart contract using ALProject.getALConfiguration()');
            console.log('Real AL config:', smartContractData);
          } else {
            console.log('AL contracts not yet deployed, using stored configuration');
            throw new Error('AL contracts not deployed yet');
          }
        } catch (contractError) {
          console.warn(' Could not retrieve AL metadata from contract, using configuration data');
          // Fallback to stored configuration - using correct field names
          smartContractData = {
            queryStrategy: config.extensions.dal.queryStrategy || 'uncertainty_sampling',
            alScenario: config.extensions.dal.alScenario || 'pool_based',
            maxIterations: config.extensions.dal.maxIterations || 10,
            queryBatchSize: config.extensions.dal.queryBatchSize || 5,
            labelSpace: config.extensions.dal.labelSpace || []
          };
        }
      } else {
        console.warn(' Could not connect to smart contract, using stored configuration');
        smartContractData = {
          queryStrategy: config.extensions.dal.queryStrategy || 'uncertainty_sampling',
          alScenario: config.extensions.dal.alScenario || 'pool_based',
          maxIterations: config.extensions.dal.maxIterations || 10,
          queryBatchSize: config.extensions.dal.queryBatchSize || 5,
          labelSpace: config.extensions.dal.labelSpace || []
        };
      }

      // Generate comprehensive config.json for AL projects
      const alConfig = {
        // Project identification
        project_id: projectId,
        project_type: 'active_learning',
        version: '1.0.0',
        
        // Timestamps
        created_at: config.created,
        updated_at: config.lastModified,
        
        // Smart contract information
        smart_contract: {
          main_contract: config.contractAddress,
          voting_contract: smartContractData.votingContract,
          storage_contract: smartContractData.storageContract
        },
        
        // Active Learning Configuration
        active_learning: {
          query_strategy: smartContractData.queryStrategy,
          scenario: smartContractData.alScenario,
          max_iterations: smartContractData.maxIterations,
          query_batch_size: smartContractData.queryBatchSize,
          label_space: smartContractData.labelSpace,
          
          // Model configuration - using actual saved values
          model: {
            type: config.extensions.dal.model?.type || 'logistic_regression',
            parameters: config.extensions.dal.model?.parameters || {
              max_iter: 1000,
              random_state: 42
            },
            framework: 'scikit-learn'
          },
          
          // Dataset configuration - using actual saved values
          datasets: {
            training_dataset: config.extensions.dal.trainingDataset || 'dataset-main',
            labeling_dataset: config.extensions.dal.labelingDataset || 'dataset-main',
            format: 'csv'
          },
          
          // Voting configuration - using actual saved values
          voting: {
            consensus_type: config.extensions.dal.votingConsensus || 'simple_majority',
            threshold: 0.51,
            timeout_seconds: config.extensions.dal.votingTimeout || 3600
          },
          
          // Additional AL parameters
          validation_split: config.extensions.dal.validation_split || 0.2
        },
        
        // Workflow configuration
        workflow: {
          name: 'al_iteration.cwl',
          type: 'cwl',
          version: 'v1.2',
          orchestrator_endpoint: 'http://145.100.135.97:5004'
        },
        
        // IPFS configuration
        ipfs: {
          gateway: 'http://145.100.135.97:8081/ipfs/',
          api_endpoint: 'http://145.100.135.97:5002'
        }
      };

      return alConfig;
    } catch (error) {
      console.error('Error generating config from smart contract:', error);
      // Fallback to basic config
      return {
        project_id: projectId,
        project_type: config.extensions?.dal ? 'active_learning' : 'general',
        version: '1.0.0',
        created_at: config.created,
        updated_at: config.lastModified,
        error: 'Could not retrieve smart contract data'
      };
    }
  }

  /**
   * Refresh project configuration from smart contract
   */
  async refreshProjectConfigurationFromContract(
    projectId: string,
    config: DVREProjectConfiguration
  ): Promise<DVREProjectConfiguration | null> {
    if (!config.contractAddress) {
      console.warn('Project configuration or contract address not available for refresh.');
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const projectContract = new ethers.Contract(
        config.contractAddress,
        Project.abi,
        signer
      );

      // Fetch the latest configuration from the smart contract
      const latestConfig = await projectContract.getProjectConfiguration();
      console.log('Refreshed project configuration from smart contract:', latestConfig);

      // Update the local configuration with fresh smart contract data
      const updatedConfig = { ...config, projectData: latestConfig };

      // Update deployment status
      updatedConfig.ipfs = {
        roCrateHash: config.ipfs?.roCrateHash || '',
        publishedAt: config.ipfs?.publishedAt || new Date().toISOString()
      };

      return updatedConfig;
    } catch (error) {
      console.error('Failed to refresh project configuration from smart contract:', error);
      return null;
    }
  }
}

export const smartContractService = SmartContractService.getInstance(); 