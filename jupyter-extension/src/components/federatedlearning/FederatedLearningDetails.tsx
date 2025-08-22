import React, { useState } from 'react';
import { FederatedLearningProject } from './FederatedLearningComponent';

interface FederatedLearningDetailsProps {
  project: FederatedLearningProject;
  onBack: () => void;
}

const FederatedLearningDetails: React.FC<FederatedLearningDetailsProps> = ({
  project,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'workflow' | 'participants' | 'privacy'>('overview');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'var(--jp-success-color1)';
      case 'running': return 'var(--jp-warn-color1)';
      case 'failed': return 'var(--jp-error-color1)';
      default: return 'var(--jp-ui-font-color3)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'running': return 'Running';
      case 'failed': return 'Failed';
      default: return 'Loading';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const TabButton: React.FC<{ id: string; label: string; }> = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id as any)}
      style={{
        padding: '8px 16px',
        background: activeTab === id ? 'var(--jp-brand-color1)' : 'var(--jp-layout-color2)',
        color: activeTab === id ? 'white' : 'var(--jp-ui-font-color1)',
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease'
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <button
            onClick={onBack}
            style={{
              padding: '6px 12px',
              background: 'var(--jp-layout-color2)',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '3px',
              cursor: 'pointer',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '13px',
              marginBottom: '10px'
            }}
          >
            ← Back to Projects
          </button>
          <h1 style={{ 
            fontSize: '1.5rem',
            color: 'var(--jp-ui-font-color1)',
            margin: 0
          }}>
            {project.objective}
          </h1>
          <div style={{
            fontSize: '13px',
            color: 'var(--jp-ui-font-color2)',
            marginTop: '4px'
          }}>
            Created: {formatDate(project.created)} • 
            Last Modified: {formatDate(project.lastModified)}
          </div>
        </div>
        <div style={{
          background: 'var(--jp-brand-color1)',
          color: 'white',
          fontSize: '12px',
          padding: '6px 12px',
          borderRadius: '16px',
          fontWeight: 'bold'
        }}>
          FEDERATED LEARNING
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <TabButton id="overview" label="Overview" />
        <TabButton id="assets" label="Assets" />
        <TabButton id="workflow" label="Workflow" />
        <TabButton id="participants" label="Participants" />
        <TabButton id="privacy" label="Privacy" />
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'var(--jp-layout-color0)',
        border: '1px solid var(--jp-border-color1)',
        borderRadius: '8px',
        padding: '20px',
        minHeight: '400px'
      }}>
        {activeTab === 'overview' && (
          <div>
            <h3 style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '16px' }}>
              Project Overview
            </h3>
            
            {project.description && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--jp-ui-font-color1)', fontSize: '14px', marginBottom: '8px' }}>
                  Description
                </h4>
                <p style={{ 
                  color: 'var(--jp-ui-font-color2)', 
                  lineHeight: '1.5',
                  margin: 0
                }}>
                  {project.description}
                </p>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'var(--jp-layout-color2)',
                padding: '16px',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--jp-brand-color1)' }}>
                  {project.assets?.datasets?.length || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                  Datasets
                </div>
              </div>
              
              <div style={{
                background: 'var(--jp-layout-color2)',
                padding: '16px',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--jp-success-color1)' }}>
                  {project.assets?.scripts?.length || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                  Scripts
                </div>
              </div>
              
              <div style={{
                background: 'var(--jp-layout-color2)',
                padding: '16px',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--jp-warn-color1)' }}>
                  {project.workflow?.steps?.length || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                  Workflow Steps
                </div>
              </div>
              
              <div style={{
                background: 'var(--jp-layout-color2)',
                padding: '16px',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--jp-ui-font-color1)' }}>
                  {project.memberCount}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                  Members
                </div>
              </div>
            </div>

            {/* Quick Status */}
            <div style={{
              background: 'var(--jp-layout-color2)',
              padding: '16px',
              borderRadius: '6px'
            }}>
              <h4 style={{ color: 'var(--jp-ui-font-color1)', fontSize: '14px', marginBottom: '8px' }}>
                Current Status
              </h4>
              <div style={{ color: 'var(--jp-ui-font-color2)' }}>
                {!project.workflow?.steps?.length ? (
                  'No workflow defined yet'
                ) : (
                  <>
                    {project.workflow.steps.filter((s: any) => s?.status === 'completed').length} of {project.workflow.steps.length} steps completed
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div>
            <h3 style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '16px' }}>
              Project Assets
            </h3>
            
            {/* Datasets */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--jp-ui-font-color1)', fontSize: '16px', marginBottom: '12px' }}>
                Datasets ({project.assets?.datasets?.length || 0})
              </h4>
              {!project.assets?.datasets?.length ? (
                <p style={{ color: 'var(--jp-ui-font-color3)', fontStyle: 'italic' }}>
                  No datasets registered yet
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {project.assets.datasets.map((dataset: any, index: number) => (
                    <div 
                      key={index}
                      style={{
                        background: 'var(--jp-layout-color2)',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--jp-border-color2)'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: 'var(--jp-ui-font-color1)', marginBottom: '4px' }}>
                        {dataset.name || 'Unnamed Dataset'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--jp-ui-font-color2)', marginBottom: '4px' }}>
                        {dataset.description || 'No description provided'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color3)' }}>
                        Format: {dataset.format || 'Unknown'} • Location: {dataset.location || 'Not specified'}
                        {dataset.size && ` • Size: ${dataset.size}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scripts */}
            <div>
              <h4 style={{ color: 'var(--jp-ui-font-color1)', fontSize: '16px', marginBottom: '12px' }}>
                Scripts ({project.assets?.scripts?.length || 0})
              </h4>
              {!project.assets?.scripts?.length ? (
                <p style={{ color: 'var(--jp-ui-font-color3)', fontStyle: 'italic' }}>
                  No scripts registered yet
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {project.assets.scripts.map((script: any, index: number) => (
                    <div 
                      key={index}
                      style={{
                        background: 'var(--jp-layout-color2)',
                        padding: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--jp-border-color2)'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: 'var(--jp-ui-font-color1)', marginBottom: '4px' }}>
                        {script.name || 'Unnamed Script'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--jp-ui-font-color2)', marginBottom: '4px' }}>
                        {script.description || 'No description provided'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color3)' }}>
                        Type: {script.type ? script.type.replace('_', ' ') : 'Unknown'} • Location: {script.location || 'Not specified'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div>
            <h3 style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '16px' }}>
              Federated Learning Workflow
            </h3>
            
            {!project.workflow?.steps?.length ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'var(--jp-ui-font-color3)'
              }}>
                <p>No workflow steps defined yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {project.workflow.steps.map((step: any, index: number) => (
                  <div 
                    key={index}
                    style={{
                      background: 'var(--jp-layout-color2)',
                      padding: '16px',
                      borderRadius: '6px',
                      border: '1px solid var(--jp-border-color2)',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--jp-ui-font-color1)' }}>
                        {getStatusIcon(step.status || 'pending')} {step.name || 'Unnamed Step'}
                      </div>
                      <div style={{
                        background: getStatusColor(step.status || 'pending'),
                        color: 'white',
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                      }}>
                        {step.status ? step.status.toUpperCase() : 'UNKNOWN'}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '13px', color: 'var(--jp-ui-font-color2)', marginBottom: '8px' }}>
                      {step.description || 'No description provided'}
                    </div>
                    
                    <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color3)' }}>
                      Type: {step.type ? step.type.replace('_', ' ') : 'Unknown'}
                      {step.assignedTo && ` • Assigned to: ${step.assignedTo}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <div>
            <h3 style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '16px' }}>
              Project Participants ({project.participants?.length || 0})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(project.participants || []).map((participant: any, index: number) => (
                <div 
                  key={index}
                  style={{
                    background: 'var(--jp-layout-color2)',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid var(--jp-border-color2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--jp-ui-font-color1)' }}>
                      {participant.address || 'Unknown Address'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color3)' }}>
                      {participant.address === project.creator ? 'Project Creator' : 'Member'}
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--jp-brand-color1)',
                    color: 'white',
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontWeight: 'bold'
                  }}>
                    {participant.role ? participant.role.toUpperCase() : 'MEMBER'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <h3 style={{ color: 'var(--jp-ui-font-color1)', marginBottom: '16px' }}>
              Privacy & Security Settings
            </h3>
            
            {/* Access Policies */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--jp-ui-font-color1)', fontSize: '16px', marginBottom: '12px' }}>
                Access Policies
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{
                  background: 'var(--jp-layout-color2)',
                  padding: '12px',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                    {project.policies?.access?.dataSharing ? '' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                    Data Sharing
                  </div>
                </div>
                
                <div style={{
                  background: 'var(--jp-layout-color2)',
                  padding: '12px',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                    {project.policies?.access?.modelSharing ? '' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                    Model Sharing
                  </div>
                </div>
                
                <div style={{
                  background: 'var(--jp-layout-color2)',
                  padding: '12px',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                    {project.policies?.access?.resultsSharing ? '' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                    Results Sharing
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Techniques */}
            <div>
              <h4 style={{ color: 'var(--jp-ui-font-color1)', fontSize: '16px', marginBottom: '12px' }}>
                Privacy-Preserving Techniques
              </h4>
              {!Object.keys(project.policies?.privacy || {}).length ? (
                <p style={{ color: 'var(--jp-ui-font-color3)', fontStyle: 'italic' }}>
                  No privacy techniques configured
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                  {project.policies?.privacy?.differentialPrivacy && (
                    <div style={{
                      background: 'var(--jp-success-color3)',
                      border: '1px solid var(--jp-success-color1)',
                      padding: '12px',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--jp-success-color1)', marginBottom: '4px' }}>
                        Differential Privacy
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                        Adds noise to protect individual data points
                      </div>
                    </div>
                  )}
                  
                  {project.policies?.privacy?.homomorphicEncryption && (
                    <div style={{
                      background: 'var(--jp-success-color3)',
                      border: '1px solid var(--jp-success-color1)',
                      padding: '12px',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--jp-success-color1)', marginBottom: '4px' }}>
                        Homomorphic Encryption
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                        Enables computation on encrypted data
                      </div>
                    </div>
                  )}
                  
                  {project.policies?.privacy?.secureAggregation && (
                    <div style={{
                      background: 'var(--jp-success-color3)',
                      border: '1px solid var(--jp-success-color1)',
                      padding: '12px',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--jp-success-color1)', marginBottom: '4px' }}>
                        Secure Aggregation
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--jp-ui-font-color2)' }}>
                        Combines model updates without revealing individual contributions
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FederatedLearningDetails;
