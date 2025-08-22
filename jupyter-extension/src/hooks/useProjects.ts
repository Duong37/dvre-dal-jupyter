import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useFactoryRegistry } from './useFactoryRegistry';
import { useAuth } from './useAuth';

import ProjectTemplateRegistry from '../abis/ProjectTemplateRegistry.json';
import ProjectFactory from '../abis/ProjectFactory.json';
import Project from '../abis/Project.json';
import { RPC_URL } from '../config/contracts';

// =====================================================================
// STANDALONE UTILITY FUNCTIONS - Can be imported by services
// =====================================================================

/**
 * Get all join requesters for a project (off-chain implementation)
 * Replaces the removed getAllRequesters() contract function
 */
export const getAllRequestersForProject = async (projectAddress: string): Promise<string[]> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const projectContract = new ethers.Contract(projectAddress, Project.abi, provider);
    
    const requesters: string[] = [];
    let index = 0;
    
    try {
      // Keep reading requesters array until we get an error (out of bounds)
      while (true) {
        try {
          const requesterAddress = await projectContract.requesters(index);
          
          // Check if this requester still has an active request
          const joinRequest = await projectContract.getJoinRequest(requesterAddress);
          if (joinRequest.exists) {
            requesters.push(requesterAddress);
          }
          
          index++;
        } catch {
          break; // End of array
        }
      }
    } catch (error) {
      console.log('No requesters found or error reading requesters array');
    }
    
    return requesters;
  } catch (error) {
    console.error('Error getting all requesters for project:', error);
    return [];
  }
};

/**
 * Get join request details for a specific requester
 */
export const getJoinRequestForProject = async (projectAddress: string, requesterAddress: string): Promise<{
  requester: string;
  role: string;
  timestamp: number;
  exists: boolean;
}> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const projectContract = new ethers.Contract(projectAddress, Project.abi, provider);
    const request = await projectContract.getJoinRequest(requesterAddress);
    
    return {
      requester: request.requester,
      role: request.role,
      timestamp: Number(request.timestamp),
      exists: request.exists
    };
  } catch (error) {
    console.error('Error getting join request for project:', error);
    return {
      requester: '',
      role: '',
      timestamp: 0,
      exists: false
    };
  }
};

/**
 * Get all participants for a project using contract's getAllParticipants function
 */
export const getAllParticipantsForProject = async (projectAddress: string): Promise<{
  participantAddresses: string[];
  roles: string[];
  weights: bigint[];
  joinTimestamps: bigint[];
}> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const projectContract = new ethers.Contract(projectAddress, Project.abi, provider);
    
    console.log('Getting participant data using contract getAllParticipants()...');
    
    try {
      // Use contract's built-in getAllParticipants function (most efficient)
      const result = await projectContract.getAllParticipants();
      
      console.log(`Retrieved data for ${result.participantAddresses.length} participants using getAllParticipants()`);
      
      return {
        participantAddresses: result.participantAddresses,
        roles: result.roles,
        weights: result.weights,
        joinTimestamps: result.joinTimestamps
      };
    } catch (contractError) {
      console.warn('getAllParticipants() failed, falling back to individual calls:', contractError);
      
      // Fallback to manual iteration for backward compatibility
    const participantAddresses: string[] = [];
    const roles: string[] = [];
    const weights: bigint[] = [];
    const joinTimestamps: bigint[] = [];
    
    // Get participant count by calling participants array until we get an error
    let participantCount = 0;
    try {
      while (true) {
        try {
          const addr = await projectContract.participants(participantCount);
          participantAddresses.push(addr);
          participantCount++;
        } catch {
          break; // End of array
        }
      }
    } catch (error) {
      console.log('No participants found or error reading participants array');
    }
    
    // Get individual participant data from mappings
    for (const address of participantAddresses) {
      try {
        const role = await projectContract.participantRoles(address);
        const weight = await projectContract.participantWeights(address);
        const joinTime = await projectContract.joinedAt(address);
        
        roles.push(role);
        weights.push(weight);
        joinTimestamps.push(joinTime);
      } catch (error) {
        console.warn(`Failed to get data for participant ${address}:`, error);
        // Use defaults if individual calls fail
        roles.push('contributor');
        weights.push(BigInt(1));
        joinTimestamps.push(BigInt(0));
      }
    }
    
    console.log(`Retrieved data for ${participantCount} participants through individual calls`);
    
    return {
      participantAddresses,
      roles,
      weights,
      joinTimestamps
    };
    }
  } catch (error) {
    console.error('Error getting all participants for project:', error);
    return {
      participantAddresses: [],
      roles: [],
      weights: [],
      joinTimestamps: []
    };
  }
};

