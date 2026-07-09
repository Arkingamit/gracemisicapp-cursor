
import OrganizationForm from '@/components/organizations/OrganizationForm';

const OrganizationAdd = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Create New Organization</h1>
      <OrganizationForm />
    </div>
  );
};

export default OrganizationAdd;
