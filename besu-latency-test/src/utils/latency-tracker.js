export class LatencyTracker {
  constructor() {
    this.measurements = [];
    this.operationCounts = {};
  }

  // Start timing an operation
  startTiming(operationType, accountId, metadata = {}) {
    const timingId = `${operationType}_${accountId}_${Date.now()}_${Math.random()}`;
    const timing = {
      id: timingId,
      operationType,
      accountId,
      metadata,
      startTime: Date.now(),
      endTime: null,
      latency: null,
      success: null,
      error: null
    };
    
    this.measurements.push(timing);
    return timingId;
  }

  // End timing an operation
  endTiming(timingId, success = true, error = null) {
    const timing = this.measurements.find(m => m.id === timingId);
    if (!timing) {
      console.warn(`Timing not found for ID: ${timingId}`);
      return;
    }

    timing.endTime = Date.now();
    timing.latency = timing.endTime - timing.startTime;
    timing.success = success;
    timing.error = error;

    // Update operation counts
    const key = timing.operationType;
    if (!this.operationCounts[key]) {
      this.operationCounts[key] = { total: 0, successful: 0, failed: 0 };
    }
    this.operationCounts[key].total++;
    if (success) {
      this.operationCounts[key].successful++;
    } else {
      this.operationCounts[key].failed++;
    }
  }

  // Get statistics for a specific operation type
  getOperationStats(operationType) {
    const measurements = this.measurements.filter(m => 
      m.operationType === operationType && m.latency !== null
    );

    if (measurements.length === 0) {
      return null;
    }

    const latencies = measurements.map(m => m.latency);
    const successful = measurements.filter(m => m.success);
    
    return {
      operationType,
      totalOperations: measurements.length,
      successfulOperations: successful.length,
      failedOperations: measurements.length - successful.length,
      successRate: (successful.length / measurements.length) * 100,
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        median: this.calculateMedian(latencies),
        p95: this.calculatePercentile(latencies, 95),
        p99: this.calculatePercentile(latencies, 99)
      }
    };
  }

  // Get stats grouped by concurrent accounts
  getAccountConcurrencyStats(accountCount) {
    const accountMeasurements = this.measurements.filter(m => 
      m.metadata.concurrentAccounts === accountCount && m.latency !== null
    );

    if (accountMeasurements.length === 0) {
      return null;
    }

    const operationTypes = [...new Set(accountMeasurements.map(m => m.operationType))];
    const stats = {
      concurrentAccounts: accountCount,
      totalOperations: accountMeasurements.length,
      operationBreakdown: {}
    };

    operationTypes.forEach(opType => {
      const opMeasurements = accountMeasurements.filter(m => m.operationType === opType);
      const latencies = opMeasurements.map(m => m.latency);
      
      stats.operationBreakdown[opType] = {
        count: opMeasurements.length,
        avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        minLatency: Math.min(...latencies),
        maxLatency: Math.max(...latencies),
        p95Latency: this.calculatePercentile(latencies, 95)
      };
    });

    return stats;
  }

  // Generate a comprehensive report
  generateReport() {
    const report = {
      summary: {
        totalMeasurements: this.measurements.length,
        completedMeasurements: this.measurements.filter(m => m.latency !== null).length,
        overallSuccessRate: 0,
        testDuration: 0
      },
      operationStats: {},
      concurrencyStats: {}
    };

    // Calculate test duration
    const completedMeasurements = this.measurements.filter(m => m.endTime !== null);
    if (completedMeasurements.length > 0) {
      const startTimes = completedMeasurements.map(m => m.startTime);
      const endTimes = completedMeasurements.map(m => m.endTime);
      report.summary.testDuration = Math.max(...endTimes) - Math.min(...startTimes);
    }

    // Calculate overall success rate
    const completed = this.measurements.filter(m => m.success !== null);
    if (completed.length > 0) {
      const successful = completed.filter(m => m.success);
      report.summary.overallSuccessRate = (successful.length / completed.length) * 100;
    }

    // Get operation stats
    const operationTypes = [...new Set(this.measurements.map(m => m.operationType))];
    operationTypes.forEach(opType => {
      const stats = this.getOperationStats(opType);
      if (stats) {
        report.operationStats[opType] = stats;
      }
    });

    // Get concurrency stats
    const concurrencyLevels = [...new Set(this.measurements.map(m => m.metadata.concurrentAccounts))];
    concurrencyLevels.forEach(level => {
      if (level) {
        const stats = this.getAccountConcurrencyStats(level);
        if (stats) {
          report.concurrencyStats[level] = stats;
        }
      }
    });

    return report;
  }

  // Helper: Calculate median
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Helper: Calculate percentile
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Print a formatted report to console
  printReport() {
    const report = this.generateReport();
    
    console.log('\n' + '-'.repeat(80));
    console.log('BESU DAL LATENCY TEST REPORT');
    console.log('-'.repeat(80));
    
    console.log(`\nSUMMARY:`);
    console.log(`Total Measurements: ${report.summary.totalMeasurements}`);
    console.log(`Completed: ${report.summary.completedMeasurements}`);
    console.log(`Success Rate: ${report.summary.overallSuccessRate.toFixed(2)}%`);
    console.log(`Test Duration: ${(report.summary.testDuration / 1000).toFixed(2)}s`);

    console.log(`\nOPERATION LATENCIES:`);
    Object.entries(report.operationStats).forEach(([opType, stats]) => {
      console.log(`${opType}:`);
      console.log(`Operations: ${stats.totalOperations} (${stats.successRate.toFixed(1)}% success)`);
      console.log(`Latency: avg=${stats.latency.avg.toFixed(0)}ms, p95=${stats.latency.p95.toFixed(0)}ms, max=${stats.latency.max}ms`);
    });

    console.log(`\nCONCURRENCY ANALYSIS:`);
    Object.entries(report.concurrencyStats).forEach(([accounts, stats]) => {
      console.log(`${accounts} concurrent accounts:`);
      Object.entries(stats.operationBreakdown).forEach(([opType, opStats]) => {
        console.log(`${opType}: avg=${opStats.avgLatency.toFixed(0)}ms, p95=${opStats.p95Latency.toFixed(0)}ms`);
      });
    });

    console.log('\n' + '-'.repeat(80));
    
    return report;
  }

  // Export data as CSV
  exportCSV() {
    const headers = 'OperationType,AccountId,ConcurrentAccounts,StartTime,EndTime,Latency,Success,Error';
    const rows = this.measurements
      .filter(m => m.latency !== null)
      .map(m => [
        m.operationType,
        m.accountId,
        m.metadata.concurrentAccounts || '',
        m.startTime,
        m.endTime,
        m.latency,
        m.success,
        m.error || ''
      ].join(','));
    
    return [headers, ...rows].join('\n');
  }
} 