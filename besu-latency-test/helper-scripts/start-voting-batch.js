import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// ALProject ABI for starting voting batch
const ALPROJECT_ABI = [
  "function startBatchVoting(string[] memory sampleIds, string[] memory sampleDataHashes, uint256[] memory originalIndices) external",
  "function getCurrentBatchSampleIds() external view returns (string[] memory)",
  "function currentRound() external view returns (uint256)"
];

async function startVotingBatch(alProjectAddress) {
  try {
    console.log('Starting voting batch for contract method testing...');
    console.log('ALProject address:', alProjectAddress);
    
    // Load accounts
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    const creatorAccount = accountsData[0]; // Creator account
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const creatorWallet = new ethers.Wallet(creatorAccount.privateKey, provider);
    
    console.log('Creator address:', creatorWallet.address);
    
    // Connect to ALProject
    const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, creatorWallet);
    
    // Check current state
    const currentRound = await alProject.currentRound();
    const currentSamples = await alProject.getCurrentBatchSampleIds();
    
    console.log('Current round:', Number(currentRound));
    console.log('Current active samples:', currentSamples.length);
    
    if (currentSamples.length > 0) {
      console.log('✅ ALProject already has active samples for testing');
      console.log('Sample IDs:', currentSamples.slice(0, 3).join(', ') + (currentSamples.length > 3 ? '...' : ''));
      return true;
    }
    
    console.log('\n📝 Creating test voting batch...');
    
    // Create sample data for testing - realistic DAL batch size = 3
    const testSamples = [
      'sample_001_dal_batch',
      'sample_002_dal_batch', 
      'sample_003_dal_batch'
    ];
    
    const testDataHashes = [
      'QmDALBatch1Hash123456789abc',
      'QmDALBatch2Hash123456789abc',
      'QmDALBatch3Hash123456789abc'
    ];
    
    const testOriginalIndices = [200, 201, 202];
    
    console.log('Test samples:', testSamples);
    console.log('Starting batch voting...');
    
    const tx = await alProject.startBatchVoting(testSamples, testDataHashes, testOriginalIndices);
    console.log('Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Batch voting started! Block:', receipt.blockNumber);
    
    // Verify samples are now active
    const updatedSamples = await alProject.getCurrentBatchSampleIds();
    console.log('Active samples after setup:', updatedSamples.length);
    console.log('Sample IDs:', updatedSamples.join(', '));
    
    console.log('\n🎯 ALProject is now ready for contract method testing!');
    console.log('You can now run:');
    console.log(`npm run test -- --test-type contract-methods --project ${alProjectAddress} --accounts "1,2,4,8" --duration 10`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error starting voting batch:', error.message);
    return false;
  }
}

// Get ALProject address from command line
const alProjectAddress = process.argv[2];
if (!alProjectAddress) {
  console.error('Usage: node start-voting-batch.js <ALProject-address>');
  process.exit(1);
}

startVotingBatch(alProjectAddress); 