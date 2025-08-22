// Configuration for D-VRE Extension
export const config = {
  // IPFS Configuration
  ipfs: {
    baseUrl: 'http://dvre03.lab.uvalight.net:5002/api/v0',
    publicUrl: 'http://dvre03.lab.uvalight.net:8081/ipfs',
    apiKey: 'dvre-platform-master-key',
    healthUrl: 'http://dvre03.lab.uvalight.net:5002/health'
  },
  
  // Orchestrator Configuration
  orchestrator: {
    endpoint: 'http://145.100.135.97:5004/streamflow/submit-project-workflow',
    baseUrl: 'http://145.100.135.97:5004',
    timeout: 30000
  },
  
  // AL-Engine Configuration
  alEngine: {
    // Python environment paths
    pythonExecutable: process.env.DVRE_PYTHON_PATH || '/Users/duongvuhai/Desktop/Thesis/DVRE/venv/bin/python3',
    
    // AL-Engine source paths
    sourceDirectory: process.env.DVRE_AL_ENGINE_PATH || '/Users/duongvuhai/Desktop/Thesis/DVRE/al-engine',
    scriptPath: process.env.DVRE_AL_ENGINE_SCRIPT || '/Users/duongvuhai/Desktop/Thesis/DVRE/al-engine/src/al_iteration.py',
    
    // RO-Crate paths
    roCrateRoot: process.env.DVRE_ROCRATE_ROOT || '../al-engine/ro-crates',
    
    // API configuration
    apiUrl: process.env.DVRE_AL_ENGINE_API || 'http://localhost:5050',
    healthEndpoint: '/health',
    iterationEndpoint: '/start_iteration',
    statusEndpoint: '/status',
    
    // Execution settings
    timeout: 300000, // 5 minutes
    retries: 3
  },
  
  // Blockchain Configuration
  blockchain: {
    // Set this to the deployed AssetFactory contract address
    assetFactoryAddress: process.env.ASSET_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
    
    // Network configuration
    networks: {
      localhost: {
        chainId: 31337,
        rpcUrl: 'http://localhost:8545'
      },
      hardhat: {
        chainId: 31337,
        rpcUrl: 'http://localhost:8545'
      }
    }
  },
  
  // File type mappings for better UX
  fileTypes: {
    dataset: {
      extensions: ['.csv', '.json', '.xlsx', '.parquet', '.h5'],
      color: '#4caf50'
    },
    model: {
      extensions: ['.pkl', '.h5', '.pt', '.pth', '.onnx', '.joblib'],
      color: '#2196f3'
    },
    script: {
      extensions: ['.py', '.js', '.ts', '.r', '.ipynb'],
      color: '#ff9800'
    },
    document: {
      extensions: ['.pdf', '.doc', '.docx', '.txt', '.md'],
      color: '#9c27b0'
    }
  }
};

export default config;
