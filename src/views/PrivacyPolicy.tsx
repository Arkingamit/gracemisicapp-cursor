"use client";

import { LegalPageShell } from "@/components/legal/LegalPageShell";

const CONTACT_EMAIL = "gamitarkin2@gmail.com";
const SITE_URL = "https://music.graceahmedabad.org";

export default function PrivacyPolicy() {
  return (
    <LegalPageShell title="Privacy Policy" updated="July 20, 2026">
      <p>
        This Privacy Policy explains how Grace Music (&quot;we&quot;, &quot;us&quot;)
        collects, uses, and shares information when you use our website and mobile
        apps at{" "}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          {SITE_URL}
        </a>
        .
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong className="text-zinc-100">Account information:</strong> email
          address, name/display name, and authentication details when you sign in
          with Google or create an account.
        </li>
        <li>
          <strong className="text-zinc-100">Profile details (optional):</strong>{" "}
          church/organization, instrument/role, and age if you choose to provide
          them.
        </li>
        <li>
          <strong className="text-zinc-100">Content you create:</strong> songs,
          sets, collections, feedback, and related app content.
        </li>
        <li>
          <strong className="text-zinc-100">Device &amp; notifications:</strong>{" "}
          push notification device tokens (Android/iOS) and web push
          subscriptions when you allow notifications.
        </li>
        <li>
          <strong className="text-zinc-100">Usage &amp; support:</strong> AI chat
          history (if you use the assistant), feedback messages, and basic
          technical logs needed to operate and secure the service.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide authentication, profiles, libraries, sets, and organizations</li>
        <li>Send notifications you opt into (sets, groups, and app updates)</li>
        <li>Improve features, moderate abuse, and provide support</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. How we share information</h2>
      <p>
        We do not sell your personal information. We may share data with service
        providers that help us run the app, including:
      </p>
      <ul>
        <li>Google (Sign-In / OAuth, Firebase Cloud Messaging for push)</li>
        <li>Hosting and database providers that store app data</li>
        <li>AI providers used for optional assistant features</li>
      </ul>
      <p>
        Organization managers and members may see content and membership
        information within organizations you join.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We keep account and content data while your account is active. When you
        delete your account, we remove or anonymize personal account data as
        described in the app&apos;s delete-account flow, except where we must
        retain limited records for security, legal, or operational reasons.
      </p>

      <h2>5. Your choices</h2>
      <ul>
        <li>Update profile details in the Profile screen</li>
        <li>Disable notifications in device settings</li>
        <li>
          Delete your account from Profile → Delete account (available in the
          app and website)
        </li>
        <li>
          Contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> for privacy
          requests
        </li>
      </ul>

      <h2>6. Children</h2>
      <p>
        Grace Music is not directed to children under 13. We do not knowingly
        collect personal information from children under 13. If you believe a
        child has provided personal information, contact us and we will take
        appropriate steps.
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect
        account data, including encrypted transport (HTTPS) and access controls.
        No method of transmission or storage is 100% secure.
      </p>

      <h2>8. International users</h2>
      <p>
        Your information may be processed in countries where we or our providers
        operate. By using Grace Music, you understand that your information may
        be transferred to those locations.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update this Privacy Policy from time to time. The &quot;Last
        updated&quot; date at the top will change when we do. Continued use of
        the service after updates means you accept the revised policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about privacy:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
