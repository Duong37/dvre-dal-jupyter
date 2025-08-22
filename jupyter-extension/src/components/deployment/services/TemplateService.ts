/**
 * Template Service - Handles project template creation and management
 * Extracted from ProjectConfigurationService for better organization
 */

import { DVREProjectConfiguration, DALTemplateParameters, GeneralTemplateParameters, ROCrateMetadata } from '../../../shared/types/types';
import { workflowService } from './WorkflowService';

export class TemplateService {
  private static instance: TemplateService;

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  /**
   * Check if a project should use DAL template
   */
  isDALProject(projectData: any): boolean {
    console.log('isDALProject called with:', projectData);
    
    if (!projectData) {
      console.log('isDALProject: No project data provided');
      return false;
    }
    
    // PRIORITY 1: Check explicit template type markers
    if (projectData.templateType === 'active_learning' || 
        projectData.project_type === 'active_learning' || 
        projectData.type === 'active_learning') {
      console.log('isDALProject: Detected as AL by explicit markers:', {
        templateType: projectData.templateType,
        project_type: projectData.project_type,
        type: projectData.type
      });
      return true;
    }
    
    // PRIORITY 2: Check project data for DAL indicators (text analysis fallback)
    const indicators = [
      'active learning', 'al', 'dal', 'machine learning', 'annotation', 'labeling',
      'query strategy', 'uncertainty sampling', 'model training'
    ];
    
    const projectText = (
      (projectData.name || '') + ' ' + 
      (projectData.description || '') + ' ' +
      (projectData.objective || '') + ' ' +
      (projectData.project_type || '')
    ).toLowerCase();
    
    const textMatch = indicators.some(indicator => projectText.includes(indicator));
    
    console.log('isDALProject: Text analysis result:', {
      projectText,
      indicators,
      textMatch,
      finalResult: textMatch
    });
    
    return textMatch;
  }

  /**
   * Create DAL (Decentralized Active Learning) template
   */
  createDALTemplate(
    projectId: string, 
    projectData: any, 
    owner: string,
    dalParameters?: DALTemplateParameters
  ): DVREProjectConfiguration {
    const now = new Date().toISOString();

    // Use provided parameters or sensible defaults
    const dalConfig = {
      queryStrategy: dalParameters?.queryStrategy || 'uncertainty_sampling',
      alScenario: dalParameters?.scenario || 'pool_based',
      model: {
        type: dalParameters?.modelType || 'logistic_regression',
        parameters: dalParameters?.modelParameters || {
          max_iter: 1000,
          random_state: 42
        }
      },
      maxIterations: dalParameters?.maxIterations || 10,
      queryBatchSize: dalParameters?.queryBatchSize || 5,
      validation_split: dalParameters?.validationSplit || 0.2,
      votingConsensus: dalParameters?.votingConsensus || 'simple_majority',
      votingTimeout: dalParameters?.votingTimeout || 3600,
      labelSpace: dalParameters?.labelSpace || []
    };

    // Create base configuration
    const config: DVREProjectConfiguration = {
      projectId,
      contractAddress: projectId,
      owner,
      projectData,
      status: 'not deployed',
      created: now,
      lastModified: now,
      roCrate: {
        metadata: this.createBaseROCrateMetadata(projectId, projectData, owner),
        datasets: {
          'dataset-main': {
            name: 'Training Dataset',
            description: 'Training and labeling dataset for active learning',
            format: 'csv',
            columns: [],
            size: 0
          }
        },
        workflows: {},
        models: {
          'dal-model': {
            name: 'Active Learning Model',
            algorithm: dalConfig.model.type,
            parameters: dalConfig.model.parameters,
            framework: 'scikit-learn'
          }
        },
        outputs: {}
      },
      extensions: {
        dal: dalConfig
      }
    };

    // Generate AL workflow using WorkflowService
    const alWorkflow = workflowService.generateActivelearningWorkflow(config);
    config.roCrate.workflows['dal-workflow'] = alWorkflow;

    return config;
  }

