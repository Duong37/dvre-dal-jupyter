import React, { useState, useEffect, useCallback } from 'react';
import { useProjects, ProjectInfo } from '../../hooks/useProjects';
import { useAuth } from '../../hooks/useAuth';
import FederatedLearningProjectList from './FederatedLearningProjectList';
import FederatedLearningDetails from './FederatedLearningDetails';

interface FederatedLearningComponentProps {
  title: string;
}

export interface FederatedLearningProject extends ProjectInfo {
  assets: {
    datasets: Array<{
      name: string;
      description: string;
      location: string;
      format: string;
      size?: string;
    }>;
    scripts: Array<{
      name: string;
      description: string;
      type: 'training' | 'validation' | 'preprocessing';
      location: string;
    }>;
  };
  workflow: {
    steps: Array<{
      name: string;
      description: string;
      type: 'data_prep' | 'local_training' | 'aggregation' | 'evaluation';
      status: 'pending' | 'running' | 'completed' | 'failed';
      assignedTo?: string;
    }>;
  };
  policies: {
    access: {
      dataSharing: boolean;
      modelSharing: boolean;
      resultsSharing: boolean;
    };
    privacy: {
      differentialPrivacy?: boolean;
      homomorphicEncryption?: boolean;
      secureAggregation?: boolean;
    };
  };
}

const FederatedLearningComponent: React.FC<FederatedLearningComponentProps> = ({ title }) => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [federatedProjects, setFederatedProjects] = useState<FederatedLearningProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { userProjects } = useProjects();
  const { account } = useAuth();

  // Filter and load federated learning projects
  const loadFederatedLearningProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const flProjects: FederatedLearningProject[] = [];
      
      for (const project of userProjects) {
        // Check if this is a federated learning project
        if (project.projectData?.type === 'federated_learning') {
          // Transform the project data to include federated learning specific fields
          const flProject: FederatedLearningProject = {
            ...project,
            assets: project.projectData.assets || { datasets: [], scripts: [] },
            workflow: project.projectData.workflow || { steps: [] },
            policies: project.projectData.policies || { 
              access: { dataSharing: false, modelSharing: false, resultsSharing: false },
              privacy: {}
            }
          };
          flProjects.push(flProject);
        }
      }
      
      setFederatedProjects(flProjects);
    } catch (err: any) {
      setError(`Failed to load federated learning projects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [userProjects]);

  useEffect(() => {
    loadFederatedLearningProjects();
  }, [loadFederatedLearningProjects]);

  const handleSelectProject = (projectAddress: string) => {
    setSelectedProject(projectAddress);
  };

  const handleBackToList = () => {
    setSelectedProject(null);
  };

  const handleRefresh = () => {
    loadFederatedLearningProjects();
  };

  if (!account) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'var(--jp-warn-color3)',
          border: '1px solid var(--jp-warn-color1)',
          borderRadius: '4px',
          padding: '20px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3 style={{ color: 'var(--jp-warn-color1)', margin: '0 0 10px 0' }}>
            Authentication Required
          </h3>
          <p style={{ color: 'var(--jp-ui-font-color1)', margin: 0 }}>
            Please connect your wallet in the Authentication tool to access federated learning projects.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <div style={{
          background: 'var(--jp-error-color3)',
          border: '1px solid var(--jp-error-color1)',
          borderRadius: '4px',
          padding: '20px',
          color: 'var(--jp-error-color1)'
        }}>
          <h3>Error</h3>
          <p>{error}</p>
          <button 
            onClick={handleRefresh}
            style={{
              padding: '8px 16px',
              background: 'var(--jp-error-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show project details if one is selected
  if (selectedProject) {
    const project = federatedProjects.find(p => p.address === selectedProject);
    if (project) {
      return (
        <FederatedLearningDetails 
          project={project}
          onBack={handleBackToList}
        />
      );
    }
  }

  // Show main federated learning project list
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
        }}>
          Federated Learning Projects
        </h1>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: 'var(--jp-brand-color1)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {federatedProjects.length === 0 && !loading ? (
        <div style={{
          background: 'var(--jp-layout-color2)',
          border: '1px solid var(--jp-border-color1)',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--jp-ui-font-color2)'
        }}>
          <h3 style={{ color: 'var(--jp-ui-font-color1)', margin: '0 0 8px 0' }}>
            No Federated Learning Projects
          </h3>
          <p style={{ margin: '0 0 16px 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            You're not part of any federated learning projects yet. Create one using the Project Hub tool
            with the "Federated Learning" template.
          </p>
        </div>
      ) : (
        <FederatedLearningProjectList
          projects={federatedProjects}
          onSelectProject={handleSelectProject}
          loading={loading}
        />
      )}
    </div>
  );
};

export default FederatedLearningComponent;
