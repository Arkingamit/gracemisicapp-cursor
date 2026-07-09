
import { useSearchParams } from 'next/navigation';
import OrganizationDetailComponent from '@/components/organizations/OrganizationDetail';

const OrganizationDetailPage = () => {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  if (!id) return <div>Invalid organization ID</div>;

  return <OrganizationDetailComponent id={id} />;
};

export default OrganizationDetailPage;
