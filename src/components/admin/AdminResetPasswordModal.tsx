"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface AdminResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => Promise<void>;
  targetUserName: string;
}

export function AdminResetPasswordModal({ 
  open, 
  onOpenChange, 
  onConfirm, 
  targetUserName 
}: AdminResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!password) return;
    setIsSubmitting(true);
    try {
      await onConfirm(password);
      setPassword('');
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the caller (toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Password Reset</DialogTitle>
          <DialogDescription>
            You are resetting the password for <strong>{targetUserName}</strong> to a temporary password.
            The new password will be shown to you after you confirm.
            Please enter <strong>your administrator password</strong> to authorize this action.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="admin-password">Your Administrator Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!password || isSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? 'Authorizing...' : 'Authorize Reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
