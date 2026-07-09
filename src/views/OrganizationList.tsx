
import OrganizationList from '@/components/organizations/OrganizationList';

const OrganizationListPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Organizations</h1>
      <OrganizationList />
    </div>
  );
};

export default OrganizationListPage;
