/**
 * DAL (Decentralized Active Learning) - Complete Type Definitions
 * Types for the comprehensive DAL extension according to design document
 */

export interface DALProject {
  id: string;
  name: string;
  description?: string;
  contractAddress: string;
  status: 'active' | 'inactive';
  participants: number;
  currentRound: number;
  totalRounds: number;
  lastUpdated: Date;
  workflowConfigured: boolean;
  creator: string;
  isActive: boolean;
  finalTraining?: boolean; // Add final training flag
  
  // Enhanced DAL-specific properties
  alConfiguration?: DALConfiguration;
  modelPerformance?: ModelPerformance;
  activeVoting?: ActiveVoting;
  userRole?: 'coordinator' | 'contributor';
  totalSamplesLabeled?: number;
  
  // Deployment status
  isDeployed: boolean;
  deploymentStatus?: 'deployed' | 'running' | 'failed' | 'deploying' | 'pending';
}

export interface DALConfiguration {
  scenario: string; // AL scenario type
  queryStrategy: string; // uncertainty_sampling, etc.
  model: {
    type: string;
    parameters: any;
  };
  queryBatchSize: number;
  maxIterations: number;
  votingConsensus: string; // simple_majority, etc.
  votingTimeout: number; // in seconds
  labelSpace: string[]; // available labels
}

export interface ModelPerformance {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  lastUpdated: Date;
}

export interface ActiveVoting {
  sampleId: string;
  sampleData: any; // could be text, image, features, etc.
  labelOptions: string[];
  currentVotes: { [label: string]: number };
  timeRemaining: number; // seconds
  iterationRound: number;
}

export interface ModelUpdate {
  iterationNumber: number;
  timestamp: Date;
  performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  totalSamples: number; // Changed from totalTrainingSamples to totalSamples for clarity
  notes?: string;
  isFinalTraining?: boolean; // Added for UI detection
}

export interface VotingRecord {
  sampleId: string;
  sampleData: any;
  finalLabel: string;
  votes: { [voterAddress: string]: string };
  votingDistribution: { [label: string]: number };
  timestamp: Date;
  iterationNumber: number;
  consensusReached: boolean;
}

export interface UserContribution {
  address: string;
  role: 'coordinator' | 'contributor';
  votesCount: number;
  joinedAt: Date;
}

export interface ProjectStats {
  totalSamples: number;
  labeledSamples: number;
  accuracyTrend: number[]; // last 10 iterations
  participationRate: number; // percentage of users active
  averageVotingTime: number; // in seconds
  consensusRate: number; // percentage of samples with consensus
}

export interface DALComponentProps {
  title?: string;
  onProjectSelect?: (project: DALProject) => void;
}

export interface DALProjectPageProps {
  project: DALProject;
  onBack?: () => void;
}

// Panel-specific props
export interface ProjectConfigurationPanelProps {
  project: DALProject;
}

export interface ControlPanelProps {
  project: DALProject;
  isCoordinator: boolean;
  onStartNextIteration: () => void;
  onEndProject: () => void;
}

export interface LabelingPanelProps {
  project: DALProject;
  activeVoting?: ActiveVoting;
  onSubmitVote: (label: string) => void;
}

export interface ModelUpdatesPanelProps {
  project: DALProject;
  modelUpdates: ModelUpdate[];
  isCoordinator: boolean;
}

export interface UserDashboardPanelProps {
  project: DALProject;
  userContributions: UserContribution[];
}

export interface VotingHistoryPanelProps {
  project: DALProject;
  votingHistory: VotingRecord[];
}