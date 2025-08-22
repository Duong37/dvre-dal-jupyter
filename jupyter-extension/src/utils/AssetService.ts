import { ethers, BrowserProvider, Signer } from 'ethers';
import AssetFactoryABI from '../abis/AssetFactory.json';
import AssetABI from '../abis/Asset.json';
import config from '../config';
import { getFactoryAddressFromRegistry } from './registryClient.js';

export interface AssetInfo {
  address: string;
  owner: string;
  name: string;
  assetType: string;
  ipfsHash: string;
  created: number;
  updated: number;
}

export class AssetService {
  private provider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private assetFactoryAddress: string;
  private isInitialized: boolean = false;

  constructor() {
    this.assetFactoryAddress = config.blockchain.assetFactoryAddress;
    this.initializeProvider();
    this.initializeAssetFactory();
  }

  private async initializeProvider() {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        this.provider = new BrowserProvider((window as any).ethereum);
        
        // Check if MetaMask is unlocked
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.signer = await this.provider.getSigner();
          console.log('AssetService: Provider initialized with connected account');
        } else {
          console.log('AssetService: Provider initialized but no account connected');
        }
      } else {
        console.warn('AssetService: MetaMask not available');
      }
    } catch (error) {
      console.warn('AssetService: Failed to initialize Web3 provider:', error);
    }
  }

  private async initializeAssetFactory() {
    try {
      const registryAddress = await getFactoryAddressFromRegistry('AssetFactory');
      if (registryAddress) {
        this.assetFactoryAddress = registryAddress;
        console.log('AssetService: AssetFactory address loaded from registry:', registryAddress);
      } else {
        console.warn('AssetService: AssetFactory not found in registry, using config fallback:', this.assetFactoryAddress);
      }
    } catch (error) {
      console.warn('AssetService: Failed to get AssetFactory from registry, using config fallback:', error);
    }
    this.isInitialized = true;
  }

  isConfigured(): boolean {
    if (!this.isInitialized) {
      return false;
    }
    const configured = this.assetFactoryAddress !== '0x0000000000000000000000000000000000000000';
    return configured;
  }

  isMetaMaskAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).ethereum;
  }

  async connectWallet(): Promise<string> {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask is not installed. Please install MetaMask extension to use this application.');
    }

    try {
      // Use the legacy request method for better compatibility
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask and try again.');
      }

      const account = accounts[0];
      
      // Update provider and signer
      this.provider = new BrowserProvider((window as any).ethereum);
      this.signer = await this.provider.getSigner();
      
      console.log('AssetService: Connected to account:', account);
      return account;
    } catch (error: any) {
      console.error('AssetService: Connection failed:', error);
      
      if (error.code === 4001) {
        throw new Error('Connection rejected by user. Please approve the connection in MetaMask.');
      } else if (error.code === -32002) {
        throw new Error('Connection request already pending. Please check MetaMask.');
      } else if (error.message?.includes("User rejected")) {
        throw new Error('Connection rejected. Please approve the connection in MetaMask.');
      } else if (error.message?.includes("setAccountsCallback")) {
        throw new Error('MetaMask compatibility issue. Please try refreshing the page and connecting again.');
      } else {
        throw new Error(`Connection failed: ${error.message || "Unknown error"}`);
      }
    }
  }

  async createAsset(name: string, assetType: string, ipfsHash: string, viewers: string[] = []): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet first.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.signer
      );

      console.log('AssetService: Creating asset with name:', name, 'type:', assetType, 'hash:', ipfsHash);
      console.log('AssetService: Viewers to add:', viewers);
      console.log('AssetService: Factory address:', this.assetFactoryAddress);
      
      // Ensure viewers array is mutable to avoid "read-only property" errors in ethers.js
      const mutableViewers = [...viewers];
      
      const tx = await factory.createAsset(name, assetType, ipfsHash, mutableViewers);
      console.log('AssetService: Transaction sent:', tx.hash);
      console.log('AssetService: Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('AssetService: Transaction receipt received');
      console.log('AssetService: Receipt status:', receipt.status);
      console.log('AssetService: Receipt status type:', typeof receipt.status);
      console.log('AssetService: Transaction hash:', receipt.hash);
      console.log('AssetService: Full receipt:', receipt);

      // Check transaction status - in ethers v6, status should be 1 for success
      if (receipt.status === 1) {
        console.log('AssetService: Asset creation transaction successful');
        return `SUCCESS_${receipt.hash}`;
      } else {
        console.error('AssetService: Transaction failed with status:', receipt.status);
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }
    } catch (error: any) {
      console.error('AssetService: Error in createAsset:', error);
      console.error('AssetService: Error type:', typeof error);
      console.error('AssetService: Error message:', error.message);
      console.error('AssetService: Error code:', error.code);
      console.error('AssetService: Full error object:', error);
      
      // Check if this is a user rejection
      if (error.message?.includes("user rejected") || error.code === 4001) {
        throw new Error('Transaction rejected by user. Please approve the transaction in MetaMask.');
      }
      
      // Check if this is a transaction revert
      if (error.message?.includes("execution reverted")) {
        throw new Error(`Smart contract execution failed: ${error.message}`);
      }
      
      // Check if transaction was actually successful despite the error
      if (error.receipt && error.receipt.status === 1) {
        console.log('AssetService: Transaction actually succeeded despite error');
        return `SUCCESS_${error.receipt.hash}`;
      }
      
      // Re-throw with more context
      throw new Error(`Failed to create asset: ${error.message || "Unknown error"}`);
    }
  }

  async getUserAssets(userAddress: string): Promise<AssetInfo[]> {
    if (!this.provider) {
      throw new Error('Provider not available. Please ensure MetaMask is installed and connected.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.provider
      );

      // Use getAccessibleAssets for privacy - only shows assets user owns or is a viewer of
      const assetAddresses = await factory.getAccessibleAssets(userAddress);
      const assets: AssetInfo[] = [];

      for (const address of assetAddresses) {
        try {
          // Explicitly check access before getting asset info
          const canAccess = await factory.canAccessAsset(address, userAddress);
          if (canAccess) {
            const assetInfo = await this.getAssetInfo(address);
            assets.push(assetInfo);
          } else {
            console.warn(`AssetService: Access denied for asset ${address}, skipping`);
          }
        } catch (error) {
          console.error(`AssetService: Failed to get info for asset ${address}:`, error);
          console.error(`AssetService: Access denied for asset ${address}, skipping`);
        }
      }

      console.log(`AssetService: Retrieved ${assets.length} accessible assets for user ${userAddress}`);
      return assets;
    } catch (error: any) {
      console.error('AssetService: Failed to get user assets:', error);
      throw new Error(`Failed to get user assets: ${error.message || "Unknown error"}`);
    }
  }

  async getAllAssets(): Promise<AssetInfo[]> {
    if (!this.provider) {
      throw new Error('Provider not available. Please ensure MetaMask is installed and connected.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.provider
      );

      const assetAddresses = await factory.getAllAssets();
      const assets: AssetInfo[] = [];

      for (const address of assetAddresses) {
        try {
          const assetInfo = await this.getAssetInfo(address);
          assets.push(assetInfo);
        } catch (error) {
          console.error(`AssetService: Failed to get info for asset ${address}:`, error);
        }
      }

      console.log(`AssetService: Retrieved ${assets.length} total assets`);
      return assets;
    } catch (error: any) {
      console.error('AssetService: Failed to get all assets:', error);
      throw new Error(`Failed to get all assets: ${error.message || "Unknown error"}`);
    }
  }

  async getAssetInfo(assetAddress: string): Promise<AssetInfo> {
    if (!this.provider) {
      throw new Error('Provider not available. Please ensure MetaMask is installed and connected.');
    }

    try {
      const asset = new ethers.Contract(
        assetAddress,
        AssetABI.abi,
        this.provider
      );

      const [owner, name, assetType, ipfsHash, created, updated] = await asset.getAssetInfo();

      return {
        address: assetAddress,
        owner,
        name,
        assetType,
        ipfsHash,
        created: Number(created),
        updated: Number(updated)
      };
    } catch (error: any) {
      console.error(`AssetService: Failed to get asset info for ${assetAddress}:`, error);
      throw new Error(`Failed to get asset info: ${error.message || "Unknown error"}`);
    }
  }

  async updateAssetHash(assetAddress: string, newIpfsHash: string): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet first.');
    }

    try {
      const asset = new ethers.Contract(
        assetAddress,
        AssetABI.abi,
        this.signer
      );

      console.log('AssetService: Updating asset hash for:', assetAddress, 'to:', newIpfsHash);
      const tx = await asset.updateIpfsHash(newIpfsHash);
      console.log('AssetService: Update transaction sent, waiting for confirmation...');
      
      await tx.wait();
      console.log('AssetService: Asset hash updated successfully');
    } catch (error: any) {
      console.error('AssetService: Failed to update asset hash:', error);
      
      if (error.message?.includes("insufficient funds")) {
        throw new Error('Insufficient funds for transaction. Please ensure your wallet has enough ETH for gas fees.');
      } else if (error.message?.includes("user rejected")) {
        throw new Error('Transaction rejected by user. Please approve the transaction in MetaMask.');
      } else {
        throw new Error(`Failed to update asset hash: ${error.message || "Unknown error"}`);
      }
    }
  }

  async addAssetViewer(assetAddress: string, viewerAddress: string): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet first.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.signer
      );

      console.log('AssetService: Adding viewer to asset:', assetAddress, 'viewer:', viewerAddress);
      const tx = await factory.addAssetViewer(assetAddress, viewerAddress);
      console.log('AssetService: Add viewer transaction sent, waiting for confirmation...');
      
      await tx.wait();
      console.log('AssetService: Viewer added successfully');
    } catch (error: any) {
      console.error('AssetService: Failed to add asset viewer:', error);
      
      if (error.message?.includes("user rejected")) {
        throw new Error('Transaction rejected by user. Please approve the transaction in MetaMask.');
      } else {
        throw new Error(`Failed to add asset viewer: ${error.message || "Unknown error"}`);
      }
    }
  }

  async removeAssetViewer(assetAddress: string, viewerAddress: string): Promise<void> {
    if (!this.signer) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet first.');
    }

    if (!this.isConfigured()) {
      throw new Error('Asset factory not configured. Please check your blockchain configuration.');
    }

    try {
      const factory = new ethers.Contract(
        this.assetFactoryAddress,
        AssetFactoryABI.abi,
        this.signer
      );

      console.log('AssetService: Removing viewer from asset:', assetAddress, 'viewer:', viewerAddress);
      const tx = await factory.removeAssetViewer(assetAddress, viewerAddress);
      console.log('AssetService: Remove viewer transaction sent, waiting for confirmation...');
      
      await tx.wait();
      console.log('AssetService: Viewer removed successfully');
    } catch (error: any) {
      console.error('AssetService: Failed to remove asset viewer:', error);
      
      if (error.message?.includes("user rejected")) {
        throw new Error('Transaction rejected by user. Please approve the transaction in MetaMask.');
      } else {
        throw new Error(`Failed to remove asset viewer: ${error.message || "Unknown error"}`);
      }
    }
  }
}

export const assetService = new AssetService();
