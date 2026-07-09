
import GroupForm from '@/components/groups/GroupForm';

const GroupAdd = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Create New Group</h1>
      <GroupForm />
    </div>
  );
};

export default GroupAdd;
