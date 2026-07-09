
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import AddToGroupModal from './AddToGroupModal';
import { useAuth } from '@/contexts/AuthContext';

interface AddToGroupButtonProps {
  songId: string;
  songTitle: string;
  showText?: boolean;
}

const AddToGroupButton = ({ songId, songTitle, showText = false }: AddToGroupButtonProps) => {
  const [showModal, setShowModal] = useState(false);
  const { currentUser } = useAuth();

  // Only render button if user is logged in
  if (!currentUser) {
    return null;
  }

  return (
    <>
      <Button 
        onClick={() => setShowModal(true)}
        variant="outline"
        size={showText ? "default" : "icon"}
        className={showText ? "flex items-center gap-2" : "h-8 w-8"}
        title="Add to Set"
      >
        <Plus className="h-4 w-4" />
        {showText && <span>Add to Set</span>}
      </Button>

      {showModal && (
        <AddToGroupModal 
          songId={songId}
          songTitle={songTitle}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

export default AddToGroupButton;
