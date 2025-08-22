import React from 'react';
import { ProjectInfo } from '../../hooks/useProjects';

interface ProjectListProps {
  projects: ProjectInfo[];
  title: string;
  onSelectProject: (project: ProjectInfo) => void;
  loading?: boolean;
}

export const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, 
  title, 
  onSelectProject,
  loading = false 
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ color: 'var(--jp-ui-font-color2)' }}>Loading projects...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--jp-layout-color1)',
      border: '1px solid var(--jp-border-color1)',
      borderRadius: '4px',
      padding: '16px',
      maxWidth: '500px'
    }}>
      <h3 style={{ 
        margin: '0 0 16px 0',
        color: 'var(--jp-ui-font-color1)'
      }}>
        {title}
      </h3>
      
      {projects.length === 0 ? (
        <div style={{ 
          color: 'var(--jp-ui-font-color2)',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '20px'
        }}>
          No projects found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projects.map((project) => (
            <div
              key={project.address}
              onClick={() => onSelectProject(project)}
              style={{
                padding: '12px',
                background: 'var(--jp-layout-color0)',
                border: project.isMember 
                  ? '1px solid var(--jp-brand-color2)' 
                  : '1px solid var(--jp-border-color2)',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = project.isMember 
                  ? 'var(--jp-brand-color3)' 
                  : 'var(--jp-layout-color2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--jp-layout-color0)';
              }}
            >
              {/* Join indicator for non-members */}
              {!project.isMember && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: project.hasPendingRequest ? 'var(--jp-warn-color1)' : 'var(--jp-brand-color1)',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontWeight: 'bold'
                }}>
                  {project.hasPendingRequest ? 'PENDING' : 'JOIN'}
                </div>
              )}
              
              <div style={{ 
                fontWeight: 'bold',
                color: 'var(--jp-ui-font-color1)',
                marginBottom: '4px'
              }}>
                {project.objective}
              </div>
              <div style={{ 
                fontSize: '12px',
                color: 'var(--jp-ui-font-color2)',
                marginBottom: '4px'
              }}>
                <strong>Type:</strong> {project.projectData?.type || 'General Project'}
              </div>
              
              <div style={{ 
                fontSize: '12px',
                color: 'var(--jp-ui-font-color2)',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Members: {project.memberCount}</span>
                <span style={{ 
                  color: project.isMember ? 'var(--jp-brand-color1)' : 
                         project.hasPendingRequest ? 'var(--jp-warn-color1)' : 
                         'var(--jp-ui-font-color3)',
                  fontWeight: project.isMember ? 'bold' : 'normal'
                }}>
                  {project.isMember ? 'Joined' : 
                   project.hasPendingRequest ? 'Request Pending' : 
                   'Click to request join'}
                </span>
              </div>
              <div style={{ 
                fontSize: '11px',
                color: 'var(--jp-ui-font-color3)',
                marginTop: '4px'
              }}>
                Created: {new Date(project.created * 1000).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;