import { ethers } from 'ethers';
import fs from 'fs';
import { CONFIG } from '../src/config.js';

// Helper function to create a fresh voting batch
async function createFreshBatch(alProjectAddress, roundNumber) {
  console.log(`🔄 Creating fresh voting batch for round ${roundNumber}...`);
  
  const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
  const creatorAccount = accountsData[0];
  
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const creatorWallet = new ethers.Wallet(creatorAccount.privateKey, provider);
  
  const ALPROJECT_ABI = [
    "function startBatchVoting(string[] memory sampleIds, string[] memory sampleDataHashes, uint256[] memory originalIndices) external",
    "function endBatchVoting(uint256 round) external",
    "function getCurrentBatchSampleIds() external view returns (string[] memory)",
    "function currentRound() external view returns (uint256)"
  ];
  
  const alProject = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, creatorWallet);
  
  // Get current round and samples
  const currentRound = await alProject.currentRound();
  const currentSamples = await alProject.getCurrentBatchSampleIds();
  
  console.log(`Current contract round: ${currentRound}, active samples: ${currentSamples.length}`);
  
  // End current batch if it exists
  if (currentSamples.length > 0) {
    console.log(`Ending current batch (round ${currentRound})...`);
    try {
      const endTx = await alProject.endBatchVoting(currentRound);
      await endTx.wait();
      console.log('✅ Current batch ended');
    } catch (error) {
      console.log(`Note: Could not end batch: ${error.message}`);
    }
  }
  
  // Create new batch - 3 samples as per DAL design with timestamp for uniqueness
  const timestamp = Date.now();
  const dalSamples = [
    `test_${timestamp}_sample_001`,
    `test_${timestamp}_sample_002`, 
    `test_${timestamp}_sample_003`
  ];
  
  const dalDataHashes = [
    `QmTest${timestamp}Sample1Hash`,
    `QmTest${timestamp}Sample2Hash`,
    `QmTest${timestamp}Sample3Hash`
  ];
  
  const dalOriginalIndices = [timestamp + 1, timestamp + 2, timestamp + 3];
  
  console.log(`Starting new batch: ${dalSamples.join(', ')}`);
  
  const tx = await alProject.startBatchVoting(dalSamples, dalDataHashes, dalOriginalIndices);
  await tx.wait();
  
  console.log(`✅ Fresh batch created and ready for 8 votes!`);
  
  // Wait longer for state to update - important for concurrent testing
  await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 2s to 5s
  
  return dalSamples;
}

