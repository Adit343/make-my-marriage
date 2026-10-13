import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/legal-page";

export const metadata: Metadata = { title: "Terms of Service · Make My Marriage" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="13 October 2026">
      <p>
        Make My Marriage is a shared workspace where a couple, their families and a planner plan a
        wedding, and where guests can open invitations, answer RSVPs, see photos and watch a live
        stream through private links. By creating an account or using a link, you agree to these
        terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must give accurate details and keep your password to yourself.</li>
        <li>One account belongs to one wedding at a time.</li>
        <li>The person who creates a wedding is its owner and decides who else can join.</li>
      </ul>

      <h2>What you put in</h2>
      <ul>
        <li>
          You own your content: guest lists, notes, expenses, photos and anything else you add.
        </li>
        <li>
          You allow us to store it and show it to the people you choose (team members, or guests
          through the links you share), only to run the service.
        </li>
        <li>
          Only add photos and personal details you have the right to share, and only invite people
          you are allowed to contact.
        </li>
      </ul>

      <h2>What you must not do</h2>
      <ul>
        <li>Break the law, or upload anything unlawful or abusive.</li>
        <li>Try to reach another wedding&apos;s data, or disrupt the service.</li>
        <li>Share a private link with the aim of misleading or harassing people.</li>
      </ul>

      <h2>Money and vendors</h2>
      <p>
        The expense and vendor tools are notebooks. We do not process payments, hold money, or
        recommend or vouch for any vendor. Search results from Google Places come from Google.
      </p>

      <h2>Links, live streams and photos</h2>
      <p>
        Guest links are secret addresses: anyone who has one can use it, so share them carefully.
        The owner or an admin can replace or turn off a link at any time. A live-stream link only
        protects our page, not the video on YouTube or Vimeo.
      </p>

      <h2>Deleting things</h2>
      <p>
        Deleting a wedding hides it at once and keeps it for 30 days so it can be restored; after
        that it and its photos are permanently erased. Deleted accounts are anonymised after 30
        days.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep the service running but cannot promise it will always be available or error
        free. Please keep your own copy of anything essential. To the extent the law allows, we are
        not liable for indirect losses.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will tell you about important changes. Questions:
        shahadit68@gmail.com.
      </p>
    </LegalPage>
  );
}
