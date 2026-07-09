
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Group, Organization } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GroupFormProps {
  group?: Group;
  onSuccess?: (groupId: string) => void;
  onClose?: () => void;
  organizationId?: string;
  members?: string[];
}

const GroupForm = ({ group, onSuccess, onClose, organizationId: initialOrgId, members: initialMembers }: GroupFormProps) => {
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get('organizationId');
  
  const [name, setName] = useState(group?.name || '');
  const [organizationId, setOrganizationId] = useState(group?.organizationId || initialOrgId || orgIdParam || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createGroup, updateGroup } = useGroups();
  const { organizations, getUserOrganizations } = useOrganizations();
  const { currentUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
  
  const userOrganizations = getUserOrganizations();

  useEffect(() => {
    // Check if user is logged in
    if (!currentUser) {
      router.replace('/login');
    }
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: 'Input required', description: 'Please enter a group name', variant: 'destructive' });
      return;
    }

    if (!organizationId) {
      toast({ title: 'Selection required', description: 'Please select an organization', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (group) {
        // Update existing group
        await updateGroup(group.id, { name, organizationId });
        if (onSuccess) {
          onSuccess(group.id);
        } else {
          router.push(`/groups/view?id=${group.id}`);
        }
      } else {
        // Create new group
        const members = initialMembers || (currentUser ? [currentUser.id] : []);
        const groupId = await createGroup({
          name,
          organizationId,
          members
        });
        
        if (onSuccess) {
          onSuccess(groupId);
        } else {
          router.push(`/groups/view?id=${groupId}`);
        }
      }

      // Call onClose if provided
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving group:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-2">
            <label htmlFor="organizationId" className="text-sm font-medium">
              Organization
            </label>
            <Select
              value={organizationId}
              onValueChange={setOrganizationId}
              required
              disabled={!!group || !!initialOrgId} // Disable changing organization for existing groups or when org is specified
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {userOrganizations.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!userOrganizations.length && (
              <p className="text-sm text-destructive">
                You need to create or join an organization first.
                <Button 
                  variant="link" 
                  className="p-0 h-auto" 
                  onClick={() => router.push('/organizations/new')}
                >
                  Create an organization
                </Button>
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Song Set Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter song set name"
              required
            />
          </div>


          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose ? onClose() : router.push('/groups')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !organizationId}>
              {isSubmitting
                ? 'Saving...'
                : group
                ? 'Update Song Set'
                : 'Create Song Set'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default GroupForm;
