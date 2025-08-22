import { useState, useEffect, useCallback } from 'react';
import { 
  projectConfigurationService,
  DVREProjectConfiguration 
} from '../components/deployment/services/ProjectConfigurationService';
import { useAuth } from './useAuth';

/**
 * Hook for managing project configuration in memory
 * 
 * This hook provides functionality to manage project configurations that are stored
 * in memory for the current session. It's designed to work seamlessly with the 
 * project deployment workflow and can be used to store temporary configurations
 * before they are persisted to the blockchain or IPFS.
 * 
 * Integrates with existing Project Hub system
 */
export function useProjectConfiguration(projectId?: string) {
  const { account } = useAuth(); // Get current user's wallet address
  const [configuration, setConfiguration] = useState<DVREProjectConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load configuration
  const loadConfiguration = useCallback(async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const config = projectConfigurationService.getProjectConfiguration(id);
      setConfiguration(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create configuration (called when new project is created)
  const createConfiguration = useCallback(async (
    projectId: string,
    projectData: any,
    templateId?: number
  ) => {
    if (!account) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);
    
    try {
      const config = await projectConfigurationService.createProjectConfiguration(
        projectId,
        projectData,
        account,
        templateId
      );
      setConfiguration(config);
      return config;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create configuration');
      return null;
    } finally {
      setLoading(false);
    }
  }, [account]);

  // Update dApp extension
  const updateExtension = useCallback(async (
    dAppName: string,
    extensionData: any
  ) => {
    if (!projectId || !account) return null;
    
    try {
      const updated = projectConfigurationService.updateExtensionConfiguration(
        projectId,
        dAppName,
        extensionData,
        account
      );
      
      if (updated) {
        setConfiguration(updated);
      }
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update extension');
      return null;
    }
  }, [projectId, account]);

  // Add dataset
  const addDataset = useCallback(async (
    datasetId: string,
    dataset: any
  ) => {
    if (!projectId || !account) return null;
    
    try {
      const updated = projectConfigurationService.addDataset(
        projectId,
        datasetId,
        dataset,
        account
      );
      
      if (updated) {
        setConfiguration(updated);
      }
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dataset');
      return null;
    }
  }, [projectId, account]);

  // Add workflow
  const addWorkflow = useCallback(async (
    workflowId: string,
    workflow: any
  ) => {
    if (!projectId || !account) return null;
    
    try {
      const updated = projectConfigurationService.addWorkflow(
        projectId,
        workflowId,
        workflow,
        account
      );
      
      if (updated) {
        setConfiguration(updated);
      }
      
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add workflow');
      return null;
    }
  }, [projectId, account]);

  // Publish to IPFS
  const publishToIPFS = useCallback(async () => {
    if (!projectId || !account) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await projectConfigurationService.publishToIPFS(projectId, account);
      
      // Reload configuration to get updated IPFS hashes
      if (result) {
        await loadConfiguration(projectId);
      }
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish to IPFS');
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId, account, loadConfiguration]);

  // Subscribe to configuration changes
  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = projectConfigurationService.onConfigurationChange(
      projectId,
      (updatedConfig: DVREProjectConfiguration) => {
        setConfiguration(updatedConfig);
      }
    );

    return unsubscribe;
  }, [projectId]);

  // Load initial configuration
  useEffect(() => {
    if (projectId) {
      loadConfiguration(projectId);
    }
  }, [projectId, loadConfiguration]);

  return {
    configuration,
    loading,
    error,
    createConfiguration,
    updateExtension,
    addDataset,
    addWorkflow,
    publishToIPFS,
    reload: () => projectId && loadConfiguration(projectId)
  };
} 