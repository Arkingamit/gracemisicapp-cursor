import { NextResponse } from "next/server";

/**
 * Apple Universal Links association.
 * Team ID is taken from the iOS Xcode project (DEVELOPMENT_TEAM).
 */
export async function GET() {
  // Team: arkin gamit (2B633NXZ52). Override with APPLE_TEAM_ID if needed.
  const teamId = process.env.APPLE_TEAM_ID || "2B633NXZ52";
  const bundleId =
    process.env.APPLE_IOS_BUNDLE_ID || "org.graceahmedabad.music.ios";

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          paths: ["/invite/*"],
          components: [
            {
              "/": "/invite/*",
              comment: "Organization invite links open in Grace Music",
            },
          ],
        },
      ],
    },
    webcredentials: {
      apps: [`${teamId}.${bundleId}`],
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      // Apple requires this content type (no file extension on the path)
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
