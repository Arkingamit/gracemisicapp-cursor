
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Music, Heart, Library, Users, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BottomNavigation = () => {
  const pathname = usePathname();
  const { currentUser } = useAuth();

  const navItems = [
    { name: 'Songs', path: '/songs', icon: Music },
    { name: 'Like', path: '/favorites', icon: Heart },
    { name: 'Library', path: '/playlists', icon: Library },
    { name: 'Sets', path: '/groups', icon: Building },
    { name: 'Org', path: '/organizations', icon: Users },
  ];

  const isActive = (path: string) => {
    if (path === '/' && pathname !== '/') return false;
    return pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));
  };

  return (
    <nav className="md:hidden fixed -bottom-1 left-0 right-0 z-50 border-t border-white/5 bg-background pointer-events-auto pb-[calc(env(safe-area-inset-bottom)+4px)] shadow-[0_-4px_20px_rgba(0,0,0,0.6)]">
      <div className="grid grid-cols-5 h-16 w-full mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`inline-flex flex-col items-center justify-center transition-all duration-300 group ${active ? 'text-primary' : 'text-zinc-500'
                }`}
            >
              <div className={`flex items-center justify-center p-1.5 mb-0.5 rounded-full transition-all ${active ? 'bg-primary/10' : ''}`}>
                <Icon
                  className={`w-6 h-6 group-active:scale-90 transition-transform ${active ? 'stroke-[2px]' : 'stroke-[1.5px]'
                    }`}
                />
              </div>
              <span className={`text-[9px] font-bold tracking-tight transition-opacity truncate w-full text-center px-1 ${active ? 'opacity-100' : 'opacity-70'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;

