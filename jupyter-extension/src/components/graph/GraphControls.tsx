import React from 'react';

interface GraphControlsProps {
  onReset: () => void;
  onExport: () => void;
  projectCount: number;
  connectionCount: number;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  onReset,
  onExport,
  projectCount,
  connectionCount
}) => {
  return (
    <div className="dvre-graph-controls">
      <div className="dvre-graph-stats">
        <div className="dvre-stat-item">
          <span className="dvre-stat-value">{projectCount}</span>
          <span className="dvre-stat-label">Projects</span>
        </div>
        <div className="dvre-stat-item">
          <span className="dvre-stat-value">{connectionCount}</span>
          <span className="dvre-stat-label">Connections</span>
        </div>
      </div>

      <div className="dvre-control-buttons">
        <button
          onClick={onReset}
          className="dvre-control-button refresh"
          type="button"
          title="Refresh project data from blockchain"
        >
          Refresh
        </button>
        
        <button
          onClick={onExport}
          className="dvre-control-button export"
          type="button"
          title="Export graph data"
        >
          Export
        </button>
      </div>
    </div>
  );
};