  /**
   * Create general-purpose template
   */
  createGeneralTemplate(
    projectId: string,
    projectData: any,
    owner: string,
    generalParameters?: GeneralTemplateParameters
  ): DVREProjectConfiguration {
    const now = new Date().toISOString();
    
    const config: DVREProjectConfiguration = {
      projectId,
      contractAddress: projectId,
      owner,
      projectData,
      status: 'not deployed',
      created: now,
      lastModified: now,
      roCrate: {
        metadata: this.createBaseROCrateMetadata(projectId, projectData, owner),
        datasets: {},
        workflows: {},
        models: {},
        outputs: {}
      },
      extensions: {}
    };

    // Add workflows from parameters if provided
    if (generalParameters?.workflows) {
      generalParameters.workflows.forEach((workflowSpec, index) => {
        const workflowId = `workflow-${index + 1}`;
        
        // Use WorkflowService to generate the workflow
        const workflow = workflowService.generateGeneralWorkflow(config, workflowSpec);
        config.roCrate.workflows[workflowId] = workflow;
      });
    } else {
      // Add default general workflow
      const defaultWorkflow = workflowService.generateGeneralWorkflow(config);
      config.roCrate.workflows['general-workflow'] = defaultWorkflow;
    }

    // Add datasets from parameters if provided
    if (generalParameters?.datasets) {
      generalParameters.datasets.forEach((datasetSpec, index) => {
        const datasetId = `dataset-${index + 1}`;
        config.roCrate.datasets[datasetId] = {
          name: datasetSpec.name,
          description: datasetSpec.description || `Dataset ${datasetSpec.name}`,
          format: datasetSpec.format || 'csv',
          columns: []
        };
      });
    }

    return config;
  }

  /**
   * Create base RO-Crate metadata
   */
  private createBaseROCrateMetadata(projectId: string, projectData: any, owner: string): ROCrateMetadata {
    return {
      "@context": "https://w3id.org/ro/crate/1.1/context",
      "@graph": [
        {
          "@type": "CreativeWork",
          "@id": "ro-crate-metadata.json",
          "conformsTo": {"@id": "https://w3id.org/ro/crate/1.1"},
          "about": {"@id": "./"}
        },
        {
          "@type": "Dataset",
          "@id": "./",
          "name": projectData.name || projectData.project_id || `DVRE Project ${projectId}`,
          "description": projectData.description || projectData.objective || "DVRE research project",
          "creator": {
            "@type": "Person",
            "@id": owner,
            "name": owner,
            "identifier": owner
          },
          "dateCreated": new Date().toISOString(),
          "dateModified": new Date().toISOString(),
          "hasPart": [],
          "keywords": ["DVRE", "research", "collaboration"],
          "license": {"@id": "https://creativecommons.org/licenses/by/4.0/"},
          "publisher": {
            "@type": "Organization",
            "name": "DVRE Platform"
          }
        }
      ],
      "conformsTo": { "@id": "https://w3id.org/ro/crate/1.1" }
    };
  }

  /**
   * Generate inputs.yaml content for DAL workflow
   */
  generateDALInputsYaml(dalConfig: any): string {
    return `# DAL Project Inputs Configuration
# Generated by DVRE Project Configuration
query_strategy: ${dalConfig.queryStrategy}
AL_scenario: ${dalConfig.alScenario}
model: |
  ${JSON.stringify(dalConfig.model, null, 2).split('\n').join('\n  ')}
max_iterations: ${dalConfig.maxIterations}
query_batch_size: ${dalConfig.queryBatchSize}
voting_consensus: ${dalConfig.votingConsensus}
voting_timeout: ${dalConfig.votingTimeout}
validation_split: ${dalConfig.validation_split}

# Dataset configuration
dataset:
  location: "./dataset.csv"
  format: "csv"
  features: []
  target_column: "label"
  
# Optional: Model outputs and metrics
outputs:
  model_path: "./outputs/trained_model.pkl"
  metrics_path: "./outputs/learning_curve.json"
  samples_path: "./outputs/selected_samples.csv"
  log_path: "./outputs/annotation_log.csv"

# Execution configuration
execution:
  backend: "local"  # or "kubernetes", "slurm"
  resources:
    cpu: 2
    memory: "4Gi"
    gpu: 0
`;
  }
}

export const templateService = TemplateService.getInstance(); 