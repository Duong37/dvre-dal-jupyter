/**
 * Workflow Service - Handles workflow submission and management
 */

import { DVREProjectConfiguration, ConfigurationWorkflow } from '../../../shared/types/types';
import config from '../../../config';
import { ethers } from 'ethers';

export interface WorkflowExecutionConfig {
  projectId: string;
  workflowType: 'active_learning' | 'federated_learning' | 'general';
  orchestratorEndpoint: string;
  configuration: any;
}

export interface WorkflowSubmissionResult {
  success: boolean;
  workflowId?: string;
  error?: string;
}

export class WorkflowService {
  private static instance: WorkflowService;
  
  // Orchestrator configuration - Uses centralized config
  private orchestratorConfig = {
    endpoint: config.orchestrator.endpoint,
    baseUrl: config.orchestrator.baseUrl,
    timeout: config.orchestrator.timeout
  };

  static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  /**
   * Generate Active Learning CWL workflow (al_iteration.cwl)
   */
  generateActivelearningWorkflow(config: DVREProjectConfiguration): ConfigurationWorkflow {
    const dalConfig = config.extensions?.dal;
    
    const alWorkflow = {
      cwlVersion: "v1.2",
      class: "CommandLineTool",
      label: "Active Learning Iteration (Train + Query)",
      doc: "One-step AL iteration using modAL and scikit-learn",
      
      baseCommand: "python3",
      arguments: ["al_iteration.py"],
      
      inputs: {
        labeled_data: {
          type: "File",
          inputBinding: {
            prefix: "--labeled_data"
          }
        },
        labeled_labels: {
          type: "File", 
          inputBinding: {
            prefix: "--labeled_labels"
          }
        },
        unlabeled_data: {
          type: "File",
          inputBinding: {
            prefix: "--unlabeled_data"
          }
        },
        model_in: {
          type: "File?",
          inputBinding: {
            prefix: "--model_in"
          }
        },
        config: {
          type: "File",
          inputBinding: {
            prefix: "--config"
          }
        }
      },
      
      outputs: {
        model_out: {
          type: "File",
          outputBinding: {
            glob: "model_out.pkl"
          }
        },
        query_indices: {
          type: "File", 
          outputBinding: {
            glob: "query_indices.npy"
          }
        }
      },
      
      requirements: {
        DockerRequirement: {
          dockerPull: "python:3.9-slim"
        }
      },
      
      // AL-specific metadata
      metadata: {
        queryStrategy: dalConfig?.queryStrategy || 'uncertainty_sampling',
        scenario: dalConfig?.AL_scenario || 'pool_based',
        maxIterations: dalConfig?.max_iterations || 10,
        votingTimeout: dalConfig?.voting_timeout_seconds || 3600
      }
    };

    return {
      name: 'al_iteration.cwl',
      description: 'Active Learning iteration workflow using modAL and scikit-learn',
      type: 'cwl',
      content: JSON.stringify(alWorkflow, null, 2),
      inputs: Object.keys(alWorkflow.inputs),
      outputs: Object.keys(alWorkflow.outputs)
    };
  }

  /**
   * Generate Federated Learning CWL workflow
   */
  generateFederatedLearningWorkflow(config: DVREProjectConfiguration): ConfigurationWorkflow {
    const flWorkflow = {
      cwlVersion: "v1.2",
      class: "CommandLineTool",
      label: "Federated Learning Training Round",
      doc: "Federated learning training round with model aggregation",
      
      baseCommand: "python3",
      arguments: ["fl_round.py"],
      
      inputs: {
        global_model: {
          type: "File",
          inputBinding: {
            prefix: "--global_model"
          }
        },
        local_data: {
          type: "File",
          inputBinding: {
            prefix: "--local_data"
          }
        },
        config: {
          type: "File",
          inputBinding: {
            prefix: "--config"
          }
        }
      },
      
      outputs: {
        updated_model: {
          type: "File",
          outputBinding: {
            glob: "updated_model.pkl"
          }
        },
        training_metrics: {
          type: "File",
          outputBinding: {
            glob: "metrics.json"
          }
        }
      },
      
      requirements: {
        DockerRequirement: {
          dockerPull: "tensorflow/tensorflow:latest"
        }
      }
    };

    return {
      name: 'fl_round.cwl',
      description: 'Federated Learning training round workflow',
      type: 'cwl',
      content: JSON.stringify(flWorkflow, null, 2),
      inputs: Object.keys(flWorkflow.inputs),
      outputs: Object.keys(flWorkflow.outputs)
    };
  }

