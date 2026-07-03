import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Organization, OrganizationInput, OrganizationUpdateInput, JoinRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth, authFetch } from './AuthContext';
import { getFullUrl } from '@/lib/api';


interface OrgMember {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  isManager: boolean;
  isEditor: boolean;
}

interface OrganizationContextType {
  organizations: Organization[];
  loading: boolean;
  createOrganization: (organization: OrganizationInput) => Promise<string>;
  getOrganization: (id: string) => Organization | undefined;
  updateOrganization: (id: string, organization: OrganizationUpdateInput) => Promise<void>;
  deleteOrganization: (id: string) => Promise<void>;
  addGroupToOrganization: (organizationId: string, groupId: string) => Promise<void>;
  removeGroupFromOrganization: (organizationId: string, groupId: string) => Promise<void>;
  addMemberToOrganization: (organizationId: string, userId: string) => Promise<void>;
  removeMemberFromOrganization: (organizationId: string, userId: string) => Promise<void>;
  inviteMemberToOrganization: (organizationId: string, email: string) => Promise<void>;
  assignManagerToOrganization: (organizationId: string, email: string) => Promise<void>;
  setOrgMemberRole: (organizationId: string, userId: string, role: 'user' | 'editor' | 'manager') => Promise<void>;
  getOrganizationMembers: (organizationId: string) => Promise<OrgMember[]>;
  getUserOrganizations: () => Organization[];
  refreshOrganizations: () => Promise<void>;
  addInstrument: (organizationId: string, instrument: string) => Promise<void>;
  removeInstrument: (organizationId: string, instrument: string) => Promise<void>;
  allowUserOrgCreation: boolean;
  submitJoinRequest: (joinCode: string) => Promise<void>;
  getJoinRequests: (organizationId: string) => Promise<JoinRequest[]>;
  approveJoinRequest: (organizationId: string, requestId: string) => Promise<void>;
  rejectJoinRequest: (organizationId: string, requestId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowUserOrgCreation, setAllowUserOrgCreation] = useState(true);
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const refreshOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch organizations when user is authenticated
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setAllowUserOrgCreation(data.allow_user_org_creation);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();

