import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { DVREProjectConfiguration, projectConfigurationService } from './services/ProjectConfigurationService';
import { useAuth } from '../../hooks/useAuth';
import { useProjects } from '../../hooks/useProjects';
import ProjectConfigurationPanel from './ProjectConfigurationPanel';
import ProjectInformationPanel from './ProjectInformationPanel';
import WorkflowsPanel from './WorkflowsPanel';
import UserList from './UserList';
import ComputationModePanel from './ComputationModePanel';

// Import Project ABI for smart contract interaction
import Project from '../../abis/Project.json';

interface ProjectDeploymentComponentProps {
  title?: string;
  projectId?: string;
  onConfigurationChange?: (config: DVREProjectConfiguration) => void;
}

export const ProjectDeploymentComponent: React.FC<ProjectDeploymentComponentProps> = ({
  title = 'Project Deployment',
  projectId: initialProjectId,
  onConfigurationChange
}) => {
  const { account } = useAuth(); // Get current user's wallet address
  const { userProjects, loading: projectsLoading, reloadUserProjects } = useProjects(); // Load blockchain projects
  const [projects, setProjects] = useState<DVREProjectConfiguration[]>([]);
  const [selectedProject, setSelectedProject] = useState<DVREProjectConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'configure'>('list');
  const [enhancedRoCrateMetadata, setEnhancedRoCrateMetadata] = useState<string>('');
  const [computationMode, setComputationMode] = useState<'local' | 'remote'>('local');

  // Use refs to prevent infinite re-renders
  const onConfigurationChangeRef = useRef(onConfigurationChange);
  const userProjectsRef = useRef(userProjects);
  
  // Update refs when values change
  useEffect(() => {
    onConfigurationChangeRef.current = onConfigurationChange;
  }, [onConfigurationChange]);
  
  useEffect(() => {
    userProjectsRef.current = userProjects;
  }, [userProjects]);

  // Helper functions for blockchain interaction
  const getProvider = () => {
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    return new ethers.BrowserProvider((window as any).ethereum);
  };

  const getSigner = async () => {
    const provider = getProvider();
    return await provider.getSigner();
  };

  const loadProjects = useCallback(async () => {
    const currentUserProjects = userProjectsRef.current;
    
    if (!account || !currentUserProjects || currentUserProjects.length === 0) {
      setProjects([]);
      return;
    }

    setLoading(true);
    try {
      console.log(`Found ${currentUserProjects.length} user projects from blockchain:`, currentUserProjects.map(p => ({ id: p.address, name: p.projectData?.name || p.projectId })));
      
      const configurations: DVREProjectConfiguration[] = [];
      
      // For each user project, ensure it has a RO-Crate configuration
      for (const project of currentUserProjects) {
        try {
          //  SECURITY: Only allow project owners to see projects in deployment UI
          const isOwner = project.creator?.toLowerCase() === account.toLowerCase();
          if (!isOwner) {
            console.log(`Skipping project ${project.address} - user is not the owner`);
            continue; // Skip projects where user is not the creator/owner
          }
          
          console.log(`Processing project ${project.address}:`, {
            projectId: project.projectId,
            projectData: project.projectData,
            hasTypeField: !!project.projectData?.type,
            typeValue: project.projectData?.type
          });
          
          // Check if RO-Crate already exists
          let config = projectConfigurationService.getProjectConfiguration(project.address);
          
          if (!config) {
            // Auto-create RO-Crate for existing projects that don't have one
            console.log(`Auto-creating RO-Crate for existing project: ${project.address}`);
            config = await projectConfigurationService.autoCreateProjectConfiguration(
              project.address,
              project.projectData,
              account
            );
            console.log(`Created RO-Crate for project ${project.address}:`, config);
          } else {
            console.log(`Found existing RO-Crate for project ${project.address}`, {
              configStatus: config.status,
              hasDALExtension: !!config.extensions?.dal,
              projectDataType: config.projectData?.type
            });
            
            //  TEMP FIX: Force-recreate RO-Crate if project has AL type but no DAL extension
            const shouldBeAL = project.projectData?.type === 'active_learning';
            const hasDALExtension = !!config.extensions?.dal;
            
            if (shouldBeAL && !hasDALExtension) {
              console.log(`Force-recreating RO-Crate for AL project without DAL extension: ${project.address}`);
              config = await projectConfigurationService.autoCreateProjectConfiguration(
                project.address,
                project.projectData,
                account
              );
              console.log(`Recreated RO-Crate with DAL extension for project ${project.address}`);
            }
          }
          
          if (config) {
            configurations.push(config);
          }
        } catch (err) {
          console.error(`Failed to process project ${project.address}:`, err);
        }
      }
      
      console.log(`Successfully loaded ${configurations.length} project configurations`);
      setProjects(configurations);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [account]); // Only depend on account, not userProjects

  const loadProjectConfiguration = useCallback((projectId: string) => {
    if (!account) return;

    try {
      const config = projectConfigurationService.getProjectConfiguration(projectId);
      if (config) {
        // Verify user ownership before allowing access
        if (projectConfigurationService.isProjectOwner(projectId, account)) {
          setSelectedProject(config);
          const currentOnConfigurationChange = onConfigurationChangeRef.current;
          currentOnConfigurationChange?.(config);
        } else {
          setError('You can only configure projects that you own');
          setSelectedProject(null);
        }
      } else {
        setError('Project configuration not found');
        setSelectedProject(null);
      }
    } catch (err) {
      console.error('Failed to load project configuration:', err);
      setError('Failed to load project configuration');
      setSelectedProject(null);
    }
  }, [account]); // Only depend on account

  // Load projects when blockchain projects change or component mounts
  useEffect(() => {
    if (!projectsLoading && userProjects) { // Wait for blockchain projects to load first
      loadProjects();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, userProjects, projectsLoading]); // Don't include loadProjects to prevent infinite loop

  // Debug helper - expose data to console for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).dvreDebugData = {
        account,
        userProjects,
        projects,
        projectsLoading,
        error,
        timestamp: new Date().toISOString()
      };
      
      console.log('DVRE Debug Data Updated:', {
        account,
        userProjectsCount: userProjects?.length || 0,
        configuredProjectsCount: projects.length,
        loading: projectsLoading,
        error
      });
    }
  }, [account, userProjects, projects, projectsLoading, error]);

  // Subscribe to configuration changes for selected project
  useEffect(() => {
    if (!selectedProject) return;

    const unsubscribe = projectConfigurationService.onConfigurationChange(
      selectedProject.projectId,
      (updatedConfig: DVREProjectConfiguration) => {
        setSelectedProject(updatedConfig);
        const currentOnConfigurationChange = onConfigurationChangeRef.current;
        currentOnConfigurationChange?.(updatedConfig);
        // Reload enhanced RO-Crate when configuration changes
        loadEnhancedRoCrateMetadata(updatedConfig);
      }
    );

    // Load enhanced RO-Crate metadata for the selected project
    loadEnhancedRoCrateMetadata(selectedProject);

    return unsubscribe;
  }, [selectedProject]); // Remove onConfigurationChange dependency

  // Load enhanced RO-Crate metadata with real blockchain assets
  const loadEnhancedRoCrateMetadata = async (project: DVREProjectConfiguration) => {
    try {
      const enhancedMetadata = await projectConfigurationService.generateEnhancedROCrateJSON(project);
      setEnhancedRoCrateMetadata(enhancedMetadata);
    } catch (error) {
      console.error('Failed to load enhanced RO-Crate metadata:', error);
      // Fallback to regular metadata
      setEnhancedRoCrateMetadata(JSON.stringify(project.roCrate.metadata, null, 2));
    }
  };

  // Handle initial project selection
  useEffect(() => {
    if (initialProjectId && account) {
      loadProjectConfiguration(initialProjectId);
      setView('configure');
    }
  }, [initialProjectId, account, loadProjectConfiguration]);

  const handleProjectSelect = (projectId: string) => {
    loadProjectConfiguration(projectId);
    setView('configure');
  };

  // NEW: Simplified deploy function using DeploymentOrchestrator
  const handleDeployProject = async () => {
    if (!selectedProject || !account) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Deploying project:', selectedProject.projectId);
      
      // Use the centralized deployment orchestrator
      const { deploymentOrchestrator } = await import('./services/DeploymentOrchestrator');
      const result = await deploymentOrchestrator.deployProject(selectedProject.projectId, account, computationMode);

      // Check if deployment failed due to validation errors
      if (result.error) {
        // If it's a validation error, show it as an error, not as "deployment completed"
        if (result.error.includes('Cannot deploy project. Please fix the following issues:')) {
          setError(result.error);
          return; // Don't show deployment completed message
        }
      }

      // Generate success message based on deployment results
      let deploymentMessage = `Project deployment completed!\n\n`;
      
      // Add step-by-step results
      if (result.steps.alSmartContracts === 'success') {
        deploymentMessage += `- AL Smart Contracts: Deployed\n`;
        // Show AL contract addresses if they were actually deployed
        if (result.alContractAddresses) {
          deploymentMessage += `ALProjectVoting: ${result.alContractAddresses.voting}\n`;
          deploymentMessage += `ALProjectStorage: ${result.alContractAddresses.storage}\n`;
        }
      } else if (result.steps.alSmartContracts === 'failed') {
        deploymentMessage += `- AL Smart Contracts: Failed\n`;
        deploymentMessage += `- ALProjectVoting and ALProjectStorage deployment failed\n`;
        deploymentMessage += `- Check console for error details\n`;
      } else if (result.steps.alSmartContracts === 'skipped') {
        deploymentMessage += `- AL Smart Contracts: Skipped (Non-AL Project)\n`;
        deploymentMessage += `- This project doesn't require AL contracts\n`;
      }
      
      if (result.steps.ipfsUpload === 'success') {
        deploymentMessage += `- IPFS Upload: Success\n`;
        deploymentMessage += `- RO-Crate Hash: ${result.roCrateHash}\n`;
      } else {
        deploymentMessage += `- IPFS Upload: Failed\n`;
      }

      if (result.steps.localROCrateSave === 'success') {
        deploymentMessage += `- Local RO-Crate Save: Success\n`;
        deploymentMessage += `- Local Path: ${result.localROCratePath}\n`;
      } else if (result.steps.localROCrateSave === 'failed') {
        deploymentMessage += `- Local RO-Crate Save: Failed\n`;
      } else {
        if (computationMode === 'remote') {
          deploymentMessage += `- Local RO-Crate Save: Skipped (Remote/Infra Sharing mode)\n`;
        } else {
          deploymentMessage += `- Local RO-Crate Save: Skipped\n`;
        }
      }

      // Local file download results
      if (result.steps.localFileDownload === 'success') {
        deploymentMessage += `- Local Files: Downloaded (${result.downloadedFiles?.length || 0} files)\n`;
        deploymentMessage += `- Local Path: ${result.localDownloadPath}\n`;
      } else if (result.steps.localFileDownload === 'failed') {
        deploymentMessage += `- Local Files: Download Failed\n`;
      } else if (result.steps.localFileDownload === 'skipped') {
        deploymentMessage += `- Local Files: Skipped (RO-Crate format used instead)\n`;
      }
      
      if (result.steps.orchestrationDeploy === 'success') {
        deploymentMessage += `- Orchestration: Deployed\n`;
        if (result.orchestrationWorkflowId) {
          deploymentMessage += `- Workflow ID: ${result.orchestrationWorkflowId}\n`;
          deploymentMessage += `- Monitor at: http://145.100.135.97:5004\n`;
        }
      } else if (result.steps.orchestrationDeploy === 'failed') {
        deploymentMessage += `- Orchestration: Failed\n`;
      } else if (result.steps.orchestrationDeploy === 'skipped') {
        deploymentMessage += `- Orchestration: Skipped (Local mode)\n`;
      }
      
      if (result.steps.smartContractUpdate === 'success') {
        deploymentMessage += `- Smart Contract: Updated\n`;
      } else if (result.steps.smartContractUpdate === 'failed') {
        deploymentMessage += `- Smart Contract: Update Failed\n`;
      }

      // Overall status - determine success based on critical steps
      const overallSuccess = result.steps.ipfsUpload === 'success';
      if (overallSuccess) {
        deploymentMessage += `\n - Overall Status: SUCCESS`;
      } else {
        deploymentMessage += `\n - Overall Status: PARTIAL (check individual steps)`;
      }

      if (result.error) {
        deploymentMessage += `\n - Error: ${result.error}`;
      }
      
      alert(deploymentMessage);
      
      // Reload project to get updated configuration
      loadProjectConfiguration(selectedProject.projectId);
    } catch (err) {
      console.error('Failed to deploy project:', err);
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  // REMOVED: deployALContracts function (now in DeploymentOrchestrator)

  // Handle user actions (approve, reject, remove)
  const handleUserAction = async (action: string, userAddress: string) => {
    if (!selectedProject || !account || !selectedProject.contractAddress) return;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(
        selectedProject.contractAddress,
        Project.abi,
        signer
      );

      switch (action) {
        case 'approve':
          console.log('Approving join request for:', userAddress);
          await projectContract.approveJoinRequest(userAddress);
          break;
        case 'reject':
          console.log('Rejecting join request for:', userAddress);
          await projectContract.rejectJoinRequest(userAddress);
          break;
        case 'remove':
          console.log('Removing user:', userAddress);
          // Note: This would need a removeParticipant method in the contract
          // await projectContract.removeParticipant(userAddress);
          console.warn('Remove user functionality not yet implemented in contract');
          break;
        default:
          console.warn('Unknown user action:', action);
      }

      // Reload project data to reflect changes
      loadProjectConfiguration(selectedProject.projectId);
    } catch (error) {
      console.error('Failed to perform user action:', error);
      setError(error instanceof Error ? error.message : 'User action failed');
    }
  };

  const getProjectDescription = (project: DVREProjectConfiguration): string => {
    const baseDescription = project.projectData?.description || project.projectData?.objective || 'No description provided';
    const isALProject = project.extensions?.dal !== undefined;
    
    if (isALProject) {
      return ` Active Learning Project - ${baseDescription}`;
    }
    
    return baseDescription;
  };

  const getProjectTypeLabel = (project: DVREProjectConfiguration): string => {
    if (project.extensions?.dal) {
      return 'Active Learning';
    }
    if (project.extensions?.federated) {
      return 'Federated Learning';
    }
    return 'General';
  };

  const handleCopyRoCrateJSON = () => {
    if (!selectedProject) return;

    // Use enhanced metadata if available, otherwise fall back to regular metadata
    const roCrateJSON = enhancedRoCrateMetadata || JSON.stringify(selectedProject.roCrate.metadata, null, 2);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roCrateJSON).then(() => {
        alert('Enhanced RO-Crate JSON-LD copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        fallbackCopy(roCrateJSON);
      });
    } else {
      fallbackCopy(roCrateJSON);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('Enhanced RO-Crate JSON-LD copied to clipboard!');
    } catch (err) {
      alert('Failed to copy to clipboard. Please copy manually from the JSON viewer.');
    }
    document.body.removeChild(textArea);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return '#10b981'; // Green for deployed
      case 'not deployed': return '#f59e0b'; // Orange for not deployed
      default: return '#6b7280';
    }
  };

  // Show authentication message if not connected
  if (!account) {
    return (
      <div className="project-configuration-panel">
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <h3>{title}</h3>
          <p>Please connect your wallet to access project deployment.</p>
        </div>
      </div>
    );
  }

  // Show loading state while projects are being loaded from blockchain
  const isLoading = loading || projectsLoading;

  const renderProjectList = () => (
    <div className="project-list-view">
      <div className="panel-header">
        <h3>{title}</h3>
        <div className="header-actions">
          <span className="project-count">
            {projects.length} project{projects.length !== 1 ? 's' : ''} owned
          </span>
          <button 
            className="refresh-button"
            onClick={async () => {
              await reloadUserProjects();
              await loadProjects();
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <p>Loading your projects and RO-Crate configurations...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <h4>No Deployable Projects Found</h4>
          <p>Only project <strong>owners/creators</strong> can deploy projects.</p>
          <p>If you've joined projects as a contributor, those projects won't appear here - only the project creator can deploy them.</p>
          <p>Create a new project in <strong>Project Hub</strong> to deploy your own project.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div 
              key={project.projectId}
              className="project-card"
              onClick={() => handleProjectSelect(project.projectId)}
            >
              <div className="project-header">
                <h4>{project.projectData?.name || project.projectData?.project_id || 'Unnamed Project'}</h4>
                <div className="project-badges">
                  <span className="project-type-badge">
                    {getProjectTypeLabel(project)}
                  </span>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(project.status) }}
                  >
                    {project.status}
                  </span>
                </div>
              </div>
              
              <p className="project-description">
                {getProjectDescription(project)}
              </p>
              
              <div className="project-footer">
                <span className="last-modified">
                  Modified: {new Date(project.lastModified).toLocaleDateString()}
                </span>
                {project.ipfs && (
                  <span className="ipfs-status">Published</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderConfiguration = () => (
    <div className="project-config-view">
      <div className="config-header">
        <button 
          className="back-button"
          onClick={() => setView('list')}
        >
          ← Back to Projects
        </button>
        <h3>{selectedProject?.projectData?.name || 'Project Configuration'}</h3>
        <div className="config-actions">
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(selectedProject?.status || 'not deployed') }}
          >
            {selectedProject?.status || 'not deployed'}
          </span>
          <button 
            className="deploy-button"
            onClick={handleDeployProject}
            disabled={loading}
          >
            {loading ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {selectedProject && (
        <div className="config-content">
          {/* Project Information Section */}
          <ProjectInformationPanel project={selectedProject} />

          {/* Project Users Panel */}
          <UserList 
            project={selectedProject} 
            onUserAction={handleUserAction}
          />

          {/* Project Configuration Panel */}
          <div className="config-section">
            <h4>Project Configuration</h4>
            <ProjectConfigurationPanel
              projectId={selectedProject.projectId}
              projectConfig={selectedProject}
              onConfigurationChange={(updatedConfig) => {
                setSelectedProject(updatedConfig);
                onConfigurationChangeRef.current?.(updatedConfig);
              }}
            />
          </div>

          {/* Computation Mode Panel */}
          <ComputationModePanel 
            project={selectedProject} 
            computationMode={computationMode}
            onModeChange={(mode) => {
              setComputationMode(mode);
            }}
          />

          {/* Workflows Panel */}
          <WorkflowsPanel project={selectedProject} />

          {/* RO-Crate JSON-LD Viewer */}
          <div className="config-section">
            <div className="section-header">
              <h4>RO-Crate JSON-LD Metadata</h4>
              <button
                className="copy-json-button"
                onClick={() => handleCopyRoCrateJSON()}
              >
                Copy JSON
              </button>
            </div>
            
            <div className="json-viewer">
              <pre className="json-content">
                {enhancedRoCrateMetadata || JSON.stringify(selectedProject.roCrate.metadata, null, 2)}
              </pre>
            </div>
          </div>

          {/* IPFS Publication Section */}
          {selectedProject.ipfs && (
            <div className="config-section">
              <h4>IPFS Publication</h4>
              <div className="ipfs-info">
                <div className="info-item">
                  <strong>Published:</strong> {new Date(selectedProject.ipfs.publishedAt || '').toLocaleString()}
                </div>
                <div className="info-item">
                  <strong>RO-Crate Hash:</strong> 
                  <code>{selectedProject.ipfs.roCrateHash}</code>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="project-configuration-panel">
      {view === 'list' && renderProjectList()}
      {view === 'configure' && renderConfiguration()}
    </div>
  );
};

export default ProjectDeploymentComponent;