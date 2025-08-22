import {
  GraphData,
  GraphNode,
  GraphLink,
  ProjectData,
  FilterOptions
} from '../components/graph/GraphTypes';

export class GraphDataProcessor {
  private static readonly DEFAULT_THEME = {
    nodeColors: {
      project: '#4A90E2',
      member: '#F39C12',
      data: '#27AE60',
      model: '#9B59B6',
      infrastructure: '#E74C3C'
    },
    linkColors: {
      member: '#F39C12',
      data: '#27AE60', 
      model: '#9B59B6',
      infrastructure: '#E74C3C',
      other: '#95A5A6'
    }
  };

  /**
   * Process raw JSON data into graph format
   */
  async processData(rawData: any): Promise<GraphData> {
    const projects = this.extractProjects(rawData);
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const resourceMap = new Map<string, GraphNode>();

    // Create project nodes
    for (const project of projects) {
      const projectNode: GraphNode = {
        id: this.getProjectId(project),
        label: this.getProjectName(project),
        type: 'project',
        metadata: {
          description: project.description,
          owner: project.owner,
          createdAt: project.createdAt,
          tags: project.tags || []
        },
        color: GraphDataProcessor.DEFAULT_THEME.nodeColors.project,
        size: 20
      };
      nodes.push(projectNode);
    }

    // Process each project's resources and create connections
    for (const project of projects) {
      const projectId = this.getProjectId(project);
      
      // Process members
      const members = this.extractMembers(project);
      this.processResources(members, 'member', projectId, nodes, links, resourceMap);

      // Process data resources  
      const dataResources = this.extractDataResources(project);
      this.processResources(dataResources, 'data', projectId, nodes, links, resourceMap);

      // Process models
      const models = this.extractModels(project);
      this.processResources(models, 'model', projectId, nodes, links, resourceMap);

      // Process infrastructure
      const infrastructure = this.extractInfrastructure(project);
      this.processResources(infrastructure, 'infrastructure', projectId, nodes, links, resourceMap);
    }

    return { nodes, links };
  }

  /**
   * Apply filters to graph data
   */
  applyFilters(data: GraphData, filters: FilterOptions): GraphData {
    let filteredNodes = [...data.nodes];
    let filteredLinks = [...data.links];

    // Filter by resource types
    if (!filters.showMembers) {
      filteredNodes = filteredNodes.filter(n => n.type !== 'member');
      filteredLinks = filteredLinks.filter(l => l.type !== 'member');
    }
    if (!filters.showData) {
      filteredNodes = filteredNodes.filter(n => n.type !== 'data');
      filteredLinks = filteredLinks.filter(l => l.type !== 'data');
    }
    if (!filters.showModels) {
      filteredNodes = filteredNodes.filter(n => n.type !== 'model');
      filteredLinks = filteredLinks.filter(l => l.type !== 'model');
    }
    if (!filters.showInfrastructure) {
      filteredNodes = filteredNodes.filter(n => n.type !== 'infrastructure');
      filteredLinks = filteredLinks.filter(l => l.type !== 'infrastructure');
    }

    // Filter by selected projects
    if (filters.selectedProjects.length > 0) {
      const selectedProjectNodes = new Set(filters.selectedProjects);
      const connectedNodes = new Set<string>();
      
      // Add selected projects
      filters.selectedProjects.forEach(id => connectedNodes.add(id));
      
      // Add nodes connected to selected projects
      filteredLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        if (selectedProjectNodes.has(sourceId)) {
          connectedNodes.add(targetId);
        }
        if (selectedProjectNodes.has(targetId)) {
          connectedNodes.add(sourceId);
        }
      });

