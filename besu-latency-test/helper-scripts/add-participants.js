import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// Project contract ABI - minimal for adding participants
const PROJECT_ABI = [
  "function addParticipantWithRole(address _participant, string memory _role, uint256 _weight) external",
  "function getParticipantRole(address _participant) external view returns (string memory)",
  "function getAllParticipants() external view returns (address[] memory, string[] memory, uint256[] memory, uint256[] memory)",
  "function creator() external view returns (address)"
];

const PROJECT_ADDRESS = "0x0EB121f3990A397080A31C68cc4B1FC5F6C74c4a";

async function addParticipants() {
  try {
    console.log('Adding participants to project:', PROJECT_ADDRESS);
    console.log('Using chain ID:', CONFIG.CHAIN_ID);
    
    // Read accounts
    const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
    console.log(`Loaded ${accountsData.length} accounts`);
    
    // Setup provider and creator wallet (assuming account 0 is the creator)
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const creatorWallet = new ethers.Wallet(accountsData[0].privateKey, provider);
    
    console.log('Creator address:', creatorWallet.address);
    console.log('Creator account 0 address:', accountsData[0].address);
    
    // Connect to the project contract
    const projectContract = new ethers.Contract(PROJECT_ADDRESS, PROJECT_ABI, creatorWallet);
    
    // Verify creator
    const contractCreator = await projectContract.creator();
    console.log('Contract creator:', contractCreator);
    
    if (contractCreator.toLowerCase() !== creatorWallet.address.toLowerCase()) {
      console.error('ERROR: Wallet address does not match contract creator!');
      console.log('Expected:', contractCreator);
      console.log('Got:', creatorWallet.address);
      return;
    }
    
    // Get current participants before adding
    console.log('\n--- Current Participants ---');
    try {
      const [addresses, roles, weights, timestamps] = await projectContract.getAllParticipants();
      console.log(`Current participants: ${addresses.length}`);
      for (let i = 0; i < addresses.length; i++) {
        console.log(`${addresses[i]} - Role: ${roles[i]}, Weight: ${weights[i]}`);
      }
    } catch (error) {
      console.log('Could not fetch current participants:', error.message);
    }
    
    console.log('\n--- Adding New Participants ---');
    
    // Add participants 1-7 (skipping 0 since it's the creator)
    // Make everyone a contributor for consistent voting weights
    const participantsToAdd = accountsData.slice(1, 8); // Get accounts 1-7 (7 people)
    
    for (let i = 0; i < participantsToAdd.length; i++) {
      const account = participantsToAdd[i];
      const role = "contributor"; // Make everyone a contributor
      const weight = 2; // All contributors get weight 2
      
      console.log(`\nAdding participant ${i + 1}/7:`);
      console.log(`Address: ${account.address}`);
      console.log(`Role: ${role}`);
      console.log(`Weight: ${weight}`);
      
      try {
        // Check if already a participant
        const currentRole = await projectContract.getParticipantRole(account.address);
        if (currentRole && currentRole.length > 0) {
          console.log(`✓ Already a participant with role: ${currentRole}`);
          continue;
        }
        
        // Add the participant
        const tx = await projectContract.addParticipantWithRole(
          account.address,
          role,
          weight
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`✓ Added successfully! Block: ${receipt.blockNumber}`);
        
        // Small delay to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ✗ Failed to add participant:`, error.message);
      }
    }
    
    // Get final participants list
    console.log('\n--- Final Participants List ---');
    try {
      const [addresses, roles, weights, timestamps] = await projectContract.getAllParticipants();
      console.log(`Total participants: ${addresses.length}`);
      for (let i = 0; i < addresses.length; i++) {
        const joinDate = new Date(Number(timestamps[i]) * 1000).toISOString();
        console.log(`${i + 1}. ${addresses[i]}`);
        console.log(`Role: ${roles[i]}, Weight: ${weights[i]}`);
        console.log(`Joined: ${joinDate}`);
      }
    } catch (error) {
      console.error('Could not fetch final participants:', error.message);
    }
    
    console.log('\n✓ Participant addition process completed!');
    
  } catch (error) {
    console.error('Error adding participants:', error);
  }
}

// Run the script
addParticipants(); 