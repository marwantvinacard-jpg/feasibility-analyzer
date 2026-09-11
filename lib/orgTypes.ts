// Multi-tenant "org" layer — additive on top of the existing per-user model.
// A user with no org still works exactly as before (analyses scoped by uid).
// Joining/creating an org adds a shared workspace on top: teammates see each
// other's analyses, one owner controls branding + API keys + billing seat.

export type OrgRole = "owner" | "analyst" | "viewer";
export type OrgStatus = "pending" | "approved" | "rejected";
export type OrgPlanKey = "starter" | "growth" | "enterprise";

export interface Organization {
  id: string;
  name: string;
  ownerUid: string;
  ownerEmail: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string; // hex, e.g. "#6366f1"
  };
  /** New orgs start pending — an admin (Marwan) must approve before the org
   *  can issue API keys or call the public API. Team creation/browsing the
   *  workspace UI is allowed while pending; using paid API access is not. */
  status: OrgStatus;
  /** Subscription tier, if any (see lib/pricing.ts ORG_PLANS). Undefined = no active plan. */
  plan?: OrgPlanKey;
  subscriptionStatus?: string; // mirrors Stripe subscription.status
  createdAt: number;
}

export interface OrgMember {
  uid: string;
  email: string;
  name: string;
  role: OrgRole;
  addedAt: number;
}

/** Metadata only — the raw key is shown once at creation and never stored. */
export interface ApiKeyDoc {
  id: string;
  label: string;
  keyPrefix: string; // first 12 chars, shown in the list for identification
  createdAt: number;
  createdBy: string; // email
  lastUsedAt?: number;
  revoked?: boolean;
}
