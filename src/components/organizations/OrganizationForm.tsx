
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { Organization } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrganizationFormProps {
  organization?: Organization;
  onSuccess?: (organizationId: string) => void;
}

const OrganizationForm = ({ organization, onSuccess }: OrganizationFormProps) => {
  const [name, setName] = useState(organization?.name || '');
  const [managerEmail, setManagerEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createOrganization, updateOrganization, allowUserOrgCreation } = useOrganizations();
  const { currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is logged in
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    
    const isSuperAdmin = currentUser.role === 'super_admin';
    const isCreating = !organization;

    // Block if: not super_admin AND (is creating AND creation is disabled)
    if (!isSuperAdmin && isCreating && !allowUserOrgCreation) {
      router.replace('/organizations');
    }
  }, [currentUser, router, organization, allowUserOrgCreation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an organization name",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (organization) {
        // Update existing organization
        await updateOrganization(organization.id, { name });
        if (onSuccess) {
          onSuccess(organization.id);
        } else {
          router.push(`/organizations/view?id=${organization.id}`);
        }
      } else {
        // Create new organization (super_admin only)
        // Note: The backend will set managerId to createdBy if we don't handle lookup here,
        // but it's better for super_admin to assign the manager via the detail page after creation
        // to ensure the user exists and handle the role update correctly.
        const organizationId = await createOrganization({
          name,
          members: [currentUser!.id],
        });
        
        if (onSuccess) {
          onSuccess(organizationId);
        } else {
          router.push(`/organizations/view?id=${organizationId}`);
        }
      }
    } catch (error) {
      console.error('Error saving organization:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save organization",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Organization Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter organization name"
              required
            />
          </div>


          {!organization && (
            <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-3">
              <Crown className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Manager Assignment</p>
                <p className="text-muted-foreground">You will be the initial manager. Use the organization detail page to assign a different manager after creation.</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/organizations')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : organization
                ? 'Update Organization'
                : 'Create Organization'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default OrganizationForm;
