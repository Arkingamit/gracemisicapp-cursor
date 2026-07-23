import type { Viewport } from "next";
import { AppProviders } from "./AppProviders";
import AIChatBot from "@/components/common/AIChatBot";
import "@/index.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) under the iOS notch / Dynamic Island
  viewportFit: "cover",
  // Android Chrome/WebView: resize layout viewport with the keyboard so
  // fixed UI (bottom nav, dialogs) stays above it without a black gap.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <title>Grace Music</title>
        <meta name="description" content="Musical Website" />
        <meta name="author" content="Arkin" />
        <meta property="og:title" content="Grace Music" />
        <meta property="og:description" content="Musical Website" />
        <meta property="og:type" content="website" />
      </head>
      <body>
        <AppProviders>
          {children}
          <AIChatBot />
        </AppProviders>
      </body>
    </html>
  );
}
