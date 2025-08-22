import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GraphVisualization } from './GraphVisualization';
import { GraphFilters } from './GraphFilters';
import { GraphControls } from './GraphControls';
import { useGraphData } from '../../hooks/useGraphData';
import { useAuth } from '../../hooks/useAuth';
import { GraphDataProcessor } from '../../utils/GraphDataProcessor';
import { FilterOptions } from './GraphTypes';

interface GraphComponentProps {
  title: string;
}

const GraphComponent: React.FC<GraphComponentProps> = ({ title }) => {
  const { account } = useAuth();
  const { graphData, loading, error, refreshGraphData, projectCount, hasProjects } = useGraphData();
  
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    showMembers: true,
    showData: true,
    showModels: true,
    showInfrastructure: true,
    minConnections: 1,
    selectedProjects: []
  });

  // Apply filters to graph data
  const filteredGraphData = useMemo(() => {
    if (!graphData) return null;
    
    const processor = new GraphDataProcessor();
    return processor.applyFilters(graphData, filterOptions);
  }, [graphData, filterOptions]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<FilterOptions>) => {
    setFilterOptions((prev: FilterOptions) => ({ ...prev, ...newFilters }));
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refreshGraphData();
  }, [refreshGraphData]);

  // Auto-load data when component mounts and user is connected
  useEffect(() => {
    if (account && !graphData && !loading) {
      refreshGraphData();
    }
  }, [account, graphData, loading, refreshGraphData]);

  // Wallet not connected
  if (!account) {
    return (
      <div className="dvre-graph-container">
        <div className="dvre-graph-header">
          <h2>{title}</h2>
          <p className="dvre-graph-description">
            Visualize connections between your blockchain projects through shared members, data, models, and infrastructure.
          </p>
        </div>

        <div className="dvre-graph-connect-prompt">
          <div className="dvre-connect-card">
            <h3>Authentication Required</h3>
            <p>
              You need to be authenticated to access the project graph.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="dvre-graph-container">
        <div className="dvre-graph-header">
          <h2>{title}</h2>
          <p className="dvre-graph-description">
            Visualize connections between your blockchain projects through shared members, data, models, and infrastructure.
          </p>
        </div>

        <div className="dvre-graph-loading">
          <div className="dvre-spinner"></div>
          <p>Loading your projects from the blockchain...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dvre-graph-container">
        <div className="dvre-graph-header">
          <h2>{title}</h2>
          <p className="dvre-graph-description">
            Visualize connections between your blockchain projects through shared members, data, models, and infrastructure.
          </p>
        </div>

        <div className="dvre-graph-error">
          <div className="dvre-error-icon"></div>
          <h3>Error Loading Projects</h3>
          <p>{error}</p>
          <button 
            onClick={handleRefresh}
            className="dvre-retry-button"
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No projects found
  if (!hasProjects || !graphData || graphData.nodes.length === 0) {
    return (
      <div className="dvre-graph-container">
        <div className="dvre-graph-header">
          <h2>{title}</h2>
          <p className="dvre-graph-description">
            Visualize connections between your blockchain projects through shared members, data, models, and infrastructure.
          </p>
        </div>

        <div className="dvre-graph-empty">
          <h3>No Projects Found</h3>
          <p>
            You don't have any projects registered on the blockchain yet. 
            Create or join projects using the Project Hub tool to see connections here.
          </p>
          <button 
            onClick={handleRefresh}
            className="dvre-refresh-button"
            type="button"
          >
            Refresh Projects
          </button>
        </div>
      </div>
    );
  }

  // Main graph view
  return (
    <div className="dvre-graph-container">
      <div className="dvre-graph-header">
        <h2>{title}</h2>
        <p className="dvre-graph-description">
          Visualizing connections between your {projectCount} blockchain project{projectCount !== 1 ? 's' : ''} through shared resources.
        </p>
      </div>

      <div className="dvre-graph-content">
        <div className="dvre-graph-view">
          <div className="dvre-graph-controls-panel">
            <GraphControls 
              onReset={handleRefresh}
              onExport={() => {/* TODO: Implement export */}}
              projectCount={graphData.nodes.filter((n: any) => n.type === 'project').length}
              connectionCount={graphData.links.length}
            />
            
            <GraphFilters
              filterOptions={filterOptions}
              onFilterChange={handleFilterChange}
              availableProjects={graphData.nodes
                .filter((n: any) => n.type === 'project')
                .map((n: any) => ({ id: n.id, name: n.label }))
              }
            />
          </div>

          <div className="dvre-graph-visualization">
            {filteredGraphData && (
              <GraphVisualization
                data={filteredGraphData}
                width={800}
                height={600}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphComponent;
