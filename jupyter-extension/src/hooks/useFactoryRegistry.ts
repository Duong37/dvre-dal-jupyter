"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";

import FactoryRegistry from "../abis/FactoryRegistry.json";
import { FACTORY_REGISTRY_ADDRESS, RPC_URL } from "../config/contracts";

interface FactoryInfo {
  name: string;
  address: string;
  isValid: boolean;
}

export function useFactoryRegistry() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get a single factory address by name
  const getFactoryAddress = useCallback(async (factoryName: string): Promise<string | null> => {
    if (!factoryName) {
      setError("Factory name is required");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Use JsonRpcProvider for read-only operations
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const registryContract = new ethers.Contract(
        FACTORY_REGISTRY_ADDRESS,
        FactoryRegistry.abi,
        provider
      );

      const address = await registryContract.get(factoryName);
      
      // Check if address is zero address (not found)
      if (address === "0x0000000000000000000000000000000000000000") {
        setError(`Factory "${factoryName}" not found in registry`);
        return null;
      }

      setLoading(false);
      return address;
    } catch (err: any) {
      setError(`Failed to get factory address: ${err.message}`);
      setLoading(false);
      return null;
    }
  }, []);

  // Get multiple factory addresses by names
  const getMultipleFactories = useCallback(async (factoryNames: string[]): Promise<FactoryInfo[]> => {
    if (!factoryNames || factoryNames.length === 0) {
      setError("Factory names array is required");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const registryContract = new ethers.Contract(
        FACTORY_REGISTRY_ADDRESS,
        FactoryRegistry.abi,
        provider
      );

      const factories: FactoryInfo[] = [];

      // Get all addresses in parallel
      const promises = factoryNames.map(async (name) => {
        try {
          const address = await registryContract.get(name);
          const isValid = address !== "0x0000000000000000000000000000000000000000";
          return { name, address, isValid };
        } catch (err) {
          console.warn(`Failed to get factory "${name}":`, err);
          return { name, address: "0x0000000000000000000000000000000000000000", isValid: false };
        }
      });

      const results = await Promise.all(promises);
      factories.push(...results);

      setLoading(false);
      return factories;
    } catch (err: any) {
      setError(`Failed to get factory addresses: ${err.message}`);
      setLoading(false);
      return [];
    }
  }, []);

  // Get all known factory addresses
  const getKnownFactories = useCallback(async (): Promise<FactoryInfo[]> => {
    const knownFactoryNames = [
      // JSON project system contracts
      "ProjectTemplateRegistry",
      "ProjectFactory",
      // User management contracts
      "UserMetadataFactory"
    ];
    return getMultipleFactories(knownFactoryNames);
  }, [getMultipleFactories]);

  // Check if a factory exists in the registry
  const factoryExists = useCallback(async (factoryName: string): Promise<boolean> => {
    const address = await getFactoryAddress(factoryName);
    return address !== null;
  }, [getFactoryAddress]);

  // Convenience method to get factory contract instance
  const getFactoryContract = useCallback(async (factoryName: string, abi: any[], signer?: ethers.Signer): Promise<ethers.Contract | null> => {
    const address = await getFactoryAddress(factoryName);
    if (!address) return null;

    const provider = signer || new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(address, abi, provider);
  }, [getFactoryAddress]);

  return {
    // State
    loading,
    error,
    
    // Methods
    getFactoryAddress,
    getMultipleFactories,
    getKnownFactories,
    factoryExists,
    getFactoryContract,
    
    // Utility method to clear error
    clearError: () => setError(null)
  };
}
