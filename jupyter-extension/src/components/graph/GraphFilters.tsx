import React from 'react';
import { FilterOptions, ProjectInfo } from './GraphTypes';

interface GraphFiltersProps {
  filterOptions: FilterOptions;
  onFilterChange: (newFilters: Partial<FilterOptions>) => void;
  availableProjects: ProjectInfo[];
}

export const GraphFilters: React.FC<GraphFiltersProps> = ({
  filterOptions,
  onFilterChange,
  availableProjects
}) => {
  const handleResourceTypeChange = (type: keyof FilterOptions, checked: boolean) => {
    onFilterChange({ [type]: checked });
  };

  const handleMinConnectionsChange = (value: number) => {
    onFilterChange({ minConnections: value });
  };

  const handleProjectSelection = (projectId: string, selected: boolean) => {
    const newSelection = selected 
      ? [...filterOptions.selectedProjects, projectId]
      : filterOptions.selectedProjects.filter(id => id !== projectId);
    
    onFilterChange({ selectedProjects: newSelection });
  };

  const selectAllProjects = () => {
    onFilterChange({ selectedProjects: availableProjects.map(p => p.id) });
  };

  const clearProjectSelection = () => {
    onFilterChange({ selectedProjects: [] });
  };

  return (
    <div className="dvre-graph-filters">
      <h3>Filters</h3>

      {/* Resource Type Filters */}
      <div className="dvre-filter-section">
        <h4>Show Connections</h4>
        <div className="dvre-filter-checkboxes">
          <label className="dvre-checkbox-label">
            <input
              type="checkbox"
              checked={filterOptions.showMembers}
              onChange={(e) => handleResourceTypeChange('showMembers', e.target.checked)}
            />
            <span className="dvre-connection-type members">Members</span>
          </label>

          <label className="dvre-checkbox-label">
            <input
              type="checkbox"
              checked={filterOptions.showData}
              onChange={(e) => handleResourceTypeChange('showData', e.target.checked)}
            />
            <span className="dvre-connection-type data">Data</span>
          </label>

          <label className="dvre-checkbox-label">
            <input
              type="checkbox"
              checked={filterOptions.showModels}
              onChange={(e) => handleResourceTypeChange('showModels', e.target.checked)}
            />
            <span className="dvre-connection-type models">Models</span>
          </label>

          <label className="dvre-checkbox-label">
            <input
              type="checkbox"
              checked={filterOptions.showInfrastructure}
              onChange={(e) => handleResourceTypeChange('showInfrastructure', e.target.checked)}
            />
            <span className="dvre-connection-type infrastructure">Infrastructure</span>
          </label>
        </div>
      </div>

      {/* Connection Threshold */}
      <div className="dvre-filter-section">
        <h4>Minimum Connections</h4>
        <div className="dvre-connection-slider">
          <input
            type="range"
            min="1"
            max="10"
            value={filterOptions.minConnections}
            onChange={(e) => handleMinConnectionsChange(parseInt(e.target.value))}
            className="dvre-slider"
          />
          <span className="dvre-slider-value">{filterOptions.minConnections}</span>
        </div>
        <p className="dvre-filter-description">
          Hide resources with fewer than {filterOptions.minConnections} connection{filterOptions.minConnections !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Project Selection */}
      <div className="dvre-filter-section">
        <h4>Focus on Projects</h4>
        <div className="dvre-project-controls">
          <button
            onClick={selectAllProjects}
            className="dvre-filter-button secondary"
            type="button"
          >
            Select All
          </button>
          <button
            onClick={clearProjectSelection}
            className="dvre-filter-button secondary"
            type="button"
          >
            Clear Selection
          </button>
        </div>
        
        <div className="dvre-project-list">
          {availableProjects.map((project) => (
            <label key={project.id} className="dvre-checkbox-label">
              <input
                type="checkbox"
                checked={filterOptions.selectedProjects.includes(project.id)}
                onChange={(e) => handleProjectSelection(project.id, e.target.checked)}
              />
              <span className="dvre-project-name">{project.name}</span>
            </label>
          ))}
        </div>
        
        {filterOptions.selectedProjects.length === 0 && (
          <p className="dvre-filter-description">
            No projects selected - showing all connections
          </p>
        )}
        {filterOptions.selectedProjects.length > 0 && (
          <p className="dvre-filter-description">
            Focusing on {filterOptions.selectedProjects.length} selected project{filterOptions.selectedProjects.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Quick Filters */}
      <div className="dvre-filter-section">
        <h4>Quick Filters</h4>
        <div className="dvre-quick-filters">
          <button
            onClick={() => onFilterChange({
              showMembers: true,
              showData: false,
              showModels: false,
              showInfrastructure: false
            })}
            className="dvre-filter-button secondary small"
            type="button"
          >
            Only Members
          </button>
          
          <button
            onClick={() => onFilterChange({
              showMembers: false,
              showData: true,
              showModels: true,
              showInfrastructure: false
            })}
            className="dvre-filter-button secondary small"
            type="button"
          >
            Data & Models
          </button>
          
          <button
            onClick={() => onFilterChange({
              showMembers: true,
              showData: true,
              showModels: true,
              showInfrastructure: true
            })}
            className="dvre-filter-button secondary small"
            type="button"
          >
            Show All
          </button>
        </div>
      </div>
    </div>
  );
};
