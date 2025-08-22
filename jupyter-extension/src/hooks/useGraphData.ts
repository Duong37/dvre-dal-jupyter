import { useState, useEffect, useCallback } from 'react';
import { useProjects, ProjectInfo } from './useProjects';
import { useAuth } from './useAuth';
import { GraphData } from '../components/graph/GraphTypes';
import { GraphDataProcessor } from '../utils/GraphDataProcessor';

export interface GraphProjectData {
  id: string;
  name: string;
  description?: string;
  creator: string;
  created: number;
  participants: Array<{
    address: string;
    role: string;
    name?: string;
  }>;
  data?: any[];
  models?: any[];
  infrastructure?: any[];
  datasets?: any[];
  algorithms?: any[];
  resources?: any[];
  // Additional fields from project JSON
  [key: string]: any;
}

export const useGraphData = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { userProjects, loadProjects } = useProjects();
  const { account } = useAuth();

  // Process blockchain projects into graph format using the centralized processor
  const processProjectsToGraphData = useCallback(async (projects: ProjectInfo[]): Promise<GraphData> => {
    const processor = new GraphDataProcessor();
    
    // Convert ProjectInfo[] to the format expected by GraphDataProcessor
    const projectsData = projects.map(project => ({
      // Standard fields
      project_id: project.projectId,
      id: project.address,
      objective: project.objective,
      description: project.description,
      creator: project.creator,
      created: project.created,
      participants: project.participants,
      
      // Include the full project data
      ...project.projectData
    }));
    
    return await processor.processData(projectsData);
  }, []);

  // Load and process graph data
  const loadGraphData = useCallback(async () => {
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ensure projects are loaded
      await loadProjects();
      
      // Process the user's projects into graph format
      const graphData = await processProjectsToGraphData(userProjects);
      setGraphData(graphData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [account, loadProjects, userProjects, processProjectsToGraphData]);

  // Load graph data when account changes or component mounts
  useEffect(() => {
    if (account && userProjects.length === 0) {
      loadGraphData();
    } else if (account && userProjects.length > 0) {
      // Process existing user projects
      processProjectsToGraphData(userProjects).then(graphData => {
        setGraphData(graphData);
      }).catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to process graph data');
      });
    }
  }, [account, userProjects.length, loadGraphData, processProjectsToGraphData]);

  // Refresh graph data
  const refreshGraphData = useCallback(async () => {
    await loadGraphData();
  }, [loadGraphData]);

  return {
    graphData,
    loading,
    error,
    refreshGraphData,
    projectCount: userProjects.length,
    hasProjects: userProjects.length > 0
  };
};
