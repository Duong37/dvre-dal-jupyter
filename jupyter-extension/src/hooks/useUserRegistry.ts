import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useFactoryRegistry } from './useFactoryRegistry';
import { useAuth } from './useAuth';

import UserMetadataFactory from '../abis/UserMetadataFactory.json';
import Project from '../abis/Project.json';
import ProjectFactory from '../abis/ProjectFactory.json';
import { RPC_URL } from '../config/contracts';

export interface UserInfo {
  address: string;
  name: string;
  email: string;
  institution: string;
  projects: string[]; // Project addresses they're part of
}

export interface InvitationInfo {
  projectAddress: string;
  projectName: string;
  role: string;
  timestamp: number;
  inviter: string;
}

export const useUserRegistry = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [userInvitations, setUserInvitations] = useState<InvitationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { getFactoryContract } = useFactoryRegistry();
  const { account } = useAuth();

  const getSigner = async () => {
    if (!(window as any).ethereum) {
      throw new Error('MetaMask not found');
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    return await provider.getSigner();
  };

  // Load all registered users
  const loadAllUsers = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);

    try {
      const factoryContract = await getFactoryContract(
        "UserMetadataFactory",
        UserMetadataFactory.abi
      );

      if (!factoryContract) {
        throw new Error("UserMetadataFactory not found");
      }

      const userAddresses = await factoryContract.getAllUsers();
      const loadedUsers: UserInfo[] = [];

      for (const address of userAddresses) {
        try {
          const metadataJSON = await factoryContract.getUserMetadataJSON(address);
          const metadata = JSON.parse(metadataJSON);
          
          // Get projects this user is part of (simplified version)
          const projects: string[] = [];
          // TODO: Could implement project lookup by scanning all projects and checking participants
          
          loadedUsers.push({
            address,
            name: metadata.name,
            email: metadata.email,
            institution: metadata.institution,
            projects
          });
        } catch (err) {
          console.warn(`Failed to load metadata for user ${address}:`, err);
        }
      }

      setUsers(loadedUsers);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load users: ${err.message}`);
      setLoading(false);
    }
  }, [account, getFactoryContract]);

  // Load invitations for current user
  const loadUserInvitations = useCallback(async () => {
    if (!account) return;
    
    setLoading(true);
    setError(null);

    try {
      // Get all projects to scan for invitations
      const projectFactoryContract = await getFactoryContract(
        "ProjectFactory",
        ProjectFactory.abi
      );

      if (!projectFactoryContract) {
        throw new Error("ProjectFactory not found");
      }

      const projectAddresses = await projectFactoryContract.getAllProjects();
      const foundInvitations: InvitationInfo[] = [];

      // Scan each project for invitations to the current user
      for (const projectAddress of projectAddresses) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          const projectContract = new ethers.Contract(projectAddress, Project.abi, provider);
          
          // Check if there's an invitation for this user
          const invitation = await projectContract.getInvitation(account);
          
          if (invitation.exists) {
            // Get project data to get project name
            const projectDataString = await projectContract.getProjectData();
            const projectData = JSON.parse(projectDataString);
            const creator = await projectContract.creator();
            
            foundInvitations.push({
              projectAddress,
              projectName: projectData.objective || 'Unknown Project',
              role: invitation.role,
              timestamp: Number(invitation.timestamp),
              inviter: creator
            });
          }
        } catch (err) {
          console.warn(`Failed to check invitations for project ${projectAddress}:`, err);
        }
      }

      setUserInvitations(foundInvitations);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load invitations: ${err.message}`);
      setLoading(false);
    }
  }, [account, getFactoryContract]);

  // Send invitation to user for a project
  const sendInvitation = useCallback(async (
    projectAddress: string,
    userAddress: string,
    role: string
  ): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      // Check if current user is project creator
      const creator = await projectContract.creator();
      if (creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only project creator can send invitations');
      }

      const tx = await projectContract.sendInvitation(userAddress, role);
      await tx.wait();

      console.log('Invitation sent successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to send invitation:', err);
      setError(`Failed to send invitation: ${err.message}`);
      return false;
    }
  }, [account]);

  // Accept invitation
  const acceptInvitation = useCallback(async (projectAddress: string): Promise<boolean> => {
    if (!account) return false;

    try {
      console.log('Starting invitation acceptance for project:', projectAddress);
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      // Verify invitation exists first
      console.log('Getting invitation details for account:', account);
      const invitation = await projectContract.getInvitation(account);
      console.log('Invitation details:', invitation);
      
      if (!invitation.exists) {
        throw new Error('No invitation found');
      }

      // SINGLE TRANSACTION: Contract automatically adds participant and removes invitation
      console.log('Accepting invitation...');
      const acceptTx = await projectContract.acceptInvitation();
      console.log('Accept transaction sent:', acceptTx.hash);
      await acceptTx.wait();
      console.log('Accept transaction confirmed - participant automatically added to contract');

      console.log('Invitation accepted successfully');
      
      // Refresh the invitations list to remove the accepted invitation
      await loadUserInvitations();
      
      return true;
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack
      });
      setError(`Failed to accept invitation: ${err.message}`);
      return false;
    }
  }, [account, loadUserInvitations]);

  // Add member to project (for project creators to update project data after invitation acceptance)
  const addMemberToProject = useCallback(async (
    projectAddress: string,
    memberAddress: string,
    role: string
  ): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      // Check if current user is project creator
      const creator = await projectContract.creator();
      if (creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error('Only project creator can add members');
      }

      // Check if user is already a participant (using contract mapping)
      const existingRole = await projectContract.participantRoles(memberAddress);
      if (existingRole && existingRole.length > 0) {
        console.log('User is already a participant in this project');
        return true;
      }

      // SINGLE TRANSACTION: Add participant using contract function
      const addTx = await projectContract.addParticipantWithRole(memberAddress, role, 1);
      await addTx.wait();

      console.log('Member added to project successfully using contract function');
      return true;
    } catch (err: any) {
      console.error('Failed to add member to project:', err);
      setError(`Failed to add member to project: ${err.message}`);
      return false;
    }
  }, [account]);

  // Reject invitation
  const rejectInvitation = useCallback(async (projectAddress: string): Promise<boolean> => {
    if (!account) return false;

    try {
      const signer = await getSigner();
      const projectContract = new ethers.Contract(projectAddress, Project.abi, signer);
      
      const tx = await projectContract.rejectInvitation();
      await tx.wait();

      console.log('Invitation rejected successfully');
      return true;
    } catch (err: any) {
      console.error('Failed to reject invitation:', err);
      setError(`Failed to reject invitation: ${err.message}`);
      return false;
    }
  }, [account]);

  // Initialize data on mount
  useEffect(() => {
    if (account) {
      loadAllUsers();
      loadUserInvitations();
    }
  }, [account, loadAllUsers, loadUserInvitations]);

  return {
    // State
    users,
    userInvitations,
    loading,
    error,

    // Methods
    loadAllUsers,
    loadUserInvitations,
    sendInvitation,
    acceptInvitation,
    addMemberToProject,
    rejectInvitation,

    // Utility
    clearError: () => setError(null)
  };
};
