/**
 * Local File Download Service
 * Handles automatic downloading of project files for local computation mode
 * Based on comp_mode.md requirements
 */

import { DVREProjectConfiguration } from '../../../shared/types/types';
import config from '../../../config';

export interface LocalDownloadResult {
  success: boolean;
  downloadedFiles: string[];
  localPath: string;
  error?: string;
}

export class LocalFileDownloadService {
  private static instance: LocalFileDownloadService;

  static getInstance(): LocalFileDownloadService {
    if (!LocalFileDownloadService.instance) {
      LocalFileDownloadService.instance = new LocalFileDownloadService();
    }
    return LocalFileDownloadService.instance;
  }

  /**
   * Download all project files for local computation
   */
  async downloadProjectFilesForLocal(
    project: DVREProjectConfiguration,
    roCrateHash: string
  ): Promise<LocalDownloadResult> {
    const projectName = project.projectData?.name || project.projectId;
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const localPath = `~/dvre-projects/${sanitizedName}/`;

    try {
      console.log('📥 Downloading project files for local computation...');
      
      // 1. Download RO-Crate bundle files
      const roCrateFiles = await this.downloadRoCrateBundle(roCrateHash);
      
      // 2. Download datasets from IPFS
      const datasetFiles = await this.downloadProjectDatasets(project);
      
      // 3. Create local project structure
      const downloadedFiles = await this.createLocalProjectStructure(
        project, 
        roCrateFiles, 
        datasetFiles,
        localPath
      );

      console.log(`Successfully downloaded ${downloadedFiles.length} files to ${localPath}`);
      
      return {
        success: true,
        downloadedFiles,
        localPath
      };

    } catch (error) {
      console.error(' Failed to download project files for local computation:', error);
      return {
        success: false,
        downloadedFiles: [],
        localPath,
        error: error instanceof Error ? error.message : 'Unknown download error'
      };
    }
  }

  /**
   * Download RO-Crate bundle files from IPFS
   */
  private async downloadRoCrateBundle(roCrateHash: string): Promise<Record<string, string>> {
    const ipfsUrl = `${config.ipfs.publicUrl}/ipfs/${roCrateHash}`;
    
    const files = {
      'al_iteration.cwl': '',
      'project_config.json': '',
      'voting_config.json': '',
      'model_info.json': ''
    };

    try {
      // Download workflow file
      const workflowResponse = await fetch(`${ipfsUrl}/workflows/al_iteration.cwl`);
      if (workflowResponse.ok) {
        files['al_iteration.cwl'] = await workflowResponse.text();
      }

      // Download config file
      const configResponse = await fetch(`${ipfsUrl}/config/config.json`);
      if (configResponse.ok) {
        files['project_config.json'] = await configResponse.text();
      }

      // Download inputs file (contains voting config)
      const inputsResponse = await fetch(`${ipfsUrl}/inputs/inputs.json`);
      if (inputsResponse.ok) {
        const inputsData = await inputsResponse.text();
        const parsedInputs = JSON.parse(inputsData);
        
        // Extract voting configuration
        const votingConfig = {
          voting_consensus: parsedInputs.voting_consensus,
          voting_timeout_seconds: parsedInputs.voting_timeout_seconds,
          label_space: parsedInputs.label_space
        };
        files['voting_config.json'] = JSON.stringify(votingConfig, null, 2);
      }

      // Download model info if available
      try {
        const modelResponse = await fetch(`${ipfsUrl}/config/models/`);
        if (modelResponse.ok) {
          const modelData = await modelResponse.text();
          files['model_info.json'] = modelData;
        }
      } catch (error) {
        console.log('No model files found, creating basic model_info.json');
        files['model_info.json'] = JSON.stringify({
          model_type: 'RandomForestClassifier',
          framework: 'scikit-learn',
          parameters: {}
        }, null, 2);
      }

    } catch (error) {
      console.warn('Some RO-Crate files may not be available:', error);
    }

    return files;
  }

  /**
   * Download project datasets from IPFS
   */
  private async downloadProjectDatasets(project: DVREProjectConfiguration): Promise<Record<string, Blob>> {
    const datasetFiles: Record<string, Blob> = {};
    
    console.log('📥 Downloading project datasets from IPFS...');
    console.log('Available datasets in project:', Object.keys(project.roCrate.datasets));
    
    // Get datasets from project configuration
    const datasets = Object.values(project.roCrate.datasets);
    
    for (const dataset of datasets) {
      if (dataset.ipfsHash) {
        try {
          console.log(`Downloading dataset "${dataset.name}" from IPFS: ${dataset.ipfsHash}`);
          
          const ipfsUrl = `${config.ipfs.publicUrl}/ipfs/${dataset.ipfsHash}`;
          const response = await fetch(ipfsUrl);
          
          if (response.ok) {
            const blob = await response.blob();
            
            // Create filename based on dataset type and name
            const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9-_]/g, '_');
            const extension = dataset.format || 'csv';
            let filename: string;
            
            // Use AL-Engine expected filenames for training and labeling datasets
            if ((dataset as any).type === 'training') {
              filename = `labeled_samples.${extension}`;
            } else if ((dataset as any).type === 'labeling') {
              filename = `unlabeled_samples.${extension}`;
            } else {
              filename = `${sanitizedName}.${extension}`;
            }
            
            datasetFiles[filename] = blob;
            console.log(`Successfully downloaded dataset: ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
          } else {
            console.warn(` Failed to download dataset ${dataset.name}: HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(` Failed to download dataset ${dataset.name}:`, error);
        }
      } else {
        console.warn(` Dataset "${dataset.name}" has no IPFS hash - skipping download`);
      }
    }

    console.log(`Downloaded ${Object.keys(datasetFiles).length} dataset files`);
    return datasetFiles;
  }

  /**
   * Create local project structure and download files
   */
  private async createLocalProjectStructure(
    project: DVREProjectConfiguration,
    roCrateFiles: Record<string, string>,
    datasetFiles: Record<string, Blob>,
    localPath: string
  ): Promise<string[]> {
    const downloadedFiles: string[] = [];
    
    // Create a map of all files to download
    const allFiles = new Map<string, string | Blob>();
    
    // Add RO-Crate files
    Object.entries(roCrateFiles).forEach(([filename, content]) => {
      if (content) {
        allFiles.set(filename, content);
      }
    });
    
    // Add dataset files in datasets/ subdirectory
    Object.entries(datasetFiles).forEach(([filename, blob]) => {
      allFiles.set(`datasets/${filename}`, blob);
    });
    
    // Download each file
    allFiles.forEach((content, filename) => {
      this.downloadFile(content, filename);
      downloadedFiles.push(filename);
    });

    console.log(`Created local project structure at: ${localPath}`);
    console.log(`Downloaded files:`, downloadedFiles);

    return downloadedFiles;
  }

  /**
   * Download a single file using browser download
   */
  private downloadFile(content: string | Blob, filename: string): void {
    let blob: Blob;
    
    if (content instanceof Blob) {
      blob = content;
    } else {
      blob = new Blob([content], { 
        type: filename.endsWith('.cwl') ? 'text/plain' : 'application/json' 
      });
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate local project path for a given project
   */
  getLocalProjectPath(project: DVREProjectConfiguration): string {
    const projectName = project.projectData?.name || project.projectId;
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `~/dvre-projects/${sanitizedName}/`;
  }
}

export const localFileDownloadService = LocalFileDownloadService.getInstance(); 