// Test different concurrency levels while completing voting rounds
async function testWriteConcurrencyLevels(alProjectAddress, concurrency) {
  const accountsData = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));
  const participants = accountsData.slice(0, 8); // Use first 8 accounts (all participants)
  
  // Get node URLs for distribution - Read Operations Testing: Including all 4 nodes
  const nodeUrls = [
    CONFIG.BESU_NODES.node1.url,
    CONFIG.BESU_NODES.node2.url,
    CONFIG.BESU_NODES.node3.url,
    CONFIG.BESU_NODES.node4.url  // Added back for read operation testing
  ];
  
  console.log(`\n=== Node Distribution for ${concurrency} Concurrent Votes ===`);
  console.log(`Available nodes: ${nodeUrls.length}`);
  nodeUrls.forEach((url, i) => {
    const nodeInfo = CONFIG.BESU_NODES[`node${i+1}`];
    console.log(`Node ${i+1}: ${nodeInfo.name} - ${url}`);
  });
  
  const results = [];
  
  const ALPROJECT_ABI = [
    "function submitBatchVote(string[] memory sampleIds, string[] memory labels) external",
    "function getCurrentBatchSampleIds() external view returns (string[] memory)"
  ];
  
  console.log(`\n=== Testing ${concurrency} Concurrent Votes ===`);
  console.log(`Strategy: ${8/concurrency} rounds of ${concurrency} concurrent votes each`);
  console.log(`Total votes per test: 8 (all participants vote once)\n`);
  
  // Get current samples - but only use the fresh ones we just created
  const allSamples = await createFreshBatch(alProjectAddress, concurrency);
  
  console.log(`Available samples: ${allSamples.length} (using only fresh batch samples)`);
  console.log(`Fresh samples: ${allSamples.join(', ')}`);
  
  // Calculate how many rounds we need
  const roundsNeeded = Math.ceil(8 / concurrency);
  console.log(`Will execute ${roundsNeeded} rounds with ${concurrency} concurrent votes each\n`);
  
  for (let round = 0; round < roundsNeeded; round++) {
    const startIdx = round * concurrency;
    const endIdx = Math.min(startIdx + concurrency, 8);
    const accountsThisRound = participants.slice(startIdx, endIdx);
    
    console.log(`--- Round ${round + 1}/${roundsNeeded}: Testing ${accountsThisRound.length} concurrent votes ---`);
    
    // Show node distribution for this round
    accountsThisRound.forEach((account, idx) => {
      const accountIndex = startIdx + idx;
      const nodeIndex = accountIndex % nodeUrls.length;
      const nodeUrl = nodeUrls[nodeIndex];
      const nodeInfo = CONFIG.BESU_NODES[`node${nodeIndex + 1}`];
      console.log(`account_${accountIndex} -> ${nodeInfo.name} (${nodeUrl})`);
    });
    
    // Prepare concurrent vote submissions with staggered timing
    const votePromises = accountsThisRound.map(async (account, idx) => {
      const accountIndex = startIdx + idx;
      const nodeIndex = accountIndex % nodeUrls.length;
      const nodeUrl = nodeUrls[nodeIndex];
      const nodeInfo = CONFIG.BESU_NODES[`node${nodeIndex + 1}`];
      
      // Create provider for the specific node
      const provider = new ethers.JsonRpcProvider(nodeUrl);
      const wallet = new ethers.Wallet(account.privateKey, provider);
      const contract = new ethers.Contract(alProjectAddress, ALPROJECT_ABI, wallet);
      
      const accountId = `account_${accountIndex}`;
      let operationStart; // Declare operationStart at the proper scope
      
      try {
        // Vote on ALL samples (correct DAL behavior)
        const samplesToVote = [...allSamples];
        const labelSpace = ['0', '1', '2'];
        const labels = samplesToVote.map(() => labelSpace[Math.floor(Math.random() * labelSpace.length)]);
        
        console.log(`${accountId}: Submitting vote for ${samplesToVote.length} samples via ${nodeInfo.name}...`);
        
        operationStart = Date.now();
        
        // Submit vote for ALL samples
        const tx = await contract.submitBatchVote(samplesToVote, labels);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        const operationEnd = Date.now();
        const latency = operationEnd - operationStart;
        
        const result = {
          operation: 'submitBatchVote_concurrency',
          accountId: accountId,
          concurrencyLevel: concurrency,
          round: round + 1,
          success: true,
          latency: latency,
          gasUsed: Number(receipt.gasUsed),
          blockNumber: receipt.blockNumber,
          transactionHash: tx.hash,
          timestamp: new Date().toISOString(),
          sampleCount: samplesToVote.length,
          labels: labels,
          nodeUrl: nodeUrl,
          nodeName: nodeInfo.name
        };
        
        console.log(`✅ ${accountId}: Vote successful - ${latency}ms, gas: ${receipt.gasUsed.toLocaleString()} [${nodeInfo.name}]`);
        return result;
        
      } catch (error) {
        const operationEnd = Date.now();
        const latency = operationStart ? operationEnd - operationStart : 0;
        
        // Extract detailed error information
        let errorDetails = error.message;
        let errorReason = 'Unknown';
        let errorCode = 'UNKNOWN';
        
        if (error.reason) {
          errorReason = error.reason;
        }
        if (error.code) {
          errorCode = error.code;
        }
        if (error.revert && error.revert.args && error.revert.args.length > 0) {
          errorReason = error.revert.args[0];
        }
        if (error.data) {
          errorDetails += ` | Data: ${error.data}`;
        }
        
        const result = {
          operation: 'submitBatchVote_concurrency',
          accountId: accountId,
          concurrencyLevel: concurrency,
          round: round + 1,
          success: false,
          latency: latency,
          error: errorDetails,
          errorReason: errorReason,
          errorCode: errorCode,
          timestamp: new Date().toISOString(),
          nodeUrl: nodeUrl,
          nodeName: nodeInfo.name
        };
        
        console.log(`❌ ${accountId}: Vote failed - ${errorReason} [${nodeInfo.name}]`);
        console.log(`Error code: ${errorCode}`);
        console.log(`Full error: ${errorDetails.slice(0, 150)}...`);
        return result;
      }
    });
    
    // Execute concurrent votes for this round
    const roundResults = await Promise.all(votePromises);
    results.push(...roundResults);
    
    const successful = roundResults.filter(r => r.success);
    console.log(`Round ${round + 1} completed: ${successful.length}/${roundResults.length} successful votes`);
    
    // Short delay between rounds - progressive wait times based on concurrency
    if (round < roundsNeeded - 1) {
      const waitTime = concurrency * 1000; // 1s per concurrent vote (1s, 2s, 4s, 8s)
      console.log(`Waiting ${waitTime/1000} seconds before next round...\n`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  console.log(`\n${concurrency}-concurrent test completed: ${results.filter(r => r.success).length}/${results.length} total successful votes`);
  return results;
}

// Analyze concurrency test results
function analyzeConcurrencyResults(results, concurrency) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n=== ${concurrency}-Concurrent Write Results ===`);
  console.log(`Total vote attempts: ${results.length}`);
  console.log(`Successful votes: ${successful.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  console.log(`Failed votes: ${failed.length} (${(failed.length/results.length*100).toFixed(1)}%)`);
  
  // Declare variables outside the if block
  let avg, median, p95, p99, min, max;
  
  if (successful.length > 0) {
    const latencies = successful.map(r => r.latency);
    latencies.sort((a, b) => a - b);
    
    avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    median = latencies[Math.floor(latencies.length / 2)];
    p95 = latencies[Math.floor(latencies.length * 0.95)];
    p99 = latencies[Math.floor(latencies.length * 0.99)];
    min = Math.min(...latencies);
    max = Math.max(...latencies);
    
    console.log(`\nSuccessful Vote Latency:`);
    console.log(`Average: ${avg.toFixed(0)}ms`);
    console.log(`Median: ${median}ms`);
    console.log(`P95: ${p95}ms`);
    console.log(`P99: ${p99}ms`);
    console.log(`Range: ${min}ms - ${max}ms`);
    
    // Gas analysis
    const gasUsed = successful.filter(r => r.gasUsed).map(r => r.gasUsed);
    if (gasUsed.length > 0) {
      const avgGas = gasUsed.reduce((a, b) => a + b, 0) / gasUsed.length;
      console.log(`Average Gas: ${Math.round(avgGas).toLocaleString()}`);
    }
    
    // Round analysis
    const rounds = [...new Set(successful.map(r => r.round))];
    console.log(`\nRound Analysis:`);
    rounds.forEach(round => {
      const roundVotes = successful.filter(r => r.round === round);
      const roundAvgLatency = roundVotes.reduce((sum, r) => sum + r.latency, 0) / roundVotes.length;
      console.log(`Round ${round}: ${roundVotes.length} votes, avg ${roundAvgLatency.toFixed(0)}ms`);
    });
  }
  
  return {
    concurrency,
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate: (successful.length/results.length*100).toFixed(1),
    latencyStats: successful.length > 0 ? {
      avg: avg.toFixed(0),
      median,
      p95,
      p99,
      min,
      max
    } : null
  };
}

async function runWriteLatencyTest() {
  const alProjectAddress = '0xf19E723eCa9F627a97804B4fdC235Ce7cd2d9353';
  const concurrencyLevels = [1, 2, 4, 8]; // Different concurrent vote levels
  
  console.log('=== Pure Write Latency Testing - Concurrency Approach ===');
  console.log(`ALProject: ${alProjectAddress}`);
  console.log(`Testing concurrency levels: ${concurrencyLevels.join(', ')}`);
  console.log(`Strategy: Complete voting rounds with exactly 8 votes each time`);
  console.log(`DAL Behavior: Each vote covers ALL samples in the batch\n`);
  
  // Ensure results directory
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }
  
  const allTestResults = [];
  
  for (const concurrency of concurrencyLevels) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${concurrency} concurrent votes`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Run concurrency test (batch creation is now handled inside the function)
      const results = await testWriteConcurrencyLevels(alProjectAddress, concurrency);
      
      // Analyze results
      const analysis = analyzeConcurrencyResults(results, concurrency);
      
      // Save individual test results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const individualResultsFile = `results/write-concurrency-${concurrency}level-${timestamp}.json`;
      
      const testData = {
        testInfo: {
          testType: 'write-latency-concurrency',
          alProjectAddress,
          concurrencyLevel: concurrency,
          totalVotesPerTest: 8,
          roundsPerTest: Math.ceil(8 / concurrency),
          dalBehavior: 'vote-on-all-samples',
          timestamp: new Date().toISOString()
        },
        analysis,
        results
      };
      
      fs.writeFileSync(individualResultsFile, JSON.stringify(testData, null, 2));
      allTestResults.push(testData);
      
      console.log(`\n📁 Results saved to: ${individualResultsFile}`);
      
    } catch (error) {
      console.error(`❌ Error testing ${concurrency} concurrency:`, error.message);
    }
    
    // Delay between tests
    if (concurrency !== concurrencyLevels[concurrencyLevels.length - 1]) {
      console.log('\nWaiting 5 seconds before next concurrency test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Generate final summary
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryFile = `results/write-concurrency-summary-${timestamp}.json`;
  
  const summary = {
    testInfo: {
      testType: 'write-latency-concurrency-summary',
      alProjectAddress,
      concurrencyLevels,
      totalVotesPerTest: 8,
      dalBehavior: 'vote-on-all-samples',
      timestamp: new Date().toISOString()
    },
    tests: allTestResults.map(test => ({
      concurrencyLevel: test.testInfo.concurrencyLevel,
      roundsPerTest: test.testInfo.roundsPerTest,
      analysis: test.analysis
    }))
  };
  
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log(`\n🎯 Write latency concurrency testing completed!`);
  console.log(`📁 Summary saved to: ${summaryFile}`);
  
  // Print final comparison
  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL COMPARISON');
  console.log(`${'='.repeat(60)}`);
  
  allTestResults.forEach(test => {
    const analysis = test.analysis;
    const concurrency = test.testInfo.concurrencyLevel;
    const rounds = test.testInfo.roundsPerTest;
    
    console.log(`${concurrency} concurrent (${rounds} rounds): ${analysis.successful}/${analysis.total} success, avg ${analysis.latencyStats?.avg || 'N/A'}ms`);
  });
}

runWriteLatencyTest().catch(console.error); 