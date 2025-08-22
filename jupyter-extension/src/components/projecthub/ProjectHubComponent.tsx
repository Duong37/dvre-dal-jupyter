import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProjects, ProjectInfo, JoinRequest } from '../../hooks/useProjects';
import { useUserRegistry} from '../../hooks/useUserRegistry';
import ProjectCreationHub from './ProjectCreationHub';
import ProjectList from './ProjectList';
import ProjectDetails from './ProjectDetails';
import JoinProjectDialog from './JoinProjectDialog';
import InvitationsAndRequestsList from './InvitationsAndRequestsList';

interface JoinRequestInfo extends JoinRequest {
  projectAddress: string;
  projectName: string;
}

type ViewMode = 'main' | 'create' | 'details' | 'join';

interface ProjectHubComponentProps {
  title?: string;
  initialViewMode?: ViewMode;
  initialProjectAddress?: string;
}

export const ProjectHubComponent: React.FC<ProjectHubComponentProps> = ({ 
  title = 'Project Hub',
  initialViewMode = 'main',
  initialProjectAddress
}) => {
  const { account } = useAuth();
  const { projects, userProjects, loading, error, requestToJoinProject, getProjectRoles, loadProjects, handleJoinRequest } = useProjects();
  const { userInvitations, loading: invitationsLoading, loadUserInvitations, acceptInvitation, rejectInvitation } = useUserRegistry();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProjectAddress || null);
  const [projectToJoin, setProjectToJoin] = useState<ProjectInfo | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequestInfo[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);

  // Load join requests for user's projects
  const loadJoinRequests = useCallback(async () => {
    if (!account || !userProjects.length) {
      setJoinRequests([]);
      return;
    }

    setJoinRequestsLoading(true);
    try {
      const allJoinRequests: JoinRequestInfo[] = [];
      
      for (const project of userProjects) {
        if (project.isOwner && project.joinRequests.length > 0) {
          for (const request of project.joinRequests) {
            allJoinRequests.push({
              ...request,
              projectAddress: project.address,
              projectName: project.objective || 'Unknown Project'
            });
          }
        }
      }
      
      setJoinRequests(allJoinRequests);
    } catch (err) {
      console.error('Failed to load join requests:', err);
    } finally {
      setJoinRequestsLoading(false);
    }
  }, [account, userProjects]);

  // Load both invitations and join requests
  const loadInvitationsAndRequests = useCallback(async () => {
    if (!account) return;
    
    await Promise.all([
      loadUserInvitations(),
      loadJoinRequests()
    ]);
  }, [account, loadUserInvitations, loadJoinRequests]);

  // Load invitations and requests when component mounts or userProjects change
  useEffect(() => {
    if (account) {
      loadUserInvitations();
    }
  }, [account, loadUserInvitations]);

  useEffect(() => {
    if (account && userProjects.length > 0) {
      loadJoinRequests();
    }
  }, [account, userProjects, loadJoinRequests]);

  // Action handlers for invitations and join requests
  const handleAcceptInvitation = async (projectAddress: string) => {
    try {
      const success = await acceptInvitation(projectAddress);
      if (success) {
        await loadInvitationsAndRequests();
        alert('Invitation accepted successfully!');
      }
    } catch (err) {
      console.error('Failed to accept invitation:', err);
    }
  };

  const handleRejectInvitation = async (projectAddress: string) => {
    try {
      const success = await rejectInvitation(projectAddress);
      if (success) {
        await loadInvitationsAndRequests();
        alert('Invitation rejected.');
      }
    } catch (err) {
      console.error('Failed to reject invitation:', err);
    }
  };

  const handleApproveJoinRequest = async (projectAddress: string, memberAddress: string) => {
    try {
      const success = await handleJoinRequest(projectAddress, memberAddress, true);
      if (success) {
        await loadInvitationsAndRequests();
        alert('Join request approved successfully!');
      }
    } catch (err) {
      console.error('Failed to approve join request:', err);
    }
  };

  const handleRejectJoinRequest = async (projectAddress: string, memberAddress: string) => {
    try {
      const success = await handleJoinRequest(projectAddress, memberAddress, false);
      if (success) {
        await loadInvitationsAndRequests();
        alert('Join request rejected.');
      }
    } catch (err) {
      console.error('Failed to reject join request:', err);
    }
  };

  const handleSelectProject = async (project: ProjectInfo) => {
    if (project.isMember) {
      // User is already a member, show project details
      setSelectedProject(project.address);
      setViewMode('details');
    } else if (project.hasPendingRequest) {
      // User has a pending request, show a message
      alert('You already have a pending join request for this project. Please wait for the project creator to review your request.');
    } else {
      // User is not a member and has no pending request, load available roles and show join dialog
      setProjectToJoin(project);
      try {
        const roles = await getProjectRoles(project.address);
        
        // Debug: Log project data and roles
        console.log('Project data:', project.projectData);
        console.log('Project type (camelCase):', project.projectData?.projectType);
        console.log('Project type (underscore):', project.projectData?.project_type);
        console.log('Original roles:', roles);
        
        // Filter out 'coordinator' role for active learning projects
        let filteredRoles = roles;
        const isActivelearning = project.projectData?.projectType === 'active_learning' || 
                                project.projectData?.project_type === 'active_learning';
        
        console.log('Project type (camelCase):', project.projectData?.projectType);
        console.log('Project type (underscore):', project.projectData?.project_type);
        console.log('Is active learning project:', isActivelearning);
        
        if (isActivelearning) {
          filteredRoles = roles.filter(role => 
            role.toLowerCase() !== 'coordinator'
          );
          
          console.log('Filtered roles (removed coordinator):', filteredRoles);
          
          // If no roles remain after filtering, provide 'contributor' as default
          if (filteredRoles.length === 0) {
            filteredRoles = ['contributor'];
            console.log('No roles left, using default: contributor');
          }
        }
        
        setAvailableRoles(filteredRoles);
      } catch (err) {
        console.error('Failed to load project roles:', err);
        setAvailableRoles([]);
      }
      setViewMode('join');
    }
  };

  const handleJoinProject = async (role: string): Promise<boolean> => {
    if (!projectToJoin) return false;
    
    setJoinLoading(true);
    try {
      const success = await requestToJoinProject(projectToJoin.address, role);
      if (success) {
        // Successfully submitted join request
        alert(`Join request submitted successfully! The project creator will review your request to join as "${role}".`);
        console.log('Successfully submitted join request');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to submit join request:', err);
      return false;
    } finally {
      setJoinLoading(false);
    }
  };

  const handleBackToMain = () => {
    setViewMode('main');
    setSelectedProject(null);
    setProjectToJoin(null);
    setAvailableRoles([]);
    setJoinLoading(false);
  };

  const handleRefreshProjects = async () => {
    try {
      await Promise.all([
        loadProjects(),
        loadInvitationsAndRequests()
      ]);
    } catch (error) {
      console.error('Failed to refresh projects:', error);
    }
  };

  if (!account) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <h1 style={{ 
          fontSize: '1.5rem',
          color: 'var(--jp-ui-font-color1)',
          margin: '0 0 16px 0'
        }}        >
          Project Hub
        </h1>
        <p style={{ 
          color: 'var(--jp-ui-font-color2)'
        }}>
          Please connect your wallet to access project hub features.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: 'var(--jp-error-color1)'
      }}>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (viewMode === 'join' && projectToJoin) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <JoinProjectDialog
          project={projectToJoin}
          availableRoles={availableRoles}
          onJoin={handleJoinProject}
          onCancel={handleBackToMain}
          loading={joinLoading}
        />
      </div>
    );
  }

  if (viewMode === 'details' && selectedProject) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <ProjectDetails 
          projectAddress={selectedProject}
          onBack={handleBackToMain}
          onMembershipChange={handleRefreshProjects}
        />
      </div>
    );
  }

  const handleProjectCreationSuccess = () => {
    setViewMode('main');
    handleRefreshProjects();
  };

  if (viewMode === 'create') {
    return (
      <ProjectCreationHub 
        onBack={handleBackToMain}
        onSuccess={handleProjectCreationSuccess}
      />
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ 
          fontSize: '1.5rem',
          color: 'var(--jp-ui-font-color1)',
          margin: 0
        }}        >
          Project Hub
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleRefreshProjects}
            disabled={loading || invitationsLoading || joinRequestsLoading}
            style={{
              padding: '8px 16px',
              background: 'var(--jp-layout-color2)',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '3px',
              cursor: (loading || invitationsLoading || joinRequestsLoading) ? 'not-allowed' : 'pointer',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '13px',
              opacity: (loading || invitationsLoading || joinRequestsLoading) ? 0.6 : 1
            }}
          >
            {(loading || invitationsLoading || joinRequestsLoading) ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setViewMode('create')}
            style={{
              padding: '8px 16px',
              background: 'var(--jp-brand-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            + New Project
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
      }}>
        <ProjectList
          projects={userProjects}
          title="My Projects"
          onSelectProject={handleSelectProject}
          loading={loading || invitationsLoading || joinRequestsLoading}
        />
        
        <ProjectList
          projects={projects.filter(p => !p.isMember)}
          title="Available Projects"
          onSelectProject={handleSelectProject}
          loading={loading || invitationsLoading || joinRequestsLoading}
        />

        {/* Invitations and Join Requests Section */}
        <InvitationsAndRequestsList 
          userInvitations={userInvitations} 
          joinRequests={joinRequests} 
          onAcceptInvitation={handleAcceptInvitation}
          onRejectInvitation={handleRejectInvitation}
          onApproveJoinRequest={handleApproveJoinRequest}
          onRejectJoinRequest={handleRejectJoinRequest}
          loading={loading || invitationsLoading || joinRequestsLoading}
        />
      </div>
    </div>
  );
};

export default ProjectHubComponent;