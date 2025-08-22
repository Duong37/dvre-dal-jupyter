/**
 * Project Configuration Service
 * Manages project configuration data and state across the application
 */

import { ProjectDeploymentService, DeploymentStatus } from './ProjectDeploymentService';
import { 
  DVREProjectConfiguration,
  TemplateParameters,
  ConfigurationChangeCallback
} from '../../../shared/types/types';
import { templateService } from './TemplateService';
import { roCrateService } from './ROCrateService';
import { ipfsService } from './IPFSService';

// Get the instance for this service
const projectDeploymentService = ProjectDeploymentService.getInstance();

export class ProjectConfigurationService {
  private static instance: ProjectConfigurationService;
  private storagePrefix = 'dvre-project-config';
  private eventListeners: Map<string, Set<ConfigurationChangeCallback>> = new Map();

  constructor() {
    // Initialize event listeners map
    this.eventListeners = new Map();
    
    // Migrate existing projects to new status system
    this.migrateExistingProjects();
  }
  
  static getInstance(): ProjectConfigurationService {
    if (!ProjectConfigurationService.instance) {
      ProjectConfigurationService.instance = new ProjectConfigurationService();
    }
    return ProjectConfigurationService.instance;
  }

  /**
   * Auto-create RO-Crate when project is created (called after smart contract creation)
   */
  async autoCreateProjectConfiguration(
    contractAddress: string,
    projectData: any,
    owner: string,
    templateParameters?: TemplateParameters
  ): Promise<DVREProjectConfiguration> {
    const projectId = contractAddress;
    
    // Check if this is a DAL project based on project data
    const isDALProject = templateService.isDALProject(projectData);
    
    if (isDALProject) {
      console.log('Creating parameterized DAL template for project:', projectId);
      const config = templateService.createDALTemplate(
        projectId, 
        projectData, 
        owner, 
        templateParameters?.dalConfig
      );
      this.saveConfiguration(config);
      this.emitConfigurationUpdate(projectId, config);
      return config;
    }

    // Create general template
    const config = templateService.createGeneralTemplate(
      projectId,
      projectData,
      owner,
      templateParameters?.generalConfig
    );

    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    return config;
  }

  /**
   * Check if current user is the owner of a project
   */
  isProjectOwner(projectId: string, userAddress: string): boolean {
    const config = this.getProjectConfiguration(projectId);
    return config?.owner?.toLowerCase() === userAddress?.toLowerCase();
  }

