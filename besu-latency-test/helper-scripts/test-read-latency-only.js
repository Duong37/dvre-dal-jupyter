import { ContractMethodLatencyTesting } from '../src/test-scenarios/contract-method-latency.js';
import fs from 'fs';
import { ethers } from 'ethers';
import { CONFIG } from '../src/config.js';

// Helper function to create a fresh voting batch
async function createFreshBatch(alProjectAddress, batchNumber) {
  console.log(`🔄 Creating fresh voting batch ${batchNumber}...`);
  
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
  
  // End current batch if it exists
  const currentRound = await alProject.currentRound();
  const currentSamples = await alProject.getCurrentBatchSampleIds();
  
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
  
  // Create new batch
  const dalSamples = [
    `batch_${batchNumber}_sample_001`,
    `batch_${batchNumber}_sample_002`,
    `batch_${batchNumber}_sample_003`
  ];
  
  const dalDataHashes = [
    `QmBatch${batchNumber}Sample1Hash`,
    `QmBatch${batchNumber}Sample2Hash`,
    `QmBatch${batchNumber}Sample3Hash`
  ];
  
  const dalOriginalIndices = [batchNumber * 100 + 1, batchNumber * 100 + 2, batchNumber * 100 + 3];
  
  console.log(`Starting new batch: ${dalSamples.join(', ')}`);
  
  const tx = await alProject.startBatchVoting(dalSamples, dalDataHashes, dalOriginalIndices);
  await tx.wait();
  
  console.log(`✅ Fresh batch ${batchNumber} created and ready for voting!`);
  
  // Wait a moment for state to update
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return dalSamples;
}

