// Deployment services barrel file
export { DeploymentOrchestrator } from './DeploymentOrchestrator';
export { ProjectDeploymentService } from './ProjectDeploymentService';
export type { DeploymentStatus } from './ProjectDeploymentService';

// Moved services from main services directory
export { 
  ProjectConfigurationService, 
  projectConfigurationService
} from './ProjectConfigurationService';

export {
  TemplateService,
  templateService
} from './TemplateService';

export {
  ROCrateService,
  roCrateService
} from './ROCrateService';

export {
  SmartContractService,
  smartContractService
} from './SmartContractService';

export { 
  LocalFileDownloadService,
  localFileDownloadService,
  type LocalDownloadResult
} from './LocalFileDownloadService';

export { 
  IPFSService,
  ipfsService 
} from './IPFSService';

export {
  WorkflowService,
  workflowService,
  type WorkflowExecutionConfig,
  type WorkflowSubmissionResult
} from './WorkflowService';

export {
  LocalROCrateService,
  localROCrateService
} from './LocalROCrateService';

// Export types from shared types
export type {
  DVREProjectConfiguration,
  ConfigurationDataset,
  ConfigurationWorkflow,
  ConfigurationModel,
  ROCrateMetadata,
  IPFSUploadResult,
  IPFSFile,
  DALTemplateParameters,
  GeneralTemplateParameters,
  TemplateParameters,
  IPFSConfig,
  ConfigurationChangeCallback
} from '../../../shared/types/types'; 