    if (currentUser) {
      refreshOrganizations();
    } else {
      setOrganizations([]);
      setLoading(false);
    }
  }, [currentUser, refreshOrganizations]);



  const createOrganization = async (organizationInput: OrganizationInput): Promise<string> => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to create an organization');

      const res = await authFetch('/api/organizations', {
        method: 'POST',
        body: JSON.stringify(organizationInput),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create organization');

      setOrganizations(prev => [...prev, data.organization]);
      toast({ title: "Organization created", description: `${data.organization.name} has been created successfully` });
      return data.organization.id;
    } catch (error) {
      toast({ title: "Failed to create organization", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getOrganization = (id: string) => organizations.find(organization => organization.id === id);

  const updateOrganization = async (id: string, updatedData: OrganizationUpdateInput) => {
    const existingOrg = organizations.find(o => o.id === id);
    if (existingOrg) {
      const keys = Object.keys(updatedData) as Array<keyof OrganizationUpdateInput>;
      const hasChanges = keys.some(key => {
        if (key === 'members') {
          return JSON.stringify(updatedData[key]) !== JSON.stringify(existingOrg[key]);
        }
        return updatedData[key] !== existingOrg[key];
      });

      if (!hasChanges) {
        return;
      }
    }

    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in to update an organization');

      const res = await authFetch(`/api/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update organization');

      setOrganizations(prev => prev.map(o => o.id === id ? data.organization : o));
      toast({ title: "Organization updated", description: `${data.organization.name} has been updated successfully` });
    } catch (error) {
      toast({ title: "Failed to update organization", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteOrganization = async (id: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('You must be logged in');
      const org = organizations.find(o => o.id === id);
      if (!org) throw new Error('Not found');

      const res = await authFetch(`/api/organizations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      setOrganizations(prev => prev.filter(o => o.id !== id));
      toast({ title: "Deleted", description: `${org.name} has been deleted` });
    } catch (error) {
      toast({ title: "Failed to delete", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addGroupToOrganization = async (organizationId: string, groupId: string) => {
    // Groups are managed via the groups API - this refreshes the org state
    await refreshOrganizations();
  };

  const removeGroupFromOrganization = async (organizationId: string, groupId: string) => {
    await refreshOrganizations();
  };

  const addMemberToOrganization = async (organizationId: string, userId: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');
      const org = organizations.find(o => o.id === organizationId);
      if (!org) throw new Error('Not found');

      const res = await authFetch(`/api/organizations/${organizationId}`, {
        method: 'PUT',
        body: JSON.stringify({ members: [...org.members, userId] }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');

      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      toast({ title: "Member added", description: `User added to ${org.name}` });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const inviteMemberToOrganization = async (organizationId: string, email: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');
      const org = organizations.find(o => o.id === organizationId);
      if (!org) throw new Error('Organization not found');

      const res = await authFetch(`/api/organizations/${organizationId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite member');

      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      toast({ title: "Member added", description: `${email} has been added to ${org.name}` });
    } catch (error) {
      toast({ title: "Invite failed", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeMemberFromOrganization = async (organizationId: string, userId: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');
      const org = organizations.find(o => o.id === organizationId);
      if (!org) throw new Error('Not found');

      const res = await authFetch(`/api/organizations/${organizationId}`, {
        method: 'PUT',
        body: JSON.stringify({ members: org.members.filter(m => m !== userId) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');

      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      toast({ title: "Member removed", description: `User removed from ${org.name}` });
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getUserOrganizations = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin') return organizations;
    return organizations.filter(org => 
      org.members.includes(currentUser.id) || 
      org.createdBy === currentUser.id || 
      org.managerIds.includes(currentUser.id)
    );
  };

  const assignManagerToOrganization = async (organizationId: string, email: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');

      const res = await authFetch(`/api/organizations/${organizationId}/assign-manager`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign manager');

      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      toast({ title: "Manager added", description: `${email} is now a manager` });
    } catch (error) {
      toast({ title: "Failed to assign manager", description: error instanceof Error ? error.message : "An unknown error occurred", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getOrganizationMembers = async (organizationId: string): Promise<OrgMember[]> => {
    try {
      const res = await authFetch(`/api/organizations/${organizationId}/members`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get members');
      return data.members;
    } catch (error) {
      console.error('Failed to get members:', error);
      return [];
    }
  };

  const addInstrument = async (organizationId: string, instrument: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');
      const res = await authFetch(`/api/organizations/${organizationId}/instruments`, {
        method: 'POST',
        body: JSON.stringify({ instrument }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add instrument');
      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      toast({ title: 'Instrument added', description: `${instrument} is now available in your organization.` });
    } catch (error) {
      toast({ title: 'Failed to add instrument', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeInstrument = async (organizationId: string, instrument: string) => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');
      const res = await authFetch(`/api/organizations/${organizationId}/instruments?instrument=${encodeURIComponent(instrument)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove instrument');
      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      toast({ title: 'Instrument removed', description: `${instrument} has been removed from your organization.` });
    } catch (error) {
      toast({ title: 'Failed to remove instrument', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const setOrgMemberRole = async (organizationId: string, userId: string, role: 'user' | 'editor' | 'manager') => {
    setLoading(true);
    try {
      if (!currentUser) throw new Error('Login required');

      const res = await authFetch(`/api/organizations/${organizationId}/appoint-org-editor`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change role');

      setOrganizations(prev => prev.map(o => o.id === organizationId ? data.organization : o));
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
      toast({ title: 'Role updated', description: `User is now ${role === 'user' ? 'a' : 'an'} ${roleLabel}` });
    } catch (error) {
      toast({ title: 'Failed to change role', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const submitJoinRequest = async (joinCode: string) => {
    try {
      setLoading(true);
      const res = await authFetch('/api/organizations/join-request', {
        method: 'POST',
        body: JSON.stringify({ joinCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit join request');
      toast({ title: 'Request Sent', description: 'Your request to join has been sent to the organization managers.' });
    } catch (error) {
      toast({ title: 'Join Request Failed', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getJoinRequests = async (organizationId: string): Promise<JoinRequest[]> => {
    try {
      const res = await authFetch(`/api/organizations/${organizationId}/requests`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch join requests');
      return data.requests;
    } catch (error) {
      console.error('Failed to get join requests', error);
      return [];
    }
  };

  const approveJoinRequest = async (organizationId: string, requestId: string) => {
    try {
      const res = await authFetch(`/api/organizations/${organizationId}/requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve request');
      toast({ title: 'Request Approved', description: 'The user has been added to the organization.' });
      await refreshOrganizations(); // Refresh to show new member
    } catch (error) {
      toast({ title: 'Approval Failed', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
      throw error;
    }
  };

  const rejectJoinRequest = async (organizationId: string, requestId: string) => {
    try {
      const res = await authFetch(`/api/organizations/${organizationId}/requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request');
      toast({ title: 'Request Rejected', description: 'The join request was rejected.' });
    } catch (error) {
      toast({ title: 'Rejection Failed', description: error instanceof Error ? error.message : 'An unknown error occurred', variant: 'destructive' });
      throw error;
    }
  };

  const value = {
    organizations,
    loading,
    createOrganization,
    getOrganization,
    updateOrganization,
    deleteOrganization,
    addGroupToOrganization,
    removeGroupFromOrganization,
    addMemberToOrganization,
    removeMemberFromOrganization,
    inviteMemberToOrganization,
    assignManagerToOrganization,
    setOrgMemberRole,
    getOrganizationMembers,
    getUserOrganizations,
    refreshOrganizations,
    addInstrument,
    removeInstrument,
    allowUserOrgCreation,
    submitJoinRequest,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useOrganizations = () => {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganizations must be used within an OrganizationProvider');
  return context;
};
