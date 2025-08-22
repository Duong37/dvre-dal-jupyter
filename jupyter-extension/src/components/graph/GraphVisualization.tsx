import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GraphData, GraphNode } from './GraphTypes';

interface GraphVisualizationProps {
  data: GraphData;
  width: number;
  height: number;
}

interface SimulationNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  data,
  width,
  height
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<SimulationNode[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ show: boolean; x: number; y: number; node?: GraphNode }>({
    show: false,
    x: 0,
    y: 0
  });

  // Initialize nodes with random positions
  useEffect(() => {
    const initialNodes: SimulationNode[] = data.nodes.map(node => ({
      ...node,
      x: Math.random() * (width - 100) + 50,
      y: Math.random() * (height - 100) + 50,
      vx: 0,
      vy: 0
    }));
    setNodes(initialNodes);
  }, [data.nodes, width, height]);

  // Simple physics simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const interval = setInterval(() => {
      setNodes(currentNodes => {
        return currentNodes.map(node => {
          if (draggedNode === node.id) return node; // Don't move dragged nodes

          let fx = 0, fy = 0;

          // Repulsion between nodes
          currentNodes.forEach(other => {
            if (other.id !== node.id) {
              const dx = node.x - other.x;
              const dy = node.y - other.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = Math.min(1000 / (distance * distance), 10);
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          });

          // Attraction for connected nodes
          data.links.forEach(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            
            let other: SimulationNode | undefined;
            let attraction = 0.05;

            if (sourceId === node.id) {
              other = currentNodes.find(n => n.id === targetId);
            } else if (targetId === node.id) {
              other = currentNodes.find(n => n.id === sourceId);
            }

            if (other) {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              fx += (dx / distance) * attraction * distance * 0.01;
              fy += (dy / distance) * attraction * distance * 0.01;
            }
          });

          // Center force
          const centerX = width / 2;
          const centerY = height / 2;
          fx += (centerX - node.x) * 0.001;
          fy += (centerY - node.y) * 0.001;

          // Update velocity and position
          const damping = 0.9;
          const newVx = (node.vx + fx) * damping;
          const newVy = (node.vy + fy) * damping;

          let newX = node.x + newVx;
          let newY = node.y + newVy;

          // Boundary constraints
          const radius = (node.size || 10) + 5;
          newX = Math.max(radius, Math.min(width - radius, newX));
          newY = Math.max(radius, Math.min(height - radius, newY));

          return {
            ...node,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy
          };
        });
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [nodes.length, data.links, width, height, draggedNode]);

  const handleMouseDown = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(true);
    setDraggedNode(nodeId);
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !draggedNode) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setNodes(currentNodes =>
      currentNodes.map(node =>
        node.id === draggedNode
          ? { ...node, x, y, vx: 0, vy: 0 }
          : node
      )
    );
  }, [isDragging, draggedNode]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNode(null);
  }, []);

  const handleNodeMouseEnter = useCallback((node: GraphNode, event: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    setTooltip({
      show: true,
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top - 10,
      node
    });
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setTooltip({ show: false, x: 0, y: 0 });
  }, []);

  // Color scheme
  const getNodeColor = (type: string): string => {
    const colors = {
      project: '#4A90E2',
      member: '#F39C12',
      data: '#27AE60',
      model: '#9B59B6',
      infrastructure: '#E74C3C'
    };
    return colors[type as keyof typeof colors] || '#95A5A6';
  };

  const getLinkColor = (type: string): string => {
    const colors = {
      member: '#F39C12',
      data: '#27AE60',
      model: '#9B59B6',
      infrastructure: '#E74C3C',
      other: '#95A5A6'
    };
    return colors[type as keyof typeof colors] || '#95A5A6';
  };

  return (
    <div className="dvre-graph-visualization">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="dvre-graph-svg"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ border: '1px solid #ddd', borderRadius: '4px' }}
      >
        {/* Links */}
        <g className="links">
          {data.links.map((link, index) => {
            const sourceNode = nodes.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
            const targetNode = nodes.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));
            
            if (!sourceNode || !targetNode) return null;

            return (
              <line
                key={`link-${index}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={getLinkColor(link.type)}
                strokeWidth={link.width || 2}
                strokeOpacity={0.6}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map(node => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size || 15}
                fill={getNodeColor(node.type)}
                stroke="#fff"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                onMouseEnter={(e) => handleNodeMouseEnter(node, e)}
                onMouseLeave={handleNodeMouseLeave}
              />
              <text
                x={node.x}
                y={node.y + (node.size || 15) + 16}
                textAnchor="middle"
                fontSize="12px"
                fontFamily="sans-serif"
                fill="#333"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
              </text>
            </g>
          ))}
        </g>

        {/* Legend */}
        <g className="legend" transform="translate(20, 20)">
          {['project', 'member', 'data', 'model', 'infrastructure']
            .filter(type => data.nodes.some(node => node.type === type))
            .map((type, index) => (
              <g key={type} transform={`translate(0, ${index * 25})`}>
                <circle
                  r={8}
                  fill={getNodeColor(type)}
                  stroke="#fff"
                  strokeWidth={1}
                />
                <text
                  x={15}
                  y={4}
                  fontSize="12px"
                  fontFamily="sans-serif"
                  fill="#333"
                  style={{ textTransform: 'capitalize' }}
                >
                  {type}
                </text>
              </g>
            ))}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip.show && tooltip.node && (
        <div
          className="dvre-graph-tooltip"
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: '200px'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{tooltip.node.label}</div>
          <div>Type: {tooltip.node.type}</div>
          {tooltip.node.metadata?.description && (
            <div>Description: {tooltip.node.metadata.description}</div>
          )}
          {tooltip.node.metadata?.owner && (
            <div>Owner: {tooltip.node.metadata.owner}</div>
          )}
          {tooltip.node.metadata?.role && (
            <div>Role: {tooltip.node.metadata.role}</div>
          )}
        </div>
      )}
    </div>
  );
};
