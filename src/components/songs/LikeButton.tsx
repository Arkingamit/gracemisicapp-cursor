
"use client";

import React from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlaylists } from '@/contexts/PlaylistContext';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  songId: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "ghost" | "outline" | "default";
  className?: string;
  showText?: boolean;
}

const LikeButton: React.FC<LikeButtonProps> = ({ 
  songId, 
  size = "icon", 
  variant = "ghost",
  className,
  showText = false
}) => {
  const { isFavorite, toggleFavorite } = usePlaylists();
  const liked = isFavorite(songId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(songId);
  };

  return (
    <Button
      variant={variant}
      size={showText ? "sm" : size}
      onClick={handleClick}
      className={cn(
        "transition-all duration-300",
        liked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-400",
        className
      )}
    >
      <Heart className={cn("w-4 h-4", liked && "fill-current")} />
      {showText && <span className="ml-2">{liked ? "Liked" : "Like"}</span>}
    </Button>
  );
};

export default LikeButton;
