/**
 * Project Deployment Service
 * Manages the state and progress of project deployment across different phases
 */

import { DVREProjectConfiguration } from './ProjectConfigurationService';

export interface DeploymentStatus {
  status: 'pending' | 'deploying' | 'deployed' | 'running' | 'failed';
  deployedAt?: string;
  orchestrationWorkflowId?: string;
  orchestrationUrl?: string;
  error?: string;
  lastUpdated: string;
}

export interface DeploymentConfig {
  orchestrationServerUrl: string;
  enableHealthChecks: boolean;
  deploymentTimeout: number;
  retryAttempts: number;
}

export interface OrchestrationRequest {
  project_id: string;
  workflow_type: 'active_learning' | 'federated_learning' | 'general';
  configuration: any;
  ipfs_hashes: {
    ro_crate_hash: string;
  };
  configuration_phase: 'deployed' | 'not deployed';
}

interface OrchestrationResponse {
  workflow_id: string;
  status: string;
  message?: string;
}

export class ProjectDeploymentService {
  private static instance: ProjectDeploymentService;
  private storagePrefix = 'dvre-deployment-status';
  
  // Default configuration
  private config: DeploymentConfig = {
    orchestrationServerUrl: 'http://145.100.135.97:5004', // From your VM
    enableHealthChecks: true,
    deploymentTimeout: 30000, // 30 seconds
    retryAttempts: 3
  };

  // In-memory cache for deployment statuses
  private deploymentCache = new Map<string, DeploymentStatus>();

  constructor() {
    // Load config from environment if available
    const envConfig = (window as any).__DVRE_CONFIG__?.ORCHESTRATION;
    if (envConfig) {
      this.config = { ...this.config, ...envConfig };
    }
    
    // Initialize from localStorage
    this.loadAllDeploymentStatuses();
  }

  static getInstance(): ProjectDeploymentService {
    if (!ProjectDeploymentService.instance) {
      ProjectDeploymentService.instance = new ProjectDeploymentService();
    }
    return ProjectDeploymentService.instance;
  }

