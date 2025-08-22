import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// Simple ALProject ABI for status checking
const ALPROJECT_ABI = [
  "function getCurrentBatchSampleIds() external view returns (string[] memory)",
  "function currentRound() external view returns (uint256)",
  "function votingContract() external view returns (address)",
  "function isSampleActive(string memory sampleId) external view returns (bool)"
];

async function checkALProjectStatus(alProjectAddress) {
  try {
    console.log('Checking ALProject status...');
    console.log('ALProject address:', alProjectAddress);
    
    // Load accounts
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    const creatorAccount = accountsData[0];
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(creatorAccount.privateKey, provider);
    
    console.log('Using account:', wallet.address);
    
    // Connect to ALProject
    const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, wallet);
    
    // Check current state
    const currentRound = await alProject.currentRound();
    const currentSamples = await alProject.getCurrentBatchSampleIds();
    const votingContract = await alProject.votingContract();
    
    console.log('\n=== ALProject Status ===');
    console.log('Current Round:', Number(currentRound));
    console.log('Active Samples:', currentSamples.length);
    console.log('Voting Contract:', votingContract);
    
    if (currentSamples.length > 0) {
      console.log('Sample IDs:', currentSamples.slice(0, 3).join(', ') + (currentSamples.length > 3 ? '...' : ''));
      
      // Check if first sample is active
      const firstSampleActive = await alProject.isSampleActive(currentSamples[0]);
      console.log('First sample active:', firstSampleActive);
    }
    
    const ready = currentSamples.length > 0 && votingContract !== ethers.ZeroAddress;
    console.log('\nReady for testing:', ready ? '✅ YES' : '❌ NO');
    
    if (!ready) {
      console.log('\nTo make ready:');
      if (votingContract === ethers.ZeroAddress) {
        console.log('- Need to link voting contract');
      }
      if (currentSamples.length === 0) {
        console.log('- Need to start a voting batch');
      }
    }
    
    return ready;
    
  } catch (error) {
    console.error('Error checking ALProject status:', error.message);
    return false;
  }
}

// Get ALProject address from command line
const alProjectAddress = process.argv[2];
if (!alProjectAddress) {
  console.error('Usage: node check-alproject-simple.js <ALProject-address>');
  process.exit(1);
}

checkALProjectStatus(alProjectAddress); 