"use client";

import { LegalPageShell } from "@/components/legal/LegalPageShell";

const CONTACT_EMAIL = "gamitarkin2@gmail.com";
const SITE_URL = "https://music.graceahmedabad.org";

export default function TermsOfService() {
  return (
    <LegalPageShell title="Terms of Service" updated="July 20, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of Grace Music
        (the website, Android/iOS apps, and related services) operated at{" "}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
          {SITE_URL}
        </a>
        . By creating an account or using the service, you agree to these Terms.
      </p>

      <h2>1. The service</h2>
      <p>
        Grace Music helps churches and musicians manage worship songs, chord
        charts, song sets, collections, and organizations. Features may change
        over time.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must provide accurate account information</li>
        <li>You are responsible for activity under your account</li>
        <li>You may delete your account from Profile at any time</li>
        <li>
          We may suspend or terminate accounts that violate these Terms or harm
          other users
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Upload unlawful, harmful, or abusive content</li>
        <li>Attempt to break into, disrupt, or overload the service</li>
        <li>Impersonate others or misuse organization roles</li>
        <li>Scrape or misuse the service in ways that harm other users</li>
      </ul>

      <h2>4. User content &amp; copyright</h2>
      <p>
        You retain rights to content you submit. By uploading songs, charts, or
        other materials, you represent that you have the rights needed to share
        them in Grace Music (for example, permission, license, or ownership).
      </p>
      <p>
        Do not upload copyrighted lyrics, charts, or recordings unless you are
        authorized to do so. We may remove content that appears to infringe
        rights or violate these Terms. Report concerns via the in-app report
        tools or email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>5. Organizations &amp; roles</h2>
      <p>
        Organization managers control membership and content within their
        organization. If you are the only manager of an organization, transfer
        management before deleting your account.
      </p>

      <h2>6. Notifications</h2>
      <p>
        If you enable notifications, we may send alerts related to sets, groups,
        and app updates. You can turn notifications off in your device settings.
      </p>

      <h2>7. AI features</h2>
      <p>
        Optional AI features may process prompts and related context to provide
        suggestions. Do not submit sensitive personal data you do not want
        processed by those features.
      </p>

      <h2>8. Disclaimer</h2>
      <p>
        The service is provided &quot;as is&quot; without warranties of any kind
        to the fullest extent permitted by law. We do not guarantee uninterrupted
        or error-free operation.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Grace Music and its operators are
        not liable for indirect, incidental, special, consequential, or punitive
        damages, or any loss of data, profits, or goodwill arising from your use
        of the service.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these Terms. The &quot;Last updated&quot; date will change
        when we do. Continued use after changes means you accept the updated
        Terms.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPageShell>
  );
}
