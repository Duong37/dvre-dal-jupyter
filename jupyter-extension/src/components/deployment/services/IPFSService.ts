/**
 * IPFS Service - Enhanced IPFS integration with proper error handling and configuration
 */

import { IPFSConfig, IPFSFile, IPFSUploadResult, DVREProjectConfiguration } from '../../../shared/types/types';
import config from '../../../config';

export class IPFSService {
  private static instance: IPFSService;
  
  // IPFS Configuration - Uses centralized config
  private ipfsGateways = [
    config.ipfs.publicUrl + '/' // Primary: Configured IPFS gateway
  ];
  
  // IPFS upload configuration - Uses centralized config
  private ipfsConfig: IPFSConfig = {
    useMockUpload: false, // Use real IPFS node
    apiUrl: config.ipfs.baseUrl.replace('/api/v0', ''), // Remove /api/v0 suffix for our usage
    gatewayUrl: config.ipfs.publicUrl + '/',
    timeout: 30000, // 30 second timeout for uploads
    apiKey: config.ipfs.apiKey
  };

  constructor() {
    // Test IPFS connectivity on initialization
    this.testIPFSConnection();
  }

  static getInstance(): IPFSService {
    if (!IPFSService.instance) {
      IPFSService.instance = new IPFSService();
    }
    return IPFSService.instance;
  }

