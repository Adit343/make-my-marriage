import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";

export const metadata: Metadata = { title: "Privacy Policy · Make My Marriage" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="13 October 2026">
      <p>
        This explains what we keep, why, who can see it and for how long. We keep only what the
        wedding workspace needs.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          Your account: name, email and a scrambled (hashed) password, or your Google identity.
        </li>
        <li>
          Your wedding: names, dates, venues, events, tasks, expenses, vendors, the website, the
          live-stream links and photos.
        </li>
        <li>
          Your guests: name, phone, email, address, dietary preference, notes, their replies and
          their private link, as entered by your team.
        </li>
        <li>
          A short record of each email we send (who, when, whether it worked). It never contains the
          message or any link.
        </li>
        <li>
          Which browser signed in (for your list of signed-in devices). We do not store IP
          addresses; short-lived counters used to slow down abuse keep only an unreadable
          fingerprint.
        </li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>Your wedding team, according to their role. No other wedding can see your data.</li>
        <li>
          A guest sees only their own invitation, events and reply; a shared photo link shows only
          the photos you allowed.
        </li>
        <li>Anyone who has your published wedding website address sees what you made public.</li>
        <li>We do not sell your data or use it for advertising.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use one cookie to keep you signed in. Guest pages use no cookies and no tracking scripts.
      </p>

      <h2>Services we rely on</h2>
      <ul>
        <li>MongoDB Atlas stores the data.</li>
        <li>
          Cloudflare R2 stores photos in a private bucket; pictures are shown through short-lived
          links.
        </li>
        <li>Resend sends email.</li>
        <li>Google handles &quot;Continue with Google&quot; and vendor search (Places).</li>
        <li>YouTube or Vimeo play a live stream you add, when a guest opens the watch page.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Deleted wedding: hidden at once, permanently erased after 30 days, photos included.</li>
        <li>Deleted account: personal details are erased after 30 days.</li>
        <li>
          Email delivery records: 180 days. Expired sign-in sessions and links: removed
          automatically.
        </li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can edit or delete your details and guests in the app, sign out other devices, replace
        or switch off any guest link, and delete your account or wedding from Settings. To ask for a
        copy of your data or for a correction, write to us.
      </p>

      <h2 id="security">Security</h2>
      <ul>
        <li>Connections use HTTPS.</li>
        <li>Passwords are hashed with a slow, salted method and never stored as typed.</li>
        <li>
          Guest links are long random secrets, can be replaced, and stop working when revoked.
        </li>
        <li>
          Photos are private and checked when uploaded; every request is checked against your
          wedding.
        </li>
        <li>
          No system is perfectly secure. If you find a problem, please tell us at the address in the
          Contact section below.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>shahadit68@gmail.com</p>
    </LegalPage>
  );
}