async function runContractMethodTest() {
  const alProjectAddress = '0xf19E723eCa9F627a97804B4fdC235Ce7cd2d9353'; // Updated to current address
  const iterations = 3; // 3 iterations for read operations
  const accountCount = 8; // 8 accounts (all participants)
  const duration = 10000; // 10 seconds
  
  console.log('=== Contract Method Read Operations Testing ===');
  console.log(`ALProject: ${alProjectAddress}`);
  console.log(`Testing: ${iterations} iterations with ${accountCount} accounts`);
  console.log(`Duration: ${duration/1000} seconds each`);
  console.log(`Focus: getBatchStatus() and getVotingDistribution() - READ operations`);
  console.log('📝 Fresh voting batches will be created for each iteration\n');
  
  const contractTester = new ContractMethodLatencyTesting();
  const allResults = [];
  const testSummary = [];
  
  // Ensure results directory exists
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }
  
  for (let iteration = 1; iteration <= iterations; iteration++) {
    console.log(`\n--- Iteration ${iteration}/${iterations}: ${accountCount} accounts reading operations ---`);
    
    try {
      // Create fresh batch for this iteration
      await createFreshBatch(alProjectAddress, iteration);
      
      const results = await contractTester.runDistributedContractMethodTest(
        alProjectAddress,
        accountCount,
        duration
      );
      
      console.log(`✅ Completed iteration ${iteration} with ${accountCount} accounts - ${results.length} operations`);
      
      // Save individual iteration results
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const individualResultsFile = `results/read-operations-iteration${iteration}-${timestamp}.json`;
      
      const testData = {
        testInfo: {
          testType: 'read-operations',
          iteration: iteration,
          alProjectAddress,
          accountCount,
          duration: duration/1000,
          timestamp: new Date().toISOString()
        },
        results: results
      };
      
      fs.writeFileSync(individualResultsFile, JSON.stringify(testData, null, 2));
      allResults.push(...results);
      
      // Calculate summary for this iteration
      const successfulResults = results.filter(r => r.success);
      if (successfulResults.length > 0) {
        const latencies = successfulResults.map(r => r.latency);
        latencies.sort((a, b) => a - b);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
        const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
        
        const summary = {
          iteration: iteration,
          accountCount,
          totalOperations: results.length,
          successfulOperations: successfulResults.length,
          successRate: (successfulResults.length/results.length*100).toFixed(1),
          avgLatency: avgLatency.toFixed(0),
          p95Latency,
          p99Latency,
          timestamp: new Date().toISOString()
        };
        
        testSummary.push(summary);
        
        console.log(`Success: ${successfulResults.length}/${results.length} (${summary.successRate}%)`);
        console.log(`Avg: ${summary.avgLatency}ms, P95: ${p95Latency}ms, P99: ${p99Latency}ms`);
        console.log(`Results saved to: ${individualResultsFile}`);
      }
      
    } catch (error) {
      console.error(`❌ Error in iteration ${iteration}:`, error.message);
    }
    
    // Short delay between tests
    if (iteration !== iterations) {
      console.log('Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Generate final summary report
  console.log('\n=== Final Read Operations Test Summary ===');
  
  // Group by operation type
  const operationGroups = {};
  allResults.forEach(result => {
    if (!operationGroups[result.operation]) {
      operationGroups[result.operation] = [];
    }
    operationGroups[result.operation].push(result);
  });
  
  const finalReport = {
    testInfo: {
      testType: 'read-operations-testing',
      alProjectAddress,
      iterations: iterations,
      accountCount: accountCount,
      duration: duration/1000,
      totalOperations: allResults.length,
      timestamp: new Date().toISOString()
    },
    iterationSummary: testSummary,
    operationBreakdown: {}
  };
  
  Object.keys(operationGroups).forEach(operation => {
    const results = operationGroups[operation];
    const successful = results.filter(r => r.success);
    
    if (successful.length > 0) {
      const latencies = successful.map(r => r.latency);
      latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      const operationSummary = {
        totalCalls: results.length,
        successfulCalls: successful.length,
        successRate: (successful.length/results.length*100).toFixed(1),
        avgLatency: avg.toFixed(0),
        p95Latency: p95,
        p99Latency: p99,
        minLatency: Math.min(...latencies),
        maxLatency: Math.max(...latencies)
      };
      
      finalReport.operationBreakdown[operation] = operationSummary;
      
      console.log(`\n${operation}:`);
      console.log(`Total calls: ${operationSummary.totalCalls}`);
      console.log(`Success rate: ${operationSummary.successRate}%`);
      console.log(`Avg: ${operationSummary.avgLatency}ms, P95: ${p95}ms, P99: ${p99}ms`);
      console.log(`Range: ${operationSummary.minLatency}ms - ${operationSummary.maxLatency}ms`);
      
    }
  });
  
  // Save final comprehensive report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `results/read-operations-final-report-${timestamp}.json`;
  
  // Ensure results directory exists
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results', { recursive: true });
  }
  
  fs.writeFileSync(reportFileName, JSON.stringify(finalReport, null, 2));
  
  // Also create a CSV summary for easy analysis
  const csvFileName = `results/read-operations-summary-${timestamp}.csv`;
  const csvHeader = 'Iteration,AccountCount,TotalOps,SuccessfulOps,SuccessRate,AvgLatency,P95Latency,P99Latency\n';
  const csvData = testSummary.map(s => 
    `${s.iteration},${s.accountCount},${s.totalOperations},${s.successfulOperations},${s.successRate},${s.avgLatency},${s.p95Latency},${s.p99Latency}`
  ).join('\n');
  
  fs.writeFileSync(csvFileName, csvHeader + csvData);
  
  console.log(`\n🎯 Read operations testing completed!`);
  console.log(`📁 Results saved to:`);
  console.log(`JSON Report: ${reportFileName}`);
  console.log(`CSV Summary: ${csvFileName}`);
  console.log(`Individual iteration results also saved`);
  console.log(`\nFocus: getBatchStatus() and getVotingDistribution() read latency across 4 nodes`);
}

runContractMethodTest().catch(console.error); 