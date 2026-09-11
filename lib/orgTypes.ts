// Multi-tenant "org" layer — additive on top of the existing per-user model.
// A user with no org still works exactly as before (analyses scoped by uid).
// Joining/creating an org adds a shared workspace on top: teammates see each
// other's analyses, one owner controls branding + API keys + billing seat.

export type OrgRole = "owner" | "analyst" | "viewer";

export interface Organization {
  id: string;
  name: string;
  ownerUid: string;
  branding: {
    logoUrl?: string;
    primaryColor?: string; // hex, e.g. "#6366f1"
  };
  plan: "free" | "team";
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
