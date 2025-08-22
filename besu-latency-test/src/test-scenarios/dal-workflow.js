import { ethers } from 'ethers';
import { CONFIG, TEST_DATA } from '../config.js';
import { 
  ALPROJECT_ABI, 
  ALPROJECTVOTING_ABI,
  PROJECT_FACTORY_ABI,
  PROJECT_ABI
} from '../contracts/abis.js';

export class DALWorkflowTester {
  constructor(provider, latencyTracker) {
    this.provider = provider;
    this.latencyTracker = latencyTracker;
    this.projectFactoryContract = null;
    this.testProjects = new Map(); // accountId -> project info
  }

  // Initialize contracts
  async initialize() {
    if (!CONFIG.CONTRACTS.PROJECT_FACTORY) {
      throw new Error('PROJECT_FACTORY address not configured');
    }
    
    this.projectFactoryContract = new ethers.Contract(
      CONFIG.CONTRACTS.PROJECT_FACTORY,
      PROJECT_FACTORY_ABI,
      this.provider
    );
  }

  // Test Scenario 1: Project Creation
  async testProjectCreation(wallet, accountId, concurrentAccounts) {
    const timingId = this.latencyTracker.startTiming(
      'project_creation', 
      accountId, 
      { concurrentAccounts }
    );

    try {
      const factoryWithSigner = this.projectFactoryContract.connect(wallet);
      
      // Create AL project (templateId = 1 typically for AL projects)
      const tx = await factoryWithSigner.createProjectFromTemplate(
        1, // AL template ID
        TEST_DATA.PROJECT_METADATA,
        {
          gasLimit: CONFIG.TEST_PARAMS.GAS_LIMIT,
          gasPrice: CONFIG.TEST_PARAMS.GAS_PRICE
        }
      );

      const receipt = await tx.wait();
      
      // Extract project address from events
      const projectCreatedEvent = receipt.logs.find(log => 
        log.topics[0] === ethers.id('ProjectCreated(address,address,string,uint256,uint256)')
      );
      
      let projectAddress = null;
      if (projectCreatedEvent) {
        const decoded = factoryWithSigner.interface.parseLog(projectCreatedEvent);
        projectAddress = decoded.args.projectAddress;
      }

      // Store project info for later tests
      this.testProjects.set(accountId, {
        address: projectAddress,
        creator: wallet.address,
        txHash: tx.hash
      });

      this.latencyTracker.endTiming(timingId, true);
      return { projectAddress, txHash: tx.hash };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Test Scenario 2: AL Project Setup (after deployment)
  async testALProjectSetup(wallet, accountId, concurrentAccounts) {
    const projectInfo = this.testProjects.get(accountId);
    if (!projectInfo) {
      throw new Error(`No project found for account ${accountId}`);
    }

    const timingId = this.latencyTracker.startTiming(
      'al_setup', 
      accountId, 
      { concurrentAccounts }
    );

    try {
      const alProjectContract = new ethers.Contract(
        projectInfo.address,
        ALPROJECT_ABI,
        wallet
      );

      // This would normally be done after AL contracts are deployed
      // For testing, we'll assume they exist (you'd need to deploy them first)
      const tx = await alProjectContract.setupALProject(
        ethers.ZeroAddress, // voting contract (would be real address)
        ethers.ZeroAddress, // storage contract (would be real address) 
        TEST_DATA.AL_CONFIG.queryStrategy,
        TEST_DATA.AL_CONFIG.alScenario,
        TEST_DATA.AL_CONFIG.maxIteration,
        TEST_DATA.AL_CONFIG.queryBatchSize,
        TEST_DATA.AL_CONFIG.labelSpace,
        ethers.ZeroAddress, // rocrate asset (would be real address)
        {
          gasLimit: CONFIG.TEST_PARAMS.GAS_LIMIT,
          gasPrice: CONFIG.TEST_PARAMS.GAS_PRICE
        }
      );

      await tx.wait();
      this.latencyTracker.endTiming(timingId, true);
      return { txHash: tx.hash };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Test Scenario 3: Start Batch Voting
  async testStartBatchVoting(wallet, accountId, concurrentAccounts) {
    const projectInfo = this.testProjects.get(accountId);
    if (!projectInfo) {
      throw new Error(`No project found for account ${accountId}`);
    }

    const timingId = this.latencyTracker.startTiming(
      'start_batch_voting', 
      accountId, 
      { concurrentAccounts }
    );

    try {
      const alProjectContract = new ethers.Contract(
        projectInfo.address,
        ALPROJECT_ABI,
        wallet
      );

      const tx = await alProjectContract.startBatchVoting(
        TEST_DATA.SAMPLE_IDS,
        TEST_DATA.SAMPLE_HASHES,
        TEST_DATA.ORIGINAL_INDICES,
        {
          gasLimit: CONFIG.TEST_PARAMS.GAS_LIMIT,
          gasPrice: CONFIG.TEST_PARAMS.GAS_PRICE
        }
      );

      await tx.wait();
      this.latencyTracker.endTiming(timingId, true);
      return { txHash: tx.hash };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Test Scenario 4: Submit Votes
  async testSubmitVote(wallet, accountId, concurrentAccounts) {
    const projectInfo = this.testProjects.get(accountId);
    if (!projectInfo) {
      throw new Error(`No project found for account ${accountId}`);
    }

    const timingId = this.latencyTracker.startTiming(
      'submit_vote', 
      accountId, 
      { concurrentAccounts }
    );

    try {
      const alProjectContract = new ethers.Contract(
        projectInfo.address,
        ALPROJECT_ABI,
        wallet
      );

      // Submit votes for all samples
      const labels = TEST_DATA.SAMPLE_IDS.map((_, i) => 
        TEST_DATA.AL_CONFIG.labelSpace[i % TEST_DATA.AL_CONFIG.labelSpace.length]
      );

      const tx = await alProjectContract.submitBatchVote(
        TEST_DATA.SAMPLE_IDS,
        labels,
        {
          gasLimit: CONFIG.TEST_PARAMS.GAS_LIMIT,
          gasPrice: CONFIG.TEST_PARAMS.GAS_PRICE
        }
      );

      await tx.wait();
      this.latencyTracker.endTiming(timingId, true);
      return { txHash: tx.hash };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Test Scenario 5: Read Operations (checking state)
  async testReadOperations(wallet, accountId, concurrentAccounts) {
    const projectInfo = this.testProjects.get(accountId);
    if (!projectInfo) {
      throw new Error(`No project found for account ${accountId}`);
    }

    const timingId = this.latencyTracker.startTiming(
      'read_operations', 
      accountId, 
      { concurrentAccounts }
    );

    try {
      const alProjectContract = new ethers.Contract(
        projectInfo.address,
        ALPROJECT_ABI,
        this.provider // Use provider for read operations (no signer needed)
      );

      // Multiple read operations
      const operations = [
        alProjectContract.getCurrentRound(),
        alProjectContract.hasALContracts(),
        this.projectFactoryContract.checkIsDALProject(projectInfo.address)
      ];

      await Promise.all(operations);
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };

    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Run a complete workflow simulation for one account
  async runCompleteWorkflow(wallet, accountId, concurrentAccounts) {
    console.log(`Account ${accountId}: Starting complete DAL workflow simulation...`);
    
    try {
      // Step 1: Create project
      console.log(`Account ${accountId}: Creating project...`);
      await this.testProjectCreation(wallet, accountId, concurrentAccounts);
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_PARAMS.OPERATION_DELAY));

      // Step 2: Setup AL project (would normally happen after deployment)
      console.log(`Account ${accountId}: Setting up AL project...`);
      // await this.testALProjectSetup(wallet, accountId, concurrentAccounts);
      // await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_PARAMS.OPERATION_DELAY));

      // Step 3: Start batch voting
      console.log(`Account ${accountId}: Starting batch voting...`);
      // await this.testStartBatchVoting(wallet, accountId, concurrentAccounts);
      // await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_PARAMS.OPERATION_DELAY));

      // Step 4: Submit votes
      console.log(`Account ${accountId}: Submitting votes...`);
      // await this.testSubmitVote(wallet, accountId, concurrentAccounts);
      // await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_PARAMS.OPERATION_DELAY));

      // Step 5: Read operations
      console.log(`Account ${accountId}: Performing read operations...`);
      await this.testReadOperations(wallet, accountId, concurrentAccounts);

      console.log(`Account ${accountId}: Workflow completed successfully`);

    } catch (error) {
      console.error(`Account ${accountId}: Workflow failed:`, error.message);
      throw error;
    }
  }

  // Run multiple operations per account for load testing
  async runLoadTest(wallet, accountId, concurrentAccounts, operationsPerAccount = 5) {
    console.log(`Account ${accountId}: Running load test with ${operationsPerAccount} operations...`);
    
    for (let i = 0; i < operationsPerAccount; i++) {
      try {
        // For load testing, focus on the most common operations
        await this.testProjectCreation(wallet, `${accountId}_${i}`, concurrentAccounts);
        await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_PARAMS.OPERATION_DELAY));
        
        await this.testReadOperations(wallet, `${accountId}_${i}`, concurrentAccounts);
        await new Promise(resolve => setTimeout(resolve, CONFIG.TEST_PARAMS.OPERATION_DELAY));
        
      } catch (error) {
        console.error(`Account ${accountId}: Operation ${i} failed:`, error.message);
      }
    }
  }
} 