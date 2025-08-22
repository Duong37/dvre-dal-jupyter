import React, { useState, useEffect, useCallback } from 'react';
import { DALProject, DALComponentProps } from './types';
import DALProjectPage from './DALProjectPage';
import { useProjects } from '../../hooks/useProjects';
import { useAuth } from '../../hooks/useAuth';
import { projectConfigurationService } from '../deployment/services/ProjectConfigurationService';
import { ethers } from 'ethers';
import { RPC_URL } from '../../config/contracts';
import ALProject from '../../abis/ALProject.json';
import { resolveALProjectAddress, getBaseProjectAddress } from './utils/AddressResolver';

/**
 * DAL Landing Page Component - Shows user's DAL projects
 * Implements the Landing Page functionality from the design document
 */
export const DALComponent: React.FC<DALComponentProps> = ({ 
  title = 'Decentralized Active Learning',
  onProjectSelect 
}) => {
  const [selectedView, setSelectedView] = useState<'all' | 'owned' | 'joined'>('all');
  const [selectedProject, setSelectedProject] = useState<DALProject | null>(null);
  const [enrichedProjects, setEnrichedProjects] = useState<DALProject[]>([]);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);

  // Use useProjects to get all user projects
  const { userProjects, loading, error, reloadUserProjects } = useProjects();
  const { account } = useAuth();

  // Enrich project with AL-specific data (borrowed from useDALProject)
  const enrichProjectWithALData = useCallback(async (project: any) => {
    // Declare variables at function level for proper scope
    let currentRound = 1; // Default value
    let finalTraining = false; // Track final training status
    
    try {
      // Check deployment status from smart contract
      let isDeployed = false;
      let deploymentStatus: 'deployed' | 'running' | 'failed' | 'deploying' | 'pending' = 'pending';
      let alConfiguration: any = undefined;
      let projectDescription = '';
      
      try {
        // Get provider and create contract instance
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Use shared utility to resolve ALProject address
        const alProjectAddress = await resolveALProjectAddress(project.address, provider);
        
        // Now use the resolved ALProject address
        const projectContract = new ethers.Contract(alProjectAddress, ALProject.abi, provider);

        // Check if AL contracts are deployed
        const hasALContracts = await projectContract.hasALContracts();
        
        if (hasALContracts) {
          isDeployed = true;
          deploymentStatus = 'deployed';
          
          // Get the actual current round from the smart contract
          try {
            currentRound = Number(await projectContract.currentRound());
          } catch (roundError) {
            console.warn('Could not get current round:', roundError);
            currentRound = 1; // Fallback
          }
          
          // Get final training status
          try {
            finalTraining = await projectContract.finalTraining();
          } catch (finalTrainingError) {
            console.warn('Could not get final training status:', finalTrainingError);
            finalTraining = false;
          }
        } else {
          isDeployed = false;
          deploymentStatus = 'pending';
        }

        // Fetch project description and AL configuration from project data JSON
        try {
          // Get the base project address to call getProjectData()
          const baseProjectAddress = await getBaseProjectAddress(alProjectAddress, provider);
          const Project = (await import('../../abis/Project.json')).default;
          const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, provider);
          
          // Get the project data JSON that was stored during creation
          const projectDataString = await baseProjectContract.getProjectData();
          const projectData = JSON.parse(projectDataString);
          
          // Extract project description from project data
          projectDescription = projectData.description || projectData.objective || '';
          
          // Extract AL configuration from project data if available
          alConfiguration = {
            queryStrategy: projectData.queryStrategy || 'uncertainty_sampling',
            scenario: projectData.alScenario || 'pool_based', 
            model: { 
              type: 'logistic_regression',
              parameters: {} 
            },
            maxIterations: Number(projectData.maxIterations) || 10,
            queryBatchSize: Number(projectData.queryBatchSize) || 10,
            votingConsensus: 'simple_majority',
            votingTimeout: 3600,
            labelSpace: projectData.labelSpace && projectData.labelSpace.length > 0 
              ? projectData.labelSpace 
              : ['positive', 'negative']
          };
        } catch (dataError) {
          console.warn('Could not parse project data:', dataError);
          
          // Try to get AL metadata from smart contract as fallback
          try {
            // Use getALConfiguration() instead of getProjectMetadata()
            const [
              queryStrategy,
              alScenario,
              maxIteration,
              , // currentRound (unused)
              queryBatchSize,
              , // votingTimeout (unused)
              labelSpace
            ] = await projectContract.getALConfiguration();
            
            // Extract AL configuration from smart contract (fallback)
            alConfiguration = {
              queryStrategy: queryStrategy || 'uncertainty_sampling',
              scenario: alScenario || 'pool_based', 
              model: { 
                type: 'logistic_regression',
                parameters: {} 
              },
              maxIterations: Number(maxIteration) || 10,
              queryBatchSize: Number(queryBatchSize) || 10,
              votingConsensus: 'simple_majority',
              votingTimeout: 3600,
              labelSpace: labelSpace && labelSpace.length > 0 
                ? [...labelSpace] 
                : ['positive', 'negative']
            };
            
            // For description, try to get it from base project if available
            try {
              const baseProjectAddress = await getBaseProjectAddress(alProjectAddress, provider);
              const Project = (await import('../../abis/Project.json')).default;
              const baseProjectContract = new ethers.Contract(baseProjectAddress, Project.abi, provider);
              const projectDataString = await baseProjectContract.getProjectData();
              const projectData = JSON.parse(projectDataString);
              projectDescription = projectData.description || projectData.objective || '';
            } catch (descError) {
              console.warn('Could not get description from base project:', descError);
              projectDescription = '';
            }
          } catch (metadataError) {
            console.warn('Could not fetch AL metadata from smart contract:', metadataError);
            
            // Final fallback to local configuration
            const config = projectConfigurationService.getProjectConfiguration(project.address);
            const dalConfig = config?.extensions?.dal;
            if (dalConfig) {
              alConfiguration = {
                queryStrategy: dalConfig.queryStrategy || 'uncertainty_sampling',
                scenario: dalConfig.alScenario || 'pool_based',
                model: dalConfig.model || { type: 'logistic_regression', parameters: {} },
                maxIterations: dalConfig.maxIterations || 10,
                queryBatchSize: dalConfig.queryBatchSize || 10,
                votingConsensus: dalConfig.votingConsensus || 'simple_majority',
                votingTimeout: dalConfig.votingTimeout || 3600,
                labelSpace: dalConfig.labelSpace || ['positive', 'negative']
              };
            }
          }
        }
        
      } catch (deploymentError) {
        console.warn('Could not check smart contract deployment status:', deploymentError);
        // Fallback to deployment service
        const config = projectConfigurationService.getProjectConfiguration(project.address);
        isDeployed = config ? (config.status === 'deployed') : false;
        deploymentStatus = config?.status === 'deployed' ? 'deployed' : 'pending';
      }

      const isOwner = project.creator?.toLowerCase() === account?.toLowerCase();
    
    return {
        id: project.address,
        name: project.projectData?.name || project.projectData?.project_id || project.objective || 'Unnamed Project',
        description: projectDescription || project.description || project.projectData?.description,
        contractAddress: project.address,
        status: project.isActive ? 'active' : 'inactive',
        participants: project.participants?.length || 0,
        currentRound: currentRound, // Use the actual current round
        totalRounds: alConfiguration?.maxIterations || 10,
        lastUpdated: new Date(project.lastModified * 1000),
        workflowConfigured: true,
        creator: project.creator,
        isActive: project.isActive,
        alConfiguration,
        modelPerformance: undefined,
        activeVoting: undefined,
        userRole: isOwner ? 'coordinator' : 'contributor',
        totalSamplesLabeled: 0,
        isDeployed,
        deploymentStatus: deploymentStatus as any,
        finalTraining: finalTraining
      } as DALProject;
    } catch (err) {
      console.error(`Failed to enrich project ${project.address} with AL data:`, err);
      
      // Return basic project data if enrichment fails
      const isOwner = project.creator?.toLowerCase() === account?.toLowerCase();
      return {
        id: project.address,
        name: project.projectData?.name || project.projectData?.project_id || project.objective || 'Unnamed Project',
        description: project.description || project.projectData?.description,
        contractAddress: project.address,
        status: project.isActive ? 'active' : 'inactive',
        participants: project.participants?.length || 0,
        currentRound: currentRound, // Use the actual current round instead of hardcoded 1
        totalRounds: 10,
        lastUpdated: new Date(project.lastModified * 1000),
        workflowConfigured: true,
        creator: project.creator,
        isActive: project.isActive,
        alConfiguration: undefined,
        modelPerformance: undefined,
        activeVoting: undefined,
        userRole: isOwner ? 'coordinator' : 'contributor',
        totalSamplesLabeled: 0,
        isDeployed: false,
        deploymentStatus: 'pending'
      } as DALProject;
    }
  }, [account]);

  // Enrich all user projects with AL data
  const enrichAllProjects = useCallback(async () => {
    if (!userProjects || userProjects.length === 0) {
      setEnrichedProjects([]);
      return;
    }

    setEnrichmentLoading(true);
    try {
      const enrichedList: DALProject[] = [];
      
      for (const project of userProjects) {
        const enrichedProject = await enrichProjectWithALData(project);
        enrichedList.push(enrichedProject);
      }
      
      setEnrichedProjects(enrichedList);
    } catch (err) {
      console.error('Failed to enrich projects:', err);
    } finally {
      setEnrichmentLoading(false);
    }
  }, [userProjects, enrichProjectWithALData]);

  // Handle refresh button click
  const handleRefresh = async () => {
    await reloadUserProjects();
    await enrichAllProjects();
  };

  // Enrich projects when userProjects change
  useEffect(() => {
    enrichAllProjects();
  }, [enrichAllProjects]);

  // Convert projects and separate owned vs joined
  const allProjects = enrichedProjects;
  const ownedProjects = allProjects.filter(p => p.userRole === 'coordinator');
  const joinedProjects = allProjects.filter(p => p.userRole === 'contributor');

  const handleProjectSelect = (project: DALProject) => {
    // Only allow opening deployed projects
    if (project.isDeployed) {
      setSelectedProject(project);
      onProjectSelect?.(project);
    } else {
      // For non-deployed projects, show a message with option to go to deployment
      const shouldDeploy = window.confirm(
        'This project needs to be deployed first. Would you like to go to Project Deployment now?'
      );
      
      if (shouldDeploy) {
        // Use the widget opener utility for consistent experience
        try {
          const { openProjectHubWidget } = require('../../utils/WidgetOpener');
          openProjectHubWidget({
            title: 'Project Deployment',
            initialViewMode: 'main' // Could be enhanced to go directly to deployment
          });
        } catch (error) {
          console.warn('Could not open deployment via widget opener, falling back to alert');
          alert('Please open Project Deployment from the launcher to deploy this project first.');
        }
      }
    }
  };

  const handleBackToLanding = () => {
    setSelectedProject(null);
  };

  // If a project is selected, show the project page
  if (selectedProject) {
    return (
      <DALProjectPage 
        project={selectedProject} 
        onBack={handleBackToLanding}
      />
    );
  }

  const getFilteredProjects = () => {
    switch (selectedView) {
      case 'owned': return ownedProjects;
      case 'joined': return joinedProjects;
      case 'all':
      default: return [...ownedProjects, ...joinedProjects];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981'; // Green for active
      case 'inactive': return '#6b7280'; // Grey for inactive
      case 'draft': return '#f59e0b';
      case 'configured': return '#3b82f6';
      case 'running': return '#10b981';
      case 'completed': return '#6b7280';
      case 'terminated': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getProgressPercentage = (current: number, total: number) => {
    return Math.round((current / total) * 100);
  };

  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Show authentication message if not connected
  if (!account) {
    return (
      <div className="dal-container">
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <h3>{title}</h3>
          <p>Please connect your wallet to access Active Learning projects.</p>
        </div>
      </div>
    );
  }

  if (loading || enrichmentLoading) {
    return (
      <div className="dal-container">
        <div className="dal-loading">
          <h3>{title}</h3>
          <p>Loading Active Learning projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dal-container">
        <div className="dal-error">
          <h3>{title}</h3>
          <p style={{ color: 'var(--jp-error-color1)' }}>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  const filteredProjects = getFilteredProjects();

  return (
    <div className="dal-container">
      <div className="dal-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3>{title}</h3>
            <p>Collaborative machine learning with active learning strategies</p>
          </div>
          <button 
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading || enrichmentLoading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: loading || enrichmentLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              color: '#374151',
              opacity: loading || enrichmentLoading ? 0.6 : 1
            }}
          >
            {loading || enrichmentLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {/* Project Summary */}
        <div className="project-summary">
          <div className="summary-item">
            <span className="count">{ownedProjects.length}</span>
            <span className="label">Owned Projects</span>
          </div>
          <div className="summary-item">
            <span className="count">{joinedProjects.length}</span>
            <span className="label">Joined Projects</span>
          </div>
          <div className="summary-item">
            <span className="count">{ownedProjects.filter(p => p.isActive).length + joinedProjects.filter(p => p.isActive).length}</span>
            <span className="label">Active Projects</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="dal-filters">
        <button 
          className={`filter-tab ${selectedView === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedView('all')}
        >
          All Projects ({ownedProjects.length + joinedProjects.length})
        </button>
        <button 
          className={`filter-tab ${selectedView === 'owned' ? 'active' : ''}`}
          onClick={() => setSelectedView('owned')}
        >
          Owned ({ownedProjects.length})
        </button>
        <button 
          className={`filter-tab ${selectedView === 'joined' ? 'active' : ''}`}
          onClick={() => setSelectedView('joined')}
        >
          Joined ({joinedProjects.length})
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="dal-empty">
          <h4>No Active Learning Projects</h4>
          <p>Create a new Active Learning project to get started:</p>
          <ol style={{ textAlign: 'left', margin: '16px auto', maxWidth: '400px' }}>
            <li>Go to <strong>Project Hub</strong></li>
            <li>Create a new project using the <strong>Active Learning template</strong></li>
            <li>Configure and deploy it in <strong>Project Deployment</strong></li>
          </ol>
        </div>
      ) : (
        <div className="dal-projects">
          {filteredProjects.map((project) => (
            <div key={project.id} className="dal-project-card">
              {/* Prominent Project Name Container */}
              <div className="project-name-container" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 className="project-name" style={{ margin: 0 }}>{project.name}</h3>
                  {/* Project Description - moved closer to project name */}
                  {project.description && project.description.trim() !== '' && (
                    <div className="project-description" style={{
                      fontSize: '14px',
                      color: '#666',
                      marginTop: '4px',
                      lineHeight: '1.4',
                      fontStyle: 'italic'
                    }}>
                      {project.description}
                    </div>
                  )}
                </div>
                <div className="project-badges" style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  minWidth: 'fit-content'
                }}>
                  <span className="project-type-badge">
                    ACTIVE LEARNING
                  </span>
                  <span className="role-badge" data-role={project.userRole}>
                    {project.userRole === 'coordinator' ? 'COORDINATOR' : 'CONTRIBUTOR'}
                  </span>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(project.status) }}
                  >
                    {project.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Configuration Summary */}
                {project.alConfiguration && (
                  <div className="project-config-summary">
                    <span>Strategy: {project.alConfiguration.queryStrategy}</span>
                    <span>Model: {project.alConfiguration.model.type}</span>
                  </div>
                )}

              <div className="project-stats">
                <div className="stat">
                  <span className="label">Progress:</span>
                  <span className="value">
                    {project.currentRound}/{project.totalRounds} rounds 
                    ({getProgressPercentage(project.currentRound, project.totalRounds)}%)
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Participants:</span>
                  <span className="value">{project.participants}</span>
                </div>
                <div className="stat">
                  <span className="label">Status:</span>
                  <span className={`value ${project.isDeployed ? 'deployed' : 'not-deployed'}`}>
                    {project.isDeployed ? 'Deployed' : 'Not Deployed'}
                  </span>
                </div>
                {project.isDeployed && (
                  <>
                    {project.modelPerformance?.accuracy && (
                      <div className="stat">
                        <span className="label">Accuracy:</span>
                        <span className="value">{(project.modelPerformance.accuracy * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </>
                )}
                <div className="stat">
                  <span className="label">Last Updated:</span>
                  <span className="value">{project.lastUpdated.toLocaleDateString()}</span>
                </div>
              </div>

              {/* Active Voting Indicator */}
              {project.activeVoting && project.isActive && project.isDeployed && (
                <div className="active-voting-banner">
                  <div className="voting-info">
                    <span className="voting-status">Active Voting in Progress</span>
                    <span className="time-remaining">
                      Time remaining: {formatTimeRemaining(project.activeVoting.timeRemaining)}
                    </span>
                  </div>
                  <div className="voting-progress">
                    {Object.entries(project.activeVoting.currentVotes).map(([label, count]) => (
                      <span key={label} className="vote-count">
                        {label}: {count as number}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="project-actions">
                {project.isDeployed ? (
                  <button 
                    className="primary-btn"
                    onClick={() => handleProjectSelect(project)}
                  >
                    {project.isActive ? 'Open Project' : 'View Results'}
                  </button>
                ) : (
                  <div className="deployment-required">
                    <p className="deployment-message">
                      Deploy this project in <strong>Project Deployment</strong> to access Active Learning features.
                    </p>
                    <button 
                      className="deployment-btn"
                      onClick={() => handleProjectSelect(project)}
                      disabled
                    >
                      Not Deployed ({project.deploymentStatus || 'pending'})
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DALComponent; 