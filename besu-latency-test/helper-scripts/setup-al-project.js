import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// We'll need to check if there's an existing ALProject for the base project
// For now, let's create a script that can help set up voting sessions

const ALPROJECT_ABI = [
  "function baseProject() external view returns (address)",
  "function votingContract() external view returns (address)",
  "function storageContract() external view returns (address)",
  "function currentRound() external view returns (uint256)",
  "function startBatchVoting(string[] memory sampleIds, string[] memory sampleDataHashes, uint256[] memory originalIndices) external",
  "function getCurrentBatchSampleIds() external view returns (string[] memory)",
  "function hasALContracts() external view returns (bool)"
];

const PROJECT_ABI = [
  "function getALExtension() external view returns (address)",
  "function hasALExtension() external view returns (bool)",
  "function creator() external view returns (address)"
];

async function setupALProjectForTesting() {
  try {
    console.log('Setting up ALProject for contract method testing...');
    
    // Load accounts
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    const creatorAccount = accountsData[0]; // Creator account
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const creatorWallet = new ethers.Wallet(creatorAccount.privateKey, provider);
    
    console.log('Creator address:', creatorWallet.address);
    
    // Base project address (from previous setup)
    const BASE_PROJECT_ADDRESS = "0x068D03ABFAd7FD62D461170B248c04e138688407";
    
    // Check if the base project has an AL extension
    const baseProject = new ethers.Contract(BASE_PROJECT_ADDRESS, PROJECT_ABI, creatorWallet);
    
    const hasALExtension = await baseProject.hasALExtension();
    console.log('Base project has AL extension:', hasALExtension);
    
    if (!hasALExtension) {
      console.error('❌ Base project does not have an AL extension!');
      console.log('You need to deploy an ALProject extension first.');
      console.log('This requires deploying ALProject, ALProjectVoting, and ALProjectStorage contracts.');
      return null;
    }
    
    // Get AL extension address
    const alProjectAddress = await baseProject.getALExtension();
    console.log('ALProject address:', alProjectAddress);
    
    // Connect to ALProject
    const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, creatorWallet);
    
    // Check if ALProject has voting and storage contracts
    const hasALContracts = await alProject.hasALContracts();
    console.log('ALProject has AL contracts:', hasALContracts);
    
    if (!hasALContracts) {
      console.error('❌ ALProject does not have voting/storage contracts linked!');
      return null;
    }
    
    const votingContractAddress = await alProject.votingContract();
    const storageContractAddress = await alProject.storageContract();
    
    console.log('Voting contract:', votingContractAddress);
    console.log('Storage contract:', storageContractAddress);
    
    // Check current state
    const currentRound = await alProject.currentRound();
    const currentSamples = await alProject.getCurrentBatchSampleIds();
    
    console.log('Current round:', Number(currentRound));
    console.log('Current active samples:', currentSamples.length);
    
    // If no active samples, create some for testing
    if (currentSamples.length === 0) {
      console.log('\n📝 Creating test voting batch...');
      
      // Create sample data for testing
      const testSamples = [
        'sample_001',
        'sample_002', 
        'sample_003',
        'sample_004',
        'sample_005'
      ];
      
      const testDataHashes = [
        'QmTest1Hash1234567890abcdef',
        'QmTest2Hash1234567890abcdef',
        'QmTest3Hash1234567890abcdef',
        'QmTest4Hash1234567890abcdef',
        'QmTest5Hash1234567890abcdef'
      ];
      
      const testOriginalIndices = [0, 1, 2, 3, 4];
      
      try {
        console.log('Starting batch voting with test samples...');
        const tx = await alProject.startBatchVoting(testSamples, testDataHashes, testOriginalIndices);
        console.log('Transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('✅ Batch voting started! Block:', receipt.blockNumber);
        
        // Verify samples are now active
        const updatedSamples = await alProject.getCurrentBatchSampleIds();
        console.log('Active samples after setup:', updatedSamples.length);
        
      } catch (error) {
        console.error('❌ Failed to start batch voting:', error.message);
        return null;
      }
    } else {
      console.log('✅ ALProject already has active samples for testing');
    }
    
    console.log('\n🎯 ALProject setup complete!');
    console.log('Ready for contract method latency testing');
    console.log('ALProject address:', alProjectAddress);
    
    return {
      alProjectAddress,
      votingContractAddress,
      storageContractAddress,
      baseProjectAddress: BASE_PROJECT_ADDRESS,
      currentRound: Number(currentRound),
      activeSamples: currentSamples.length
    };
    
  } catch (error) {
    console.error('Error setting up ALProject:', error.message);
    return null;
  }
}

// Helper function to check ALProject status
async function checkALProjectStatus(alProjectAddress) {
  try {
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    const creatorAccount = accountsData[0];
    
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(creatorAccount.privateKey, provider);
    
    const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, wallet);
    
    const currentRound = await alProject.currentRound();
    const currentSamples = await alProject.getCurrentBatchSampleIds();
    const votingContract = await alProject.votingContract();
    const storageContract = await alProject.storageContract();
    
    console.log('\n=== ALProject Status ===');
    console.log('Address:', alProjectAddress);
    console.log('Current Round:', Number(currentRound));
    console.log('Active Samples:', currentSamples.length);
    console.log('Voting Contract:', votingContract);
    console.log('Storage Contract:', storageContract);
    
    if (currentSamples.length > 0) {
      console.log('Sample IDs:', currentSamples.slice(0, 3).join(', ') + (currentSamples.length > 3 ? '...' : ''));
    }
    
    return {
      alProjectAddress,
      currentRound: Number(currentRound),
      activeSamples: currentSamples.length,
      votingContract,
      storageContract,
      ready: currentSamples.length > 0
    };
    
  } catch (error) {
    console.error('Error checking ALProject status:', error.message);
    return null;
  }
}

// Export functions
export { setupALProjectForTesting, checkALProjectStatus };

// Run setup if called directly
if (process.argv[1].includes('setup-al-project.js')) {
  setupALProjectForTesting();
} 