import React, { useState, useEffect, useCallback } from 'react';
import { useProjects, ProjectInfo } from './useProjects';
import { useAuth } from './useAuth';
import { projectConfigurationService } from '../components/deployment/services/ProjectConfigurationService';
import { ethers } from 'ethers';
import { RPC_URL } from '../config/contracts';
import Project from '../abis/Project.json';

export interface DALProjectInfo extends ProjectInfo {
  // DAL-specific properties
  alConfiguration?: {
    queryStrategy: string;
    scenario: string;
    model: {
      type: string;
      parameters: any;
    };
    maxIterations: number;
    queryBatchSize: number;
    votingConsensus: string;
    votingTimeout: number;
    labelSpace: string[];
  };
  currentIteration: number;
  totalSamplesLabeled: number;
  modelPerformance?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  };
  activeVoting?: {
    sampleId: string;
    sampleData: any;
    labelOptions: string[];
    currentVotes: { [label: string]: number };
    timeRemaining: number;
  };
  // Deployment status
  isDeployed: boolean;
  deploymentStatus?: 'deployed' | 'running' | 'failed' | 'deploying' | 'pending';
}

export interface ModelUpdate {
  iterationNumber: number;
  timestamp: Date;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  totalSamples: number; // Updated from samplesAddedCount to totalSamples
  notes?: string;
  isFinalTraining?: boolean;
}

export interface VotingRecord {
  sampleId: string;
  sampleData: any;
  finalLabel: string;
  votes: { [voterAddress: string]: string };
  votingDistribution: { [label: string]: number };
  timestamp: number;
  iterationNumber: number;
}

