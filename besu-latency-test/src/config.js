// Besu Configuration
export const CONFIG = {
  // Default RPC endpoint - can be overridden by command line
  RPC_URL: process.env.BESU_RPC_URL || 'http://145.100.135.27:8550',
  
  // All available Besu nodes
  BESU_NODES: {
    node1: {
      name: 'Node 1 (135.27)',
      url: 'http://145.100.135.27:8550',
      location: 'Primary'
    },
    node2: {
      name: 'Node 2 (135.39)', 
      url: 'http://145.100.135.39:8550',
      location: 'Secondary'
    },
    node3: {
      name: 'Node 3 (135.97)',
      url: 'http://145.100.135.97:8550', 
      location: 'Tertiary'
    },
    node4: {
      name: 'Node 4 (44.119)',
      url: 'http://49.12.44.119:8550',
      location: 'Quaternary'
    }
  },
  
  // Chain ID for your Besu network
  CHAIN_ID: 1337,
  
  // Contract addresses - these will need to be updated with your deployed contracts
  CONTRACTS: {
    PROJECT_FACTORY: process.env.PROJECT_FACTORY_ADDRESS || '',
    AL_PROJECT_DEPLOYER: process.env.AL_PROJECT_DEPLOYER_ADDRESS || '',
    // These will be deployed during tests
    AL_PROJECT: '',
    AL_VOTING: '',
    AL_STORAGE: ''
  },
  
  // Test parameters
  TEST_PARAMS: {
    // Number of concurrent accounts to test (1, 2, 4, 8, 16, 32, 64, 128)
    ACCOUNT_COUNTS: [1, 2, 4, 8, 16, 32, 64, 128],
    
    // Number of operations per account
    OPERATIONS_PER_ACCOUNT: 10,
    
    // Delay between operations (ms)
    OPERATION_DELAY: 1000,
    
    // Gas settings
    GAS_LIMIT: 2000000,
    GAS_PRICE: '0' // Free gas for testing
  }
};

// Helper function to get all node URLs
export function getAllNodeUrls() {
  return Object.values(CONFIG.BESU_NODES).map(node => node.url);
}

// Helper function to get node info by URL
export function getNodeInfo(url) {
  return Object.values(CONFIG.BESU_NODES).find(node => node.url === url);
}

// Sample data for testing
export const TEST_DATA = {
  PROJECT_METADATA: JSON.stringify({
    title: "Latency Test Project",
    description: "Testing DAL latency",
    type: "active_learning"
  }),
  
  AL_CONFIG: {
    queryStrategy: "uncertainty",
    alScenario: "pool_based",
    maxIteration: 5,
    queryBatchSize: 10,
    labelSpace: ["positive", "negative", "neutral"]
  },
  
  VOTING_CONFIG: {
    votingConsensus: 2, // Simple majority
    votingTimeout: 300  // 5 minutes
  },
  
  SAMPLE_IDS: ["sample_1", "sample_2", "sample_3"],
  SAMPLE_HASHES: ["QmHash1", "QmHash2", "QmHash3"],
  ORIGINAL_INDICES: [0, 1, 2]
}; 