      filteredNodes = filteredNodes.filter(n => connectedNodes.has(n.id));
      filteredLinks = filteredLinks.filter(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
        const targetId = typeof l.target === 'string' ? l.target : l.target.id;
        return connectedNodes.has(sourceId) && connectedNodes.has(targetId);
      });
    }

    // Filter by minimum connections
    if (filters.minConnections > 1) {
      const connectionCounts = new Map<string, number>();
      
      filteredLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1);
        connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1);
      });

      filteredNodes = filteredNodes.filter(n => 
        n.type === 'project' || (connectionCounts.get(n.id) || 0) >= filters.minConnections
      );
      
      const remainingNodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
        const targetId = typeof l.target === 'string' ? l.target : l.target.id;
        return remainingNodeIds.has(sourceId) && remainingNodeIds.has(targetId);
      });
    }

    return { nodes: filteredNodes, links: filteredLinks };
  }

  private extractProjects(data: any): ProjectData[] {
    if (Array.isArray(data)) {
      return data;
    }
    if (data.projects && Array.isArray(data.projects)) {
      return data.projects;
    }
    if (typeof data === 'object' && data !== null) {
      // Single project
      return [data];
    }
    return [];
  }

  private getProjectId(project: ProjectData): string {
    return project.project_id || project.id || project.name || project.title || `project-${Math.random()}`;
  }

  private getProjectName(project: ProjectData): string {
    return project.objective || project.name || project.title || project.project_id || project.id || 'Unnamed Project';
  }

  private extractMembers(project: ProjectData): any[] {
    // Check for members at top level in various field names
    let members = project.members || project.team || project.users || project.participants || [];
    
    return Array.isArray(members) ? members : [];
  }

  /**
   * Extract data resources from project, including datasets in assets field
   */
  private extractDataResources(project: ProjectData): any[] {
    // Check for data at top level
    let data = project.data || project.datasets || project.dataResources || [];
    
    // Also check for datasets in the assets field (common in federated learning projects)
    if (project.assets && project.assets.datasets) {
      const assetsDatasets = Array.isArray(project.assets.datasets) ? project.assets.datasets : [];
      data = Array.isArray(data) ? [...data, ...assetsDatasets] : assetsDatasets;
    }
    
    return Array.isArray(data) ? data : [];
  }

  /**
   * Extract models and scripts from project, including scripts in assets field
   */
  private extractModels(project: ProjectData): any[] {
    // Check for models at top level
    let models = project.models || project.algorithms || project.ml_models || [];
    
    // Also check for scripts in the assets field (which could include model scripts)
    if (project.assets && project.assets.scripts) {
      const assetsScripts = Array.isArray(project.assets.scripts) ? project.assets.scripts : [];
      models = Array.isArray(models) ? [...models, ...assetsScripts] : assetsScripts;
    }
    
    return Array.isArray(models) ? models : [];
  }

  private extractInfrastructure(project: ProjectData): any[] {
    const infra = project.infrastructure || project.resources || project.services || [];
    return Array.isArray(infra) ? infra : [];
  }

  private processResources(
    resources: any[],
    type: 'member' | 'data' | 'model' | 'infrastructure',
    projectId: string,
    nodes: GraphNode[],
    links: GraphLink[],
    resourceMap: Map<string, GraphNode>
  ): void {
    for (const resource of resources) {
      const resourceId = this.getResourceId(resource, type);
      const resourceLabel = this.getResourceLabel(resource, type);

      // Check if resource node already exists
      let resourceNode = resourceMap.get(resourceId);
      if (!resourceNode) {
        resourceNode = {
          id: resourceId,
          label: resourceLabel,
          type,
          metadata: this.extractResourceMetadata(resource),
          color: GraphDataProcessor.DEFAULT_THEME.nodeColors[type],
          size: 10
        };
        nodes.push(resourceNode);
        resourceMap.set(resourceId, resourceNode);
      }

      // Create link between project and resource
      const linkId = `${projectId}-${resourceId}`;
      if (!links.find(l => l.id === linkId)) {
        const link = {
          id: linkId,
          source: projectId,
          target: resourceId,
          type,
          strength: 1,
          color: GraphDataProcessor.DEFAULT_THEME.linkColors[type],
          width: 2
        };
        links.push(link);
      }
    }
  }

  private getResourceId(resource: any, type: string): string {
    if (typeof resource === 'string') {
      // For string resources, create a clean ID by extracting meaningful parts
      const cleanResource = resource.replace(/[^a-zA-Z0-9]/g, '_');
      return `${type}-${cleanResource}`;
    }
    
    // For members, prioritize address as the unique identifier
    if (type === 'member') {
      return resource.address || resource.id || resource.name || resource.email || `${type}-${Math.random()}`;
    }
    
    return resource.id || resource.name || resource.email || `${type}-${Math.random()}`;
  }

  private getResourceLabel(resource: any, type: string): string {
    if (typeof resource === 'string') {
      // For string resources, use the full string as label but clean it up for display
      if (resource.startsWith('ipfs://')) {
        return resource.substring(7); // Remove 'ipfs://' prefix for cleaner display
      }
      return resource;
    }
    
    // For members, prefer address display over "Unnamed member"
    if (type === 'member') {
      const name = resource.name || resource.title || resource.email;
      if (name) {
        return name;
      }
      // Show shortened address if available
      if (resource.address) {
        return resource.address.substring(0, 8) + '...' + resource.address.substring(-6);
      }
      if (resource.id && resource.id.length > 10) {
        return resource.id.substring(0, 8) + '...' + resource.id.substring(-6);
      }
      return resource.id || `Unnamed ${type}`;
    }
    
    return resource.name || resource.title || resource.email || resource.id || `Unnamed ${type}`;
  }

  private extractResourceMetadata(resource: any): any {
    if (typeof resource === 'string') {
      // For string resources, try to extract useful metadata
      const metadata: any = { originalValue: resource };
      
      if (resource.startsWith('ipfs://')) {
        metadata.type = 'IPFS';
        metadata.hash = resource.substring(7);
        metadata.description = `IPFS resource: ${metadata.hash}`;
      } else if (resource.startsWith('http://') || resource.startsWith('https://')) {
        metadata.type = 'URL';
        metadata.url = resource;
        metadata.description = `Web resource: ${resource}`;
      } else {
        metadata.type = 'Reference';
        metadata.description = resource;
      }
      
      return metadata;
    }
    return {
      description: resource.description,
      type: resource.type,
      role: resource.role,
      version: resource.version,
      provider: resource.provider,
      ...resource
    };
  }
}
