import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, authFetch } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';
import { FeedbackModal } from '../common/FeedbackModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, User, LogOut, Settings, Music, Users, Heart, ListMusic, Info, Plus, MessageSquare, ListChecks, Files } from 'lucide-react';
import { hasAnyRole } from '@/lib/roles';

const Navigation = () => {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (currentUser && hasAnyRole(currentUser, 'editor', 'verifier')) {
      const fetchPendingCount = async () => {
        try {
          const res = await authFetch('/api/songs?status=pending&limit=1000');
          if (res.ok) {
            const data = await res.json();
            setPendingCount(data.songs?.length || 0);
          }
        } catch (e) {
          console.error("Failed to fetch pending songs count", e);
        }
      };
      fetchPendingCount();

      // Listen for custom event from Verification Queue
      const handleSongProcessed = () => {
        setPendingCount((prev) => Math.max(0, prev - 1));
      };
      window.addEventListener('pendingSongProcessed', handleSongProcessed);
      return () => {
        window.removeEventListener('pendingSongProcessed', handleSongProcessed);
      };
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const navLinks = [
    { name: 'Songs', path: '/songs', icon: <Music className="h-4 w-4" />, tour: 'nav-songs' },
    { name: 'Favorites', path: '/favorites', icon: <Heart className="h-4 w-4" />, tour: 'nav-favorites' },
    { name: 'Collections', path: '/playlists', icon: <ListMusic className="h-4 w-4" />, tour: 'nav-library' },
    { name: 'Sets', path: '/groups', icon: <Files className="h-4 w-4" />, tour: 'nav-sets' },
    { name: 'Orgs', path: '/organizations', icon: <Users className="h-4 w-4" />, tour: 'nav-orgs' },
  ];
  return (
    <>

      <header className="absolute top-0 left-0 right-0 z-50 w-full md:pt-4 md:px-4 pointer-events-none">
        <div className="w-full md:max-w-5xl mx-auto bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/100 border-b md:border border-border/9 md:shadow-md md:rounded-full pointer-events-auto  ">
          <div className="container mx-auto px-4 md:px-6 flex justify-between items-center h-16">
            <div className="flex items-center md:flex-1">
              <Link href="/" className="flex items-center gap-3 text-xl font-bold group">
                <div className="h-10 w-10 flex items-center justify-center shrink-0">
                  <img src="/lovable-uploads/gracemain.png" alt="Grace Music Logo" className="max-h-full max-w-full object-contain" />
                </div>
                <span className="md:hidden lg:block whitespace-nowrap text-zinc-100 group-hover:text-primary transition-colors duration-200">Grace Music</span>
              </Link>
            </div>
          
          <nav className="hidden md:flex items-center justify-center gap-2 lg:gap-6 md:flex-auto">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                data-tour={link.tour}
                className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 rounded-md transition-colors text-xs lg:text-sm font-medium ${
                  isActive(link.path)
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-100'
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </nav>
        
        <div className="flex items-center gap-2 md:flex-1 justify-end">
          
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div data-tour="notification-bell">
                <NotificationBell />
              </div>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-tour="profile-menu" variant="ghost" className="relative h-10 w-auto rounded-full flex items-center gap-2 pl-1 pr-3 md:pr-4 border border-transparent md:border-border/50 hover:bg-zinc-800/50 transition-all hover:border-zinc-700">
                  <div className="relative">
                    <Avatar className="h-8 w-8 ring-1 ring-white/20 shadow-sm transition-all group-hover:ring-white/40">
                      <AvatarImage src={currentUser.photoURL || ''} alt={currentUser.displayName || currentUser.name} />
                      <AvatarFallback className="bg-zinc-700 text-white font-bold text-xs">
                        {getInitials(currentUser.displayName || currentUser.name || 'User')}
                      </AvatarFallback>
                    </Avatar>
                    {pendingCount > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white border border-zinc-950 shadow-sm animate-pulse">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    ) : (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-950 rounded-full" />
                    )}
                  </div>
                  <span className="text-sm font-medium hidden lg:block text-zinc-200">
                    {currentUser.displayName?.split(' ')[0] || currentUser.name?.split(' ')[0] || 'User'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser.displayName || currentUser.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{currentUser.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/about')}>
                  <Info className="mr-2 h-4 w-4" />
                  <span>About & Contact</span>
                </DropdownMenuItem>

                <DropdownMenuItem data-tour="add-song" onClick={() => router.push('/songs/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Add Song</span>
                </DropdownMenuItem>
                {hasAnyRole(currentUser, 'verifier', 'editor') && (
                  <DropdownMenuItem onClick={() => router.push('/verification-queue')} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ListChecks className="mr-2 h-4 w-4" />
                      <span>Pending Songs</span>
                    </div>
                    {pendingCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                )}
                {hasAnyRole(currentUser, 'super_admin') && (
                  <DropdownMenuItem onClick={() => router.push('/admin')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Dashboard</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Desktop View */}
              <div className="hidden md:flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/about')}
                  className="border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300 hover:text-white rounded-full px-6 transition-all hover:scale-105 active:scale-95"
                >
                  About
                </Button>
                <Button 
                  onClick={() => router.push('/login')}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full px-6 transition-all hover:scale-105 active:scale-95"
                >
                  Sign In
                </Button>
              </div>

              {/* Mobile View */}
              <div className="flex md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-auto rounded-full flex items-center gap-2 px-3 border border-border/50 hover:bg-zinc-800/50 transition-colors">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-medium">Login</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48" align="end" forceMount>
                    <DropdownMenuItem onClick={() => router.push('/login')}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Sign In</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/about')}>
                      <Info className="mr-2 h-4 w-4" />
                      <span>About</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
    </>
  );
};

export default Navigation;
