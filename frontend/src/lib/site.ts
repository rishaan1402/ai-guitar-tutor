/** Public facts about the service, shown on the legal pages and in the app. */
export const SITE = {
  name: "Open Strings",
  /** Contact for privacy / account requests. Set NEXT_PUBLIC_SUPPORT_EMAIL before publishing. */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
  /** Date the privacy policy and terms last changed (shown on the pages). */
  legalUpdated: "15 November 2026",
  minimumAge: 13,
} as const;

/** "email us at x" when an address is configured, otherwise the store listing's contact. */
export function contactLine(): string {
  return SITE.supportEmail
    ? `email us at ${SITE.supportEmail}`
    : "use the developer contact email on our Google Play listing";
}
