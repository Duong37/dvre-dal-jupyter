import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// ALProject ABI for managing voting batches
const ALPROJECT_ABI = [
  "function startBatchVoting(string[] memory sampleIds, string[] memory sampleDataHashes, uint256[] memory originalIndices) external",
  "function endBatchVoting(uint256 round) external",
  "function getCurrentBatchSampleIds() external view returns (string[] memory)",
  "function currentRound() external view returns (uint256)"
];

async function setupRealisticDALBatch(alProjectAddress) {
  try {
    console.log('Setting up realistic DAL voting batch...');
    console.log('ALProject address:', alProjectAddress);
    console.log('DAL Configuration:');
    console.log('- Query Batch Size: 3 samples');
    console.log('- Label Space: ["0", "1", "2"]');
    console.log('- Each user votes on ALL 3 samples');
    
    // Load accounts
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    const creatorAccount = accountsData[0]; // Creator account
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const creatorWallet = new ethers.Wallet(creatorAccount.privateKey, provider);
    
    console.log('\nCreator address:', creatorWallet.address);
    
    // Connect to ALProject
    const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, creatorWallet);
    
    // Check current state
    const currentRound = await alProject.currentRound();
    const currentSamples = await alProject.getCurrentBatchSampleIds();
    
    console.log('Current round:', Number(currentRound));
    console.log('Current active samples:', currentSamples.length);
    
    if (currentSamples.length > 0) {
      console.log('Current samples:', currentSamples.slice(0, 3).join(', ') + (currentSamples.length > 3 ? '...' : ''));
      
      // End current batch first
      console.log('\n🔄 Ending current voting batch...');
      try {
        const endTx = await alProject.endBatchVoting(currentRound);
        console.log('End batch transaction sent:', endTx.hash);
        
        const endReceipt = await endTx.wait();
        console.log('✅ Current batch ended! Block:', endReceipt.blockNumber);
        
        // Wait a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log('Note: Could not end current batch:', error.message);
        console.log('Proceeding to start new batch anyway...');
      }
    }
    
    console.log('\n📝 Creating realistic DAL voting batch...');
    
    // Create realistic DAL batch: exactly 3 samples (query batch size)
    const dalSamples = [
      'dal_sample_001_round_' + (Number(currentRound) + 1),
      'dal_sample_002_round_' + (Number(currentRound) + 1),
      'dal_sample_003_round_' + (Number(currentRound) + 1)
    ];
    
    const dalDataHashes = [
      'QmDALRound1Sample1Hash123abc',
      'QmDALRound1Sample2Hash123abc',
      'QmDALRound1Sample3Hash123abc'
    ];
    
    // Original indices from the unlabeled dataset
    const dalOriginalIndices = [1001, 1002, 1003];
    
    console.log('DAL Batch Setup:');
    console.log('Samples:', dalSamples);
    console.log('Label Space: ["0", "1", "2"] (3 classes)');
    console.log('Expected Behavior: Each user votes on all 3 samples');
    
    console.log('\nStarting DAL batch voting...');
    
    const tx = await alProject.startBatchVoting(dalSamples, dalDataHashes, dalOriginalIndices);
    console.log('Transaction sent:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ DAL batch voting started! Block:', receipt.blockNumber);
    
    // Verify samples are now active
    const updatedSamples = await alProject.getCurrentBatchSampleIds();
    const newRound = await alProject.currentRound();
    
    console.log('\n🎯 DAL Project Ready for Realistic Testing!');
    console.log('Round:', Number(newRound));
    console.log('Active samples:', updatedSamples.length);
    console.log('Sample IDs:', updatedSamples.join(', '));
    
    console.log('\n📋 Test Scenario:');
    console.log('- Each of 8 users will vote on ALL 3 samples');
    console.log('- Labels randomly chosen from ["0", "1", "2"]');
    console.log('- No conflicts: each user submits 1 batch vote with 3 labels');
    console.log('- Expected success rate: ~100% for vote submissions');
    
    console.log('\nYou can now run:');
    console.log(`node test-contract-methods.js`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error setting up DAL batch:', error.message);
    return false;
  }
}

// Get ALProject address from command line
const alProjectAddress = process.argv[2];
if (!alProjectAddress) {
  console.error('Usage: node setup-realistic-dal-batch.js <ALProject-address>');
  process.exit(1);
}

setupRealisticDALBatch(alProjectAddress); 