export interface TemplateField {
  fieldName: string;
  fieldType: 'string' | 'number' | 'boolean' | 'array' | 'object';
  isRequired: boolean;
  defaultValue: string;
}

export interface ProjectTemplate {
  id: number;
  name: string;
  description: string;
  projectType: string;
  participantRoles: string[];
  fields: TemplateField[];
  exampleJSON: string;
  isActive: boolean;
}

export interface ProjectMember {
  address: string;
  role: string;
}

export interface JoinRequest {
  requester: string;
  role: string;
  timestamp: number;
}

export interface ProjectInfo {
  address: string;
  projectId: string;
  objective: string;
  description?: string;
  creator: string;
  isActive: boolean;
  created: number;
  lastModified: number;
  participants: ProjectMember[];
  joinRequests: JoinRequest[];
  projectData: any; // Full parsed JSON
  // UI helpers
  isMember: boolean;
  isOwner: boolean;
  hasPendingRequest: boolean;
  memberCount: number;
}

export interface ProjectDetails extends ProjectInfo {
  availableRoles: string[];
}

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [userProjects, setUserProjects] = useState<ProjectInfo[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getFactoryContract } = useFactoryRegistry();
  const { account } = useAuth();

  const getProvider = () => {
    return new ethers.JsonRpcProvider(RPC_URL);
  };

  const getSigner = async () => {
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    return await provider.getSigner();
  };

  // Get detailed project information
  const getProjectInfo = useCallback(async (projectAddress: string): Promise<ProjectInfo | null> => {
    try {
      const provider = getProvider();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, provider);

      // First, validate that this is a valid contract by checking if it has code
      const code = await provider.getCode(projectAddress);
      if (code === '0x') {
        console.warn(`No contract code at address ${projectAddress}`);
        return null;
      }

      // Try to call a simple read function first to validate the contract
      try {
        await projectContract.creator();
      } catch (err) {
        console.warn(`Address ${projectAddress} is not a valid Project contract:`, err);
        return null;
      }

      const projectDataString = await projectContract.getProjectData();
      let projectData;
      
      try {
        projectData = JSON.parse(projectDataString);
      } catch (parseErr) {
        console.error(`Invalid JSON in project ${projectAddress}:`, parseErr);
        return null;
      }
      
      // Get project status (returns: active, created, modified, creator)
      const projectStatus = await projectContract.getProjectStatus();
      const projectInfo = {
        creator: projectStatus.projectCreator,
        isActive: projectStatus.active,
        created: Number(projectStatus.created),
        lastModified: Number(projectStatus.modified)
      };

      // Get participants from contract (single source of truth)
      const participants: ProjectMember[] = [];
      try {
        const result = await projectContract.getAllParticipants();
        for (let i = 0; i < result.participantAddresses.length; i++) {
          participants.push({
            address: result.participantAddresses[i],
            role: result.roles[i]
          });
        }
        console.log(`Loaded ${participants.length} participants from contract for project ${projectAddress}`);
      } catch (err) {
        console.warn('Failed to get participants from contract, falling back to JSON data:', err);
        // Fallback to JSON data for backward compatibility
      if (projectData.participants && Array.isArray(projectData.participants)) {
        participants.push(...projectData.participants);
        }
      }

      // Get join requests from contract (using utility functions)
      let joinRequests: JoinRequest[] = [];
      try {
        const requesters = await getAllRequestersForProject(projectAddress);
        
        // Now process the requesters to build joinRequests array
        for (const requester of requesters) {
          const request = await getJoinRequestForProject(projectAddress, requester);
          if (request.exists) {
            joinRequests.push({
              requester: request.requester,
              role: request.role,
              timestamp: request.timestamp
            });
          }
        }
      } catch (err) {
        console.warn('Failed to get join requests:', err);
      }

      // Find the user's membership (might be owner or regular member)
      const userParticipant = participants.find(p => p.address.toLowerCase() === account?.toLowerCase());
      const isOwner = projectInfo.creator.toLowerCase() === account?.toLowerCase();
      const isMember = !!userParticipant || isOwner;
      const hasPendingRequest = joinRequests.some(r => r.requester.toLowerCase() === account?.toLowerCase());

      // Count of participants in the project
      const memberCount = participants.length;

      return {
        address: projectAddress,
        projectId: projectData.project_id || projectData.projectId || 'Unknown',
        objective: projectData.objective || 'No objective specified',
        description: projectData.description,
        creator: projectInfo.creator,
        isActive: projectInfo.isActive,
        created: Number(projectInfo.created),
        lastModified: Number(projectInfo.lastModified),
        participants,
        joinRequests,
        projectData,
        isMember,
        isOwner,
        hasPendingRequest,
        memberCount
      };
    } catch (err) {
      console.error(`Failed to get project info for ${projectAddress}:`, err);
      return null;
    }
  }, [account]);

  // Load all projects
  const loadProjects = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);

    try {
      const factoryContract = await getFactoryContract(
        "ProjectFactory",
        ProjectFactory.abi
      );

      if (!factoryContract) {
        throw new Error("ProjectFactory not found");
      }

      const projectAddresses = await factoryContract.getAllProjects();
      const allProjects: ProjectInfo[] = [];

      for (let i = 0; i < projectAddresses.length; i++) {
        try {
          const projectInfo = await getProjectInfo(projectAddresses[i]);
          if (projectInfo) {
            allProjects.push(projectInfo);
          }
        } catch (err) {
          console.warn(`Failed to load project at address ${projectAddresses[i]}:`, err);
        }
      }

      // Separate user projects from all projects
      const userProjectsList = allProjects.filter(p => p.isMember || p.isOwner);
      const availableProjectsList = allProjects.filter(p => !p.isMember && !p.isOwner);

      setUserProjects(userProjectsList);
      setProjects(availableProjectsList);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load projects: ${err.message}`);
      setLoading(false);
    }
  }, [account, getFactoryContract, getProjectInfo]);

  // Load project templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const templateRegistryContract = await getFactoryContract(
        "ProjectTemplateRegistry",
        ProjectTemplateRegistry.abi
      );

      if (!templateRegistryContract) {
        throw new Error("ProjectTemplateRegistry not found");
      }

      const templateCount = await templateRegistryContract.getTemplateCount();
      const loadedTemplates: ProjectTemplate[] = [];

      for (let i = 0; i < templateCount; i++) {
        const template = await templateRegistryContract.getTemplate(i);
        const templateFields = await templateRegistryContract.getTemplateFields(i);
        
        // Convert field arrays to TemplateField objects
        const fields: TemplateField[] = [];
        for (let j = 0; j < templateFields.fieldNames.length; j++) {
          fields.push({
            fieldName: templateFields.fieldNames[j],
            fieldType: templateFields.fieldTypes[j] as any,
            isRequired: templateFields.isRequired[j],
            defaultValue: templateFields.defaultValues[j]
          });
        }
        
        loadedTemplates.push({
          id: i,
          name: template[0],
          description: template[1],
          projectType: template[2],
          participantRoles: template[3],
          fields: fields,
          exampleJSON: template[4],
          isActive: template[5]
        });
      }

      setTemplates(loadedTemplates.filter(t => t.isActive));
      setLoading(false);
      
      // Debug logging for templates
      console.log('Templates loaded:', {
        totalTemplates: loadedTemplates.length,
        activeTemplates: loadedTemplates.filter(t => t.isActive).length,
        alTemplate: loadedTemplates.find(t => t.projectType === 'active_learning'),
        allTemplates: loadedTemplates.map(t => ({ id: t.id, name: t.name, type: t.projectType, active: t.isActive }))
      });
      
      // Expose to window for debugging
      if (typeof window !== 'undefined') {
        (window as any).dvreDebugData = {
          ...(window as any).dvreDebugData,
          templates: loadedTemplates.filter(t => t.isActive)
        };
      }
    } catch (err: any) {
      setError(`Failed to load templates: ${err.message}`);
      setLoading(false);
    }
  }, [getFactoryContract]);

  // Request to join a project (uses contract's join request system)
  const requestToJoinProject = useCallback(async (projectAddress: string, role: string): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);

      // Check if user already has a pending request or is already a member
      const projectInfo = await getProjectInfo(projectAddress);
      if (!projectInfo) {
        throw new Error('Project not found');
      }

      if (projectInfo.isOwner) {
        throw new Error('You are the owner of this project');
      }

      if (projectInfo.isMember) {
        throw new Error('You are already a member of this project');
      }

      if (projectInfo.hasPendingRequest) {
        throw new Error('You already have a pending request for this project');
      }

      // Validate that the requested role is available in the project
      const availableRoles = await getProjectRoles(projectAddress);
      if (!availableRoles.includes(role)) {
        throw new Error(`Role "${role}" is not available for this project. Available roles: ${availableRoles.join(', ')}`);
      }

      // Submit join request to contract
      const tx = await projectContract.submitJoinRequest(role);
      await tx.wait();

      console.log('Join request submitted successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to request join:', err);
      setError(`Failed to request join: ${err.message}`);
      return false;
    }
  }, [account, getProjectInfo]);

  // Approve/reject join request (project owner only)
  const handleJoinRequest = useCallback(async (
    projectAddress: string, 
    memberAddress: string, 
    approve: boolean
  ): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);

      if (approve) {
        // Verify the join request exists
        const request = await projectContract.getJoinRequest(memberAddress);
        if (!request.exists) {
          throw new Error('Join request not found');
        }

        // SINGLE TRANSACTION: Contract automatically adds participant and removes request
        const approveTx = await projectContract.approveJoinRequest(memberAddress);
        await approveTx.wait();
        
        console.log(`Join request approved for ${memberAddress} - participant automatically added to contract`);
      } else {
        // Just reject the join request (this removes it from the contract)
        const rejectTx = await projectContract.rejectJoinRequest(memberAddress);
        await rejectTx.wait();
        
        console.log(`Join request rejected for ${memberAddress}`);
      }

      return true;
    } catch (err: any) {
      console.error('Failed to handle join request:', err);
      setError(`Failed to handle join request: ${err.message}`);
      return false;
    }
  }, [account]);

  // Create project from template
  const createProjectFromTemplate = useCallback(async (
    templateId: number,
    projectData: any
  ): Promise<string | null> => {
    try {
      const signer = await getSigner();
      const factoryContract = await getFactoryContract(
        "ProjectFactory",
        ProjectFactory.abi,
        signer
      );

      if (!factoryContract) {
        throw new Error("ProjectFactory not found");
      }

      //  CRITICAL FIX: Ensure templates are loaded before using them
      if (templates.length === 0) {
        console.log('Templates not loaded yet, loading templates first...');
        await loadTemplates();
      }

      // Wait a moment for templates to be available
      let template = templates.find(t => t.id === templateId);
      
      // If still not found, this is a fallback based on template registry knowledge
      if (!template) {
        console.warn(`Template ${templateId} not found in loaded templates, using fallback detection`);
        // Based on the template registry contracts, we know:
        // templateId 0 = Federated Learning
        // templateId 1 = Research Collaboration  
        // templateId 2 = Active Learning
        if (templateId === 2) {
          template = {
            id: templateId,
            name: 'Active Learning',
            description: 'Active Learning template',
            projectType: 'active_learning',
            participantRoles: ['coordinator', 'contributor'],
            fields: [],
            exampleJSON: '',
            isActive: true
          };
        } else if (templateId === 0) {
          template = {
            id: templateId,
            name: 'Federated Learning',
            description: 'Federated Learning template',
            projectType: 'federated_learning',
            participantRoles: ['data_owner', 'aggregator', 'coordinator'],
            fields: [],
            exampleJSON: '',
            isActive: true
          };
        } else {
          template = {
            id: templateId,
            name: 'General',
            description: 'General template',
            projectType: 'general',
            participantRoles: ['member'],
            fields: [],
            exampleJSON: '',
            isActive: true
          };
        }
      }

      const isActivelearningTemplate = template.projectType === 'active_learning';
      
      // Enhance project data with template type info for on-chain storage
      const enhancedProjectData = {
        ...projectData,
        templateId: templateId,
        templateType: template.projectType,
        // Force AL projects to be detected as such
        project_type: isActivelearningTemplate ? 'active_learning' : (projectData.project_type || template.projectType)
      };

      console.log('Template Detection:', {
        templateId,
        templateFound: !!templates.find(t => t.id === templateId),
        templateType: template.projectType,
        isActivelearningTemplate,
        enhancedProjectData: {
          templateType: enhancedProjectData.templateType,
          project_type: enhancedProjectData.project_type
        }
      });

      // Ensure roles array exists with default roles if not provided
      if (!enhancedProjectData.roles || !Array.isArray(enhancedProjectData.roles) || enhancedProjectData.roles.length === 0) {
        enhancedProjectData.roles = ['Member'];
      }

      // Note: No need to manage participants in JSON - contract constructor automatically adds creator
      // The contract constructor calls: participants.push(_creator) and participantRoles[_creator] = "creator"

      //  FIXED: Pass enhanced data to smart contract
      const projectDataString = JSON.stringify(enhancedProjectData);
      console.log('Sending to contract:', { projectDataString: projectDataString.substring(0, 200) + '...' });
      
      const tx = await factoryContract.createProjectFromTemplate(templateId, projectDataString);
      const receipt = await tx.wait();

      // Find the project creation event
      const factoryInterface = new ethers.Interface(ProjectFactory.abi);
      const projectCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = factoryInterface.parseLog(log);
          return parsed?.name === 'ProjectCreated';
        } catch {
          return false;
        }
      });

      if (projectCreatedEvent) {
        const parsedEvent = factoryInterface.parseLog(projectCreatedEvent);
        const projectAddress = parsedEvent?.args[1]; // project address

        console.log('Project created at address:', projectAddress);

        // RO-Crate will be created later during project deployment phase
        // No auto-creation during Project Hub creation

        return projectAddress;
      }

      return null;
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(`Failed to create project: ${err.message}`);
      return null;
    }
  }, [account, getFactoryContract, templates, loadTemplates]);

  // Create custom project
  const createCustomProject = useCallback(async (projectData: any): Promise<string | null> => {
    try {
      const signer = await getSigner();
      const factoryContract = await getFactoryContract(
        "ProjectFactory",
        ProjectFactory.abi,
        signer
      );

      if (!factoryContract) {
        throw new Error("ProjectFactory not found");
      }

      // For custom projects, only add default roles if roles field is completely undefined
      // If roles is an empty array, it likely means user didn't define roles, so use default
      if (projectData.roles === undefined || 
          (Array.isArray(projectData.roles) && projectData.roles.length === 0)) {
        projectData.roles = ['Member'];
      } else if (!Array.isArray(projectData.roles)) {
        projectData.roles = ['Member'];
      }

      // Note: No need to manage participants in JSON - contract constructor automatically adds creator
      // The contract constructor calls: participants.push(_creator) and participantRoles[_creator] = "creator"

      const projectDataString = JSON.stringify(projectData);
      const tx = await factoryContract.createCustomProject(projectDataString);
      const receipt = await tx.wait();

      // Find the project creation event
      const factoryInterface = new ethers.Interface(ProjectFactory.abi);
      const projectCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = factoryInterface.parseLog(log);
          return parsed?.name === 'ProjectCreated';
        } catch {
          return false;
        }
      });

      if (projectCreatedEvent) {
        const parsedEvent = factoryInterface.parseLog(projectCreatedEvent);
        const projectAddress = parsedEvent?.args[1]; // project address

        console.log('Custom project created at address:', projectAddress);

        // RO-Crate will be created later during project deployment phase
        // No auto-creation during Project Hub creation

        return projectAddress;
      }

      return null;
    } catch (err: any) {
      console.error('Failed to create custom project:', err);
      setError(`Failed to create project: ${err.message}`);
      return null;
    }
  }, [account, getFactoryContract]);

  // Get project roles (from project JSON roles field)
  const getProjectRoles = useCallback(async (projectAddress: string): Promise<string[]> => {
    try {
      const projectInfo = await getProjectInfo(projectAddress);
      if (!projectInfo) return [];

      // Get roles from project data roles field
      if (projectInfo.projectData.roles && Array.isArray(projectInfo.projectData.roles)) {
        // If roles array has content, return it
        if (projectInfo.projectData.roles.length > 0) {
          return projectInfo.projectData.roles;
        }
        // If roles array is empty, check if it was explicitly set to empty
        // For now, we'll treat empty arrays as needing the default fallback
        // TODO: Could add a flag like "_explicitlyNoRoles" to distinguish intent
      }

      // Fallback to default roles if not defined or empty
      console.warn(`Project ${projectAddress} does not have roles defined or has empty roles, using default roles`);
      return ['Member'];
    } catch (err) {
      console.error('Failed to get project roles:', err);
      return ['Member'];
    }
  }, [getProjectInfo]);

  // Get join requests for a project
  const getJoinRequests = useCallback(async (projectAddress: string): Promise<JoinRequest[]> => {
    try {
      // Use the utility function instead of duplicating logic
      const requesters = await getAllRequestersForProject(projectAddress);
      const joinRequests: JoinRequest[] = [];

      for (const requester of requesters) {
        const request = await getJoinRequestForProject(projectAddress, requester);
        if (request.exists) {
          joinRequests.push({
            requester: request.requester,
            role: request.role,
            timestamp: request.timestamp
          });
        }
      }

      return joinRequests;
    } catch (err) {
      console.error('Failed to get join requests:', err);
      return [];
    }
  }, []);

  // Update project data (only by project owner)
  const updateProjectData = useCallback(async (projectAddress: string, newProjectData: any): Promise<boolean> => {
    if (!account) {
      throw new Error('No account connected');
    }

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);

      // Verify that the current user is the project creator
      const creator = await projectContract.creator();
      if (creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only the project creator can update project data');
      }

      // Convert project data to JSON string
      const jsonString = JSON.stringify(newProjectData);

      // Call the contract function
      const tx = await projectContract.updateProjectData(jsonString);
      await tx.wait();

      console.log('Project data updated successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to update project data:', err);
      setError(err.message);
      throw err;
    }
  }, [account]);

  // Reload user projects (force re-fetch from blockchain)
  const reloadUserProjects = async () => {
    await loadProjects();
  };

  // Initialize data on mount
  useEffect(() => {
    if (account) {
      loadProjects();
      loadTemplates();
    }
  }, [account, loadProjects, loadTemplates]);

  return {
    // State
    projects,
    userProjects,
    templates,
    loading,
    error,

    // Methods
    loadProjects,
    loadTemplates,
    getProjectInfo,
    getJoinRequests,
    requestToJoinProject,
    handleJoinRequest,
    createProjectFromTemplate,
    createCustomProject,
    updateProjectData,
    getProjectRoles,
    reloadUserProjects,

    // Utility
    clearError: () => setError(null)
  };
};
