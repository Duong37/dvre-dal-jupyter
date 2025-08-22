import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// Full ABIs for debugging
const ALPROJECT_ABI = [
  "function submitBatchVote(string[] memory sampleIds, string[] memory labels) external",
  "function getCurrentBatchSampleIds() external view returns (string[] memory)",
  "function isSampleActive(string memory sampleId) external view returns (bool)",
  "function currentRound() external view returns (uint256)",
  "function votingContract() external view returns (address)",
  "function baseProject() external view returns (address)"
];

const ALPROJECTVOTING_ABI = [
  "function voterWeights(address voter) external view returns (uint256)",
  "function hasUserVoted(string memory sampleId, address user) external view returns (bool)",
  "function votingSessions(string memory sampleId) external view returns (uint256 startTime, bool isActive, bool isFinalized, string memory finalLabel)",
  "function getBatchStatus(uint256 round) external view returns (bool isActive, uint256 totalSamples, uint256 completedSamples, uint256 remainingSamples, uint256 startTime, string[] memory sampleIds, string[] memory sampleDataHashes, uint256[] memory sampleOriginalIndices)"
];

const PROJECT_ABI = [
  "function getParticipantRole(address _participant) external view returns (string memory)"
];

async function debugVoteSubmission(alProjectAddress) {
  try {
    console.log('🔍 Debugging Vote Submission Issues...');
    console.log('ALProject address:', alProjectAddress);
    
    // Load accounts - use first 3 for debugging
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    const testAccounts = accountsData.slice(0, 3);
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    
    // Get project info
    const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, provider);
    const currentRound = await alProject.currentRound();
    const currentSamples = await alProject.getCurrentBatchSampleIds();
    const votingContractAddress = await alProject.votingContract();
    const baseProjectAddress = await alProject.baseProject();
    
    console.log('\n=== Project Status ===');
    console.log('Current Round:', Number(currentRound));
    console.log('Active Samples:', currentSamples.length);
    console.log('Sample IDs:', currentSamples);
    console.log('Voting Contract:', votingContractAddress);
    console.log('Base Project:', baseProjectAddress);
    
    // Connect to contracts
    const votingContract = new ethers.Contract(votingContractAddress, ALPROJECTVOTING_ABI, provider);
    const baseProject = new ethers.Contract(baseProjectAddress, PROJECT_ABI, provider);
    
    // Check batch status
    console.log('\n=== Batch Status ===');
    try {
      const batchStatus = await votingContract.getBatchStatus(currentRound);
      console.log('Batch Active:', batchStatus[0]);
      console.log('Total Samples:', Number(batchStatus[1]));
      console.log('Completed Samples:', Number(batchStatus[2]));
      console.log('Remaining Samples:', Number(batchStatus[3]));
    } catch (error) {
      console.log('Could not get batch status:', error.message);
    }
    
    // Test each account
    for (let i = 0; i < testAccounts.length; i++) {
      const account = testAccounts[i];
      const wallet = new ethers.Wallet(account.privateKey, provider);
      
      console.log(`\n=== Testing Account ${i} (${wallet.address}) ===`);
      
      // Check if user is a project participant
      try {
        const role = await baseProject.getParticipantRole(wallet.address);
        console.log('Project Role:', role || 'NOT_PARTICIPANT');
      } catch (error) {
        console.log('Could not get role:', error.message);
      }
      
      // Check voter weight
      try {
        const voterWeight = await votingContract.voterWeights(wallet.address);
        console.log('Voter Weight:', Number(voterWeight));
      } catch (error) {
        console.log('Could not get voter weight:', error.message);
      }
      
      // Check each sample
      for (const sampleId of currentSamples) {
        console.log(`\n  Sample: ${sampleId}`);
        
        // Check if sample is active
        try {
          const isActive = await alProject.isSampleActive(sampleId);
          console.log(`Active: ${isActive}`);
        } catch (error) {
          console.log(`Active check failed: ${error.message}`);
        }
        
        // Check voting session
        try {
          const session = await votingContract.votingSessions(sampleId);
          console.log(`Session - Active: ${session[1]}, Finalized: ${session[2]}`);
          if (session[3]) {
            console.log(`Final Label: ${session[3]}`);
          }
        } catch (error) {
          console.log(`Session check failed: ${error.message}`);
        }
        
        // Check if user has voted
        try {
          const hasVoted = await votingContract.hasUserVoted(sampleId, wallet.address);
          console.log(`Has Voted: ${hasVoted}`);
        } catch (error) {
          console.log(`Vote check failed: ${error.message}`);
        }
      }
      
      // Try to submit a vote
      console.log(`\n  🗳️  Attempting vote submission...`);
      const labelSpace = ['0', '1', '2'];
      const labels = currentSamples.map(() => labelSpace[Math.floor(Math.random() * labelSpace.length)]);
      
      console.log(`Voting on: ${currentSamples.join(', ')}`);
      console.log(`With labels: ${labels.join(', ')}`);
      
      try {
        const alProjectWithSigner = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, wallet);
        
        // Estimate gas first
        const gasEstimate = await alProjectWithSigner.submitBatchVote.estimateGas(currentSamples, labels);
        console.log(`Gas Estimate: ${gasEstimate.toString()}`);
        
        // Submit vote
        const tx = await alProjectWithSigner.submitBatchVote(currentSamples, labels);
        console.log(`✅ Vote submitted! Tx: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ Vote confirmed! Block: ${receipt.blockNumber}, Gas Used: ${receipt.gasUsed}`);
        
      } catch (error) {
        console.log(`❌ Vote failed: ${error.message}`);
        
        // Try to get more detailed error
        if (error.data) {
          console.log(`Error data: ${error.data}`);
        }
        if (error.reason) {
          console.log(`Error reason: ${error.reason}`);
        }
      }
      
      console.log('\n  ⏳ Waiting 3 seconds before next account...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n🎯 Debug session completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Get ALProject address from command line
const alProjectAddress = process.argv[2];
if (!alProjectAddress) {
  console.error('Usage: node debug-vote-submission.js <ALProject-address>');
  process.exit(1);
}

debugVoteSubmission(alProjectAddress); 