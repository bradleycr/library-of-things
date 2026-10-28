import type { Metadata } from "next"
import Link from "next/link"

/**
 * Privacy notice for the whole library, written in the shape of GDPR
 * Articles 13 and 14. It is not a certification. A page cannot certify
 * compliance. It tells people what we do with their data, why, and how to
 * reach us.
 */

export const metadata: Metadata = {
  title: "Privacy notice — Library of Things",
  description: "How the Foresight Library of Things handles personal data, including guest passes.",
}

const UPDATED = "27 October 2026"
const CONTACT = "bradley@foresight.org"

const sections: Array<{ title: string; body: string[] }> = [
  {
    title: "Who we are",
    body: [
      "The Foresight Institute is the controller for Library of Things. The Institute’s address is 50 California Street, Suite 1500, San Francisco, 94111, United States. This library is operated for the Foresight Berlin Node and for any other community node that uses this installation.",
      "Privacy requests go to Bradley Clark Royes, Node Manager, at bradley@foresight.org. That is also the address replies to a guest-pass email reach.",
    ],
  },
  {
    title: "What this notice covers",
    body: [
      "This notice covers the Library of Things application: the catalog, library cards, book borrowing, temporary keycards and other physical passes, sharing history, and the steward tools used to run a node.",
      "It is written for members and for guests who check out a pass. If you only browse the catalog, the public information described below is what we show, and we do not ask you to create an account to look.",
    ],
  },
  {
    title: "What we process",
    body: [
      "Library card. A card needs an email you can open. We store a pseudonym, a salted hash of your PIN, and that email. Your real name is optional. If you ask us to send the card, we email the number and a new PIN, and the previous PIN stops working. A copy of that new PIN stays with the one-time link for up to 24 hours, then we delete it. The database keeps the hash.",
      "Guest pass. If you check out a temporary keycard, we ask for your name, email, and the day you plan to return it. We email you a confirmation. The card is checked out only after you open that message and confirm. If you have not confirmed after about an hour, we send one follow-up with the same finish-checkout button. On the morning of your chosen day we email you how to return it, and we email the node manager that morning and again when the card is returned. About two weeks after you leave, we email you to ask for a short stay report. Full reports stay internal; we may ask permission to share a short quote and whether we may mention your name. When you return the card you may optionally upload a photo of leaving it at reception or in the return locker; that photo is visible only to stewards and is deleted after about two weeks. We do not create a library card for you.",
      "Borrowing records. Sharing history stores that an item was added, checked out, or returned, with a time and a place name. For a guest pass the public name is “Guest”. The email is not written into that public history.",
      "Return reminders. On the day a book is due, a week later, and a month after that, we email the address on the borrower’s library card and ask for the book back. That email explains leaving it with CIC Berlin reception or, after hours, in the return locker in the node office (bottom right of the lockers), and mentions how to reach the node manager and the open coworking the node cohosts.",
      "Location. Returning a book may ask the browser for a single location sample so we can tell whether you are near the node. We do not keep the raw coordinates. A temporary keycard return does not use location. Having the card is enough.",
      "Steward access. Node stewards can see member contact details, and the email of a guest pass that is currently out, so they can run the library and follow up about a stay.",
    ],
  },
  {
    title: "Why, and the legal bases",
    body: [
      "Guest email and name: you give them so we can confirm the address and send the pass letter. The legal basis is your consent (GDPR Article 6(1)(a)), which you give by submitting the form and confirming from your inbox. You can ignore the email. The card is not checked out, and an unconfirmed request expires after 7 days.",
      "Running the library: library cards, loans, returns, and the steward tools are how the community shares physical things. The legal basis is our legitimate interest in operating that library (Article 6(1)(f)), balanced against your interest in not being put on a public list. That is why emails stay off sharing history.",
      "The stay report and house rules in the guest-pass email are a request from the node manager, not a condition we enforce inside the app. Replying to that email is optional and goes to the node manager, not into the public ledger.",
      "Security: rate limits and session cookies protect card creation, login, and checkout. The legal basis is legitimate interest in keeping the service from being abused.",
    ],
  },
  {
    title: "Sharing history",
    body: [
      "The sharing history at /ledger is public. It is how the library stays transparent. It shows item, event, time, and a display name.",
      "For temporary keycards and other operational passes, that name is Guest. We do not publish the guest email, including in the CSV or JSON download of the same history. Anyone who taps a card can see that it is out. They cannot see the address it was checked out to.",
      "Stewards still see the current guest email on the steward dashboard, because someone has to know who is holding a physical pass.",
    ],
  },
  {
    title: "Who else receives data",
    body: [
      "We use processors who act on our instructions:",
      "Vercel hosts the application. Supabase hosts the Postgres database. Resend sends the guest-pass email. Resend’s sending region for this mail is Ireland (eu-west-1).",
      "We do not sell personal data. We do not use advertising trackers, marketing pixels, or a third-party analytics suite.",
      "A pocket-library book can show an owner contact email on its public page, because borrowers need a way to arrange pickup. That is separate from a guest-pass email and from a member’s private account email.",
    ],
  },
  {
    title: "Transfers outside the EU",
    body: [
      "The controller is established in the United States. Hosting and the database may be processed in the United States or the European Union, depending on the provider region. Where personal data leaves the EU or EEA, the transfer relies on the safeguards those providers offer, including Standard Contractual Clauses where they apply.",
      "The guest-pass email itself is sent through Resend in the EU (Ireland).",
    ],
  },
  {
    title: "Cookies",
    body: [
      "We use only cookies the service needs in order to work. A library-card session cookie (lot_session) is set when you create or log in with a card. A guest-pass cookie may be set on the browser that confirms a checkout. A steward cookie is set after the steward password. These are strictly necessary. We do not ask for consent for them, and we do not set analytics or advertising cookies.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "An unconfirmed guest-pass request, including the email, is deleted when it expires (7 days) or shortly after. Once you confirm, the email is kept on the active loan so stewards can see who has the card. When the card is returned, that live copy is erased.",
      "A private copy of the guest email can remain on the loan event for the node manager, so they can follow up about the stay. It is not shown in sharing history. You can ask us to delete it.",
      "Sharing history itself is kept as the community record. After a member deletes their account, their public name becomes “Deleted account”.",
      "Library-card contact details are kept until you update them or the account is deleted.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "If the GDPR applies to you, you can ask for access, correction, erasure, restriction, or a copy of your personal data, and you can object to processing based on legitimate interests. Where we rely on consent, you can withdraw it. Withdrawing consent does not affect a checkout that already happened, but we will stop using the address for new mail and we will delete the private copy if you ask.",
      "You can also lodge a complaint with a supervisory authority. In Berlin, that is the Berliner Beauftragte für Datenschutz und Informationsfreiheit (https://www.datenschutz-berlin.de). In Germany more broadly, people also write to the Federal Commissioner, the BfDI (https://www.bfdi.bund.de). A directory of EU authorities is published by the European Data Protection Board (https://www.edpb.europa.eu).",
    ],
  },
  {
    title: "Children",
    body: [
      "Library of Things is an office and community tool. It is not directed at children, and we do not knowingly create library cards or guest passes for anyone under 16.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <article className="page-container max-w-2xl py-8 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Library of Things</p>
      <h1 className="mt-2 font-lot text-4xl text-foreground">Privacy notice</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {UPDATED}</p>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        This notice explains how personal data is handled in Library of Things. It is written so a guest,
        a member, or a data-protection officer can see what we collect and why. It is not a certificate
        of compliance. If something here is wrong, write to us and we will correct it.
      </p>

      {sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="border-b border-border pb-2 font-lot text-2xl text-foreground">{section.title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90 sm:text-base">
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10 rounded-2xl border border-border bg-muted/40 p-5">
        <h2 className="font-lot text-2xl text-foreground">Contact</h2>
        <p className="mt-3 text-sm leading-relaxed sm:text-base">
          Privacy requests for this library:{" "}
          <a className="font-medium underline underline-offset-2" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The Foresight Institute, 50 California Street, Suite 1500, San Francisco, 94111.{" "}
          <a className="underline underline-offset-2" href="https://foresight.org">
            foresight.org
          </a>
        </p>
        <p className="mt-4 text-sm">
          <Link href="/ledger" className="underline underline-offset-2">
            Sharing history
          </Link>
        </p>
      </section>
    </article>
  )
}
