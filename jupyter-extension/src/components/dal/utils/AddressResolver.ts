/**
 * Address Resolver Utility
 * 
 * Provides shared functionality to resolve ALProject contract addresses from base Project contracts.
 * This is needed because the DAL frontend receives base Project addresses but AL operations 
 * require ALProject contract addresses.
 */

import { ethers } from 'ethers';
import { RPC_URL } from '../../../config/contracts';
import ALProject from '../../../abis/ALProject.json';

/**
 * Resolves ALProject contract address from base Project contract address
 * @param baseProjectAddress - The base Project contract address or ALProject address
 * @param provider - Optional provider (will create one if not provided)
 * @returns Promise<string> - The ALProject contract address
 */
export async function resolveALProjectAddress(
  baseProjectAddress: string, 
  provider?: ethers.JsonRpcProvider
): Promise<string> {
  const rpcProvider = provider || new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    // First check if the address is already an ALProject by checking for hasALContracts method
    const alProjectContract = new ethers.Contract(baseProjectAddress, ALProject.abi, rpcProvider);
    try {
      await alProjectContract.hasALContracts();
      // If this succeeds, it's already an ALProject address
      console.log(`Address ${baseProjectAddress} is already an ALProject contract`);
      return baseProjectAddress;
    } catch {
      // If it fails, this might be a base Project address, get the alExtension
    }
    
    // Try to get ALProject address from base Project contract
    const Project = (await import('../../../abis/Project.json')).default;
    const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, rpcProvider);
    
    const alExtension = await baseProjectContract.getALExtension();
    if (!alExtension || alExtension === ethers.ZeroAddress) {
      throw new Error('No AL extension found for this project');
    }
    
    console.log(`Resolved ALProject address ${alExtension} from base Project ${baseProjectAddress}`);
    return alExtension;
  } catch (error) {
    console.error(` Failed to resolve ALProject address from ${baseProjectAddress}:`, error);
    throw new Error(`Could not resolve ALProject address: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the base Project contract address from an ALProject contract
 * @param alProjectAddress - The ALProject contract address
 * @param provider - Optional provider (will create one if not provided)
 * @returns Promise<string> - The base Project contract address
 */
export async function getBaseProjectAddress(
  alProjectAddress: string,
  provider?: ethers.JsonRpcProvider
): Promise<string> {
  const rpcProvider = provider || new ethers.JsonRpcProvider(RPC_URL);
  
  try {
    const alProjectContract = new ethers.Contract(alProjectAddress, ALProject.abi, rpcProvider);
    const baseProjectAddress = await alProjectContract.baseProject();
    
    if (!baseProjectAddress || baseProjectAddress === ethers.ZeroAddress) {
      throw new Error('Invalid base project address');
    }
    
    console.log(`Found base Project address ${baseProjectAddress} for ALProject ${alProjectAddress}`);
    return baseProjectAddress;
  } catch (error) {
    console.error(` Failed to get base Project address from ${alProjectAddress}:`, error);
    throw new Error(`Could not get base Project address: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 