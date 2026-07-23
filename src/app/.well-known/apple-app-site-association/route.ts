import { NextResponse } from "next/server";

/**
 * Apple Universal Links association.
 * Team ID is taken from the iOS Xcode project (DEVELOPMENT_TEAM).
 */
export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID || "7C99V6842Q";
  const bundleId = "org.graceahmedabad.music";

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
