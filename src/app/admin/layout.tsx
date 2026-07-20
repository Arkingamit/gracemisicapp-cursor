"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Users,
  Building2,
  Files,
  Music,
  CheckSquare,
  Gift,
  Tags,
  Coins,
  PlusCircle,
  FileText,
  HardDrive,
  Grid,
  MessageSquare,
  Activity,
  MessageCircle,
  Settings,
  Menu,
  X,
  Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/admin/stats', label: 'Stats', icon: BarChart3 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/song-sets', label: 'Song Sets', icon: Files },
  { href: '/admin/songs', label: 'Songs', icon: Music },
  { href: '/admin/verification', label: 'Verification Queue', icon: CheckSquare },
  { href: '/admin/song-reports', label: 'Song Reports', icon: Flag },
  { href: '/admin/contributions', label: 'Contributions', icon: Gift },
  { href: '/admin/aliases', label: 'Aliases', icon: Tags },
  { href: '/admin/activity', label: 'Payouts & Activity', icon: Coins },
  { href: '/admin/add-song', label: 'Add Song', icon: PlusCircle },
  { href: '/admin/audit', label: 'Activity Logs', icon: FileText },
  { href: '/admin/storage', label: 'Storage', icon: HardDrive },
  { href: '/admin/genres', label: 'Genres', icon: Grid },
  { href: '/admin/ai-chats', label: 'AI Chats', icon: MessageSquare },
  { href: '/admin/ai-usage', label: 'AI Usage', icon: Activity },
  { href: '/admin/feedback', label: 'User Feedback', icon: MessageCircle },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  useEffect(() => {
    if (!loading) {
      if (!currentUser || currentUser.role !== 'super_admin') {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        router.push('/');
      }
    }
  }, [currentUser, loading, router, toast]);

  if (loading || (!currentUser || currentUser.role !== 'super_admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-black">
      {/* Mobile Menu Button */}
      <div className="lg:hidden absolute top-4 left-4 z-[70]">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-black border-white/10"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-64 bg-zinc-950 border-r border-white/5 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="shrink-0 p-4 border-b border-white/5 mt-14 lg:mt-0">
            <h2 className="text-lg font-bold text-white tracking-tight">Admin Console</h2>
            <p className="text-xs text-zinc-500">Manage Grace Music App</p>
          </div>
          
          <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 py-4 space-y-1 pb-[calc(env(safe-area-inset-bottom)+5rem)] lg:pb-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-orange-500/10 text-orange-500' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-zinc-500'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-black p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
