/**
 * RO-Crate Service - Generate Research Object Crate metadata for projects
 */

import { DVREProjectConfiguration } from '../../../shared/types/types';
import { assetService } from '../../../utils/AssetService';

export class ROCrateService {
  private static instance: ROCrateService;

  static getInstance(): ROCrateService {
    if (!ROCrateService.instance) {
      ROCrateService.instance = new ROCrateService();
    }
    return ROCrateService.instance;
  }

  /**
   * Generate basic RO-Crate JSON-LD
   */
  generateROCrateJSON(config: DVREProjectConfiguration): string {
    // Generate complete RO-Crate JSON-LD structure
    const roCrate = {
      ...config.roCrate.metadata,
      "@graph": [
        ...config.roCrate.metadata["@graph"],
        // Add datasets, workflows, models to the graph
        ...Object.entries(config.roCrate.datasets).map(([id, dataset]) => ({
          "@type": "Dataset",
          "@id": id,
          "name": dataset.name,
          "description": dataset.description,
          "encodingFormat": dataset.format,
          "contentUrl": dataset.url,
          "contentSize": dataset.size,
          "variableMeasured": dataset.columns?.map(col => ({
            "@type": "PropertyValue",
            "name": col.name,
            "description": col.description,
            "dataType": col.dataType
          }))
        })),
        ...Object.entries(config.roCrate.workflows).map(([id, workflow]) => ({
          "@type": ["File", "SoftwareSourceCode", "ComputationalWorkflow"],
          "@id": id,
          "name": workflow.name,
          "description": workflow.description,
          "programmingLanguage": workflow.type === 'cwl' ? 'CWL' : workflow.type,
          "text": workflow.content,
          "input": workflow.inputs,
          "output": workflow.outputs
        })),
        ...Object.entries(config.roCrate.models).map(([id, model]) => ({
          "@type": ["File", "SoftwareSourceCode"],
          "@id": id,
          "name": model.name,
          "description": `${model.algorithm} model`,
          "programmingLanguage": model.framework,
          "runtimePlatform": model.framework,
          "codeRepository": model.algorithm
        }))
      ]
    };
    
    return JSON.stringify(roCrate, null, 2);
  }

