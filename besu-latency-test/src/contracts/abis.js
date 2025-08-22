// Minimal ABIs for contract method latency testing
// Based on contract-calls-testing.md requirements

// ALProject ABI - only submitBatchVote and helper functions
export const ALPROJECT_ABI = [
  "function submitBatchVote(string[] memory sampleIds, string[] memory labels) external",
  "function getCurrentBatchSampleIds() external view returns (string[] memory)",
  "function isSampleActive(string memory sampleId) external view returns (bool)",
  "function currentRound() external view returns (uint256)",
  "function votingContract() external view returns (address)"
];

// ALProjectVoting ABI - only getBatchStatus and getVotingDistribution
export const ALPROJECTVOTING_ABI = [
  "function getBatchStatus(uint256 round) external view returns (bool isActive, uint256 totalSamples, uint256 completedSamples, uint256 remainingSamples, uint256 startTime, string[] memory sampleIds, string[] memory sampleDataHashes, uint256[] memory sampleOriginalIndices)",
  "function getVotingDistribution(string memory sampleId) external view returns (string[] memory labels, uint256[] memory voteCounts, uint256[] memory voteWeights)"
];

// Minimal placeholder ABIs for compatibility
export const PROJECT_FACTORY_ABI = [
  "function createProject(string memory name) external returns (address)"
];

export const PROJECT_ABI = [
  "function name() external view returns (string memory)"
];

export const AL_VOTING_ABI = ALPROJECTVOTING_ABI; // Alias for backwards compatibility
