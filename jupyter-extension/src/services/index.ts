/**
 * Services barrel file - Export all DVRE services from their new component-based locations
 */

// Deployment services
export { 
  ProjectConfigurationService, 
  projectConfigurationService,
  TemplateService,
  templateService,
  ROCrateService,
  roCrateService,
  SmartContractService,
  smartContractService,
  LocalFileDownloadService,
  localFileDownloadService,
  IPFSService,
  ipfsService,
  WorkflowService,
  workflowService,
  LocalROCrateService,
  localROCrateService,
  DeploymentOrchestrator,
  ProjectDeploymentService
} from '../components/deployment/services';

export type {
  LocalDownloadResult,
  WorkflowExecutionConfig,
  WorkflowSubmissionResult,
  DeploymentStatus,
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
} from '../components/deployment/services';

// DAL services
export { 
  alContractService, 
  ALContractService 
} from '../components/dal/services';

export type { 
  VotingRecord,
  UserContribution, 
  ModelUpdate,
  ActiveVoting
} from '../components/dal/services'; 