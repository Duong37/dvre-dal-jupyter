import { ethers } from 'ethers';
import { CONFIG, TEST_DATA } from '../config.js';
import { AL_VOTING_ABI, AL_PROJECT_ABI } from '../contracts/abis.js';

export class VotingSimulation {
  constructor(provider, latencyTracker) {
    this.provider = provider;
    this.latencyTracker = latencyTracker;
    this.mockVotingContract = null;
    this.mockProjectContract = null;
  }

  // Initialize with mock contract addresses (for testing without real deployments)
  async initialize(mockVotingAddress = '0x' + '1'.repeat(40), mockProjectAddress = '0x' + '2'.repeat(40)) {
    this.mockVotingContract = new ethers.Contract(mockVotingAddress, AL_VOTING_ABI, this.provider);
    this.mockProjectContract = new ethers.Contract(mockProjectAddress, AL_PROJECT_ABI, this.provider);
  }

  // Simulate: Submit a vote (most frequent operation during voting)
  async simulateSubmitVote(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'submit_vote', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      const votingWithSigner = this.mockVotingContract.connect(wallet);
      
      // Simulate voting on 3 samples with random labels
      const sampleIds = ['sample_1', 'sample_2', 'sample_3'];
      const labels = sampleIds.map(() => 
        TEST_DATA.AL_CONFIG.labelSpace[Math.floor(Math.random() * TEST_DATA.AL_CONFIG.labelSpace.length)]
      );

      const tx = await votingWithSigner.submitBatchVote(sampleIds, labels, {
        gasLimit: CONFIG.TEST_PARAMS.GAS_LIMIT,
        gasPrice: CONFIG.TEST_PARAMS.GAS_PRICE
      });

      await tx.wait();
      this.latencyTracker.endTiming(timingId, true);
      return { txHash: tx.hash };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Check voting status (frequent polling during active voting)
  async simulateCheckVotingStatus(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'check_voting_status', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      // Simulate the frequent status checks users do
      const operations = [
        this.mockVotingContract.getBatchStatus(1), // Current round status
        this.mockVotingContract.getBatchSamples(1), // Get samples in batch
        this.mockProjectContract.getCurrentRound(), // Project round
      ];

      await Promise.all(operations);
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Get current votes (real-time updates during voting)
  async simulateGetCurrentVotes(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'get_current_votes', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      const sampleIds = ['sample_1', 'sample_2', 'sample_3'];
      
      // Simulate getting vote data for real-time UI updates
      const operations = sampleIds.map(sampleId => 
        Promise.all([
          this.mockVotingContract.getVotes(sampleId),
          this.mockVotingContract.getVotingDistribution(sampleId),
          this.mockVotingContract.hasUserVoted(sampleId, ethers.Wallet.createRandom().address)
        ])
      );

      await Promise.all(operations);
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Simulate: Mixed voting activity (realistic user behavior)
  async simulateMixedVotingActivity(wallet, accountId, concurrentAccounts, nodeInfo = null) {
    const operations = [
      // Most common: checking status (users refresh frequently)
      { type: 'status', weight: 5 },
      // Common: checking current votes (real-time updates)
      { type: 'votes', weight: 3 },
      // Less common but critical: submitting votes
      { type: 'submit', weight: 1 }
    ];

    // Weighted random selection
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    let selectedOperation = 'status';
    for (const op of operations) {
      cumulativeWeight += op.weight;
      if (random <= cumulativeWeight) {
        selectedOperation = op.type;
        break;
      }
    }

    try {
      switch (selectedOperation) {
        case 'submit':
          return await this.simulateSubmitVote(wallet, accountId, concurrentAccounts, nodeInfo);
        case 'votes':
          return await this.simulateGetCurrentVotes(accountId, concurrentAccounts, nodeInfo);
        case 'status':
        default:
          return await this.simulateCheckVotingStatus(accountId, concurrentAccounts, nodeInfo);
      }
    } catch (error) {
      console.error(`Account ${accountId}: Mixed voting operation (${selectedOperation}) failed:`, error.message);
      return { success: false, operation: selectedOperation };
    }
  }

  // Run realistic voting session simulation
  async runVotingSession(accounts, sessionDuration = 60000, nodeInfo = null) {
    console.log(`\n🗳️  Starting realistic voting session simulation`);
    console.log(`Duration: ${sessionDuration / 1000}s`);
    console.log(`Participants: ${accounts.length}`);
    if (nodeInfo) {
      console.log(`Node: ${nodeInfo.name}`);
    }

    const startTime = Date.now();
    const promises = [];

    // Each account performs random voting activities during the session
    accounts.forEach((account, index) => {
      const accountPromise = this.runAccountVotingActivity(
        account, 
        startTime, 
        sessionDuration, 
        accounts.length, 
        nodeInfo
      );
      promises.push(accountPromise);
    });

    await Promise.all(promises);
    
    const actualDuration = Date.now() - startTime;
    console.log(`✅ Voting session completed in ${(actualDuration / 1000).toFixed(2)}s`);
  }

  // Individual account's voting activity during session
  async runAccountVotingActivity(account, sessionStart, sessionDuration, concurrentAccounts, nodeInfo) {
    const wallet = account.wallet.connect(this.provider);
    const endTime = sessionStart + sessionDuration;
    let operationCount = 0;

    console.log(`👤 ${account.id}: Starting voting activity...`);

    while (Date.now() < endTime) {
      try {
        await this.simulateMixedVotingActivity(wallet, account.id, concurrentAccounts, nodeInfo);
        operationCount++;
        
        // Random delay between operations (500ms to 3s) - realistic user behavior
        const delay = 500 + Math.random() * 2500;
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`   ❌ ${account.id}: Operation failed:`, error.message);
      }
    }

    console.log(`✅ ${account.id}: Completed ${operationCount} operations`);
  }

  // Run concurrency scaling test (key for your thesis)
  async runConcurrencyScalingTest(accountCounts = [1, 2, 4, 8], nodeInfo = null) {
    console.log(`\n📊 Running concurrency scaling test`);
    if (nodeInfo) {
      console.log(`Node: ${nodeInfo.name}`);
    }

    for (const accountCount of accountCounts) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 Testing ${accountCount} concurrent voter(s)`);
      console.log(`${'='.repeat(60)}`);

      // Generate test accounts
      const accounts = [];
      for (let i = 0; i < accountCount; i++) {
        const wallet = ethers.Wallet.createRandom();
        accounts.push({
          id: `voter_${i}`,
          wallet,
          address: wallet.address
        });
      }

      console.log('Generated voters:');
      accounts.forEach(account => {
        console.log(`${account.id}: ${account.address}`);
      });

      // Run short but intensive voting session
      await this.runVotingSession(accounts, 30000, nodeInfo); // 30 second sessions

      // Break between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Test specific operation under load
  async runOperationLoadTest(operationType, accounts, iterations = 10, nodeInfo = null) {
    console.log(`\n⚡ Load testing: ${operationType}`);
    console.log(`Accounts: ${accounts.length}, Iterations: ${iterations}`);
    
    const promises = accounts.map(async (account, index) => {
      const wallet = account.wallet.connect(this.provider);
      
      for (let i = 0; i < iterations; i++) {
        try {
          switch (operationType) {
            case 'submit_vote':
              await this.simulateSubmitVote(wallet, account.id, accounts.length, nodeInfo);
              break;
            case 'check_status':
              await this.simulateCheckVotingStatus(account.id, accounts.length, nodeInfo);
              break;
            case 'get_votes':
              await this.simulateGetCurrentVotes(account.id, accounts.length, nodeInfo);
              break;
          }
          
          // Small delay between operations
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          
        } catch (error) {
          console.error(`${account.id}: ${operationType} failed:`, error.message);
        }
      }
    });

    await Promise.all(promises);
    console.log(`✅ Load test completed: ${operationType}`);
  }
} 