  /**
   * Generate enhanced RO-Crate JSON-LD with real blockchain assets and current configuration
   */
  async generateEnhancedROCrateJSON(config: DVREProjectConfiguration): Promise<string> {
    try {
      // Fetch real blockchain assets
      const userAssets = await assetService.getAllAssets();
      const userDatasets = userAssets.filter(asset => asset.assetType === 'dataset');
      const userModels = userAssets.filter(asset => asset.assetType === 'model');
      
      // Enhanced RO-Crate with real assets
      const enhancedRoCrate = {
        ...config.roCrate.metadata,
        "@graph": [
          // Update the root dataset with current project information
          {
            "@type": ["Dataset", "SoftwareApplication"],
            "@id": "./",
            "name": config.projectData?.name || "DVRE Project",
            "description": config.projectData?.description || config.projectData?.objective || "DVRE research project",
            "creator": {
              "@type": "Person",
              "@id": config.owner,
              "name": config.owner
            },
            "dateCreated": config.created,
            "dateModified": config.lastModified,
            "version": "1.0.0",
            "license": {"@id": "https://creativecommons.org/licenses/by/4.0/"},
            "publisher": {
              "@type": "Organization",
              "name": "DVRE Platform"
            },
            "keywords": this.generateKeywords(config),
            "programmingLanguage": config.extensions?.dal ? "CWL" : "General",
            "applicationCategory": config.extensions?.dal ? "Active Learning" : "Research",
            "projectType": config.extensions?.dal ? "active_learning" : "general",
            "projectStatus": config.status,
            "contractAddress": config.contractAddress,
            "hasPart": [
              ...userDatasets.map(asset => ({ "@id": `blockchain-asset-${asset.address}` })),
              ...userModels.map(asset => ({ "@id": `blockchain-model-${asset.address}` })),
              ...Object.keys(config.roCrate.workflows).map(id => ({ "@id": id })),
              ...(config.extensions?.dal ? [{ "@id": "al_iteration.cwl" }] : [])
            ]
          },
          
          // Add RO-Crate metadata file
          {
            "@type": "CreativeWork",
            "@id": "ro-crate-metadata.json",
            "conformsTo": {"@id": "https://w3id.org/ro/crate/1.1"},
            "about": {"@id": "./"},
            "description": "RO-Crate metadata file for this dataset"
          },
          
          // Add real blockchain datasets
          ...userDatasets.map(asset => ({
            "@type": "Dataset",
            "@id": `blockchain-asset-${asset.address}`,
            "name": asset.name,
            "description": `Blockchain dataset: ${asset.name}`,
            "encodingFormat": "application/octet-stream",
            "contentUrl": `ipfs://${asset.ipfsHash}`,
            "identifier": asset.address,
            "creator": {
              "@type": "Person",
              "@id": asset.owner,
              "name": asset.owner
            },
            "dateCreated": new Date(asset.created * 1000).toISOString(),
            "dateModified": new Date(asset.updated * 1000).toISOString(),
            "distribution": {
              "@type": "DataDownload",
              "contentUrl": `https://ipfs.io/ipfs/${asset.ipfsHash}`,
              "encodingFormat": "application/octet-stream"
            },
            "assetType": asset.assetType,
            "blockchainAddress": asset.address
          })),
          
          // Add real blockchain models
          ...userModels.map(asset => ({
            "@type": ["File", "SoftwareSourceCode"],
            "@id": `blockchain-model-${asset.address}`,
            "name": asset.name,
            "description": `Blockchain model: ${asset.name}`,
            "encodingFormat": "application/octet-stream",
            "contentUrl": `ipfs://${asset.ipfsHash}`,
            "identifier": asset.address,
            "creator": {
              "@type": "Person",
              "@id": asset.owner,
              "name": asset.owner
            },
            "dateCreated": new Date(asset.created * 1000).toISOString(),
            "dateModified": new Date(asset.updated * 1000).toISOString(),
            "programmingLanguage": "Python", // Assumed for ML models
            "assetType": asset.assetType,
            "blockchainAddress": asset.address
          })),
          
          // Add configured workflows
          ...Object.entries(config.roCrate.workflows).map(([id, workflow]) => ({
            "@type": ["File", "SoftwareSourceCode", "ComputationalWorkflow"],
            "@id": id,
            "name": workflow.name,
            "description": workflow.description,
            "programmingLanguage": workflow.type === 'cwl' ? 'CWL' : workflow.type,
            "text": workflow.content,
            "input": workflow.inputs,
            "output": workflow.outputs,
            "dateCreated": config.created,
            "dateModified": config.lastModified
          })),
          
          // Add AL iteration workflow for Active Learning projects
          ...(config.extensions?.dal ? [{
            "@type": ["File", "SoftwareSourceCode", "ComputationalWorkflow"],
            "@id": "al_iteration.cwl",
            "name": "Active Learning Iteration (Train + Query)",
            "description": "One-step AL iteration using modAL and scikit-learn",
            "encodingFormat": "application/x-cwl",
            "programmingLanguage": "CWL",
            "dateCreated": config.created,
            "dateModified": config.lastModified,
            "creator": {
              "@type": "Person",
              "@id": config.owner,
              "name": config.owner
            },
            "license": {"@id": "https://creativecommons.org/licenses/by/4.0/"},
            "version": "1.0",
            "input": [
              "labeled_data",
              "labeled_labels", 
              "unlabeled_data",
              "model_in",
              "config"
            ],
            "output": [
              "model_out",
              "query_indices"
            ],
            "workflowType": "CommandLineTool",
            "baseCommand": "python3",
            "arguments": ["al_iteration.py"],
            "softwareRequirements": [
              "Python 3.9+",
              "scikit-learn",
              "modAL",
              "numpy",
              "joblib",
              "CWL runner"
            ],
            "keywords": ["active learning", "machine learning", "CWL", "iteration", "annotation"],
            "dockerRequirement": "python:3.9-slim",
            "conformsTo": {
              "@id": "https://w3id.org/cwl/v1.2/",
              "name": "CWL v1.2"
            }
          }] : []),
          
          // Add DAL configuration if present
          ...(config.extensions?.dal ? [{
            "@type": ["File", "SoftwareSourceCode"],
            "@id": "dal-configuration",
            "name": "Active Learning Configuration",
            "description": "Decentralized Active Learning configuration parameters",
            "encodingFormat": "application/json",
            "dateCreated": config.created,
            "dateModified": config.lastModified,
            "programmingLanguage": "JSON",
            "text": JSON.stringify(config.extensions.dal, null, 2),
            "activelearning": {
              "queryStrategy": config.extensions.dal.queryStrategy,
              "scenario": config.extensions.dal.alScenario,
              "maxIterations": config.extensions.dal.maxIterations,
              "queryBatchSize": config.extensions.dal.queryBatchSize,
              "model": config.extensions.dal.model
            }
          }] : [])
        ]
      };
      
      return JSON.stringify(enhancedRoCrate, null, 2);
    } catch (error) {
      console.error('Failed to generate enhanced RO-Crate:', error);
      // Fallback to regular RO-Crate generation
      return this.generateROCrateJSON(config);
    }
  }

  /**
   * Generate inputs.json for Active Learning projects
   */
  generateInputsJSON(config: DVREProjectConfiguration): any {
    if (!config.extensions?.dal) {
      return {};
    }

    const dalConfig = config.extensions.dal;
    
    return {
      // Core AL configuration
      query_strategy: dalConfig.queryStrategy || 'uncertainty_sampling',
      AL_scenario: dalConfig.alScenario || 'pool_based',
      max_iterations: dalConfig.maxIterations || 10,
      labeling_budget: dalConfig.queryBatchSize || 100,
      validation_split: dalConfig.validation_split || 0.2,
      
      // Model configuration
      model: {
        type: dalConfig.model?.type || 'LogisticRegression',
        parameters: dalConfig.model?.parameters || {
          max_iter: 1000,
          random_state: 42
        },
        framework: 'scikit-learn'
      },
      
      // Dataset references
      training_dataset: dalConfig.trainingDataset || '',
      labeling_dataset: dalConfig.labelingDataset || '',
      
      // Voting configuration
      voting_consensus: dalConfig.votingConsensus || 0.7,
      voting_timeout_seconds: dalConfig.votingTimeout || 3600,
      
      // Label space
      label_space: dalConfig.labelSpace || [], // Remove default ['positive', 'negative']
      
      // Runtime configuration
      execution: {
        backend: 'local',
        resources: {
          cpu: 2,
          memory: '4Gi',
          gpu: 0
        }
      }
    };
  }

  /**
   * Generate appropriate keywords for the project
   */
  private generateKeywords(config: DVREProjectConfiguration): string[] {
    const keywords = ["DVRE", "research", "collaboration"];
    
    if (config.extensions?.dal) {
      keywords.push("active learning", "machine learning", "annotation", "CWL");
    }
    
    if (config.extensions?.federated) {
      keywords.push("federated learning", "distributed learning");
    }
    
    // Add keywords from project data
    if (config.projectData?.type) {
      keywords.push(config.projectData.type);
    }
    
    return keywords;
  }
}

export const roCrateService = ROCrateService.getInstance(); 