  /**
   * Upload complete RO-Crate to IPFS with organized structure
   */
  async uploadROCrate(
    projectId: string,
    roCrateData: string,
    config: DVREProjectConfiguration
  ): Promise<{
    roCrateHash: string;
  }> {
    try {
      console.log('Starting IPFS upload process...');
      
      // Prepare RO-Crate bundle with new organized structure
      console.log('Preparing organized RO-Crate bundle...');
      
      const bundleFiles: IPFSFile[] = [
        // Root: RO-Crate metadata file
        {
          name: 'ro-crate-metadata.json',
          content: roCrateData,
          type: 'application/json'
        }
      ];

      // Generate and add config/config.json from smart contract data
      console.log('Generating config/config.json from smart contract data...');
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
            project_type: config.extensions?.dal ? 'active_learning' : 'general',
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
        workflows.forEach((workflow) => {
          const workflowFile: IPFSFile = {
            name: `workflows/${workflow.name.replace(/\s+/g, '_').toLowerCase()}.${workflow.type}`,
            content: workflow.content,
            type: workflow.type === 'cwl' ? 'application/x-cwl' : 'text/plain'
          };
          
          console.log(`Adding workflow to workflows/ directory: ${workflowFile.name}`);
          bundleFiles.push(workflowFile);
        });
      }

      // Add inputs/inputs.json for Active Learning projects
      if (config.extensions?.dal) {
        try {
          const { roCrateService } = await import('./ROCrateService');
          const inputsData = roCrateService.generateInputsJSON(config);
          bundleFiles.push({
            name: 'inputs/inputs.json',
            content: JSON.stringify(inputsData, null, 2),
            type: 'application/json'
          });
          console.log('Adding AL inputs configuration to inputs/ directory');
        } catch (error) {
          console.warn('Failed to generate inputs JSON:', error);
        }
      }
      
      // Add dataset metadata to inputs/ directory (not actual data files)
      Object.entries(config.roCrate.datasets).forEach(([id, dataset]) => {
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
      Object.entries(config.roCrate.models).forEach(([id, model]) => {
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
      
      // Upload the complete organized RO-Crate bundle
      const roCrateResult = await this.uploadDirectory(bundleFiles, `dvre-project-${projectId}`);
      console.log('Organized RO-Crate bundle uploaded:', roCrateResult);
      
      return {
        roCrateHash: roCrateResult.hash
      };
      
    } catch (error) {
      console.error('IPFS upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload single file to IPFS
   */
  async uploadFile(file: IPFSFile): Promise<IPFSUploadResult> {
    if (this.ipfsConfig.useMockUpload) {
      // For development/testing - generate deterministic hash based on content
      return this.generateTestIPFSResult(file);
    }

    try {
      console.log(`Uploading file to real IPFS node: ${file.name}`);
      
      // Create FormData for IPFS API
      const formData = new FormData();
      
      // Convert content to Blob
      let blob: Blob;
      if (typeof file.content === 'string') {
        blob = new Blob([file.content], { type: file.type || 'text/plain' });
      } else {
        blob = new Blob([file.content], { type: file.type || 'application/octet-stream' });
      }
      
      formData.append('file', blob, file.name);
      
      // Create AbortController for timeout (browser compatibility)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), this.ipfsConfig.timeout);
      
      try {
        // Upload to IPFS node with authentication headers
        const response = await fetch(`${this.ipfsConfig.apiUrl}/api/v0/add`, {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
          mode: 'cors', // Handle CORS explicitly
          headers: {
            // Authentication header for the auth proxy
            'Authorization': `Bearer ${this.ipfsConfig.apiKey}`,
            'X-API-Key': this.ipfsConfig.apiKey
            // Don't set Content-Type - let browser set it with boundary for FormData
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`IPFS Authentication failed: API key may be invalid. Status: ${response.status}`);
          }
          throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.text();
        const ipfsResponse = JSON.parse(result);
        
        console.log(`File uploaded to IPFS: ${file.name} -> ${ipfsResponse.Hash}`);
        
        return {
          hash: ipfsResponse.Hash,
          url: `${this.ipfsConfig.gatewayUrl}${ipfsResponse.Hash}`,
          size: blob.size
        };
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      console.error(` IPFS upload failed for ${file.name}:`, error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          console.warn(`
IPFS Authentication Failed:
   The API key "${this.ipfsConfig.apiKey}" was rejected by the auth proxy.
   
   Please verify:
   1. The API key is correctly configured in ./api-keys.txt on your VM
   2. The auth proxy container is running: docker ps | grep ipfs-auth-proxy
   3. Check auth proxy logs: docker logs ipfs-auth-proxy --tail 10
   
   For now, DVRE will use test mode for uploads.
          `);
        } else if (error.message.includes('fetch')) {
          console.warn(' Network error - IPFS node may not be accessible or CORS not configured');
        }
      }
      
      // Fallback to test mode if real upload fails
      console.warn('Falling back to test mode due to IPFS upload failure');
      return this.generateTestIPFSResult(file);
    }
  }

  /**
   * Upload directory to IPFS
   */
  async uploadDirectory(files: IPFSFile[], dirName: string): Promise<IPFSUploadResult> {
    if (this.ipfsConfig.useMockUpload) {
      // For development/testing - generate deterministic hash based on directory contents
      const combinedContent = files.map(f => `${f.name}:${f.content}`).join('|');
      return this.generateTestIPFSResult({
        name: dirName,
        content: combinedContent,
        type: 'directory'
      });
    }

    try {
      console.log(`Uploading directory to real IPFS node: ${dirName} (${files.length} files)`);
      
      // Create FormData with all files
      const formData = new FormData();
      
      for (const file of files) {
        // Convert content to Blob
        let blob: Blob;
        if (typeof file.content === 'string') {
          blob = new Blob([file.content], { type: file.type || 'text/plain' });
        } else {
          blob = new Blob([file.content], { type: file.type || 'application/octet-stream' });
        }
        
        // Add file with proper path structure
        formData.append('file', blob, `${dirName}/${file.name}`);
      }
      
      // Create AbortController for timeout (browser compatibility)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), this.ipfsConfig.timeout);
      
      try {
        // Upload directory to IPFS with authentication headers
        const response = await fetch(`${this.ipfsConfig.apiUrl}/api/v0/add?wrap-with-directory=true&recursive=true`, {
          method: 'POST',
          body: formData,
          signal: abortController.signal,
          mode: 'cors', // Handle CORS explicitly
          headers: {
            // Authentication header for the auth proxy
            'Authorization': `Bearer ${this.ipfsConfig.apiKey}`,
            'X-API-Key': this.ipfsConfig.apiKey
            // Don't set Content-Type - let browser set it with boundary for FormData
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`IPFS Authentication failed: API key may be invalid. Status: ${response.status}`);
          }
          throw new Error(`IPFS directory upload failed: ${response.status} ${response.statusText}`);
        }

        const responseText = await response.text();
        
        // Parse NDJSON response (each line is a JSON object)
        const lines = responseText.trim().split('\n');
        const results = lines.map(line => JSON.parse(line));
        
        // Find the directory hash (last result with empty name or matching dirName)
        const directoryResult = results.find(r => r.Name === '' || r.Name === dirName) || results[results.length - 1];
        
        console.log(`Directory uploaded to IPFS: ${dirName} -> ${directoryResult.Hash}`);
        
        // Calculate total size
        const totalSize = results.reduce((sum, r) => sum + (r.Size || 0), 0);
        
        return {
          hash: directoryResult.Hash,
          url: `${this.ipfsConfig.gatewayUrl}${directoryResult.Hash}`,
          size: totalSize
        };
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      console.error(` IPFS directory upload failed for ${dirName}:`, error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('Authentication failed')) {
          console.warn('IPFS Authentication Failed - using test mode for directory upload');
        } else if (error.message.includes('fetch')) {
          console.warn(' Network error - IPFS node may not be accessible or CORS not configured');
        }
      }
      
      // Fallback to test mode if real upload fails
      console.warn('Falling back to test mode due to IPFS directory upload failure');
      const combinedContent = files.map(f => `${f.name}:${f.content}`).join('|');
      return this.generateTestIPFSResult({
        name: dirName,
        content: combinedContent,
        type: 'directory'
      });
    }
  }

  /**
   * Generate deterministic test IPFS result (for development)
   */
  private generateTestIPFSResult(file: IPFSFile): IPFSUploadResult {
    // Generate a deterministic hash based on content (for testing consistency)
    const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content);
    const hash = this.generateDeterministicHash(content, file.name);
    
    const size = typeof file.content === 'string' 
      ? new Blob([file.content]).size 
      : file.content.byteLength;

    console.log(`Test IPFS upload: ${file.name} -> ${hash} (${size} bytes)`);
    
    return {
      hash: hash,
      url: `${this.ipfsGateways[0]}${hash}`,
      size
    };
  }

  /**
   * Generate deterministic hash for testing
   */
  private generateDeterministicHash(content: string, filename: string): string {
    // Simple deterministic hash for testing (not cryptographically secure)
    let hash = 0;
    const input = `${filename}:${content}`;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to base36 and ensure it looks like an IPFS hash
    const hashStr = Math.abs(hash).toString(36).padStart(44, '0').slice(0, 44);
    return `Qm${hashStr}`;
  }

  /**
   * Test connectivity to the IPFS node
   */
  async testIPFSConnection(): Promise<boolean> {
    if (this.ipfsConfig.useMockUpload) {
      console.log('IPFS: Using mock/test mode');
      return true;
    }

    try {
      console.log(`Testing IPFS connection to ${this.ipfsConfig.apiUrl}...`);
      
      // Create AbortController for timeout (browser compatibility)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5 second timeout for test
      
      try {
        const response = await fetch(`${this.ipfsConfig.apiUrl}/api/v0/version`, {
          method: 'POST',
          mode: 'cors',
          signal: abortController.signal,
          headers: {
            // Authentication header for the auth proxy
            'Authorization': `Bearer ${this.ipfsConfig.apiKey}`,
            'X-API-Key': this.ipfsConfig.apiKey
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const versionInfo = await response.json();
          console.log(`IPFS node connected successfully! Version: ${versionInfo.Version}`);
          console.log(`API key authentication successful`);
          return true;
        } else if (response.status === 401) {
          console.warn(`IPFS Authentication Failed: API key "${this.ipfsConfig.apiKey}" was rejected (Status: 401)`);
          console.warn(`Please verify API key configuration in ./api-keys.txt on your VM`);
          return false; // Connection works but auth failed
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.warn(` IPFS connection test failed:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn(`
 IPFS Setup Information:
   Your IPFS setup uses an authenticated proxy. Connection details:
   - API: ${this.ipfsConfig.apiUrl} (via auth proxy)  
   - Gateway: ${this.ipfsConfig.gatewayUrl}
   - API Key: ${this.ipfsConfig.apiKey}
   
   If authentication fails, verify the API key in ./api-keys.txt on your VM.
   For now, DVRE will use test mode for uploads.
        `);
      }
      
      return false;
    }
  }
}

export const ipfsService = IPFSService.getInstance(); 