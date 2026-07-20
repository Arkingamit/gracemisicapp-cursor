'use client';

import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  /** Controlled open state (omit when using a trigger) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog when clicked */
  trigger?: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red destructive styling (default true, most confirms are deletes) */
  destructive?: boolean;
  /** Icon shown in the media circle; defaults to a warning triangle */
  icon?: ReactNode;
  onConfirm: () => void;
}

/**
 * App-standard confirmation dialog: media icon circle, title, description,
 * cancel + confirm buttons, styled for the dark zinc theme.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  icon,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent size="sm" className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={destructive ? 'bg-red-950/60 text-red-400' : 'bg-zinc-800 text-zinc-300'}
          >
            {icon ?? <AlertTriangle />}
          </AlertDialogMedia>
          <AlertDialogTitle className={destructive ? 'text-red-400' : 'text-zinc-100'}>
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-100 text-zinc-900 hover:bg-white'
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
