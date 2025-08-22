"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useFactoryRegistry } from "./useFactoryRegistry";
import UserMetadataFactory from "../abis/UserMetadataFactory.json";

export function useAuth() {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState<boolean | null>(null);
  const { getFactoryAddress } = useFactoryRegistry();

  // Check MetaMask availability on mount
  useEffect(() => {
    checkMetaMaskAvailability();
    
    // Restore session if available
    const stored = sessionStorage.getItem("auth");
    if (stored) {
      try {
        const { account } = JSON.parse(stored);
        setAccount(account);
        console.log("Restored session:", { account });
      } catch (error) {
        console.error("Failed to restore session:", error);
        sessionStorage.removeItem("auth");
      }
    }
  }, []);

  // Listen for MetaMask account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          setAccount(null);
          sessionStorage.removeItem("auth");
          setConnectionError("Wallet disconnected");
        } else if (accounts[0] !== account) {
          // User switched accounts
          setAccount(accounts[0]);
          sessionStorage.setItem("auth", JSON.stringify({ account: accounts[0] }));
          setConnectionError(null);
        }
      };

      const handleChainChanged = () => {
        // Reload the page when network changes
        window.location.reload();
      };

      const handleDisconnect = () => {
        setAccount(null);
        sessionStorage.removeItem("auth");
        setConnectionError("Wallet disconnected");
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
      (window as any).ethereum.on('chainChanged', handleChainChanged);
      (window as any).ethereum.on('disconnect', handleDisconnect);

      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
        (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
        (window as any).ethereum.removeListener('disconnect', handleDisconnect);
      };
    }
  }, [account]);

  const checkMetaMaskAvailability = () => {
    const hasMetaMask = typeof window !== 'undefined' && (window as any).ethereum;
    setIsMetaMaskAvailable(hasMetaMask);
    
    if (!hasMetaMask) {
      setConnectionError("MetaMask is not installed. Please install MetaMask extension to use this application.");
    } else {
      setConnectionError(null);
    }
  };

  const connect = async () => {
    if (!(window as any).ethereum) {
      setConnectionError("MetaMask is not installed. Please install MetaMask extension to use this application.");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      console.log("Starting MetaMask connection...");
      
      // Step 1: Check if MetaMask is available and get basic info
      const ethereum = (window as any).ethereum;
      console.log("MetaMask object:", {
        isMetaMask: ethereum.isMetaMask,
        selectedAddress: ethereum.selectedAddress,
        networkVersion: ethereum.networkVersion,
        chainId: ethereum.chainId
      });

      // Step 2: Try to get current accounts first
      let accounts: string[] = [];
      try {
        console.log("Checking current accounts...");
        accounts = await ethereum.request({ method: 'eth_accounts' });
        console.log("Current accounts:", accounts);
      } catch (error) {
        console.warn("Failed to get current accounts:", error);
      }

      // Step 3: If no accounts, request them
      if (accounts.length === 0) {
        console.log("No accounts found, requesting accounts...");
        try {
          accounts = await ethereum.request({ method: 'eth_requestAccounts' });
          console.log("Requested accounts:", accounts);
        } catch (error: any) {
          console.error("Failed to request accounts:", error);
          
          if (error.code === 4001) {
            throw new Error("Connection rejected by user. Please approve the connection in MetaMask.");
          } else if (error.code === -32002) {
            throw new Error("Connection request already pending. Please check MetaMask.");
          } else {
            throw new Error(`Account request failed: ${error.message || "Unknown error"}`);
          }
        }
      }

      if (accounts.length === 0) {
        throw new Error("No accounts found. Please unlock MetaMask and ensure you have at least one account.");
      }

      const account = accounts[0];
      console.log("Selected account:", account);

      // Step 4: Validate the account format
      if (!account || typeof account !== 'string' || !account.startsWith('0x')) {
        throw new Error("Invalid account format received from MetaMask.");
      }

      // Step 5: Set the account and save to session
      setAccount(account);
      sessionStorage.setItem("auth", JSON.stringify({ account }));
      console.log("Successfully connected to account:", account);

      // Step 6: Validate network
      await validateNetwork();
      
    } catch (error: any) {
      console.error("Connection failed:", error);
      
      if (error.message?.includes("Connection rejected")) {
        setConnectionError("Connection rejected by user. Please approve the connection in MetaMask.");
      } else if (error.message?.includes("request already pending")) {
        setConnectionError("Connection request already pending. Please check MetaMask.");
      } else if (error.message?.includes("No accounts found")) {
        setConnectionError("No accounts found. Please unlock MetaMask and ensure you have at least one account.");
      } else if (error.message?.includes("Invalid account format")) {
        setConnectionError("MetaMask returned an invalid account format. Please try refreshing the page.");
      } else if (error.message?.includes("setAccountsCallback")) {
        setConnectionError("MetaMask compatibility issue. Please try refreshing the page and connecting again.");
      } else {
        setConnectionError(`Connection failed: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const validateNetwork = async () => {
    try {
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      console.log("Connected to network with chainId:", chainId);
      
      // You can add network validation here
      // For example, check if it's the expected network
      // const expectedChainId = "0x539"; // Your VM's chain ID
      // if (chainId !== expectedChainId) {
      //   console.warn("Connected to unexpected network:", chainId);
      // }
    } catch (error) {
      console.warn("Failed to validate network:", error);
    }
  };

  const disconnect = () => {
    setAccount(null);
    sessionStorage.removeItem("auth");
    setConnectionError(null);
    console.log("Disconnected wallet");
  };

  // Register user on the blockchain
  const register = async (email: string, name: string, institution: string) => {
    if (!(window as any).ethereum) {
      setConnectionError("MetaMask is not available");
      return false;
    }

    if (!account) {
      setConnectionError("Please connect your wallet first");
      return false;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      // Get UserMetadataFactory address from registry
      const userMetadataFactoryAddress = await getFactoryAddress("UserMetadataFactory");
      if (!userMetadataFactoryAddress) {
        setConnectionError("Failed to get UserMetadataFactory address from registry");
        return false;
      }

      const userMetadataFactory = new ethers.Contract(
        userMetadataFactoryAddress,
        UserMetadataFactory.abi,
        signer
      );

      const tx = await userMetadataFactory.registerUser(email, name, institution);
      await tx.wait();
      console.log("User registration successful");
      return true;
    } catch (err: any) {
      console.error("Registration failed:", err);
      setConnectionError(`Registration failed: ${err.message || "Unknown error"}`);
      return false;
    }
  };

  // Get factory address from registry
  const getFactoryFromRegistry = async (factoryName: string) => {
    try {
      const address = await getFactoryAddress(factoryName);
      return address;
    } catch (error) {
      console.error(`Failed to get ${factoryName} from registry:`, error);
      return null;
    }
  };

  return { 
    account, 
    connect, 
    disconnect, 
    register, 
    getFactoryFromRegistry,
    isConnecting,
    connectionError,
    isMetaMaskAvailable,
    clearError: () => setConnectionError(null)
  };
}
