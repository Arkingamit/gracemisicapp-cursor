import type { Viewport } from "next";
import { AppProviders } from "./AppProviders";
import AIChatBot from "@/components/common/AIChatBot";
import "@/index.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Helps mobile browsers / WebViews resize layout when the keyboard opens
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