export const useDALProject = (projectAddress?: string) => {
  const [dalProjects, setDalProjects] = useState<DALProjectInfo[]>([]);
  const [currentProject, setCurrentProject] = useState<DALProjectInfo | null>(null);
  const [modelUpdates, setModelUpdates] = useState<ModelUpdate[]>([]);
  const [votingHistory, setVotingHistory] = useState<VotingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { projects, userProjects, getProjectInfo } = useProjects();
  const { account } = useAuth();

  // Filter DAL projects from all projects
  const loadDALProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Combine both available projects and user projects
      const allProjects = [...projects, ...userProjects];
      
      const dalProjectsList: DALProjectInfo[] = [];

      for (const project of allProjects) {
        // Get project configuration to check if it's an AL project
        const config = projectConfigurationService.getProjectConfiguration(project.projectId);
        
        // Check if project is an Active Learning project
        // 1. Check the projectData from smart contract (primary source)
        // 2. Fallback to separate configuration service
        const isALProject = (
          // Check project data from smart contract
          project.projectData?.project_type === 'active_learning' ||
          project.projectData?.templateType === 'active_learning' ||
          project.projectData?.type === 'active_learning' ||
          // Fallback to configuration service
          (config && (
            config.projectData?.type === 'active_learning' || 
            config.projectData?.project_type === 'active_learning' ||
            !!config.extensions?.dal
          ))
        );
        
        if (isALProject) {
          // Fetch additional DAL-specific data
          const dalProject = await enrichProjectWithDALData(project, config);
          if (dalProject) {
            dalProjectsList.push(dalProject);
          }
        }
      }

      setDalProjects(dalProjectsList);
    } catch (err) {
      console.error('Failed to load DAL projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load DAL projects');
    } finally {
      setLoading(false);
    }
  }, [projects, userProjects]);

  // Enrich project with DAL-specific data
  const enrichProjectWithDALData = async (project: ProjectInfo, config: any): Promise<DALProjectInfo | null> => {
    try {
      // Check deployment status from smart contract
      let isDeployed = false;
      let deploymentStatus: 'deployed' | 'running' | 'failed' | 'deploying' | 'pending' = 'pending';
      let alConfiguration: any = undefined;
      
      try {
        // Get provider and create contract instance
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const projectContract = new ethers.Contract(project.address, Project.abi, provider);

        // Check if AL contracts are deployed
        const hasALContracts = await projectContract.hasALContracts();
        const needsALDeployment = await projectContract.needsALDeployment();
        
        if (hasALContracts) {
          isDeployed = true;
          deploymentStatus = 'deployed';
        } else if (needsALDeployment) {
          isDeployed = false;
          deploymentStatus = 'pending';
        } else {
          // This shouldn't happen for AL projects, but handle gracefully
          isDeployed = false;
          deploymentStatus = 'pending';
        }

        // Fetch AL configuration directly from smart contract
        console.log('Fetching AL metadata from smart contract:', project.address);
        try {
          const metadata = await projectContract.getProjectMetadata();
          console.log('Retrieved AL metadata from smart contract:', metadata);
          
          // Extract AL configuration from smart contract metadata
          alConfiguration = {
            queryStrategy: metadata._queryStrategy || 'uncertainty_sampling',
            scenario: metadata._alScenario || 'pool_based', 
            model: { 
              type: 'logistic_regression', // Default model type
              parameters: {} 
            },
            maxIterations: Number(metadata._maxIteration) || 10,
            queryBatchSize: Number(metadata._queryBatchSize) || 10,
            votingConsensus: 'simple_majority', // Default consensus type
            votingTimeout: 3600, // Default timeout
            labelSpace: metadata._labelSpace && metadata._labelSpace.length > 0 
              ? metadata._labelSpace 
              : []
          };

          // If AL contracts are deployed, try to get additional voting configuration
          if (hasALContracts) {
            try {
              const votingAddress = await projectContract.votingContract();
              if (votingAddress && votingAddress !== '0x0000000000000000000000000000000000000000') {
                console.log('Fetching voting configuration from AL contract:', votingAddress);
                
                // Import ALProjectVoting ABI
                const ALProjectVoting = await import('../abis/ALProjectVoting.json');
                const votingContract = new ethers.Contract(votingAddress, ALProjectVoting.default.abi, provider);
                
                // Try to get voting timeout and consensus settings if available
                // Note: These methods might not exist in all contract versions
                try {
                  const voterList = await votingContract.getVoterList();
                  console.log('Found voters:', voterList.length);
                  
                  // Additional voting config could be retrieved here if methods exist
                  // alConfiguration.votingConsensus = await votingContract.getConsensusType();
                  // alConfiguration.votingTimeout = await votingContract.getVotingTimeout();
                } catch (votingConfigError) {
                  console.log('Additional voting config not available:', (votingConfigError as Error).message);
                }
              }
            } catch (votingContractError) {
              console.log('Could not fetch voting contract details:', (votingContractError as Error).message);
            }
          }

          console.log('Parsed AL configuration from smart contract:', alConfiguration);
        } catch (metadataError) {
          console.warn('Could not fetch AL metadata from smart contract:', metadataError);
          
          // Fallback to local configuration if smart contract metadata fails
          const dalConfig = config?.extensions?.dal;
          if (dalConfig) {
            alConfiguration = {
              queryStrategy: dalConfig.queryStrategy || 'uncertainty_sampling',
              scenario: dalConfig.alScenario || 'pool_based',
              model: dalConfig.model || { type: 'logistic_regression', parameters: {} },
              maxIterations: dalConfig.maxIterations || 10,
              queryBatchSize: dalConfig.queryBatchSize || 10,
              votingConsensus: dalConfig.votingConsensus || 'simple_majority',
              votingTimeout: dalConfig.votingTimeout || 3600,
              labelSpace: dalConfig.labelSpace || [] // Remove default ['positive', 'negative']
            };
            console.log('Using fallback AL configuration from local storage:', alConfiguration);
          }
        }
        
      } catch (deploymentError) {
        console.warn('Could not check smart contract deployment status:', deploymentError);
        // Fallback to deployment service if smart contract calls fail
        try {
          const { ProjectDeploymentService } = await import('../components/deployment/services/ProjectDeploymentService');
          const deploymentService = ProjectDeploymentService.getInstance();
          isDeployed = deploymentService.isProjectDeployed(project.projectId);
          
          const status = deploymentService.getDeploymentStatus(project.projectId);
          if (status) {
            deploymentStatus = status.status as any;
          }
        } catch (fallbackError) {
          console.warn('Fallback deployment service also failed:', fallbackError);
        }
      }

      // Remove the old local config extraction since we're getting it from smart contract now
      // const dalConfig = config?.extensions?.dal;
      
      // Debug logging to understand what configuration is available
      console.log('DAL Project enrichment for:', {
        projectId: project.projectId,
        projectAddress: project.address,
        hasSmartContractALConfig: !!alConfiguration,
        alConfigFields: alConfiguration ? Object.keys(alConfiguration) : []
      });

      // In real implementation, these would come from the AL engine, smart contract events, or external services
      // For now, we'll leave them undefined until real data sources are connected
      const currentIteration = 0; // TODO: Get from AL engine or smart contract events
      const totalSamplesLabeled = 0; // TODO: Get from AL engine or smart contract events

      const dalProject: DALProjectInfo = {
        ...project,
        alConfiguration,
        currentIteration,
        totalSamplesLabeled,
        // Real model performance and voting data would come from AL contracts/services
        modelPerformance: undefined, // TODO: Get from AL contracts or external ML service
        activeVoting: undefined, // TODO: Get from ALProjectVoting contract
        isDeployed,
        deploymentStatus
      };

      return dalProject;
    } catch (err) {
      console.error(`Failed to enrich project ${project.address} with DAL data:`, err);
      return null;
    }
  };

  // Load specific project details
  const loadProjectDetails = useCallback(async (address: string) => {
    try {
      setLoading(true);
      setError(null);

      const project = await getProjectInfo(address);
      if (project) {
        const config = projectConfigurationService.getProjectConfiguration(project.projectId);
        const dalProject = await enrichProjectWithDALData(project, config);
        setCurrentProject(dalProject);

        // Load model updates and voting history for this project
        await loadModelUpdates(address);
        await loadVotingHistory(address);
      }
    } catch (err) {
      console.error(`Failed to load project details for ${address}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [getProjectInfo]);

  // Load model updates history (real implementation needed)
  const loadModelUpdates = async (projectAddress: string) => {
    try {
      console.log(`[MODEL_UPDATES] Loading model updates for project: ${projectAddress}`);
      
      // Import ALContractService to get real model updates
      const { alContractService } = await import('../components/dal/services/ALContractService');
      const updates = await alContractService.getModelUpdates(projectAddress);
      
      console.log(`[MODEL_UPDATES]  Loaded ${updates.length} model updates`);
      setModelUpdates(updates);
    } catch (error) {
      console.error(`[MODEL_UPDATES]  Failed to load model updates:`, error);
      setModelUpdates([]); // Set empty array on error
    }
  };

  // Load voting history (real implementation needed)
  const loadVotingHistory = async (projectAddress: string) => {
    // TODO: Implement real voting history loading  
    // This should fetch from ALProjectVoting and ALProjectStorage contracts
    // For now, set empty array until real data source is connected
    setVotingHistory([]);
  };

  // Start next AL iteration (coordinator only)
  const startNextIteration = useCallback(async (projectAddress: string) => {
    if (!account || !currentProject) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('Triggering next AL iteration from useDALProject via DALProjectSession');
      
      // Use DALProjectSession instead of ALContractService to avoid stale sample caching
      const { createDALProjectSession } = await import('../components/dal/services/DALProjectSession');
      const dalSession = createDALProjectSession(projectAddress, account);
      
      // Start iteration using the DAL session (this will handle AL-Engine + blockchain properly)
      await dalSession.startIteration();
      
      // Reload project data to reflect changes
      await loadProjectDetails(projectAddress);
      console.log('AL iteration started successfully via DALProjectSession');
      
    } catch (err) {
      console.error(' Failed to start next iteration:', err);
      setError(err instanceof Error ? err.message : 'Failed to start next iteration');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [account, currentProject, loadProjectDetails]);

  // End project (coordinator only)
  const endProject = useCallback(async (projectAddress: string) => {
    if (!account || !currentProject) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('Ending AL project from useDALProject');
      
      // Import ALContractService
      const { alContractService } = await import('../components/dal/services/ALContractService');
      
      // End project using the contract service
      const success = await alContractService.endProject(projectAddress, account);
      
      if (success) {
        // Reload project data to reflect changes
        await loadProjectDetails(projectAddress);
        console.log('AL project ended successfully');
      } else {
        throw new Error('Failed to end AL project');
      }
      
    } catch (err) {
      console.error(' Failed to end project:', err);
      setError(err instanceof Error ? err.message : 'Failed to end project');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [account, currentProject, loadProjectDetails]);

  // Submit vote for current sample
  const submitVote = useCallback(async (projectAddress: string, sampleId: string, label: string) => {
    if (!account || !currentProject) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('Submitting vote from useDALProject');
      
      // Import ALContractService
      const { alContractService } = await import('../components/dal/services/ALContractService');
      
      // Submit vote using the contract service (now batch-only)
      const success = await alContractService.submitBatchVote(projectAddress, [sampleId], [label], account);
      
      if (success) {
        // Reload project data to reflect the vote
        await loadProjectDetails(projectAddress);
        console.log('Vote submitted successfully');
      } else {
        throw new Error('Failed to submit vote');
      }
      
    } catch (err) {
      console.error(' Failed to submit vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [account, currentProject, loadProjectDetails]);

  // Load projects on mount and when projects change
  useEffect(() => {
    if (projects.length > 0 || userProjects.length > 0) {
      loadDALProjects();
    } else {
      setLoading(false);
    }
  }, [projects, userProjects, loadDALProjects]);

  // Load specific project if projectAddress is provided
  useEffect(() => {
    if (projectAddress) {
      loadProjectDetails(projectAddress);
    }
  }, [projectAddress, loadProjectDetails]);

  return {
    dalProjects,
    currentProject,
    modelUpdates,
    votingHistory,
    loading,
    error,
    loadDALProjects,
    loadProjectDetails,
    startNextIteration,
    endProject,
    submitVote
  };
};