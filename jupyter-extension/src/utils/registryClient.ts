import { ethers } from "ethers";
import FactoryRegistry from "../abis/FactoryRegistry.json";
import { FACTORY_REGISTRY_ADDRESS, RPC_URL } from "../config/contracts";

/**
 * Get a factory address from the registry - standalone utility function
 * This is the same logic as in useFactoryRegistry but without React state management
 */
export async function getFactoryAddressFromRegistry(factoryName: string): Promise<string | null> {
  if (!factoryName) {
    throw new Error("Factory name is required");
  }

  try {
    // Use JsonRpcProvider for read-only operations
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const registryContract = new ethers.Contract(
      FACTORY_REGISTRY_ADDRESS,
      FactoryRegistry.abi,
      provider
    );

    console.log(`Looking up factory "${factoryName}" in registry at ${FACTORY_REGISTRY_ADDRESS}`);
    console.log(`Using RPC URL: ${RPC_URL}`);

    const address = await registryContract.get(factoryName);
    console.log(`Registry returned address for "${factoryName}":`, address);
    
    // Check if address is zero address (not found)
    if (address === "0x0000000000000000000000000000000000000000") {
      console.warn(`Factory "${factoryName}" not found in registry`);
      return null;
    }

    return address;
  } catch (err: any) {
    console.error(`Failed to get factory address for "${factoryName}":`, err);
    return null;
  }
}
