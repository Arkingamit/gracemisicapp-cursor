"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { SongProvider } from "@/contexts/SongContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { GroupProvider } from "@/contexts/groups";
import { PlaylistProvider } from "@/contexts/PlaylistContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Toaster } from "@/components/ui/toaster";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

const Navigation = dynamic(() => import("@/components/layout/Navigation"), {
  ssr: false,
  loading: () => (
    <div className="h-16 border-b bg-background/80 backdrop-blur-sm" />
  ),
});

const BottomNavigation = dynamic(
  () => import("@/components/layout/BottomNavigation"),
  { ssr: false }
);

const ForceUpdateModal = dynamic(
  () => import("@/components/common/ForceUpdateModal"),
  { ssr: false }
);

const ProfileSetupModal = dynamic(
  () => import("@/components/profile/ProfileSetupModal"),
  { ssr: false }
);

const OnboardingTour = dynamic(
  () => import("@/components/common/OnboardingTour"),
  { ssr: false }
);

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "810353645969-dmsbou0itk6475tap5j8qq7ejvs68dm7.apps.googleusercontent.com";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // ID token only — do not pass OAuth scopes (avoids a second consent that often cancels)
      GoogleSignIn.initialize({
        clientId: GOOGLE_CLIENT_ID,
      }).catch(console.error);
    }
  }, []);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <AuthProvider>
          <OrganizationProvider>
            <SongProvider>
              <GroupProvider>
                <PlaylistProvider>
                  <NotificationProvider>
                    <div className="flex flex-col min-h-[100dvh]">
                      <Suspense fallback={<div className="h-16 border-b bg-background/80" />}>
                        <Navigation />
                      </Suspense>
                      <main className="min-h-[calc(100vh-64px)] pt-16 md:pt-24 pb-24 md:pb-0 relative">
                        {children}
                      </main>
                      <Suspense fallback={null}>
                        <BottomNavigation />
                      </Suspense>
                      <ForceUpdateModal />
                      <ProfileSetupModal />
                      <OnboardingTour />
                      <Toaster />
                    </div>
                  </NotificationProvider>
                </PlaylistProvider>
              </GroupProvider>
            </SongProvider>
          </OrganizationProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

