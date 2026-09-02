// Plain-English descriptions for each lead_tracker.Stage value shown on the
// Lead Tracker tab's Lost Reasons chart — business-provided (2026-09-02),
// shown as the sub-label under each reason so the raw Stage code isn't the
// only thing a reader sees. Display-only: doesn't change §2.4's Stage
// classification or the "Not Intersted" typo fold, which stays in the query.
export const LOST_REASON_DESCRIPTIONS: Record<string, string> = {
  Rental: "Asking for lease",
  "No response": "Details shared via WhatsApp and email, but no response after following up",
  "Low budget": "Budget below what's available",
  Rejected: "Rejected from our side, or by the guest's party/friends",
  "Not Located": "Mismatch in property requirement",
  "Non Availability": "Not available in the requested date range",
  "Not Interested": "Mismatch in requirement of rooms or location",
  Lost: "Lead lost, no specific reason recorded",
  cancel: "Plan changed, stay dates changed",
};