  /**
   * Generate general-purpose CWL workflow
   */
  generateGeneralWorkflow(config: DVREProjectConfiguration, workflowSpec?: any): ConfigurationWorkflow {
    const generalWorkflow = {
      cwlVersion: "v1.2",
      class: "CommandLineTool",
      label: workflowSpec?.name || "General Research Workflow",
      doc: workflowSpec?.description || "General-purpose research workflow",
      
      baseCommand: workflowSpec?.baseCommand || "python3",
      arguments: workflowSpec?.arguments || ["main.py"],
      
      inputs: workflowSpec?.inputs || {
        input_data: {
          type: "File",
          inputBinding: {
            prefix: "--input"
          }
        },
        config: {
          type: "File",
          inputBinding: {
            prefix: "--config"
          }
        }
      },
      
      outputs: workflowSpec?.outputs || {
        results: {
          type: "File",
          outputBinding: {
            glob: "results.json"
          }
        }
      },
      
      requirements: {
        DockerRequirement: {
          dockerPull: workflowSpec?.dockerImage || "python:3.9-slim"
        }
      }
    };

    return {
      name: workflowSpec?.name || 'general_workflow.cwl',
      description: workflowSpec?.description || 'General-purpose research workflow',
      type: 'cwl',
      content: JSON.stringify(generalWorkflow, null, 2),
      inputs: Object.keys(generalWorkflow.inputs),
      outputs: Object.keys(generalWorkflow.outputs)
    };
  }

