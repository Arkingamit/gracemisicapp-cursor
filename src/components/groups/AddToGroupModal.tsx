
import { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/contexts/groups';
import { useOrganizations } from '@/contexts/OrganizationContext';
import { Group, Organization } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface AddToGroupModalProps {
  songId: string;
  songTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const AddToGroupModal = ({ songId, songTitle, isOpen, onClose }: AddToGroupModalProps) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { groups, addSongToGroup } = useGroups();
  const { organizations } = useOrganizations();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter organizations where the current user is a member
  const userOrganizations = organizations.filter(org => 
    currentUser && org.members.includes(currentUser.id)
  );
  
  // Get groups for each organization where user is a member
  const orgGroupsMap: Record<string, Group[]> = {};
  userOrganizations.forEach(org => {
    orgGroupsMap[org.id] = groups.filter(group => 
      group.organizationId === org.id && 
      currentUser && group.members.includes(currentUser.id)
    );
  });

  // Filter groups that don't already have the song
  const filteredOrgGroupsMap: Record<string, Group[]> = {};
  Object.keys(orgGroupsMap).forEach(orgId => {
    filteredOrgGroupsMap[orgId] = orgGroupsMap[orgId].filter(group => 
      !group.songs.includes(songId)
    );
  });
  
  // Check if there are any groups to add the song to
  const hasAvailableGroups = Object.values(filteredOrgGroupsMap)
    .some(groups => groups.length > 0);
  
  // Handle toggling group selection
  const toggleGroupSelection = (groupId: string) => {
    const newSelection = new Set(selectedGroups);
    if (newSelection.has(groupId)) {
      newSelection.delete(groupId);
    } else {
      newSelection.add(groupId);
    }
    setSelectedGroups(newSelection);
  };
  
  // Handle adding song to selected groups
  const handleAddToGroups = async () => {
    if (selectedGroups.size === 0) {
      toast({
        title: "No groups selected",
        description: "Please select at least one group to add the song to.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    const groupIds = Array.from(selectedGroups);
    // Optimistic addSongToGroup updates each set instantly — close the modal
    // right away so the user isn't waiting on the network.
    onClose();
    setIsSubmitting(false);

    const results = await Promise.allSettled(
      groupIds.map((groupId) => addSongToGroup(groupId, songId))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const succeeded = groupIds.length - failed;

    if (succeeded > 0 && failed === 0) {
      toast({
        title: "Song added successfully",
        description: `"${songTitle}" has been added to ${succeeded} ${succeeded === 1 ? 'group' : 'groups'}.`,
      });
    } else if (failed > 0) {
      // Per-group rollback toasts already fire from addSongToGroup; add a summary.
      toast({
        title: succeeded > 0 ? "Partially added" : "Couldn't add song",
        description:
          succeeded > 0
            ? `Added to ${succeeded} group(s); ${failed} failed and were restored.`
            : "The song was not added. Any optimistic changes were rolled back.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add "{songTitle}" to Groups</DialogTitle>
          <DialogDescription>
            Select groups where you want to add this song.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {!hasAvailableGroups ? (
            <div className="text-center py-4 text-muted-foreground">
              No available groups found. 
              {userOrganizations.length === 0 
                ? " You must be a member of at least one organization to add songs to groups." 
                : " The song might already be in all your groups."}
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <Accordion type="multiple" className="w-full">
                {userOrganizations.map((org: Organization) => (
                  filteredOrgGroupsMap[org.id].length > 0 && (
                    <AccordionItem key={org.id} value={org.id}>
                      <AccordionTrigger>{org.name}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {filteredOrgGroupsMap[org.id].map((group: Group) => (
                            <div key={group.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={group.id} 
                                checked={selectedGroups.has(group.id)} 
                                onCheckedChange={() => toggleGroupSelection(group.id)}
                              />
                              <label 
                                htmlFor={group.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {group.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                ))}
              </Accordion>
            </ScrollArea>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddToGroups} 
            disabled={selectedGroups.size === 0 || !hasAvailableGroups || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : `Add to ${selectedGroups.size} ${selectedGroups.size === 1 ? 'Group' : 'Groups'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddToGroupModal;
