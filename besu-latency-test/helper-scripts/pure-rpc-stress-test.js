#!/usr/bin/env node

import { ethers } from 'ethers';
import { CONFIG, getAllNodeUrls, getNodeInfo } from '../src/config.js';
import { writeFileSync } from 'fs';

// Pure RPC Stress Test Configuration
const TEST_CONFIG = {
  // Concurrency levels to test
  CONCURRENCY_LEVELS: [1, 2, 4, 8, 16, 32, 64, 128],
  
  // Test duration for each concurrency level (30 seconds)
  TEST_DURATION_MS: 30 * 1000,
  
  // RPC methods to test (read-only)
  RPC_METHODS: [
    {
      name: 'eth_blockNumber',
      method: async (provider) => await provider.getBlockNumber(),
      weight: 40 // Most frequent - UI polling
    },
    {
      name: 'eth_getBlockByNumber',
      method: async (provider) => await provider.getBlock('latest', false),
      weight: 25 // Frequent - block data retrieval
    },
    {
      name: 'eth_getBlockByNumber_withTx',
      method: async (provider) => await provider.getBlock('latest', true),
      weight: 15 // Moderate - heavier block data
    },
    {
      name: 'eth_getLogs',
      method: async (provider) => {
        const latest = await provider.getBlockNumber();
        return await provider.getLogs({
          fromBlock: Math.max(0, latest - 10),
          toBlock: latest
        });
      },
      weight: 10 // Moderate - event monitoring
    },
    {
      name: 'eth_call_simple',
      method: async (provider) => {
        // Simple eth_call to get chain ID (view function equivalent)
        return await provider.getNetwork();
      },
      weight: 10 // Occasional - network info
    }
  ]
};

class PureRPCStressTester {
  constructor() {
    this.results = [];
    this.providers = [];
    
    // Initialize providers for all nodes
    getAllNodeUrls().forEach(url => {
      this.providers.push({
        url,
        provider: new ethers.JsonRpcProvider(url),
        nodeInfo: getNodeInfo(url)
      });
    });
  }

