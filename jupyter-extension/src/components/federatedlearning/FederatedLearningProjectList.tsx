import React from 'react';
import { FederatedLearningProject } from './FederatedLearningComponent';

interface FederatedLearningProjectListProps {
  projects: FederatedLearningProject[];
  onSelectProject: (projectAddress: string) => void;
  loading: boolean;
}

const FederatedLearningProjectList: React.FC<FederatedLearningProjectListProps> = ({
  projects,
  onSelectProject,
  loading
}) => {
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '200px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--jp-border-color1)',
          borderTop: '4px solid var(--jp-brand-color1)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  const getProjectStatus = (project: FederatedLearningProject) => {
    if (!project.workflow.steps.length) return 'No workflow defined';
    
    const completedSteps = project.workflow.steps.filter(step => step.status === 'completed').length;
    const totalSteps = project.workflow.steps.length;
    const runningSteps = project.workflow.steps.filter(step => step.status === 'running').length;
    const failedSteps = project.workflow.steps.filter(step => step.status === 'failed').length;
    
    if (failedSteps > 0) return 'Issues detected';
    if (runningSteps > 0) return 'In progress';
    if (completedSteps === totalSteps) return 'Completed';
    return `${completedSteps}/${totalSteps} steps completed`;
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '20px'
    }}>
      {projects.map((project) => (
        <div
          key={project.address}
          onClick={() => onSelectProject(project.address)}
          style={{
            background: 'var(--jp-layout-color0)',
            border: '1px solid var(--jp-border-color1)',
            borderRadius: '8px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--jp-brand-color1)';
            e.currentTarget.style.background = 'var(--jp-layout-color2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--jp-border-color1)';
            e.currentTarget.style.background = 'var(--jp-layout-color0)';
          }}
        >

          {/* Project Title */}
          <div style={{ 
            fontWeight: 'bold',
            color: 'var(--jp-ui-font-color1)',
            marginBottom: '8px',
            fontSize: '16px',
            paddingRight: '80px' // Space for badge
          }}>
            {project.objective}
          </div>

          {/* Project Description */}
          {project.description && (
            <div style={{ 
              fontSize: '13px',
              color: 'var(--jp-ui-font-color2)',
              marginBottom: '12px',
              lineHeight: '1.4'
            }}>
              {project.description}
            </div>
          )}

          {/* Assets Summary */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '12px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--jp-ui-font-color2)' }}>
                {project.assets.datasets.length} dataset{project.assets.datasets.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--jp-ui-font-color2)' }}>
                {project.assets.scripts.length} script{project.assets.scripts.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Workflow Status */}
          <div style={{
            padding: '8px 12px',
            background: 'var(--jp-layout-color1)',
            borderRadius: '4px',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '12px',
              color: 'var(--jp-ui-font-color2)',
              marginBottom: '4px'
            }}>
              Workflow Status
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--jp-ui-font-color1)',
              fontWeight: '500'
            }}>
              {getProjectStatus(project)}
            </div>
          </div>

          {/* Members and Role */}
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--jp-ui-font-color2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{project.memberCount} member{project.memberCount !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ 
              color: project.isOwner ? 'var(--jp-brand-color1)' : 'var(--jp-ui-font-color1)',
              fontWeight: project.isOwner ? 'bold' : 'normal'
            }}>
              {project.isOwner ? 'Owner' : 'Member'}
            </div>
          </div>

          {/* Privacy Features */}
          {Object.keys(project.policies.privacy || {}).length > 0 && (
            <div style={{
              marginTop: '8px',
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap'
            }}>
              {project.policies.privacy?.differentialPrivacy && (
                <span style={{
                  background: 'var(--jp-success-color3)',
                  color: 'var(--jp-success-color1)',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}>
                  DP
                </span>
              )}
              {project.policies.privacy?.homomorphicEncryption && (
                <span style={{
                  background: 'var(--jp-success-color3)',
                  color: 'var(--jp-success-color1)',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}>
                  HE
                </span>
              )}
              {project.policies.privacy?.secureAggregation && (
                <span style={{
                  background: 'var(--jp-success-color3)',
                  color: 'var(--jp-success-color1)',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}>
                  SA
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FederatedLearningProjectList;