  /**
   * Create new project configuration from template (manual creation)
   */
  async createProjectConfiguration(
    projectId: string,
    projectData: any,
    owner: string,
    templateId?: number
  ): Promise<DVREProjectConfiguration> {
    // Use template service for creation
    const config = templateService.createGeneralTemplate(projectId, projectData, owner);

    // Apply template if provided
    if (templateId !== undefined) {
      await this.applyTemplate(config, templateId);
    }

    // Save to local storage
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Get project configuration from local storage
   */
  getProjectConfiguration(projectId: string): DVREProjectConfiguration | null {
    try {
      const storageKey = `${this.storagePrefix}-${projectId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load project configuration:', error);
    }
    
    return null;
  }

  /**
   * Update dApp-specific extension configuration
   */
  updateExtensionConfiguration(
    projectId: string,
    dAppName: string,
    extensionData: any,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    // Update extension data
    config.extensions[dAppName] = {
      ...config.extensions[dAppName],
      ...extensionData,
      lastModified: new Date().toISOString()
    };
    
    config.lastModified = new Date().toISOString();
    
    // Save and notify
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Publish configuration to IPFS (simplified - no auto-deployment)
   */
  async publishToIPFS(projectId: string, userAddress: string): Promise<{
    roCrateHash: string;
  } | null> {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can publish configurations');
      return null;
    }

    try {
      console.log('Publishing RO-Crate to IPFS...', projectId);
      
      // Create RO-Crate bundle using the service
      const roCrateData = roCrateService.generateROCrateJSON(config);
      
      // Upload to IPFS using the service
      const ipfsResults = await ipfsService.uploadROCrate(projectId, roCrateData, config);
      
      // Update configuration with IPFS hashes
      config.ipfs = {
        roCrateHash: ipfsResults.roCrateHash,
        publishedAt: new Date().toISOString()
      };
      
      config.status = 'deployed';
      config.lastModified = new Date().toISOString();
      
      this.saveConfiguration(config);
      this.emitConfigurationUpdate(projectId, config);
      
      console.log('Successfully published to IPFS:', ipfsResults);

      return ipfsResults;
    } catch (error) {
      console.error('Failed to publish to IPFS:', error);
      return null;
    }
  }

  /**
   * Generate enhanced RO-Crate JSON-LD (delegates to service)
   */
  async generateEnhancedROCrateJSON(config: DVREProjectConfiguration): Promise<string> {
    return roCrateService.generateEnhancedROCrateJSON(config);
  }

  /**
   * Generate basic RO-Crate JSON-LD (delegates to service)
   */
  generateROCrateJSON(config: DVREProjectConfiguration): string {
    return roCrateService.generateROCrateJSON(config);
  }

  /**
   * Generate inputs.yaml content for DAL workflow (delegates to service)
   */
  generateDALInputsYaml(dalConfig: any): string {
    return templateService.generateDALInputsYaml(dalConfig);
  }

  /**
   * Subscribe to configuration changes
   */
  onConfigurationChange(
    projectId: string,
    callback: ConfigurationChangeCallback
  ): () => void {
    if (!this.eventListeners.has(projectId)) {
      this.eventListeners.set(projectId, new Set());
    }
    
    this.eventListeners.get(projectId)!.add(callback);
    
    return () => {
      this.eventListeners.get(projectId)?.delete(callback);
    };
  }

  /**
   * Get all project configurations (for listing)
   */
  getAllProjectConfigurations(): DVREProjectConfiguration[] {
    const configs: DVREProjectConfiguration[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.storagePrefix)) {
        try {
          const config = JSON.parse(localStorage.getItem(key)!);
          configs.push(config);
        } catch (error) {
          console.warn('Failed to parse configuration:', key, error);
        }
      }
    }
    
    return configs.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  }

  /**
   * Get projects owned by specific user
   */
  getUserOwnedProjects(userAddress: string): DVREProjectConfiguration[] {
    return this.getAllProjectConfigurations().filter(config => 
      config.owner?.toLowerCase() === userAddress?.toLowerCase()
    );
  }

  /**
   * Get deployment status for a project
   */
  getDeploymentStatus(projectId: string): DeploymentStatus | null {
    return projectDeploymentService.getDeploymentStatus(projectId);
  }

  /**
   * Monitor deployment status and update configuration
   */
  async refreshDeploymentStatus(projectId: string): Promise<void> {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return;

    try {
      const deploymentStatus = await projectDeploymentService.monitorWorkflowStatus(projectId);
      if (deploymentStatus) {
        config.deployment = deploymentStatus;
        
        // Update project status based on deployment status
        if (deploymentStatus.status === 'running' && config.status !== 'deployed') {
          config.status = 'deployed';
        } else if (deploymentStatus.status === 'failed' && config.status === 'deployed') {
          config.status = 'not deployed'; // Fall back to not deployed state
        }
        
        config.lastModified = new Date().toISOString();
        this.saveConfiguration(config);
        this.emitConfigurationUpdate(projectId, config);
      }
    } catch (error) {
      console.error('Failed to refresh deployment status:', error);
    }
  }

  /**
   * Check if a project is deployed and running
   */
  isProjectDeployed(projectId: string): boolean {
    return projectDeploymentService.isProjectDeployed(projectId);
  }

  /**
   * Get orchestration server URL for a project
   */
  getOrchestrationUrl(projectId: string): string | null {
    return projectDeploymentService.getOrchestrationUrl(projectId);
  }

  /**
   * Add dataset to configuration (owner only)
   */
  addDataset(
    projectId: string,
    datasetId: string,
    dataset: any,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    config.roCrate.datasets[datasetId] = dataset;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add workflow to configuration (owner only)
   */
  addWorkflow(
    projectId: string,
    workflowId: string,
    workflow: any,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    config.roCrate.workflows[workflowId] = workflow;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  /**
   * Add model to configuration (owner only)
   */
  addModel(
    projectId: string,
    modelId: string,
    model: any,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    config.roCrate.models[modelId] = model;
    config.lastModified = new Date().toISOString();
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
      
    return config;
  }

  /**
   * Remove workflow from configuration (owner only)
   */
  removeWorkflow(
    projectId: string,
    workflowId: string,
    userAddress: string
  ): DVREProjectConfiguration | null {
    const config = this.getProjectConfiguration(projectId);
    if (!config) return null;

    // Check if user is the owner
    if (!this.isProjectOwner(projectId, userAddress)) {
      console.error('Only project owners can modify configurations');
      return null;
    }

    // Check if workflow exists
    if (!config.roCrate.workflows[workflowId]) {
      console.error('Workflow not found:', workflowId);
      return null;
    }

    // Remove workflow
    delete config.roCrate.workflows[workflowId];
    config.lastModified = new Date().toISOString();
      
    // Update status if no workflows remain
    if (Object.keys(config.roCrate.workflows).length === 0) {
      config.status = 'not deployed';
    }
    
    this.saveConfiguration(config);
    this.emitConfigurationUpdate(projectId, config);
    
    return config;
  }

  // Private methods
  private async applyTemplate(config: DVREProjectConfiguration, templateId: number): Promise<void> {
    // TODO: Integrate with ProjectTemplateRegistry to apply template
    console.log('Applying template', templateId, 'to configuration:', config.projectId);
      }
      
  private saveConfiguration(config: DVREProjectConfiguration): void {
    const storageKey = `${this.storagePrefix}-${config.projectId}`;
    localStorage.setItem(storageKey, JSON.stringify(config, null, 2));
  }

  private emitConfigurationUpdate(projectId: string, config: DVREProjectConfiguration): void {
    // Emit to internal listeners
    this.eventListeners.get(projectId)?.forEach(callback => callback(config));
      
    // Emit global event for backward compatibility
    window.dispatchEvent(new CustomEvent('dvre-configuration-updated', {
      detail: { projectId, config, timestamp: new Date().toISOString() }
    }));
  }

  /**
   * Migrate existing projects from old status values to new simplified status values.
   */
  private migrateExistingProjects(): void {
    const configs = this.getAllProjectConfigurations();
    let migratedCount = 0;

    for (const config of configs) {
      // Check if this project has old status values that need migration
      if (['draft', 'configured', 'ready', 'active', 'completed'].includes(config.status as any)) {
        // Map old statuses to new simplified statuses
        config.status = ['ready', 'active', 'completed'].includes(config.status as any) ? 'deployed' : 'not deployed';
        this.saveConfiguration(config);
        migratedCount++;
        console.log(`Migrated project ${config.projectId} from old status to: ${config.status}`);
        }
    }
    
    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} projects to new status system.`);
    }
  }
}

export const projectConfigurationService = ProjectConfigurationService.getInstance(); 

// Re-export types for convenience
export type { DVREProjectConfiguration, TemplateParameters } from '../../../shared/types/types'; 