"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TOUR_START_KEY, TOUR_STORAGE_KEY } from "@/lib/tourSteps";

export default function ProfileSetupModal() {
  const { currentUser, updateProfile, loading } = useAuth();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: "",
    church: "",
    instrument: "",
    age: "",
  });

  // Check if profile is incomplete
  useEffect(() => {
    if (!loading && currentUser) {
      // If any of these key fields are missing, prompt the user
      const isIncomplete = !currentUser.church || !currentUser.instrument;
      
      if (isIncomplete) {
        setFormData({
          displayName: currentUser.displayName || currentUser.name || "",
          church: currentUser.church || "",
          instrument: currentUser.instrument || "",
          age: currentUser.age ? String(currentUser.age) : "",
        });
        setOpen(true);
      } else {
        setOpen(false);
      }
    }
  }, [currentUser, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.church.trim() || !formData.instrument.trim() || !formData.displayName.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill out all required fields to continue.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      await updateProfile({
        displayName: formData.displayName,
        church: formData.church,
        instrument: formData.instrument,
        age: formData.age ? parseInt(formData.age, 10) : undefined,
      });
      
      toast({
        title: "Profile updated",
        description: "Welcome to Grace Music!",
      });
      setOpen(false);

      // Trigger onboarding tour for first-time users
      const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
      if (tourCompleted !== "true") {
        localStorage.setItem(TOUR_START_KEY, "true");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // We do not provide an onOpenChange that allows closing if it's mandatory
  // The user MUST fill this out to use the app properly.
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[425px] max-h-[min(92dvh,92vh)] overflow-y-auto overscroll-contain bg-zinc-950 border-white/10 text-white top-[8%] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl text-center">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-center text-zinc-400">
            Welcome! Please fill in a few details so we can tailor your experience.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-zinc-300">Display Name <span className="text-red-500">*</span></Label>
            <Input
              id="displayName"
              placeholder="e.g. John Doe"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              className="bg-zinc-900 border-white/10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="church" className="text-zinc-300">Church / Organization <span className="text-red-500">*</span></Label>
            <Input
              id="church"
              placeholder="e.g. Grace Church"
              value={formData.church}
              onChange={(e) => setFormData(prev => ({ ...prev, church: e.target.value }))}
              className="bg-zinc-900 border-white/10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instrument" className="text-zinc-300">Primary Instrument / Role <span className="text-red-500">*</span></Label>
            <Input
              id="instrument"
              placeholder="e.g. Acoustic Guitar, Vocals, Keys"
              value={formData.instrument}
              onChange={(e) => setFormData(prev => ({ ...prev, instrument: e.target.value }))}
              className="bg-zinc-900 border-white/10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age" className="text-zinc-300">Age <span className="text-zinc-500 text-xs font-normal">(Optional)</span></Label>
            <Input
              id="age"
              type="number"
              inputMode="numeric"
              placeholder="e.g. 25"
              value={formData.age}
              onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
              className="bg-zinc-900 border-white/10"
              min="1"
              max="120"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-primary text-primary-foreground font-semibold mt-4" 
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Complete Profile"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
