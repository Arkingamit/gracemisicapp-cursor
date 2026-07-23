import { NextResponse } from "next/server";

/**
 * Android App Links verification.
 * Set ANDROID_APP_LINK_SHA256 to one or more cert fingerprints (colon-separated hex),
 * comma-separated if multiple (upload key + Play App Signing key).
 *
 * Play Console → App integrity → App signing → SHA-256 certificate fingerprint
 */
export async function GET() {
  const raw = process.env.ANDROID_APP_LINK_SHA256 || "";
  const fingerprints = raw
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, "").toUpperCase())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "org.graceahmedabad.music",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
