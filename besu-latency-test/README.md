# Besu DAL Latency Testing Tool

A focused latency testing framework for measuring Hyperledger Besu blockchain performance with DAL (Decentralized Active Learning) smart contracts.

## Overview

This tool is designed to test network latency bottlenecks in your DAL system by simulating multiple concurrent accounts performing typical blockchain operations. Unlike heavyweight tools like Hyperledger Caliper, this focuses specifically on latency measurements for academic Active Learning scenarios.

## Features

- **Concurrent Account Testing**: Test with 1, 2, 4, 8 accounts simultaneously
- **Multiple Test Types**: Simple transfers, DAL workflow operations, and load testing
- **Comprehensive Metrics**: Average, median, P95, P99 latency measurements
- **CSV/JSON Export**: Export results for analysis
- **Real-time Reporting**: Live progress and detailed final reports

## Installation

```bash
cd besu-latency-test
npm install
```

## Configuration

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Required
BESU_RPC_URL=http://localhost:8545
PROJECT_FACTORY_ADDRESS=0x...

# Optional
CHAIN_ID=1337
```

### Configuration File

Edit `src/config.js` to adjust test parameters:

```javascript
export const CONFIG = {
  RPC_URL: 'http://localhost:8545',
  CHAIN_ID: 1337,
  
  CONTRACTS: {
    PROJECT_FACTORY: '0x...', // Your deployed ProjectFactory address
  },
  
  TEST_PARAMS: {
    ACCOUNT_COUNTS: [1, 2, 4, 8],
    OPERATIONS_PER_ACCOUNT: 10,
    OPERATION_DELAY: 1000, // ms between operations
    GAS_LIMIT: 2000000,
    GAS_PRICE: '0' // Free gas for testing
  }
};
```

## Usage

### Basic Latency Test (Simple Transfers)

Test basic blockchain latency with simple ETH transfers:

```bash
npm run test -- --test-type simple --accounts "1,2,4,8" --operations 5
```

### DAL Workflow Test

Test actual DAL smart contract operations (requires deployed contracts):

```bash
npm run test -- \
  --test-type workflow \
  --factory 0xYourProjectFactoryAddress \
  --accounts "1,2,4" \
  --operations 3
```

### Load Testing

Run multiple operations per account to test sustained load:

```bash
npm run test -- \
  --test-type load \
  --factory 0xYourProjectFactoryAddress \
  --accounts "1,2,4,8" \
  --operations 10 \
  --delay 500
```

### Export Results

Export results to CSV and JSON:

```bash
npm run test -- \
  --test-type simple \
  --accounts "1,2,4,8" \
  --output results.csv
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--rpc-url` | Besu RPC endpoint | `http://localhost:8545` |
| `--factory` | ProjectFactory contract address | From config |
| `--accounts` | Comma-separated account counts | `"1,2,4,8"` |
| `--operations` | Operations per account | `10` |
| `--delay` | Delay between operations (ms) | `1000` |
| `--test-type` | Test type: simple, workflow, load | `simple` |
| `--output` | CSV output file | None |

## Test Types

### 1. Simple Transfer Test (`--test-type simple`)
- Tests basic blockchain latency
- Sends small ETH transfers between accounts
- No DAL contracts required
- Good for baseline network performance

### 2. Workflow Test (`--test-type workflow`)
- Tests complete DAL project lifecycle
- Creates projects, performs setup, voting operations
- Requires deployed DAL contracts
- Most realistic for actual usage

### 3. Load Test (`--test-type load`)
- Sustained load testing with multiple operations
- Focuses on most common operations (project creation, reads)
- Tests system behavior under continuous load

## Understanding Results

### Report Sections

1. **Summary**: Overall test statistics
2. **Operation Latencies**: Per-operation type metrics
3. **Concurrency Analysis**: Performance vs. account count

### Key Metrics

- **Average Latency**: Mean response time
- **P95 Latency**: 95% of operations complete within this time
- **P99 Latency**: 99% of operations complete within this time
- **Success Rate**: Percentage of successful operations

### Example Output

```
================================================================================
                    BESU DAL LATENCY TEST REPORT
================================================================================

SUMMARY:
  Total Measurements: 80
  Completed: 80
  Success Rate: 100.00%
  Test Duration: 45.23s

OPERATION LATENCIES:
  project_creation:
    Operations: 32 (100.0% success)
    Latency: avg=1250ms, p95=1890ms, max=2100ms
  
  read_operations:
    Operations: 32 (100.0% success)
    Latency: avg=45ms, p95=78ms, max=120ms

CONCURRENCY ANALYSIS:
  1 concurrent accounts:
    project_creation: avg=1100ms, p95=1200ms
    read_operations: avg=35ms, p95=45ms
  
  4 concurrent accounts:
    project_creation: avg=1400ms, p95=2000ms
    read_operations: avg=55ms, p95=85ms
```

## Prerequisites

### For Simple Tests
- Running Besu node
- RPC endpoint accessible
- Accounts with ETH for gas (unless gas price is 0)

### For DAL Workflow Tests
- Deployed DAL smart contracts
- ProjectFactory contract address
- Template registry with AL template
- Sufficient gas for contract operations

## Troubleshooting

### Common Issues

1. **Connection Failed**
   ```
   Failed to connect to Besu network: connect ECONNREFUSED
   ```
   - Check Besu is running and RPC endpoint is correct
   - Verify firewall/network settings

2. **Contract Not Found**
   ```
   Error: ProjectFactory address is required
   ```
   - Set PROJECT_FACTORY_ADDRESS environment variable
   - Or use --factory command line option

3. **Gas Issues**
   ```
   Error: insufficient funds for gas
   ```
   - Ensure test accounts have ETH
   - Or set gas price to 0 for testing

4. **Transaction Timeouts**
   - Increase operation delay (`--delay`)
   - Check Besu block time configuration
   - Verify network is processing transactions

### Performance Tips

1. **Start Small**: Begin with 1-2 accounts to verify setup
2. **Monitor Resources**: Watch Besu CPU/memory usage during tests
3. **Adjust Timing**: Increase delays if seeing timeouts
4. **Network Isolation**: Run tests on isolated network for consistent results

## Example Test Scenarios

### Scenario 1: Baseline Performance
```bash
# Test basic network latency
npm run test -- --test-type simple --accounts "1" --operations 10
```

### Scenario 2: Concurrency Impact
```bash
# See how latency changes with concurrent accounts
npm run test -- --test-type simple --accounts "1,2,4,8" --operations 5
```

### Scenario 3: DAL Workflow Analysis
```bash
# Test actual DAL operations
npm run test -- \
  --test-type workflow \
  --factory 0xYourAddress \
  --accounts "1,2,4" \
  --operations 3 \
  --output dal-results.csv
```

### Scenario 4: Sustained Load
```bash
# Test sustained performance
npm run test -- \
  --test-type load \
  --factory 0xYourAddress \
  --accounts "4" \
  --operations 20 \
  --delay 500
```

## Files Generated

- `latency-report.json`: Detailed test results
- `results.csv`: Raw measurement data (if --output specified)
- Console output: Real-time progress and summary

## Integration

The tool exports structured data that can be:
- Imported into spreadsheets for analysis
- Used with data visualization tools
- Integrated into CI/CD pipelines for performance regression testing 