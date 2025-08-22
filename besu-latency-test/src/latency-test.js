#!/usr/bin/env node

import { ethers } from 'ethers';
import { Command } from 'commander';
import { CONFIG, getAllNodeUrls, getNodeInfo } from './config.js';
import { LatencyTracker } from './utils/latency-tracker.js';
import { ResultsLogger } from './utils/results-logger.js';
import { DALWorkflowTester } from './test-scenarios/dal-workflow.js';
import { RPCLatencySimulation } from './test-scenarios/rpc-latency-simulation.js';
import { ContractMethodLatencyTesting } from './test-scenarios/contract-method-latency.js';
import { setupALProjectForTesting, checkALProjectStatus } from '../setup-al-project.js';
import { writeFileSync } from 'fs';

const program = new Command();

program
  .name('besu-dal-latency-test')
  .description('Latency testing for DAL on Hyperledger Besu')
  .version('1.0.0');

program
  .option('-u, --rpc-url <url>', 'Besu RPC URL', CONFIG.RPC_URL)
  .option('-f, --factory <address>', 'ProjectFactory contract address')
  .option('-p, --project <address>', 'ALProject contract address for contract method testing')
  .option('-a, --accounts <number>', 'Number of concurrent accounts (1,2,4,8,16,32,64,128)', '1,2,4,8,16,32,64,128')
  .option('-d, --duration <seconds>', 'Test duration in seconds', '10')
  .option('--test-type <type>', 'Test type: simple, workflow, load, voting, vote-submission, read-only, mixed, or contract-methods', 'voting')
  .option('--voting-duration <seconds>', 'Duration for voting simulation (seconds)', '30')
  .option('--vote-submissions <number>', 'Number of vote submissions per account in vote-submission test', '5')
  .option('--distributed', 'Distribute users evenly across multiple nodes')
  .option('--node-comparison', 'Test all configured nodes individually')
  .option('--list-nodes', 'List all configured Besu nodes')
  .option('--list-results', 'List all saved test results')
  .option('--setup-al-project', 'Set up ALProject for contract method testing')
  .option('--check-al-status', 'Check ALProject status for contract testing')
  .parse();

const options = program.opts();

// Add AL project setup functionality
if (options.setupAlProject) {
  console.log('Setting up ALProject for contract method testing...');
  const result = await setupALProjectForTesting();
  if (result) {
    console.log('\nSetup successful! Use this ALProject address for testing:');
    console.log(`--project ${result.alProjectAddress}`);
  }
  process.exit(result ? 0 : 1);
}

if (options.checkAlStatus) {
  if (!options.project) {
    console.error('Please provide ALProject address with --project <address>');
    process.exit(1);
  }
  
  console.log('Checking ALProject status...');
  const status = await checkALProjectStatus(options.project);
  if (status) {
    console.log(status.ready ? '\n✅ ALProject is ready for contract method testing!' : '\n❌ ALProject needs setup');
  }
  process.exit(status ? 0 : 1);
}

