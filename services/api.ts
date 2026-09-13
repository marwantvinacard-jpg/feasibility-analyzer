import { getIdToken } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  status: "pending" | "active" | "disabled";
  role: "user" | "admin";
  hasApiKey: boolean;
  generationCount: number;
}

export interface GenerationItem {
  id: string;
  prompt: string;
  mode: string;
  styleId: string;
  styleTitle: string;
  imageUrl: string;
  createdAt: string | null;
}

export interface AdminUser extends UserProfile {
  createdAt: string | null;
  lastLoginAt: string | null;
}

/** fetch() wrapper that attaches the Firebase ID token to every /api call. */
export async function authedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(input, { ...init, headers });
}

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

// --- Account ---------------------------------------------------------------

export async function bootstrapProfile(displayName?: string): Promise<UserProfile> {
  const res = await authedFetch("/api/user/bootstrap", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
  return jsonOrThrow(res);
}

export async function getApiKeyStatus(): Promise<boolean> {
  const res = await authedFetch("/api/user/api-key/status");
  const data = await jsonOrThrow(res);
  return !!data.hasApiKey;
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const res = await authedFetch("/api/user/api-key", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
  });
  await jsonOrThrow(res);
}

export async function deleteApiKey(): Promise<void> {
  const res = await authedFetch("/api/user/api-key", { method: "DELETE" });
  await jsonOrThrow(res);
}

// --- Magnific (magnific.com) enhancement key ------------------------------

export async function getMagnificKeyStatus(): Promise<boolean> {
  const res = await authedFetch("/api/user/magnific-key/status");
  const data = await jsonOrThrow(res);
  return !!data.hasMagnificKey;
}

export async function saveMagnificKey(apiKey: string): Promise<void> {
  const res = await authedFetch("/api/user/magnific-key", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
  });
  await jsonOrThrow(res);
}

export async function deleteMagnificKey(): Promise<void> {
  const res = await authedFetch("/api/user/magnific-key", { method: "DELETE" });
  await jsonOrThrow(res);
}

export interface EnhanceImageOptions {
  scaleFactor?: '2x' | '4x' | '8x' | '16x';
  creativity?: number;
  hdr?: number;
  resemblance?: number;
  fractality?: number;
  prompt?: string;
}

/** Sends an already-generated render through Magnific's creative upscaler. */
export async function enhanceImage(
  imageUrl: string,
  options: EnhanceImageOptions = {}
): Promise<{ imageUrl: string; genId: string }> {
  const res = await authedFetch("/api/enhance-image", {
    method: "POST",
    body: JSON.stringify({ imageUrl, ...options }),
  });
  return jsonOrThrow(res);
}

export async function listGenerations(): Promise<GenerationItem[]> {
  const res = await authedFetch("/api/user/generations");
  const data = await jsonOrThrow(res);
  return data.items || [];
}

// --- Admin -----------------------------------------------------------------

export interface AdminUsersResponse {
  users: AdminUser[];
  stats: { total: number; pending: number; active: number; disabled: number };
  totalGenerations: number;
}

export async function adminListUsers(): Promise<AdminUsersResponse> {
  const res = await authedFetch("/api/admin/users");
  return jsonOrThrow(res);
}

export async function adminSetStatus(
  uid: string,
  status: "active" | "pending" | "disabled"
): Promise<void> {
  const res = await authedFetch(`/api/admin/users/${uid}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
  await jsonOrThrow(res);
}

export async function adminSetRole(
  uid: string,
  role: "user" | "admin"
): Promise<void> {
  const res = await authedFetch(`/api/admin/users/${uid}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
  await jsonOrThrow(res);
}
