import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class ResultsLogger {
  constructor() {
    this.resultsDir = 'results';
    this.ensureResultsDirectory();
  }

  ensureResultsDirectory() {
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  generateTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  generateTestId(testType, accountCounts) {
    const timestamp = this.generateTimestamp();
    const accounts = accountCounts.replace(/,/g, '-');
    return `${timestamp}_${testType}_accounts-${accounts}`;
  }

  // Save comprehensive test results
  saveTestResults(testConfig, report, csvData = null) {
    const testId = this.generateTestId(testConfig.testType, testConfig.accounts);
    
    // Save JSON report with detailed config
    const fullReport = {
      testInfo: {
        testId,
        timestamp: new Date().toISOString(),
        configuration: testConfig,
        description: this.getTestDescription(testConfig)
      },
      results: report
    };

    const jsonFile = join(this.resultsDir, `${testId}.json`);
    writeFileSync(jsonFile, JSON.stringify(fullReport, null, 2));

    // Save CSV data if provided
    if (csvData) {
      const csvFile = join(this.resultsDir, `${testId}.csv`);
      writeFileSync(csvFile, csvData);
    }

    // Save formatted summary for screenshots
    const summaryFile = join(this.resultsDir, `${testId}_summary.txt`);
    const summary = this.generateScreenshotSummary(testConfig, report);
    writeFileSync(summaryFile, summary);

    // Save comparison table for easy screenshots
    const tableFile = join(this.resultsDir, `${testId}_table.txt`);
    const table = this.generateComparisonTable(report);
    writeFileSync(tableFile, table);

    return {
      testId,
      files: {
        json: jsonFile,
        csv: csvData ? join(this.resultsDir, `${testId}.csv`) : null,
        summary: summaryFile,
        table: tableFile
      }
    };
  }

  getTestDescription(config) {
    const descriptions = {
      simple: 'Basic blockchain transaction latency test with simple ETH transfers',
      voting: 'Realistic collaboration simulation with RPC calls during active voting rounds',
      workflow: 'Complete DAL project lifecycle workflow simulation',
      load: 'Sustained load testing with multiple operations per account'
    };

    return descriptions[config.testType] || 'Custom latency test';
  }

  // Generate a clean summary perfect for thesis screenshots
  generateScreenshotSummary(config, report) {
    const summary = [];
    
    summary.push('='.repeat(80));
    summary.push('                    BESU DAL LATENCY TEST RESULTS');
    summary.push('='.repeat(80));
    summary.push('');
    
    // Test Configuration
    summary.push('TEST CONFIGURATION:');
    summary.push(`  Test Type: ${config.testType.toUpperCase()}`);
    summary.push(`  Description: ${this.getTestDescription(config)}`);
    summary.push(`  Concurrent Accounts: ${config.accounts}`);
    summary.push(`  Test Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
    if (config.nodeComparison) {
      summary.push(`  Mode: Node Comparison (4 Besu nodes)`);
    } else {
      summary.push(`  Node: ${config.rpcUrl}`);
    }
    summary.push('');

    // Overall Results
    summary.push('OVERALL RESULTS:');
    summary.push(`  Total Operations: ${report.summary.totalMeasurements}`);
    summary.push(`  Successful: ${report.summary.completedMeasurements}`);
    summary.push(`  Success Rate: ${report.summary.overallSuccessRate.toFixed(1)}%`);
    summary.push(`  Test Duration: ${(report.summary.testDuration / 1000).toFixed(1)}s`);
    summary.push('');

    // Key Latency Metrics
    summary.push('KEY LATENCY METRICS:');
    Object.entries(report.operationStats).forEach(([operation, stats]) => {
      summary.push(`  ${operation.replace(/_/g, ' ').toUpperCase()}:`);
      summary.push(`    Average: ${stats.latency.avg.toFixed(0)}ms`);
      summary.push(`    P95: ${stats.latency.p95.toFixed(0)}ms`);
      summary.push(`    Range: ${stats.latency.min}ms - ${stats.latency.max}ms`);
      summary.push(`    Operations: ${stats.totalOperations} (${stats.successRate.toFixed(1)}% success)`);
      summary.push('');
    });

    // Concurrency Analysis
    if (Object.keys(report.concurrencyStats).length > 1) {
      summary.push('SCALABILITY ANALYSIS:');
      const accounts = Object.keys(report.concurrencyStats).sort((a, b) => parseInt(a) - parseInt(b));
      
      accounts.forEach(accountCount => {
        summary.push(`  ${accountCount} Concurrent Users:`);
        const stats = report.concurrencyStats[accountCount];
        Object.entries(stats.operationBreakdown).forEach(([op, opStats]) => {
          summary.push(`    ${op.replace(/_/g, ' ')}: ${opStats.avgLatency.toFixed(0)}ms avg, ${opStats.p95Latency.toFixed(0)}ms p95`);
        });
        summary.push('');
      });
    }

    summary.push('='.repeat(80));
    
    return summary.join('\n');
  }

  // Generate a comparison table perfect for thesis tables
  generateComparisonTable(report) {
    const table = [];
    
    table.push('LATENCY COMPARISON TABLE');
    table.push('='.repeat(60));
    table.push('');

    // Operation Comparison Table
    if (Object.keys(report.operationStats).length > 0) {
      table.push('OPERATION LATENCY COMPARISON:');
      table.push('');
      table.push('Operation'.padEnd(20) + 'Avg (ms)'.padEnd(12) + 'P95 (ms)'.padEnd(12) + 'Max (ms)'.padEnd(12) + 'Success %');
      table.push('-'.repeat(68));
      
      Object.entries(report.operationStats).forEach(([operation, stats]) => {
        const name = operation.replace(/_/g, ' ').substring(0, 19);
        const avg = stats.latency.avg.toFixed(0);
        const p95 = stats.latency.p95.toFixed(0);
        const max = stats.latency.max.toString();
        const success = stats.successRate.toFixed(1);
        
        table.push(
          name.padEnd(20) + 
          avg.padEnd(12) + 
          p95.padEnd(12) + 
          max.padEnd(12) + 
          success
        );
      });
      table.push('');
    }

    // Concurrency Comparison Table
    if (Object.keys(report.concurrencyStats).length > 1) {
      table.push('CONCURRENCY SCALABILITY TABLE:');
      table.push('');
      
      const accounts = Object.keys(report.concurrencyStats).sort((a, b) => parseInt(a) - parseInt(b));
      const operations = new Set();
      
      // Collect all operation types
      accounts.forEach(accountCount => {
        Object.keys(report.concurrencyStats[accountCount].operationBreakdown).forEach(op => {
          operations.add(op);
        });
      });

      // Create table header
      let header = 'Operation'.padEnd(18);
      accounts.forEach(count => {
        header += `${count} users`.padEnd(12);
      });
      table.push(header);
      table.push('-'.repeat(18 + accounts.length * 12));

      // Create rows for each operation
      operations.forEach(operation => {
        let row = operation.replace(/_/g, ' ').substring(0, 17).padEnd(18);
        
        accounts.forEach(accountCount => {
          const stats = report.concurrencyStats[accountCount].operationBreakdown[operation];
          const latency = stats ? stats.avgLatency.toFixed(0) + 'ms' : 'N/A';
          row += latency.padEnd(12);
        });
        
        table.push(row);
      });
      table.push('');
    }

    table.push('='.repeat(60));
    
    return table.join('\n');
  }

  // Save node comparison results specifically
  saveNodeComparisonResults(testConfig, report, nodeResults) {
    const testId = this.generateTestId('node-comparison', testConfig.accounts);
    
    // Enhanced report with node-specific data
    const fullReport = {
      testInfo: {
        testId,
        timestamp: new Date().toISOString(),
        configuration: testConfig,
        description: 'Multi-node latency comparison across 4 Besu nodes'
      },
      nodeResults,
      aggregatedResults: report
    };

    const jsonFile = join(this.resultsDir, `${testId}.json`);
    writeFileSync(jsonFile, JSON.stringify(fullReport, null, 2));

    // Create node comparison table
    const nodeTableFile = join(this.resultsDir, `${testId}_node-comparison.txt`);
    const nodeTable = this.generateNodeComparisonTable(nodeResults);
    writeFileSync(nodeTableFile, nodeTable);

    return {
      testId,
      files: {
        json: jsonFile,
        nodeTable: nodeTableFile
      }
    };
  }

  generateNodeComparisonTable(nodeResults) {
    const table = [];
    
    table.push('NODE LATENCY COMPARISON');
    table.push('='.repeat(80));
    table.push('');
    table.push('Node'.padEnd(25) + 'RPC Avg'.padEnd(12) + 'RPC Min'.padEnd(12) + 'RPC Max'.padEnd(12) + 'Status');
    table.push('-'.repeat(73));
    
    Object.entries(nodeResults).forEach(([nodeName, results]) => {
      const name = nodeName.substring(0, 24);
      const avg = results.rpcLatency ? results.rpcLatency.avg.toFixed(0) + 'ms' : 'N/A';
      const min = results.rpcLatency ? results.rpcLatency.min + 'ms' : 'N/A';
      const max = results.rpcLatency ? results.rpcLatency.max + 'ms' : 'N/A';
      const status = results.connectivity.success ? 'Online' : 'Offline';
      
      table.push(
        name.padEnd(25) + 
        avg.padEnd(12) + 
        min.padEnd(12) + 
        max.padEnd(12) + 
        status
      );
    });
    
    table.push('');
    table.push('='.repeat(80));
    
    return table.join('\n');
  }

  // List all saved results
  listResults() {
    try {
      const resultsFiles = readdirSync(this.resultsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          try {
            const content = readFileSync(join(this.resultsDir, file), 'utf8');
            const data = JSON.parse(content);
            return {
              file,
              testId: data.testId,
              testType: data.testConfig?.testType || 'unknown',
              timestamp: data.timestamp,
              description: this.getTestDescription(data.testConfig)
            };
          } catch (error) {
            return null;
          }
        })
        .filter(result => result !== null)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return resultsFiles;
    } catch (error) {
      return [];
    }
  }
} 