  // Generate weighted random RPC method selection
  selectRandomMethod() {
    const totalWeight = TEST_CONFIG.RPC_METHODS.reduce((sum, method) => sum + method.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    for (const method of TEST_CONFIG.RPC_METHODS) {
      cumulativeWeight += method.weight;
      if (random <= cumulativeWeight) {
        return method;
      }
    }
    
    return TEST_CONFIG.RPC_METHODS[0]; // Fallback
  }

  // Single client worker that sends RPC requests continuously
  async runClientWorker(clientId, concurrency, duration, nodeProvider) {
    const results = [];
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    console.log(`Client ${clientId}: Starting on ${nodeProvider.nodeInfo.name}`);
    
    while (Date.now() < endTime) {
      const method = this.selectRandomMethod();
      const requestStart = Date.now();
      
      try {
        await method.method(nodeProvider.provider);
        const latency = Date.now() - requestStart;
        
        results.push({
          clientId,
          concurrency,
          method: method.name,
          latency,
          success: true,
          timestamp: requestStart,
          node: nodeProvider.nodeInfo.name
        });
        
      } catch (error) {
        const latency = Date.now() - requestStart;
        
        results.push({
          clientId,
          concurrency,
          method: method.name,
          latency,
          success: false,
          error: error.message,
          timestamp: requestStart,
          node: nodeProvider.nodeInfo.name
        });
      }
      
      // Small delay to prevent overwhelming (but still stress testing)
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`Client ${clientId}: Completed ${results.length} requests`);
    return results;
  }

  // Test a specific concurrency level
  async testConcurrencyLevel(concurrency) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TESTING CONCURRENCY LEVEL: ${concurrency} clients`);
    console.log(`Duration: ${TEST_CONFIG.TEST_DURATION_MS / 1000} seconds`);
    console.log(`${'='.repeat(80)}`);
    
    // Distribute clients evenly across nodes
    const clientPromises = [];
    
    for (let i = 0; i < concurrency; i++) {
      const nodeIndex = i % this.providers.length;
      const nodeProvider = this.providers[nodeIndex];
      
      const clientPromise = this.runClientWorker(
        i + 1,
        concurrency,
        TEST_CONFIG.TEST_DURATION_MS,
        nodeProvider
      );
      
      clientPromises.push(clientPromise);
    }
    
    console.log(`Starting ${concurrency} concurrent clients across ${this.providers.length} nodes...`);
    
    // Run all clients in parallel
    const allResults = await Promise.all(clientPromises);
    
    // Flatten results
    const flatResults = allResults.flat();
    
    console.log(`Completed: ${flatResults.length} total requests across ${concurrency} clients`);
    
    // Calculate metrics for this concurrency level
    this.calculateAndStoreMetrics(concurrency, flatResults);
    
    return flatResults;
  }

  // Calculate p50, p95, p99, error rate for each method
  calculateAndStoreMetrics(concurrency, results) {
    const methodGroups = {};
    
    // Group results by method
    results.forEach(result => {
      if (!methodGroups[result.method]) {
        methodGroups[result.method] = [];
      }
      methodGroups[result.method].push(result);
    });
    
    // Calculate metrics for each method
    Object.keys(methodGroups).forEach(methodName => {
      const methodResults = methodGroups[methodName];
      const successfulResults = methodResults.filter(r => r.success);
      const totalRequests = methodResults.length;
      const successfulRequests = successfulResults.length;
      const errorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
      
      if (successfulResults.length > 0) {
        const latencies = successfulResults.map(r => r.latency).sort((a, b) => a - b);
        
        const p50 = this.calculatePercentile(latencies, 0.50);
        const p95 = this.calculatePercentile(latencies, 0.95);
        const p99 = this.calculatePercentile(latencies, 0.99);
        const min = Math.min(...latencies);
        const max = Math.max(...latencies);
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        
        this.results.push({
          concurrency,
          method: methodName,
          totalRequests,
          successfulRequests,
          errorRate: parseFloat(errorRate.toFixed(2)),
          p50: Math.round(p50),
          p95: Math.round(p95),
          p99: Math.round(p99),
          min: Math.round(min),
          max: Math.round(max),
          avg: Math.round(avg)
        });
        
        console.log(`${methodName}: ${successfulRequests}/${totalRequests} (${(100-errorRate).toFixed(1)}% success) - P50: ${Math.round(p50)}ms, P95: ${Math.round(p95)}ms, P99: ${Math.round(p99)}ms`);
      } else {
        this.results.push({
          concurrency,
          method: methodName,
          totalRequests,
          successfulRequests: 0,
          errorRate: 100,
          p50: null,
          p95: null,
          p99: null,
          min: null,
          max: null,
          avg: null
        });
        
        console.log(`${methodName}: 0/${totalRequests} (0% success) - ALL FAILED`);
      }
    });
  }

  // Calculate percentile value
  calculatePercentile(sortedArray, percentile) {
    const index = percentile * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  // Run the complete stress test
  async runCompleteStressTest() {
    console.log('Pure JSON-RPC Stress Test');
    console.log('=========================');
    console.log(`Node URLs: ${getAllNodeUrls().join(', ')}`);
    console.log(`Concurrency levels: ${TEST_CONFIG.CONCURRENCY_LEVELS.join(', ')}`);
    console.log(`Test duration per level: ${TEST_CONFIG.TEST_DURATION_MS / 1000} seconds`);
    console.log(`RPC methods: ${TEST_CONFIG.RPC_METHODS.map(m => m.name).join(', ')}`);
    
    const overallStartTime = Date.now();
    
    // Test each concurrency level
    for (const concurrency of TEST_CONFIG.CONCURRENCY_LEVELS) {
      await this.testConcurrencyLevel(concurrency);
      
      // Short break between concurrency levels
      if (concurrency !== TEST_CONFIG.CONCURRENCY_LEVELS[TEST_CONFIG.CONCURRENCY_LEVELS.length - 1]) {
        console.log('Waiting 5 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    const overallDuration = Date.now() - overallStartTime;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`STRESS TEST COMPLETED in ${(overallDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log(`${'='.repeat(80)}`);
    
    this.saveResults();
    this.analyzeResults();
  }

  // Save results to files
  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save detailed JSON
    const jsonFile = `rpc-stress-test-results/pure-rpc-stress-results-${timestamp}.json`;
    writeFileSync(jsonFile, JSON.stringify(this.results, null, 2));
    
    // Save CSV for easy analysis
    const csvFile = `rpc-stress-test-results/pure-rpc-stress-results-${timestamp}.csv`;
    const csvHeader = 'Concurrency,Method,TotalRequests,SuccessfulRequests,ErrorRate,P50,P95,P99,Min,Max,Avg\n';
    const csvRows = this.results.map(r => 
      `${r.concurrency},${r.method},${r.totalRequests},${r.successfulRequests},${r.errorRate},${r.p50},${r.p95},${r.p99},${r.min},${r.max},${r.avg}`
    ).join('\n');
    writeFileSync(csvFile, csvHeader + csvRows);
    
    console.log(`\nResults saved:`);
    console.log(`JSON: ${jsonFile}`);
    console.log(`CSV: ${csvFile}`);
  }

  // Analyze results and identify concurrency thresholds
  analyzeResults() {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE ANALYSIS');
    console.log('='.repeat(80));
    
    // Group by method for analysis
    const methodGroups = {};
    this.results.forEach(result => {
      if (!methodGroups[result.method]) {
        methodGroups[result.method] = [];
      }
      methodGroups[result.method].push(result);
    });
    
    Object.keys(methodGroups).forEach(methodName => {
      console.log(`\n${methodName}:`);
      console.log('Concurrency | P50ms | P95ms | P99ms | Error% | Requests');
      console.log('------------|-------|-------|-------|--------|----------');
      
      const methodResults = methodGroups[methodName].sort((a, b) => a.concurrency - b.concurrency);
      
      methodResults.forEach(result => {
        const p50 = result.p50 !== null ? result.p50.toString().padStart(5) : '  N/A';
        const p95 = result.p95 !== null ? result.p95.toString().padStart(5) : '  N/A';
        const p99 = result.p99 !== null ? result.p99.toString().padStart(5) : '  N/A';
        const errorRate = result.errorRate.toString().padStart(6);
        const requests = result.totalRequests.toString().padStart(8);
        
        console.log(`${result.concurrency.toString().padStart(11)} | ${p50} | ${p95} | ${p99} | ${errorRate} | ${requests}`);
      });
      
      // Identify performance degradation points
      this.identifyPerformanceThresholds(methodName, methodResults);
    });
  }

  // Identify where performance degrades significantly
  identifyPerformanceThresholds(methodName, methodResults) {
    const validResults = methodResults.filter(r => r.p95 !== null);
    
    if (validResults.length < 2) return;
    
    // Find where P95 latency doubles or error rate exceeds 5%
    for (let i = 1; i < validResults.length; i++) {
      const prev = validResults[i - 1];
      const current = validResults[i];
      
      const latencyIncrease = current.p95 / prev.p95;
      const errorRateThreshold = current.errorRate > 5;
      
      if (latencyIncrease > 2.0 || errorRateThreshold) {
        console.log(`⚠️  Performance degradation at ${current.concurrency} clients:`);
        if (latencyIncrease > 2.0) {
          console.log(`P95 latency increased ${latencyIncrease.toFixed(1)}x (${prev.p95}ms → ${current.p95}ms)`);
        }
        if (errorRateThreshold) {
          console.log(`Error rate: ${current.errorRate}%`);
        }
        break;
      }
    }
  }
}

// Run the stress test
async function main() {
  const tester = new PureRPCStressTester();
  await tester.runCompleteStressTest();
}

main().catch(error => {
  console.error('Stress test failed:', error);
  process.exit(1);
}); 