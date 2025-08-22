// LocalROCrateService.ts - Service for saving RO-Crate bundles locally for AL-Engine

import { DVREProjectConfiguration } from '../../../shared/types/types';
import { IPFSFile } from '../../../shared/types/types';
import ipfsConfig from '../../../config';
import { config } from '../../../config';

export interface LocalROCrateSaveResult {
  success: boolean;
  projectPath: string;
  savedFiles: string[];
  error?: string;
}

export class LocalROCrateService {
  private static instance: LocalROCrateService;
  private readonly LOCAL_ROCRATE_ROOT = config.alEngine.roCrateRoot;

  private constructor() {}

  static getInstance(): LocalROCrateService {
    if (!LocalROCrateService.instance) {
      LocalROCrateService.instance = new LocalROCrateService();
    }
    return LocalROCrateService.instance;
  }

  /**
   * Save RO-Crate bundle locally to al-engine/ro-crates
   * This mirrors the IPFS upload functionality but saves locally for AL-Engine access
   * 
   * @param projectId - The project identifier (contract address)
   * @param roCrateData - The RO-Crate JSON-LD metadata
   * @param config - The project configuration
   * @returns Promise with save results
   */
  async saveROCrateLocally(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<LocalROCrateSaveResult> {
    try {
      console.log(`Saving RO-Crate locally for project ${projectId}...`);
      
      // Create project-specific directory path
      const projectPath = `${this.LOCAL_ROCRATE_ROOT}/${projectId}`;
      
      // Prepare the same file bundle that was uploaded to IPFS
      const bundleFiles = await this.prepareBundleFiles(projectId, roCrateData, config);
      
      // Download actual dataset CSV files from IPFS and add to bundle
      const datasetFiles = await this.downloadActualDatasets(config);
      bundleFiles.push(...datasetFiles);
      
      // Save files locally
      const savedFiles = await this.saveFilesToLocal(projectPath, bundleFiles);
      
      // Create project manifest
      await this.createProjectManifest(projectPath, projectId, config, savedFiles);
      
      console.log(`Successfully saved RO-Crate locally for project ${projectId}`);
      console.log(`Location: ${projectPath}`);
      console.log(`Files saved: ${savedFiles.length}`);
      
      return {
        success: true,
        projectPath,
        savedFiles
      };
      
    } catch (error) {
      console.error(`Failed to save RO-Crate locally for project ${projectId}:`, error);
      return {
        success: false,
        projectPath: '',
        savedFiles: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Prepare the RO-Crate bundle files according to AL-Engine specification
   * Based on ro-crate-content.md requirements
   */
  private async prepareBundleFiles(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<IPFSFile[]> {
    const bundleFiles: IPFSFile[] = [
      // Root: RO-Crate metadata file
      {
        name: 'ro-crate-metadata.json',
        content: roCrateData,
        type: 'application/json'
      }
    ];

    // For Active Learning projects, generate AL-Engine specific files
    if (config.extensions?.dal) {
      // 1. Generate al_iteration.cwl (YAML format at root level)
      const cwlContent = this.generateALIterationCWL();
      bundleFiles.push({
        name: 'al_iteration.cwl',
        content: cwlContent,
        type: 'application/x-cwl'
      });

      // 2. Generate inputs.yml (runtime input mapping)
      const inputsYmlContent = this.generateInputsYml(projectId, config);
      bundleFiles.push({
        name: 'inputs.yml',
        content: inputsYmlContent,
        type: 'application/x-yaml'
      });

      // 3. Generate config.json (AL-specific configuration)
      try {
        const { smartContractService } = await import('./SmartContractService');
        const comprehensiveConfig = await smartContractService.generateConfigFromSmartContract(projectId, config);
        
        // Transform comprehensive config to AL-Engine format
        const alConfigContent = this.transformToALEngineFormat(comprehensiveConfig);
        bundleFiles.push({
          name: 'config.json',
          content: JSON.stringify(alConfigContent, null, 2),
          type: 'application/json'
        });
      } catch (error) {
        console.warn('Failed to generate AL config from smart contract:', error);
        // Fallback to basic config
        const alConfigContent = this.generateALConfigFallback(config);
        bundleFiles.push({
          name: 'config.json',
          content: JSON.stringify(alConfigContent, null, 2),
          type: 'application/json'
        });
      }

      // 4. Generate dataset files (with IPFS references instead of placeholders)
      const datasets = Object.values(config.roCrate.datasets);
      const hasTrainingDataset = datasets.some((ds: any) => ds.type === 'training');
      const hasLabelingDataset = datasets.some((ds: any) => ds.type === 'labeling');
      
      if (hasTrainingDataset || hasLabelingDataset) {
        console.log('Adding real dataset references to RO-Crate bundle');
        
        // Create dataset reference file with IPFS URLs
        const datasetReferences: any = {};
        
        datasets.forEach((dataset: any) => {
          if (dataset.ipfsHash) {
            datasetReferences[dataset.name] = {
              name: dataset.name,
              description: dataset.description,
              type: dataset.type,
              format: dataset.format,
              ipfsHash: dataset.ipfsHash,
              ipfsUrl: `${ipfsConfig.ipfs.publicUrl}/ipfs/${dataset.ipfsHash}`,
              assetAddress: dataset.assetAddress
            };
          }
        });
        
        bundleFiles.push({
          name: 'inputs/datasets/dataset_references.json',
          content: JSON.stringify(datasetReferences, null, 2),
          type: 'application/json'
        });
        
        // Add instruction file for AL-Engine
        bundleFiles.push({
          name: 'inputs/datasets/README.md',
          content: `# AL-Engine Dataset Instructions

## Available Datasets

${datasets.map((ds: any) => `
### ${ds.name}
- **Type**: ${ds.type || 'general'}
- **Format**: ${ds.format || 'csv'}
- **IPFS Hash**: \`${ds.ipfsHash}\`
- **Download URL**: \`${ipfsConfig.ipfs.publicUrl}/ipfs/${ds.ipfsHash}\`
`).join('')}

## For Local AL-Engine Execution

When running AL-Engine locally, these datasets will be automatically downloaded to:
- Training data: \`inputs/datasets/labeled_samples.csv\`
- Labeling data: \`inputs/datasets/unlabeled_samples.csv\`

The dataset download is handled by the DVRE local file download service during project deployment.

## Manual Download (if needed)

If you need to download datasets manually:

\`\`\`bash
# Download training dataset
curl -o inputs/datasets/labeled_samples.csv "${ipfsConfig.ipfs.publicUrl}/ipfs/${datasets.find((ds: any) => ds.type === 'training')?.ipfsHash || 'TRAINING_HASH'}"

# Download labeling dataset  
curl -o inputs/datasets/unlabeled_samples.csv "${ipfsConfig.ipfs.publicUrl}/ipfs/${datasets.find((ds: any) => ds.type === 'labeling')?.ipfsHash || 'LABELING_HASH'}"
\`\`\`
`,
          type: 'text/plain'
        });
      } else {
        // Keep original placeholder files if no real datasets are configured
      bundleFiles.push({
        name: 'inputs/datasets/labeled_samples.npy',
        content: '# Placeholder for labeled training data (NumPy array)\n# This file should be populated with actual labeled samples',
        type: 'text/plain'
      });

      bundleFiles.push({
        name: 'inputs/datasets/labeled_targets.npy',
        content: '# Placeholder for labeled training targets (NumPy array)\n# This file should be populated with actual labels',
        type: 'text/plain'
      });

      bundleFiles.push({
        name: 'inputs/datasets/unlabeled_samples.npy',
        content: '# Placeholder for unlabeled data pool (NumPy array)\n# This file should be populated with unlabeled samples for querying',
        type: 'text/plain'
      });
      }

      bundleFiles.push({
        name: 'config/model/model_placeholder.pkl',
        content: '# Placeholder for trained model files\n# Models will be saved as model_round_1.pkl, model_round_2.pkl, etc.',
        type: 'text/plain'
      });

    } else {
      // For non-AL projects, use the original structure
      // Generate basic config from smart contract data
      try {
        const { smartContractService } = await import('./SmartContractService');
        const configData = await smartContractService.generateConfigFromSmartContract(projectId, config);
        bundleFiles.push({
          name: 'config/config.json',
          content: JSON.stringify(configData, null, 2),
          type: 'application/json'
        });
      } catch (error) {
        console.warn('Failed to generate config from smart contract:', error);
        // Add basic config as fallback
        bundleFiles.push({
          name: 'config/config.json',
          content: JSON.stringify({
            project_id: projectId,
            project_type: 'general',
            version: '1.0.0',
            created_at: config.created,
            updated_at: config.lastModified
          }, null, 2),
          type: 'application/json'
        });
      }

      // Add workflows/ directory with CWL workflow files
      const workflows = Object.values(config.roCrate.workflows);
      if (workflows.length > 0) {
        workflows.forEach((workflow: any) => {
          const workflowFile: IPFSFile = {
            name: `workflows/${workflow.name.replace(/\s+/g, '_').toLowerCase()}.${workflow.type}`,
            content: workflow.content,
            type: workflow.type === 'cwl' ? 'application/x-cwl' : 'text/plain'
          };
          bundleFiles.push(workflowFile);
        });
      }

      // Add dataset metadata to inputs/ directory
      Object.entries(config.roCrate.datasets).forEach(([id, dataset]: [string, any]) => {
        bundleFiles.push({
          name: `inputs/datasets/${dataset.name.replace(/\s+/g, '_')}-metadata.json`,
          content: JSON.stringify({
            id: id,
            name: dataset.name,
            description: dataset.description,
            format: dataset.format,
            columns: dataset.columns,
            url: dataset.url,
            ipfsHash: dataset.ipfsHash,
            size: dataset.size || 0
          }, null, 2),
          type: 'application/json'
        });
      });

      // Add model configurations to config/ directory
      Object.entries(config.roCrate.models).forEach(([id, model]: [string, any]) => {
        bundleFiles.push({
          name: `config/models/${model.name.replace(/\s+/g, '_')}-config.json`,
          content: JSON.stringify({
            id: id,
            name: model.name,
            algorithm: model.algorithm,
            parameters: model.parameters,
            framework: model.framework
          }, null, 2),
          type: 'application/json'
        });
      });

      // Add extension configurations to config/ directory
      if (config.extensions && Object.keys(config.extensions).length > 0) {
        bundleFiles.push({
          name: 'config/extensions-config.json',
          content: JSON.stringify(config.extensions, null, 2),
          type: 'application/json'
        });
      }
    }

    return bundleFiles;
  }

  /**
   * Generate al_iteration.cwl content (YAML format) with performance metrics output
   */
  private generateALIterationCWL(): string {
    // Create cwltool definition for AL iteration that matches the working configuration
    // This matches the tested al_iteration.cwl in al-engine/ro-crates/<project-id>/
    const cwlContent = `cwlVersion: v1.2
class: CommandLineTool

baseCommand: ${config.alEngine.pythonExecutable}
arguments: [${config.alEngine.scriptPath}]

inputs:
  labeled_data:
    type: File
    inputBinding:
      prefix: --labeled_data
  labeled_labels:
    type: File
    inputBinding:
      prefix: --labeled_labels
  unlabeled_data:
    type: File
    inputBinding:
      prefix: --unlabeled_data
  model_in:
    type: File?
    inputBinding:
      prefix: --model_in
  config:
    type: File
    inputBinding:
      prefix: --config
  iteration:
    type: int
    inputBinding:
      prefix: --iteration
  project_id:
    type: string
    inputBinding:
      prefix: --project_id

outputs:
  model_out:
    type: File
    outputBinding:
      glob: "*.pkl"
  query_samples:
    type: File
    outputBinding:
      glob: "query_samples_round_*.json"
  performance_metrics:
    type: File
    outputBinding:
      glob: "performance_round_*.json"
`;

    return cwlContent;
  }

  /**
   * Generate inputs.yml content (runtime input mapping)
   */
  private generateInputsYml(projectId: string, config: DVREProjectConfiguration): string {
    // Generate simple inputs.yml that matches the working configuration
    // This matches the tested inputs.yml in al-engine/ro-crates/<project-id>/
    return `labeled_data:
  class: File
  path: inputs/datasets/labeled_samples.csv
labeled_labels:
  class: File  
  path: inputs/datasets/labeled_samples.csv
unlabeled_data:
  class: File
  path: inputs/datasets/unlabeled_samples.csv
config:
  class: File
  path: config.json
`;
  }

  /**
   * Generate AL-specific config.json content (fallback)
   */
  private generateALConfigFallback(config: DVREProjectConfiguration): any {
    const dalConfig = config.extensions?.dal || {};
    
    // Generate config that matches the working config.json structure
    return {
      al_scenario: dalConfig.alScenario || 'pool_based',
      query_strategy: dalConfig.queryStrategy || 'uncertainty_sampling',
      model_type: 'RandomForestClassifier',
      training_args: {
        n_estimators: 50,
        random_state: 42
      },
      label_space: dalConfig.labelSpace || ['setosa', 'versicolor', 'virginica'],
      query_batch_size: dalConfig.queryBatchSize || 2,
      max_iterations: dalConfig.maxIterations || 3,
      iteration: 0
    };
  }

  /**
   * Transform comprehensive configuration to AL-Engine format
   */
  private transformToALEngineFormat(comprehensiveConfig: any): any {
    console.log('Transforming config:', JSON.stringify(comprehensiveConfig, null, 2));
    
    const al = comprehensiveConfig.active_learning || {};
    
    const result = {
      al_scenario: al.scenario || 'pool_based',
      query_strategy: al.query_strategy || 'uncertainty_sampling',
      model_type: 'RandomForestClassifier',
      training_args: {
        n_estimators: 50,
        random_state: 42
      },
      label_space: al.label_space || ['setosa', 'versicolor', 'virginica'],
      query_batch_size: al.query_batch_size || 2,
      max_iterations: al.max_iterations || 3,
      iteration: 0
    };

    console.log('Transformed result:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Download actual dataset CSV files from IPFS and return as IPFSFile objects
   */
  private async downloadActualDatasets(config: DVREProjectConfiguration): Promise<IPFSFile[]> {
    const datasetFiles: IPFSFile[] = [];
    
    console.log('Downloading actual dataset CSV files from IPFS...');
    console.log('Available datasets in project:', Object.keys(config.roCrate.datasets));
    
    // Get datasets from project configuration
    const datasets = Object.values(config.roCrate.datasets);
    
    for (const dataset of datasets) {
      if (dataset.ipfsHash) {
        try {
          console.log(`Downloading dataset "${dataset.name}" from IPFS: ${dataset.ipfsHash}`);
          
          const ipfsUrl = `${ipfsConfig.ipfs.publicUrl}/ipfs/${dataset.ipfsHash}`;
          const response = await fetch(ipfsUrl);
          
          if (response.ok) {
            const content = await response.text();
            
            // Create filename based on dataset type and name
            const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
            const extension = dataset.format || 'csv';
            let filename: string;
            
            // Use AL-Engine expected filenames for training and labeling datasets
            if ((dataset as any).type === 'training') {
              filename = `inputs/datasets/labeled_samples.${extension}`;
            } else if ((dataset as any).type === 'labeling') {
              filename = `inputs/datasets/unlabeled_samples.${extension}`;
            } else {
              filename = `inputs/datasets/${sanitizedName}.${extension}`;
            }
            
            // Add to bundle files
            datasetFiles.push({
              name: filename,
              content: content,
              type: 'text/csv'
            });
            
            console.log(`Successfully downloaded dataset: ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
          } else {
            console.warn(`Failed to download dataset ${dataset.name}: HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`Failed to download dataset ${dataset.name}:`, error);
        }
      } else {
        console.warn(`Dataset "${dataset.name}" has no IPFS hash - skipping download`);
      }
    }

    console.log(`Downloaded ${datasetFiles.length} actual dataset CSV files`);
    return datasetFiles;
  }

  /**
   * Save files to local filesystem using Node.js backend service
   */
  private async saveFilesToLocal(projectPath: string, bundleFiles: IPFSFile[]): Promise<string[]> {
    try {
      console.log(`Saving ${bundleFiles.length} files to: ${projectPath}`);
      
      // Extract project ID from path
      const projectId = projectPath.split('/').pop() || 'unknown';
      
      // Prepare bundle data for backend
      const bundleData = {
        files: bundleFiles.map(file => ({
          name: file.name,
          content: typeof file.content === 'string' ? file.content : file.content.toString(),
          type: file.type
        })),
        metadata: {
          project_path: projectPath,
          created_at: new Date().toISOString()
        }
      };
      
      // Make HTTP request to local backend service
      const response = await fetch('http://localhost:3001/save-rocrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          bundleData
        })
      });
      
      if (!response.ok) {
        throw new Error(`Backend service responded with ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Successfully saved ${result.totalFiles} files to backend`);
        return result.savedFiles;
      } else {
        throw new Error(result.error || 'Backend service reported failure');
      }
      
    } catch (error) {
      console.warn('Backend service not available, falling back to browser downloads');
      console.error('Backend error:', error);
      
      // Fallback: Use browser downloads and create setup script
      return this.fallbackToDownloads(projectPath, bundleFiles);
    }
  }

  /**
   * Fallback method: Create browser downloads and setup script
   */
  private fallbackToDownloads(projectPath: string, bundleFiles: IPFSFile[]): string[] {
    const savedFiles: string[] = [];
    const projectId = projectPath.split('/').pop() || 'unknown';
    
    console.log(`Creating downloads for directory: ${projectPath}`);
    
    // For each file, create downloadable content
    for (const file of bundleFiles) {
      const fullPath = `${projectPath}/${file.name}`;
      
      // Create directory structure info
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (dirPath !== projectPath) {
        console.log(`Would create subdirectory: ${dirPath}`);
      }
      
      // Handle both string and ArrayBuffer content types
      const content = typeof file.content === 'string' 
        ? file.content 
        : new TextDecoder().decode(file.content);
      
      console.log(`Creating download: ${fullPath} (${content.length} chars)`);
      
      // Create downloadable file
      this.createDownloadableFile(file.name, content, projectId);
      savedFiles.push(file.name);
    }
    
    // Create a script to help user organize files
    this.createSetupScript(projectPath, bundleFiles);
    
    console.log(`Created ${savedFiles.length} downloads for local AL-Engine setup`);
    return savedFiles;
  }

  /**
   * Create a downloadable file using browser download mechanism
   */
  private createDownloadableFile(fileName: string, content: string, projectId: string): void {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId}_${fileName}`;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      console.log(`Download created: ${a.download}`);
    } catch (error) {
      console.warn(`Failed to create download for ${fileName}:`, error);
    }
  }

  /**
   * Create a setup script to help user organize the downloaded files
   */
  private createSetupScript(projectPath: string, bundleFiles: IPFSFile[]): void {
    const script = `#!/bin/bash
# AL-Engine RO-Crate Setup Script
# This script organizes the downloaded files into the correct structure

PROJECT_PATH="${projectPath}"
echo "Setting up AL-Engine RO-Crate at: $PROJECT_PATH"

# Create project directory
mkdir -p "$PROJECT_PATH"
mkdir -p "$PROJECT_PATH/inputs/datasets"
mkdir -p "$PROJECT_PATH/outputs"

# Move downloaded files to correct locations
${bundleFiles.map(file => {
  const projectId = projectPath.split('/').pop();
  if (file.name.includes('dataset')) {
    return `mv ~/Downloads/${projectId}_${file.name} "$PROJECT_PATH/inputs/datasets/${file.name}"`;
  } else {
    return `mv ~/Downloads/${projectId}_${file.name} "$PROJECT_PATH/${file.name}"`;
  }
}).join('\n')}

echo " AL-Engine RO-Crate setup complete!"
echo " Files organized in: $PROJECT_PATH"
`;

    this.createDownloadableFile('setup_rocrate.sh', script, 'setup');
  }

  /**
   * Create a project manifest file with metadata (now handled by backend)
   */
  private async createProjectManifest(
    projectPath: string,
    projectId: string,
    config: DVREProjectConfiguration,
    savedFiles: string[]
  ): Promise<void> {
    // The manifest is now created automatically by the backend service
    console.log(`Manifest will be created by backend service for project ${projectId}`);
  }

  /**
   * Get the local path for a project's RO-Crate
   */
  getProjectLocalPath(projectId: string): string {
    return `${this.LOCAL_ROCRATE_ROOT}/${projectId}`;
  }

  /**
   * Check if a project's RO-Crate exists locally
   */
  async projectExistsLocally(projectId: string): Promise<boolean> {
    const projectPath = this.getProjectLocalPath(projectId);
    // TODO: In real implementation, this would check if the directory exists
    // return await this.checkDirectoryExists(projectPath);
    console.log(`Would check if project exists at: ${projectPath}`);
    return false; // Placeholder
  }

  /**
   * List all locally saved projects
   */
  async listLocalProjects(): Promise<string[]> {
    // TODO: In real implementation, this would list directories in ro-crates
    console.log(`Would list projects in: ${this.LOCAL_ROCRATE_ROOT}`);
    return []; // Placeholder
  }
}

// Export singleton instance
export const localROCrateService = LocalROCrateService.getInstance();