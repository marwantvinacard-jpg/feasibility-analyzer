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
  /** True once this org has ever started a plan checkout — gates the one-time 14-day trial. */
  trialUsed?: boolean;
  createdAt: number;
}

export interface OrgMember {
  uid: string;
  email: string;
  name: string;
  role: OrgRole;
  addedAt: number;
}

/**
 * A pending invitation. Nobody joins an org without accepting one: joining
 * shares every analysis they run with the whole org, so it has to be their
 * choice, not the owner's. Stored at orgInvites/{inviteId(orgId, uid)},
 * server-only (read and written through /api/org/invites and /api/org/members).
 */
export interface OrgInvite {
  id: string;
  orgId: string;
  orgName: string;
  uid: string;
  email: string;
  name: string;
  role: Exclude<OrgRole, "owner">;
  invitedByEmail: string;
  createdAt: number;
}

/** One invite per (org, person) — re-inviting just updates it. */
export const inviteId = (orgId: string, uid: string) => `${orgId}__${uid}`;

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
