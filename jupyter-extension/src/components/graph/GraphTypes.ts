export interface GraphNode {
  id: string;
  label: string;
  type: 'project' | 'member' | 'data' | 'model' | 'infrastructure';
  metadata?: {
    description?: string;
    owner?: string;
    createdAt?: string;
    tags?: string[];
    [key: string]: any;
  };
  // Visualization properties
  x?: number;
  y?: number;
  fx?: number | null; // Fixed position x
  fy?: number | null; // Fixed position y
  vx?: number; // Velocity x
  vy?: number; // Velocity y
  color?: string;
  size?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'member' | 'data' | 'model' | 'infrastructure' | 'other';
  strength?: number;
  metadata?: {
    description?: string;
    sharedResources?: string[];
    [key: string]: any;
  };
  // Visualization properties
  color?: string;
  width?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface FilterOptions {
  showMembers: boolean;
  showData: boolean;
  showModels: boolean;
  showInfrastructure: boolean;
  minConnections: number;
  selectedProjects: string[];
}

export interface ProjectInfo {
  id: string;
  name: string;
}

// Input data types - flexible to handle various JSON structures
export interface ProjectData {
  id?: string;
  name?: string;
  title?: string;
  members?: Member[] | string[];
  data?: DataResource[] | string[];
  models?: ModelResource[] | string[];
  infrastructure?: InfrastructureResource[] | string[];
  [key: string]: any;
}

export interface Member {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

export interface DataResource {
  id?: string;
  name?: string;
  type?: string;
  source?: string;
  [key: string]: any;
}

export interface ModelResource {
  id?: string;
  name?: string;
  type?: string;
  version?: string;
  [key: string]: any;
}

export interface InfrastructureResource {
  id?: string;
  name?: string;
  type?: string;
  provider?: string;
  [key: string]: any;
}

// Graph layout and visualization types
export interface GraphLayout {
  type: 'force' | 'circular' | 'hierarchical' | 'grid';
  config?: {
    [key: string]: any;
  };
}

export interface GraphTheme {
  nodeColors: {
    project: string;
    member: string;
    data: string;
    model: string;
    infrastructure: string;
  };
  linkColors: {
    member: string;
    data: string;
    model: string;
    infrastructure: string;
    other: string;
  };
  background: string;
  text: string;
}