// List results if requested
if (options.listResults) {
  const resultsLogger = new ResultsLogger();
  const results = resultsLogger.listResults();
  
  console.log('Saved Test Results:');
  console.log('==================');
  if (results.length === 0) {
    console.log('No test results found.');
  } else {
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testId}`);
      console.log(`Type: ${result.testType}`);
      console.log(`Date: ${new Date(result.timestamp).toLocaleDateString()} ${new Date(result.timestamp).toLocaleTimeString()}`);
      console.log(`Description: ${result.description}`);
      console.log('');
    });
  }
  process.exit(0);
}

// List nodes if requested
if (options.listNodes) {
  console.log('Available Besu Nodes:');
  console.log('====================');
  Object.entries(CONFIG.BESU_NODES).forEach(([key, node]) => {
    console.log(`${key}: ${node.name} - ${node.url} (${node.location})`);
  });
  process.exit(0);
}

// Generate test accounts with node distribution
function generateTestAccountsWithNodes(count) {
  const accounts = [];
  const nodeUrls = getAllNodeUrls();
  
  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom();
    
    // Distribute users evenly across nodes
    const nodeIndex = i % nodeUrls.length;
    const nodeUrl = nodeUrls[nodeIndex];
    const nodeInfo = getNodeInfo(nodeUrl);
    
    accounts.push({
      id: `account_${i}`,
      wallet,
      address: wallet.address,
      privateKey: wallet.privateKey,
      nodeUrl,
      nodeInfo
    });
  }
  return accounts;
}

// Generate test accounts (legacy single node)
function generateTestAccounts(count) {
  const accounts = [];
  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom();
    accounts.push({
      id: `account_${i}`,
      wallet,
      address: wallet.address,
      privateKey: wallet.privateKey
    });
  }
  return accounts;
}

// Test network connectivity
async function testNodeConnectivity(rpcUrl) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    return {
      success: true,
      chainId: network.chainId.toString(),
      blockNumber,
      latency: null // We'll measure this separately
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      chainId: null,
      blockNumber: null,
      latency: null
    };
  }
}

// Measure basic RPC latency
async function measureRPCLatency(rpcUrl, iterations = 5) {
  const latencies = [];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      await provider.getBlockNumber();
      const latency = Date.now() - start;
      latencies.push(latency);
    } catch (error) {
      // Skip failed requests
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (latencies.length === 0) return null;
  
  return {
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    measurements: latencies.length
  };
}

// Run simple transaction latency test (basic transfers)
async function runSimpleLatencyTest(provider, accounts, latencyTracker, nodeInfo = null) {
  console.log('Running simple transaction latency test...');
  
  const promises = accounts.map(async (account, index) => {
    const wallet = account.wallet.connect(provider);
    const concurrentAccounts = accounts.length;
    
    for (let i = 0; i < parseInt(options.operations); i++) {
      const timingId = latencyTracker.startTiming(
        'simple_transfer', 
        account.id, 
        { concurrentAccounts, operation: i, node: nodeInfo?.name }
      );

      try {
        // Simple transfer to test basic network latency
        const targetAccount = accounts[(index + 1) % accounts.length];
        
        const tx = await wallet.sendTransaction({
          to: targetAccount.address,
          value: ethers.parseEther('0.001'), // Small amount
          gasLimit: 21000,
          gasPrice: CONFIG.TEST_PARAMS.GAS_PRICE
        });
        
        await tx.wait();
        latencyTracker.endTiming(timingId, true);
        
      } catch (error) {
        latencyTracker.endTiming(timingId, false, error.message);
        console.error(`Account ${account.id}: Simple transfer failed:`, error.message);
      }
      
      // Delay between operations
      if (i < parseInt(options.operations) - 1) {
        await new Promise(resolve => setTimeout(resolve, parseInt(options.delay)));
      }
    }
  });

  await Promise.all(promises);
}

// Run DAL workflow latency test
async function runDALWorkflowTest(provider, accounts, latencyTracker, nodeInfo = null) {
  console.log('Running DAL workflow latency test...');
  
  const workflowTester = new DALWorkflowTester(provider, latencyTracker);
  await workflowTester.initialize();
  
  const promises = accounts.map(async (account) => {
    const wallet = account.wallet.connect(provider);
    const concurrentAccounts = accounts.length;
    
    if (options.testType === 'workflow') {
      await workflowTester.runCompleteWorkflow(wallet, account.id, concurrentAccounts);
    } else if (options.testType === 'load') {
      await workflowTester.runLoadTest(wallet, account.id, concurrentAccounts, parseInt(options.operations));
    }
  });

  await Promise.all(promises);
}

// Run realistic voting/collaboration simulation test
async function runVotingSimulationTest(provider, accounts, latencyTracker, nodeInfo = null) {
  console.log('Running realistic collaboration simulation...');
  console.log('This simulates actual RPC calls users make during active voting rounds');
  
  const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
  const votingDuration = parseInt(options.votingDuration) * 1000; // Convert to milliseconds
  
  // Run realistic RPC activity session
  await rpcSimulation.runRealisticVotingSession(accounts, votingDuration, nodeInfo);
}

// NEW: Run vote submission test (write-focused)
async function runVoteSubmissionTest(provider, accounts, latencyTracker, nodeInfo = null) {
  console.log('Running write-focused vote submission testing...');
  console.log('This measures actual vote submission → confirmation → event retrieval latency');
  
  const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
  const submissionCount = parseInt(options.voteSubmissions);
  
  // Run vote submission session
  await rpcSimulation.runVoteSubmissionSession(accounts, submissionCount, nodeInfo);
}

// NEW: Run read-only RPC test (client-perceived JSON-RPC latency)
async function runReadOnlyTest(provider, accounts, latencyTracker, nodeInfo = null) {
  console.log('Running read-only RPC latency testing...');
  console.log('This measures client-perceived JSON-RPC latency for blockchain application responsiveness');
  
  const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
  const sessionDuration = parseInt(options.votingDuration) * 1000; // Convert to milliseconds
  
  // Run read-only sessions for each account
  const promises = accounts.map(async (account) => {
    return await rpcSimulation.runReadOnlySession(account.id, accounts.length, nodeInfo, sessionDuration);
  });
  
  await Promise.all(promises);
}

// NEW: Run mixed realistic test (85% read, 15% write)
async function runMixedRealisticTest(provider, accounts, latencyTracker, nodeInfo = null) {
  console.log('Running mixed realistic DAL collaboration simulation...');
  console.log('This simulates 85% read operations and 15% write operations during active collaboration');
  
  const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
  const sessionDuration = parseInt(options.votingDuration) * 1000; // Convert to milliseconds
  
  // Run mixed realistic session
  await rpcSimulation.runMixedRealisticSession(accounts, sessionDuration, nodeInfo);
}

// Run distributed voting simulation across multiple nodes
async function runDistributedVotingSimulation(accounts, latencyTracker) {
  console.log('Running distributed collaboration simulation across multiple nodes...');
  console.log('Users are distributed evenly across all available Besu nodes');
  
  const votingDuration = parseInt(options.votingDuration) * 1000;
  
  // Group accounts by node
  const nodeGroups = {};
  accounts.forEach(account => {
    if (!nodeGroups[account.nodeUrl]) {
      nodeGroups[account.nodeUrl] = [];
    }
    nodeGroups[account.nodeUrl].push(account);
  });
  
  console.log('\nUser distribution across nodes:');
  Object.entries(nodeGroups).forEach(([nodeUrl, nodeAccounts]) => {
    const nodeInfo = getNodeInfo(nodeUrl);
    console.log(`${nodeInfo.name}: ${nodeAccounts.length} users`);
    nodeAccounts.forEach(account => {
      console.log(`${account.id}: ${account.address}`);
    });
  });
  
  // Run simulation on each node in parallel
  const promises = Object.entries(nodeGroups).map(async ([nodeUrl, nodeAccounts]) => {
    const provider = new ethers.JsonRpcProvider(nodeUrl);
    const nodeInfo = getNodeInfo(nodeUrl);
    
    console.log(`\nStarting simulation on ${nodeInfo.name} with ${nodeAccounts.length} users...`);
    
    const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
    await rpcSimulation.runRealisticVotingSession(nodeAccounts, votingDuration, nodeInfo);
  });
  
  await Promise.all(promises);
  console.log('\n[*] Distributed simulation completed across all nodes');
}

// NEW: Run distributed vote submission simulation across multiple nodes
async function runDistributedVoteSubmissionSimulation(accounts, latencyTracker) {
  console.log('Running distributed vote submission simulation across multiple nodes...');
  console.log('Users are distributed evenly across all available Besu nodes');
  
  const submissionCount = parseInt(options.voteSubmissions);
  
  // Group accounts by node
  const nodeGroups = {};
  accounts.forEach(account => {
    if (!nodeGroups[account.nodeUrl]) {
      nodeGroups[account.nodeUrl] = [];
    }
    nodeGroups[account.nodeUrl].push(account);
  });
  
  console.log('\nUser distribution across nodes:');
  Object.entries(nodeGroups).forEach(([nodeUrl, nodeAccounts]) => {
    const nodeInfo = getNodeInfo(nodeUrl);
    console.log(`${nodeInfo.name}: ${nodeAccounts.length} users`);
    nodeAccounts.forEach(account => {
      console.log(`${account.id}: ${account.address}`);
    });
  });
  
  // Run simulation on each node in parallel
  const promises = Object.entries(nodeGroups).map(async ([nodeUrl, nodeAccounts]) => {
    const provider = new ethers.JsonRpcProvider(nodeUrl);
    const nodeInfo = getNodeInfo(nodeUrl);
    
    console.log(`\nStarting simulation on ${nodeInfo.name} with ${nodeAccounts.length} users...`);
    
    const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
    await rpcSimulation.runVoteSubmissionSession(nodeAccounts, submissionCount, nodeInfo);
  });
  
  await Promise.all(promises);
  console.log('\n[*] Distributed vote submission simulation completed across all nodes');
}

// NEW: Run distributed read-only simulation across multiple nodes
async function runDistributedReadOnlySimulation(accounts, latencyTracker) {
  console.log('Running distributed read-only RPC testing across multiple nodes...');
  console.log('Users are distributed evenly across all available Besu nodes');
  console.log('Focus: Client-perceived JSON-RPC latency measurement');
  
  const sessionDuration = parseInt(options.votingDuration) * 1000;
  
  // Group accounts by node
  const nodeGroups = {};
  accounts.forEach(account => {
    if (!nodeGroups[account.nodeUrl]) {
      nodeGroups[account.nodeUrl] = [];
    }
    nodeGroups[account.nodeUrl].push(account);
  });
  
  console.log('\nUser distribution across nodes:');
  Object.entries(nodeGroups).forEach(([nodeUrl, nodeAccounts]) => {
    const nodeInfo = getNodeInfo(nodeUrl);
    console.log(`${nodeInfo.name}: ${nodeAccounts.length} users`);
    nodeAccounts.forEach(account => {
      console.log(`${account.id}: ${account.address}`);
    });
  });
  
  // Run simulation on each node in parallel
  const promises = Object.entries(nodeGroups).map(async ([nodeUrl, nodeAccounts]) => {
    const provider = new ethers.JsonRpcProvider(nodeUrl);
    const nodeInfo = getNodeInfo(nodeUrl);
    const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
    
    console.log(`\nStarting read-only simulation on ${nodeInfo.name} with ${nodeAccounts.length} users...`);
    
    // Run read-only sessions for each account on this node
    const accountPromises = nodeAccounts.map(async (account) => {
      return await rpcSimulation.runReadOnlySession(account.id, accounts.length, nodeInfo, sessionDuration);
    });
    
    await Promise.all(accountPromises);
  });
  
  await Promise.all(promises);
  console.log('\n[*] Distributed read-only simulation completed across all nodes');
}

// NEW: Run distributed mixed realistic simulation across multiple nodes
async function runDistributedMixedSimulation(accounts, latencyTracker) {
  console.log('Running distributed mixed realistic simulation across multiple nodes...');
  console.log('Users are distributed evenly across all available Besu nodes');
  console.log('Mix: 85% read operations, 15% write operations');
  
  const sessionDuration = parseInt(options.votingDuration) * 1000;
  
  // Group accounts by node
  const nodeGroups = {};
  accounts.forEach(account => {
    if (!nodeGroups[account.nodeUrl]) {
      nodeGroups[account.nodeUrl] = [];
    }
    nodeGroups[account.nodeUrl].push(account);
  });
  
  console.log('\nUser distribution across nodes:');
  Object.entries(nodeGroups).forEach(([nodeUrl, nodeAccounts]) => {
    const nodeInfo = getNodeInfo(nodeUrl);
    console.log(`${nodeInfo.name}: ${nodeAccounts.length} users`);
    nodeAccounts.forEach(account => {
      console.log(`${account.id}: ${account.address}`);
    });
  });
  
  // Run simulation on each node in parallel
  const promises = Object.entries(nodeGroups).map(async ([nodeUrl, nodeAccounts]) => {
    const provider = new ethers.JsonRpcProvider(nodeUrl);
    const nodeInfo = getNodeInfo(nodeUrl);
    
    console.log(`\nStarting mixed simulation on ${nodeInfo.name} with ${nodeAccounts.length} users...`);
    
    const rpcSimulation = new RPCLatencySimulation(provider, latencyTracker);
    await rpcSimulation.runMixedRealisticSession(nodeAccounts, sessionDuration, nodeInfo);
  });
  
  await Promise.all(promises);
  console.log('\n[*] Distributed mixed realistic simulation completed across all nodes');
}

// Test with different numbers of concurrent accounts
async function runConcurrencyTest(provider, latencyTracker, nodeInfo = null) {
  const accountCounts = options.accounts.split(',').map(n => parseInt(n.trim()));
  
  console.log(`Testing with account counts: ${accountCounts.join(', ')}`);
  if (nodeInfo) {
    console.log(`Testing on: ${nodeInfo.name}`);
  }
  
  for (const accountCount of accountCounts) {
    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Testing with ${accountCount} concurrent account(s)`);
    if (nodeInfo) {
      console.log(`Node: ${nodeInfo.name} (${nodeInfo.url})`);
    }
    console.log(`${'-'.repeat(60)}`);
    
    const accounts = generateTestAccounts(accountCount);
    
    console.log('Generated test accounts:');
    accounts.forEach(account => {
      console.log(`${account.id}: ${account.address}`);
    });
    
    // Fund accounts if needed (for simple tests)
    if (options.testType === 'simple') {
      console.log('\nNote: Assuming accounts are pre-funded or gas price is 0');
    }
    
    const startTime = Date.now();
    
    try {
      if (options.testType === 'simple') {
        await runSimpleLatencyTest(provider, accounts, latencyTracker, nodeInfo);
      } else if (options.testType === 'voting') {
        await runVotingSimulationTest(provider, accounts, latencyTracker, nodeInfo);
      } else if (options.testType === 'vote-submission') {
        await runVoteSubmissionTest(provider, accounts, latencyTracker, nodeInfo);
      } else if (options.testType === 'read-only') {
        await runReadOnlyTest(provider, accounts, latencyTracker, nodeInfo);
      } else if (options.testType === 'mixed') {
        await runMixedRealisticTest(provider, accounts, latencyTracker, nodeInfo);
      } else if (options.testType === 'contract-methods') {
        // Contract method testing is handled differently - call runContractMethodTest directly
        console.log('Contract method testing should be called directly, not through runConcurrencyTest');
        return;
      } else {
        await runDALWorkflowTest(provider, accounts, latencyTracker, nodeInfo);
      }
      
      const duration = Date.now() - startTime;
      console.log(`\nCompleted ${accountCount} account test in ${(duration / 1000).toFixed(2)}s`);
      
    } catch (error) {
      console.error(`\nFailed ${accountCount} account test:`, error.message);
    }
    
    // Small break between different concurrency levels
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Test with distributed users across nodes
async function runDistributedConcurrencyTest(latencyTracker) {
  const accountCounts = options.accounts.split(',').map(n => parseInt(n.trim()));
  
  console.log(`Testing with distributed account counts: ${accountCounts.join(', ')}`);
  console.log('Users will be distributed evenly across all available nodes');
  
  for (const accountCount of accountCounts) {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`Testing with ${accountCount} concurrent user(s) distributed across nodes`);
    console.log(`${'-'.repeat(80)}`);
    
    const accounts = generateTestAccountsWithNodes(accountCount);
    
    const startTime = Date.now();
    
    try {
      if (options.testType === 'voting') {
        await runDistributedVotingSimulation(accounts, latencyTracker);
      } else if (options.testType === 'vote-submission') {
        await runDistributedVoteSubmissionSimulation(accounts, latencyTracker);
      } else if (options.testType === 'read-only') {
        await runDistributedReadOnlySimulation(accounts, latencyTracker);
      } else if (options.testType === 'mixed') {
        await runDistributedMixedSimulation(accounts, latencyTracker);
      } else {
        console.log('Note: Distributed testing currently only supports voting, vote-submission, read-only, and mixed simulation');
        // For other test types, fall back to single node
        const provider = new ethers.JsonRpcProvider(options.rpcUrl);
        if (options.testType === 'simple') {
          await runSimpleLatencyTest(provider, accounts, latencyTracker);
        } else {
          await runDALWorkflowTest(provider, accounts, latencyTracker);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`\nCompleted ${accountCount} distributed account test in ${(duration / 1000).toFixed(2)}s`);
      
    } catch (error) {
      console.error(`\nFailed ${accountCount} distributed account test:`, error.message);
    }
    
    // Small break between different concurrency levels
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// Run node comparison tests
async function runNodeComparison(latencyTracker) {
  console.log('\n' + '-'.repeat(80));
  console.log('NODE COMPARISON TEST');
  console.log('-'.repeat(80));
  
  const nodeUrls = getAllNodeUrls();
  const nodeResults = {};
  
  // First, test basic connectivity and RPC latency
  console.log('\nTesting node connectivity and basic RPC latency...\n');
  
  for (const url of nodeUrls) {
    const nodeInfo = getNodeInfo(url);
    console.log(`Testing ${nodeInfo.name} (${url}):`);
    
    // Test connectivity
    const connectivity = await testNodeConnectivity(url);
    if (connectivity.success) {
      console.log(`[+] Connected - Chain ID: ${connectivity.chainId}, Block: ${connectivity.blockNumber}`);
      
      // Measure RPC latency
      const rpcLatency = await measureRPCLatency(url);
      if (rpcLatency) {
        console.log(`[*] RPC Latency: avg=${rpcLatency.avg.toFixed(0)}ms, min=${rpcLatency.min}ms, max=${rpcLatency.max}ms`);
      }
      
      // Store results
      nodeResults[nodeInfo.name] = {
        connectivity,
        rpcLatency
      };
    } else {
      console.log(`[-] Failed: ${connectivity.error}`);
      nodeResults[nodeInfo.name] = {
        connectivity,
        rpcLatency: null
      };
      continue;
    }
    
    console.log('');
  }
  
  // Now run full tests on each working node
  console.log('\nRunning full latency tests on each node...\n');
  
  for (const url of nodeUrls) {
    const nodeInfo = getNodeInfo(url);
    
    // Test connectivity first
    const connectivity = await testNodeConnectivity(url);
    if (!connectivity.success) {
      console.log(`>> Skipping ${nodeInfo.name} - not accessible`);
      continue;
    }
    
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`TESTING NODE: ${nodeInfo.name} (${nodeInfo.location})`);
    console.log(`URL: ${url}`);
    console.log(`${'-'.repeat(80)}`);
    
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await runConcurrencyTest(provider, latencyTracker, nodeInfo);
    } catch (error) {
      console.error(`Failed to test ${nodeInfo.name}:`, error.message);
    }
    
    // Break between nodes
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return nodeResults;
}

// Add contract method testing to the main test routing
async function main() {
  console.log('Besu DAL Latency Testing Tool');
  console.log('==============================');
  
  // Update config with command line options
  if (options.factory) {
    CONFIG.CONTRACTS.PROJECT_FACTORY = options.factory;
  }
  
  // Create test configuration object for logging
  const testConfig = {
    testType: options.testType,
    accounts: options.accounts,
    operations: options.operations,
    delay: options.delay,
    votingDuration: options.votingDuration,
    voteSubmissions: options.voteSubmissions,
    nodeComparison: options.nodeComparison,
    distributed: options.distributed,
    rpcUrl: options.rpcUrl,
    factory: options.factory
  };
  
  console.log(`\nConfiguration:`);
  if (options.nodeComparison) {
    console.log(`Mode: Node Comparison (testing all ${Object.keys(CONFIG.BESU_NODES).length} nodes)`);
  } else if (options.distributed) {
    console.log(`Mode: Distributed Testing (users spread across ${Object.keys(CONFIG.BESU_NODES).length} nodes)`);
  } else {
    console.log(`RPC URL: ${options.rpcUrl}`);
  }
  console.log(`Test Type: ${options.testType}`);
  console.log(`Account Counts: ${options.accounts}`);
  console.log(`Operations per Account: ${options.operations}`);
  console.log(`Operation Delay: ${options.delay}ms`);
  
  if (options.testType === 'voting') {
    console.log(`Collaboration Session Duration: ${options.votingDuration}s`);
    console.log(`[NOTE] This test simulates realistic RPC calls during active collaboration`);
  }
  
  if (options.factory) {
    console.log(`ProjectFactory Address: ${options.factory}`);
  }
  
  // Initialize latency tracker and results logger
  const latencyTracker = new LatencyTracker();
  const resultsLogger = new ResultsLogger();
  
  // Run tests
  const overallStartTime = Date.now();
  let nodeResults = {};
  
  try {
    if (options.nodeComparison) {
      nodeResults = await runNodeComparison(latencyTracker);
    } else if (options.distributed) {
      await runDistributedConcurrencyTest(latencyTracker);
    } else if (options.testType === 'contract-methods') {
      // Contract method testing requires special handling
      if (!options.project) {
        console.error('\nError: Contract method testing requires --project <ALProject-address>');
        console.error('Use --setup-al-project to set up an ALProject first');
        process.exit(1);
      }
      await runContractMethodTest();
      return; // Exit early as contract method testing handles its own reporting
    } else {
      // Single node testing
      const provider = new ethers.JsonRpcProvider(options.rpcUrl);
      
      // Test connection
      try {
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
        
        const blockNumber = await provider.getBlockNumber();
        console.log(`Current block: ${blockNumber}`);
        
      } catch (error) {
        console.error('Failed to connect to Besu network:', error.message);
        process.exit(1);
      }
      
      // Validate requirements for DAL tests
      if (['workflow', 'load'].includes(options.testType) && !CONFIG.CONTRACTS.PROJECT_FACTORY) {
        console.error('\nError: ProjectFactory address is required for DAL workflow tests');
        console.error('Use --factory <address> or set PROJECT_FACTORY_ADDRESS environment variable');
        process.exit(1);
      }
      
      await runConcurrencyTest(provider, latencyTracker);
    }
    
    const overallDuration = Date.now() - overallStartTime;
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`All tests completed in ${(overallDuration / 1000).toFixed(2)}s`);
    
    // Generate and display report
    const report = latencyTracker.printReport();
    
    // Save results with comprehensive logging
    const csvData = latencyTracker.exportCSV();
    let savedResults;
    
    if (options.nodeComparison) {
      savedResults = resultsLogger.saveNodeComparisonResults(testConfig, report, nodeResults);
    } else {
      savedResults = resultsLogger.saveTestResults(testConfig, report, csvData);
    }
    
    console.log(`\n[>] Results saved with ID: ${savedResults.testId}`);
    console.log(`[>] Files created:`);
    Object.entries(savedResults.files).forEach(([type, path]) => {
      if (path) {
        console.log(`${type}: ${path}`);
      }
    });
    
    // Also save to legacy output if requested
    if (options.output) {
      writeFileSync(options.output, csvData);
      console.log(`\nLegacy CSV also exported to: ${options.output}`);
    }
    
    console.log(`\n[!] Use --list-results to see all saved test results`);
    
  } catch (error) {
    console.error('\nTest execution failed:', error.message);
    process.exit(1);
  }
}

