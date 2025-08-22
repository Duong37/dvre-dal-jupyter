import { ethers } from 'ethers';
import { CONFIG } from '../config.js';

export class RPCLatencySimulation {
  constructor(provider, latencyTracker) {
    this.provider = provider;
    this.latencyTracker = latencyTracker;
  }

  // Measure: Get block number (frequent polling for UI updates)
  async getBlockNumber(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'block_number', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      await this.provider.getBlockNumber();
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };
    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Measure: Get block with transaction details (heavier read operation)
  async getBlockWithTransactions(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'block_with_transactions', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      await this.provider.getBlock('latest', true);
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };
    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Measure: Get transaction receipt (for known transactions)
  async getTransactionReceipt(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'transaction_receipt', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      // Get latest block and try to get a receipt for a recent transaction
      const latestBlock = await this.provider.getBlock('latest', true);
      if (latestBlock && latestBlock.transactions.length > 0) {
        const firstTx = latestBlock.transactions[0];
        if (typeof firstTx === 'string') {
          await this.provider.getTransactionReceipt(firstTx);
        }
      }
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };
    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Measure: Get logs over a small block range
  async getLogs(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'get_logs', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      const latestBlockNumber = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlockNumber - 10); // Last 10 blocks
      
      await this.provider.getLogs({
        fromBlock: fromBlock,
        toBlock: latestBlockNumber
      });
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };
    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Measure: Network information (chain ID, fee data)
  async getNetworkInfo(accountId, concurrentAccounts, nodeInfo = null) {
    const timingId = this.latencyTracker.startTiming(
      'network_info', 
      accountId, 
      { concurrentAccounts, node: nodeInfo?.name }
    );

    try {
      await Promise.all([
        this.provider.getNetwork(),
        this.provider.getFeeData()
      ]);
      
      this.latencyTracker.endTiming(timingId, true);
      return { success: true };
    } catch (error) {
      this.latencyTracker.endTiming(timingId, false, error.message);
      throw error;
    }
  }

  // Realistic read-only user activity simulation
  async simulateReadOnlyActivity(accountId, concurrentAccounts, nodeInfo = null) {
    const operations = [
      { type: 'block_number', weight: 40, method: this.getBlockNumber.bind(this) },
      { type: 'transaction_receipt', weight: 25, method: this.getTransactionReceipt.bind(this) },
      { type: 'block_with_transactions', weight: 15, method: this.getBlockWithTransactions.bind(this) },
      { type: 'get_logs', weight: 10, method: this.getLogs.bind(this) },
      { type: 'network_info', weight: 10, method: this.getNetworkInfo.bind(this) }
    ];

    // Weighted random selection
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    let selectedOperation = operations[0];
    for (const operation of operations) {
      cumulativeWeight += operation.weight;
      if (random <= cumulativeWeight) {
        selectedOperation = operation;
        break;
      }
    }

    try {
      return await selectedOperation.method(accountId, concurrentAccounts, nodeInfo);
    } catch (error) {
      console.error(`${selectedOperation.type} failed:`, error.message);
      return { success: false, operation: selectedOperation.type, error: error.message };
    }
  }

  // Main entry point for read-only testing
  async runReadOnlySession(accountId, concurrentAccounts, nodeInfo = null, duration = 10000) {
    const startTime = Date.now();
    const results = {
      operations: 0,
      successes: 0,
      failures: 0,
      errors: []
    };

    while (Date.now() - startTime < duration) {
      try {
        const result = await this.simulateReadOnlyActivity(accountId, concurrentAccounts, nodeInfo);
        results.operations++;
        
        if (result.success) {
          results.successes++;
        } else {
          results.failures++;
          results.errors.push(result.error);
        }
        
        // Small delay to prevent overwhelming the node
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        results.operations++;
        results.failures++;
        results.errors.push(error.message);
      }
    }

    return results;
  }
} 