  /**
   * Validate CWL workflow syntax
   */
  validateWorkflow(workflowContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const workflow = JSON.parse(workflowContent);
      
      // Basic CWL validation
      if (!workflow.cwlVersion) {
        errors.push('Missing cwlVersion');
      }
      
      if (!workflow.class) {
        errors.push('Missing class specification');
      }
      
      if (!['CommandLineTool', 'Workflow'].includes(workflow.class)) {
        errors.push('Invalid class: must be CommandLineTool or Workflow');
      }
      
      if (workflow.class === 'CommandLineTool') {
        if (!workflow.baseCommand) {
          errors.push('CommandLineTool missing baseCommand');
        }
        
        if (!workflow.inputs || Object.keys(workflow.inputs).length === 0) {
          errors.push('CommandLineTool missing inputs');
        }
        
        if (!workflow.outputs || Object.keys(workflow.outputs).length === 0) {
          errors.push('CommandLineTool missing outputs');
        }
      }
      
    } catch (parseError) {
      errors.push(`Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Submit workflow to orchestrator using the correct API format
   */
  async submitWorkflowToOrchestrator(
    workflowConfig: WorkflowExecutionConfig
  ): Promise<WorkflowSubmissionResult> {
    try {
      console.log(`Submitting ${workflowConfig.workflowType} workflow to orchestrator...`);
      
      // Get the user's wallet address for headers
      const userWallet = await this.getUserWalletAddress();
      if (!userWallet) {
        throw new Error('User wallet address not available');
      }

      // Generate the appropriate CWL workflow
      const config = workflowConfig.configuration;
      let cwlWorkflow: any;
      
      if (workflowConfig.workflowType === 'active_learning') {
        // Generate AL CWL workflow
        const alWorkflow = this.generateActivelearningWorkflow({
          projectId: workflowConfig.projectId,
          extensions: { dal: config.extensions?.dal },
          roCrate: { workflows: {} }
        } as any);
        cwlWorkflow = JSON.parse(alWorkflow.content);
      } else {
        // For other workflow types, generate appropriate CWL
        cwlWorkflow = {
          cwlVersion: "v1.2",
          class: "CommandLineTool",
          label: "General Workflow",
          doc: "General workflow execution"
        };
      }

      // Prepare payload in the required format
      const payload = {
        // 1. AL iteration CWL file (content)
        cwl_workflow: cwlWorkflow,
        
        // 2. Inputs with IPFS references (adapted from local paths)
        inputs: this.generateInputsForOrchestrator(workflowConfig),
        
        // 3. AL configuration metadata
        project_id: workflowConfig.projectId,
        metadata: {
          al_config: this.generateALMetadata(workflowConfig)
        }
      };

      // Required headers
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Wallet': userWallet,
        'X-User-Role': 'coordinator'
      };
      
      // Create AbortController for timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), this.orchestratorConfig.timeout);
      
      try {
        const response = await fetch(this.orchestratorConfig.endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload),
          signal: abortController.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Orchestrator responded with ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Workflow submitted successfully:', result);
        
        return {
          success: true,
          workflowId: result.workflow_id || result.id || workflowConfig.projectId
        };
        
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      console.error(' Workflow submission failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get workflow status from orchestrator
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: 'pending' | 'running' | 'completed' | 'failed';
    details?: any;
  } | null> {
    try {
      const response = await fetch(`${this.orchestratorConfig.endpoint}/api/workflows/${workflowId}/status`);
      
      if (!response.ok) {
        throw new Error(`Failed to get workflow status: ${response.status}`);
      }
      
      const result = await response.json();
      return {
        status: result.status,
        details: result.details
      };
      
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      return null;
    }
  }

  /**
   * Get appropriate workflow for project type
   */
  getProjectWorkflow(config: DVREProjectConfiguration): ConfigurationWorkflow {
    if (config.extensions?.dal) {
      return this.generateActivelearningWorkflow(config);
    } else if (config.extensions?.federated) {
      return this.generateFederatedLearningWorkflow(config);
    } else {
      return this.generateGeneralWorkflow(config);
    }
  }

  /**
   * Update workflow in project configuration
   */
  updateProjectWorkflow(
    config: DVREProjectConfiguration,
    workflowId: string,
    workflow: ConfigurationWorkflow
  ): DVREProjectConfiguration {
    config.roCrate.workflows[workflowId] = workflow;
    config.lastModified = new Date().toISOString();
    return config;
  }

  /**
   * Get orchestrator endpoint
   */
  getOrchestratorEndpoint(): string {
    return this.orchestratorConfig.endpoint;
  }

  /**
   * Generate inputs for orchestrator (adapted from IPFS format)
   */
  private generateInputsForOrchestrator(workflowConfig: WorkflowExecutionConfig): any {
    const config = workflowConfig.configuration;
    
    if (workflowConfig.workflowType === 'active_learning') {
      // For AL projects, map to the expected input format
      // Note: We'll need to adapt this based on how datasets are stored
      return {
        labeled_data: `/ipfs/${config.roCrateHash}/inputs/datasets/labeled_data.npy`,
        labeled_labels: `/ipfs/${config.roCrateHash}/inputs/datasets/labeled_labels.npy`,
        unlabeled_data: `/ipfs/${config.roCrateHash}/inputs/datasets/unlabeled_data.npy`,
        config: `/ipfs/${config.roCrateHash}/config/config.json`,
        model_in: `/ipfs/${config.roCrateHash}/config/models/initial_model.pkl` // optional
      };
    }
    
    // For other project types
    return {
      input_data: `/ipfs/${config.roCrateHash}/inputs/input_data`,
      config: `/ipfs/${config.roCrateHash}/config/config.json`
    };
  }

  /**
   * Generate AL metadata for orchestrator
   */
  private generateALMetadata(workflowConfig: WorkflowExecutionConfig): any {
    const config = workflowConfig.configuration;
    const dalConfig = config.extensions?.dal;
    
    if (workflowConfig.workflowType === 'active_learning' && dalConfig) {
      return {
        query_strategy: dalConfig.queryStrategy || dalConfig.query_strategy || 'uncertainty_sampling',
        query_budget: dalConfig.query_batch_size || 10,
        max_iterations: dalConfig.max_iterations || 50,
        model_type: dalConfig.model?.type || 'RandomForestClassifier',
        voting_timeout_seconds: dalConfig.voting_timeout_seconds || 3600
      };
    }
    
    return {
      project_type: workflowConfig.workflowType,
      version: '1.0.0'
    };
  }

  /**
   * Get user wallet address for headers
   */
  private async getUserWalletAddress(): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        return await signer.getAddress();
      }
      return null;
    } catch (error) {
      console.error('Failed to get user wallet address:', error);
      return null;
    }
  }
}

export const workflowService = WorkflowService.getInstance(); 