  /**
   * Deploy a project to the orchestration server
   * This is called after successful IPFS publication
   */
  async deployProject(
    projectId: string,
    projectConfig: DVREProjectConfiguration,
    ipfsHashes: { roCrateHash: string },
    votingContractAddress?: string
  ): Promise<boolean> {
    try {
      console.log('Deploying project to orchestration server:', projectId);
      
      // Prepare orchestration request
      const orchestrationRequest: OrchestrationRequest = {
        project_id: projectId,
        workflow_type: this.getWorkflowType(projectConfig),
        configuration: this.buildConfiguration(projectConfig, votingContractAddress),
        ipfs_hashes: {
          ro_crate_hash: ipfsHashes.roCrateHash
        },
        configuration_phase: 'deployed'
      };

      // Update deployment status to 'deploying'
      this.updateDeploymentStatus(projectId, {
        status: 'deploying',
        lastUpdated: new Date().toISOString()
      });

      // Check orchestration server health first
      if (this.config.enableHealthChecks) {
        const isHealthy = await this.checkOrchestrationHealth();
        if (!isHealthy) {
          throw new Error('Orchestration server is not responding');
        }
      }

      // Submit to orchestration server
      const response = await this.submitToOrchestration(orchestrationRequest);
      
      // Update deployment status with success
      this.updateDeploymentStatus(projectId, {
        status: 'deployed',
        deployedAt: new Date().toISOString(),
        orchestrationWorkflowId: response.workflow_id,
        orchestrationUrl: `${this.config.orchestrationServerUrl}/streamflow/status/${response.workflow_id}`,
        lastUpdated: new Date().toISOString()
      });

      console.log(`Successfully deployed project ${projectId} (workflow: ${response.workflow_id})`);
      return true;

    } catch (error) {
      console.error(` Deployment failed for project ${projectId}:`, error);
      
      // Update deployment status with failure
      this.updateDeploymentStatus(projectId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown deployment error',
        lastUpdated: new Date().toISOString()
      });
      
      return false;
    }
  }

  /**
   * Get deployment status for a project
   */
  getDeploymentStatus(projectId: string): DeploymentStatus | null {
    return this.deploymentCache.get(projectId) || null;
  }

  /**
   * Update deployment status (persisted to localStorage)
   */
  updateDeploymentStatus(projectId: string, updates: Partial<DeploymentStatus>): void {
    const existing = this.deploymentCache.get(projectId) || {
      status: 'pending' as const,
      lastUpdated: new Date().toISOString()
    };
    
    const updated = { ...existing, ...updates };
    
    // Update cache
    this.deploymentCache.set(projectId, updated);
    
    // Persist to localStorage
    const storageKey = `${this.storagePrefix}-${projectId}`;
    localStorage.setItem(storageKey, JSON.stringify(updated));
    
    console.log(`Deployment status updated for ${projectId}:`, updated);
  }

  /**
   * Determine workflow type from project configuration
   */
  private getWorkflowType(projectConfig: DVREProjectConfiguration): 'active_learning' | 'federated_learning' | 'general' {
    if (projectConfig.extensions?.dal || projectConfig.projectData?.type === 'active_learning') {
      return 'active_learning';
    }
    if (projectConfig.extensions?.federated || projectConfig.projectData?.type === 'federated_learning') {
      return 'federated_learning';
    }
    return 'general';
  }

  /**
   * Build configuration object for orchestration
   */
  private buildConfiguration(config: DVREProjectConfiguration, votingContractAddress?: string): any {
    const baseConfig: any = {
      project_name: config.projectData?.name || config.projectData?.project_id || 'Unknown Project',
      description: config.projectData?.description || config.projectData?.objective || '',
      owner: config.owner,
      contract_address: config.contractAddress,
      ro_crate_hash: config.ipfs?.roCrateHash,
      created: config.created,
      last_modified: config.lastModified
    };

    // Add extension-specific configurations
    if (config.extensions?.dal) {
      const dalConfig = config.extensions.dal;
      const inputs: any = {
        query_strategy: dalConfig.queryStrategy || 'uncertainty_sampling',
        AL_scenario: dalConfig.alScenario || 'pool_based',
        max_iterations: dalConfig.maxIterations || 10,
        labeling_budget: dalConfig.queryBatchSize || 5,
        validation_split: dalConfig.validation_split || 0.2,
        training_dataset: dalConfig.trainingDataset || '',
        labeling_dataset: dalConfig.labelingDataset || '',
        voting_consensus: dalConfig.votingConsensus || 'simple_majority',
        voting_timeout: dalConfig.votingTimeout || 3600
      };

      if (votingContractAddress) {
        inputs.voting_contract_address = votingContractAddress;
      }
      
      baseConfig.inputs = inputs;
    }

    return baseConfig;
  }

  /**
   * Submit orchestration request to server
   */
  private async submitToOrchestration(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const endpoint = `${this.config.orchestrationServerUrl}/api/projects/deploy`;
    
    console.log(`Submitting to orchestration server: ${endpoint}`);
    console.log('Request payload:', {
      project_id: request.project_id,
      workflow_type: request.workflow_type,
      configuration: request.configuration
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.deploymentTimeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Orchestration server error: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const result = await response.json();
      console.log('Orchestration deployment successful:', result);
      return result;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Deployment timeout - orchestration server did not respond in time');
      }
      throw error;
    }
  }

  /**
   * Check orchestration server health
   */
  private async checkOrchestrationHealth(): Promise<boolean> {
    try {
      const healthEndpoint = `${this.config.orchestrationServerUrl}/health`;
      const response = await fetch(healthEndpoint, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('Orchestration server health check failed:', error);
      return false;
    }
  }

  /**
   * Load all deployment statuses from localStorage
   */
  private loadAllDeploymentStatuses(): void {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        try {
          const projectId = key.replace(`${this.storagePrefix}-`, '');
          const status = JSON.parse(localStorage.getItem(key)!);
          this.deploymentCache.set(projectId, status);
        } catch (error) {
          console.warn('Failed to load deployment status from localStorage:', key, error);
        }
      }
    }
  }

  /**
   * Monitor workflow status (optional polling)
   */
  async monitorWorkflowStatus(projectId: string): Promise<DeploymentStatus | null> {
    const currentStatus = this.getDeploymentStatus(projectId);
    if (!currentStatus?.orchestrationWorkflowId) {
      return currentStatus;
    }

    try {
      const statusEndpoint = `${this.config.orchestrationServerUrl}/api/workflows/${currentStatus.orchestrationWorkflowId}/status`;
      const response = await fetch(statusEndpoint);
      
      if (response.ok) {
        const workflowStatus = await response.json();
        
        // Map orchestration status to our deployment status
        const mappedStatus = this.mapOrchestrationStatus(workflowStatus.status);
        
        if (mappedStatus !== currentStatus.status) {
          this.updateDeploymentStatus(projectId, {
            status: mappedStatus,
            lastUpdated: new Date().toISOString()
          });
          
          return this.getDeploymentStatus(projectId);
        }
      }
    } catch (error) {
      console.warn('Failed to monitor workflow status:', error);
    }

    return currentStatus;
  }

  /**
   * Map orchestration server status to our deployment status
   */
  private mapOrchestrationStatus(orchestrationStatus: string): DeploymentStatus['status'] {
    switch (orchestrationStatus?.toLowerCase()) {
      case 'running':
      case 'executing':
        return 'running';
      case 'completed':
      case 'success':
        return 'deployed';
      case 'failed':
      case 'error':
        return 'failed';
      case 'pending':
      case 'queued':
        return 'deploying';
      default:
        return 'deployed'; // Default to deployed if unknown
    }
  }

  /**
   * Check if a project is deployed
   */
  isProjectDeployed(projectId: string): boolean {
    const status = this.getDeploymentStatus(projectId);
    return status?.status === 'deployed' || status?.status === 'running';
  }

  /**
   * Get orchestration URL for a project
   */
  getOrchestrationUrl(projectId: string): string | null {
    const status = this.getDeploymentStatus(projectId);
    return status?.orchestrationUrl || null;
  }
}

export const projectDeploymentService = ProjectDeploymentService.getInstance(); 