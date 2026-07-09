
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import GroupForm from '@/components/groups/GroupForm';
import { useGroups } from '@/contexts/groups';
import { useAuth } from '@/contexts/AuthContext';
import { Group } from '@/lib/types';

const GroupEdit = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { getGroup } = useGroups();
  const { currentUser } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | undefined>();

  useEffect(() => {
    if (id) {
      const groupData = getGroup(id);
      setGroup(groupData);
      
      if (!groupData) {
        router.replace('/groups');
        return;
      }
      
      // Check if user has permission to edit
      if (
        currentUser && 
        currentUser.role !== 'super_admin' && 
        groupData.createdBy !== currentUser.id
      ) {
        router.replace(`/groups/view?id=${id}`);
      }
    }
  }, [id, getGroup, router, currentUser]);

  if (!group) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Edit Group</h1>
      <GroupForm 
        group={group} 
        onSuccess={() => router.push(`/groups/view?id=${id}`)} 
      />
    </div>
  );
};

export default GroupEdit;