// Add contract method test function
async function runContractMethodTest() {
  console.log('\n=== Contract Method Latency Testing ===');
  
  // Check ALProject status first
  const status = await checkALProjectStatus(options.project);
  if (!status || !status.ready) {
    console.error('❌ ALProject is not ready for testing');
    console.log('Use --setup-al-project to prepare the ALProject');
    return;
  }
  
  console.log('✅ ALProject is ready for testing');
  
  const accountCounts = options.accounts.split(',').map(n => parseInt(n.trim()));
  const duration = parseInt(options.duration) * 1000;
  
  console.log(`Testing with account counts: ${accountCounts.join(', ')}`);
  console.log(`Test duration: ${duration/1000} seconds`);
  console.log(`ALProject address: ${options.project}`);
  
  const resultsLogger = new ResultsLogger();
  const allResults = [];
  
  for (const accountCount of accountCounts) {
    console.log(`\n--- Testing ${accountCount} concurrent accounts ---`);
    
    try {
      const contractTester = new ContractMethodLatencyTesting();
      const results = await contractTester.runDistributedContractMethodTest(
        options.project,
        accountCount,
        duration
      );
      
      // Log results
      const testInfo = {
        testType: 'contract-methods',
        alProjectAddress: options.project,
        accountCount,
        duration: duration/1000,
        timestamp: new Date().toISOString(),
        nodeDistribution: options.distributed || false
      };
      
      await resultsLogger.saveResults(results, testInfo);
      allResults.push(...results);
      
      // Calculate and display summary
      const successfulResults = results.filter(r => r.success);
      const latencies = successfulResults.map(r => r.latency);
      
      if (latencies.length > 0) {
        latencies.sort((a, b) => a - b);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
        const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
        
        console.log(`\n📊 Summary for ${accountCount} accounts:`);
        console.log(`Total operations: ${results.length}`);
        console.log(`Successful: ${successfulResults.length} (${(successfulResults.length/results.length*100).toFixed(1)}%)`);
        console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`);
        console.log(`P95 latency: ${p95Latency}ms`);
        console.log(`P99 latency: ${p99Latency}ms`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${accountCount} accounts:`, error.message);
    }
    
    // Short delay between tests
    if (accountCount !== accountCounts[accountCounts.length - 1]) {
      console.log('Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Final summary
  if (allResults.length > 0) {
    console.log('\n=== Final Contract Method Test Summary ===');
    
    // Group by operation type
    const operationGroups = {};
    allResults.forEach(result => {
      if (!operationGroups[result.operation]) {
        operationGroups[result.operation] = [];
      }
      operationGroups[result.operation].push(result);
    });
    
    Object.keys(operationGroups).forEach(operation => {
      const results = operationGroups[operation];
      const successful = results.filter(r => r.success);
      
      if (successful.length > 0) {
        const latencies = successful.map(r => r.latency);
        latencies.sort((a, b) => a - b);
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const p99 = latencies[Math.floor(latencies.length * 0.99)];
        
        console.log(`\n${operation}:`);
        console.log(`Total calls: ${results.length}`);
        console.log(`Success rate: ${(successful.length/results.length*100).toFixed(1)}%`);
        console.log(`Avg: ${avg.toFixed(0)}ms, P95: ${p95}ms, P99: ${p99}ms`);
        console.log(`Range: ${Math.min(...latencies)}ms - ${Math.max(...latencies)}ms`);
      }
    });
    
    console.log(`\n🎯 Contract method testing completed!`);
    console.log(`📁 Results saved to: results/`);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 