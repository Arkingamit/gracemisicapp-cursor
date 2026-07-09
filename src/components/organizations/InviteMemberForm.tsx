import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface InviteMemberFormProps {
  organizationId: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const InviteMemberForm = ({ organizationId }: InviteMemberFormProps) => {
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const { inviteMemberToOrganization } = useOrganizations();
  const { toast } = useToast();

  const handleInvite = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({ title: 'Invalid email', description: 'Please enter an email address.', variant: 'destructive' });
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    setInviting(true);
    try {
      await inviteMemberToOrganization(organizationId, trimmedEmail);
      setEmail('');
    } catch (error) {
      // Error toast is already handled by the context
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="email"
        placeholder="Enter member's email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={inviting}
        onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
        className="w-full"
      />
      <Button onClick={handleInvite} disabled={inviting} className="w-full">
        <UserPlus className="w-4 h-4 mr-2" />
        {inviting ? 'Adding...' : 'Add Member'}
      </Button>
    </div>
  );
};

export default InviteMemberForm;
