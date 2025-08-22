/**
 * Shared Types - Common type definitions used across DVRE components
 */

import { DeploymentStatus } from '../../components/deployment/services/ProjectDeploymentService';

export interface DVREProjectConfiguration {
  // Core project metadata
  projectId: string;
  contractAddress?: string; // Smart contract address
  projectData: any; // From smart contract
  status: 'deployed' | 'not deployed';
  created: string;
  lastModified: string;
  
  // Owner information
  owner: string; // Wallet address of project owner
  
  // RO-Crate structure
  roCrate: {
    metadata: ROCrateMetadata;
    datasets: Record<string, ConfigurationDataset>;
    workflows: Record<string, ConfigurationWorkflow>;
    models: Record<string, ConfigurationModel>;
    outputs: Record<string, any>;
  };
  
  // dApp-specific extensions
  extensions: Record<string, any>; // e.g., { dal: ALConfiguration, federated: FLConfig }
  
  // IPFS hashes (only after publishing)
  ipfs?: {
    roCrateHash?: string;
    publishedAt?: string;
  };
  
  // Deployment status
  deployment?: DeploymentStatus;
}

export interface ConfigurationDataset {
  name: string;
  description?: string;
  format: string;
  url?: string;
  ipfsHash?: string;
  size?: number;
  columns?: Array<{
    name: string;
    dataType: string;
    description?: string;
  }>;
}

export interface ConfigurationWorkflow {
  name: string;
  description?: string;
  type: 'cwl' | 'jupyter' | 'custom';
  content: string;
  inputs?: any[];
  outputs?: any[];
  ipfsHash?: string;
}

export interface ConfigurationModel {
  name: string;
  algorithm: string;
  parameters: Record<string, any>;
  framework?: string;
  ipfsHash?: string;
}

export interface ROCrateMetadata {
  '@context': 'https://w3id.org/ro/crate/1.1/context';
  '@graph': any[];
  conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' };
}

// IPFS Upload interfaces
export interface IPFSUploadResult {
  hash: string;
  url: string;
  size: number;
}

export interface IPFSFile {
  name: string;
  content: string | ArrayBuffer;
  type: string;
}

// Template creation interfaces
export interface DALTemplateParameters {
  queryStrategy?: string;
  scenario?: string;
  modelType?: string;
  modelParameters?: any;
  maxIterations?: number;
  queryBatchSize?: number;
  labelingBudget?: number;
  validationSplit?: number;
  votingConsensus?: string;
  votingTimeout?: number;
  labelSpace?: string[];
  workflowInputs?: string[];
  workflowOutputs?: string[];
}

export interface GeneralTemplateParameters {
  workflows?: Array<{
    name: string;
    description?: string;
    type: 'cwl' | 'jupyter' | 'custom';
    inputs?: string[];
    outputs?: string[];
    content?: string;
  }>;
  datasets?: Array<{
    name: string;
    description?: string;
    format?: string;
  }>;
}

export interface TemplateParameters {
  dalConfig?: DALTemplateParameters;
  generalConfig?: GeneralTemplateParameters;
}

// IPFS Configuration
export interface IPFSConfig {
  useMockUpload: boolean;
  apiUrl: string;
  gatewayUrl: string;
  timeout: number;
  apiKey: string;
}

// Configuration change callback
export type ConfigurationChangeCallback = (config: DVREProjectConfiguration) => void; 