import { ethers } from 'ethers';
import { CONFIG } from '../config.js';
import { ALPROJECT_ABI, ALPROJECTVOTING_ABI } from '../contracts/abis.js';

export class ContractMethodLatencyTesting {
  constructor(provider) {
    this.provider = provider;
  }

  /**
   * Test ALProjectVoting.getBatchStatus() - READ operation (moderate)
   */
  async testGetBatchStatus(wallet, votingContractAddress, round, accountId, nodeInfo = null) {
    const startTime = Date.now();
    const operationType = 'contract_getBatchStatus';
    
    try {
      const votingContract = new ethers.Contract(votingContractAddress, ALPROJECTVOTING_ABI, wallet);
      
      // Call getBatchStatus
      const result = await votingContract.getBatchStatus(round);
      const endTime = Date.now();
      
      // Parse the result
      const [isActive, totalSamples, completedSamples, remainingSamples, startTime_batch, sampleIds, sampleDataHashes, sampleOriginalIndices] = result;
      
      // Calculate approximate response size
      const responseSize = sampleIds.length * 50 + sampleDataHashes.join('').length + sampleOriginalIndices.length * 8;
      
      return {
        success: true,
        latency: endTime - startTime,
        operation: operationType,
        accountId,
        nodeInfo,
        responseData: {
          isActive,
          totalSamples: Number(totalSamples),
          completedSamples: Number(completedSamples),
          remainingSamples: Number(remainingSamples),
          sampleCount: sampleIds.length,
          approximateResponseSize: responseSize
        }
      };
      
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        operation: operationType,
        error: error.message,
        accountId,
        nodeInfo
      };
    }
  }

  /**
   * Test ALProjectVoting.getVotingDistribution() - READ operation (heavier)
   */
  async testGetVotingDistribution(wallet, votingContractAddress, sampleId, accountId, nodeInfo = null) {
    const startTime = Date.now();
    const operationType = 'contract_getVotingDistribution';
    
    try {
      const votingContract = new ethers.Contract(votingContractAddress, ALPROJECTVOTING_ABI, wallet);
      
      // Call getVotingDistribution
      const result = await votingContract.getVotingDistribution(sampleId);
      const endTime = Date.now();
      
      // Parse the result
      const [labels, voteCounts, voteWeights] = result;
      
      // Calculate response size
      const responseSize = labels.join('').length + (voteCounts.length + voteWeights.length) * 8;
      
      return {
        success: true,
        latency: endTime - startTime,
        operation: operationType,
        accountId,
        nodeInfo,
        responseData: {
          labelCount: labels.length,
          totalVotes: voteCounts.reduce((sum, count) => sum + Number(count), 0),
          approximateResponseSize: responseSize,
          labels: labels.slice(0, 5) // Only include first 5 labels to avoid huge logs
        }
      };
      
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        operation: operationType,
        error: error.message,
        accountId,
        nodeInfo
      };
    }
  }

  /**
   * Run a comprehensive contract method test session
   */
  async runContractMethodSession(wallet, alProjectAddress, duration = 10000, accountId, nodeInfo = null) {
    const results = [];
    const endTime = Date.now() + duration;
    
    console.log(`Account ${accountId}: Starting read operations testing session (${duration/1000}s)...`);
    
    try {
      // Get ALProject contract instance
      const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, wallet);
      
      // Get voting contract address
      const votingContractAddress = await alProject.votingContract();
      if (votingContractAddress === ethers.ZeroAddress) {
        throw new Error('ALProject does not have a voting contract linked');
      }
      
      // Get current round and sample IDs
      const currentRound = await alProject.currentRound();
      const currentSampleIds = await alProject.getCurrentBatchSampleIds();
      
      if (currentSampleIds.length === 0) {
        throw new Error('No active samples for voting');
      }
      
      console.log(`Account ${accountId}: Found ${currentSampleIds.length} active samples in round ${currentRound}`);
      
      let operationCount = 0;
      
      while (Date.now() < endTime) {
        // Weighted selection of READ operations only
        // 50% getBatchStatus, 50% getVotingDistribution
        const random = Math.random();
        
        if (random < 0.5) {
          // Test getBatchStatus (50%)
          const result = await this.testGetBatchStatus(
            wallet, 
            votingContractAddress, 
            currentRound, 
            accountId, 
            nodeInfo
          );
          results.push(result);
          
        } else {
          // Test getVotingDistribution (50%)
          const randomSampleId = currentSampleIds[Math.floor(Math.random() * currentSampleIds.length)];
          const result = await this.testGetVotingDistribution(
            wallet, 
            votingContractAddress, 
            randomSampleId, 
            accountId, 
            nodeInfo
          );
          results.push(result);
        }
        
        operationCount++;
        
        // Small delay to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Account ${accountId}: Completed ${operationCount} contract method operations`);
      
    } catch (error) {
      console.error(`Account ${accountId}: Contract method session error:`, error.message);
      results.push({
        success: false,
        latency: 0,
        operation: 'contract_session_error',
        error: error.message,
        accountId,
        nodeInfo
      });
    }
    
    return results;
  }

  /**
   * Run distributed contract method testing across multiple accounts
   */
  async runDistributedContractMethodTest(alProjectAddress, accountCount, duration = 10000) {
    console.log(`\n=== Contract Method Latency Testing ===`);
    console.log(`Project: ${alProjectAddress}`);
    console.log(`Accounts: ${accountCount}, Duration: ${duration/1000}s`);
    
    // Load accounts (use first 8: owner + 7 participants)
    const accountsData = JSON.parse(await import('fs').then(fs => fs.readFileSync('./accounts.json', 'utf8')));
    const accounts = accountsData.slice(0, Math.min(accountCount, 8));
    
    // Get node URLs for distribution
    const nodeUrls = [
      CONFIG.BESU_NODES.node1.url,
      CONFIG.BESU_NODES.node2.url,
      CONFIG.BESU_NODES.node3.url,
      CONFIG.BESU_NODES.node4.url
    ];
    
    // Create promises for all accounts
    const testPromises = accounts.map((account, index) => {
      const nodeUrl = nodeUrls[index % nodeUrls.length];
      const provider = new ethers.JsonRpcProvider(nodeUrl);
      const wallet = new ethers.Wallet(account.privateKey, provider);
      const accountId = `account_${index}`;
      const nodeInfo = {
        url: nodeUrl,
        name: Object.values(CONFIG.BESU_NODES).find(node => node.url === nodeUrl)?.name || 'Unknown'
      };
      
      return this.runContractMethodSession(wallet, alProjectAddress, duration, accountId, nodeInfo);
    });
    
    // Wait for all tests to complete
    console.log('\nWaiting for all contract method tests to complete...');
    const allResults = await Promise.all(testPromises);
    
    // Flatten results
    const flatResults = allResults.flat();
    
    console.log('\n=== Contract Method Test Results ===');
    console.log(`Total operations: ${flatResults.length}`);
    
    // Group results by operation type
    const operationGroups = {};
    flatResults.forEach(result => {
      if (!operationGroups[result.operation]) {
        operationGroups[result.operation] = [];
      }
      operationGroups[result.operation].push(result);
    });
    
    // Calculate statistics for each operation
    Object.keys(operationGroups).forEach(operation => {
      const results = operationGroups[operation];
      const successful = results.filter(r => r.success);
      const latencies = successful.map(r => r.latency);
      
      if (latencies.length > 0) {
        latencies.sort((a, b) => a - b);
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const p99 = latencies[Math.floor(latencies.length * 0.99)];
        
        console.log(`\n${operation}:`);
        console.log(`Success: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
        console.log(`Avg: ${avg.toFixed(0)}ms, P95: ${p95}ms, P99: ${p99}ms`);
        console.log(`Min: ${Math.min(...latencies)}ms, Max: ${Math.max(...latencies)}ms`);
        
      }
    });
    
    return flatResults;
  }
} 