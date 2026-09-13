import "./loadEnv";
import express from "express";
import path from "path";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_ROLE, ARCHITECTURAL_CONSTRAINTS, EDIT_SYSTEM_ROLE, DESIGN_BRAINS } from "./constants";
import { db, bucket, admin } from "./services/firebaseAdmin";
import { encryptKey, decryptKey, type EncryptedRecord } from "./services/crypto";
import { ensureUserProfile } from "./services/userProfile";
import { verifyAuth, requireActive, requireAdmin } from "./middleware/auth";

// ---------------------------------------------------------------------------
// Per-user Gemini + persistence helpers
// ---------------------------------------------------------------------------

class ApiKeyMissingError extends Error {
  code = "no_api_key";
  constructor() {
    super("No Gemini API key on file. Add your key in Settings.");
  }
}

/** Loads + decrypts the user's stored key and returns a GoogleGenAI client. */
async function getGenAIForUser(uid: string): Promise<GoogleGenAI> {
  const snap = await db.doc(`users/${uid}/secret/apiKey`).get();
  if (!snap.exists) throw new ApiKeyMissingError();
  const record = snap.data() as EncryptedRecord;
  const apiKey = decryptKey(record);
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

class MagnificKeyMissingError extends Error {
  code = "no_magnific_key";
  constructor() {
    super("No Magnific API key on file. Add it in Settings to enable enhancement.");
  }
}

/** Loads + decrypts the user's stored Magnific (magnific.com) API key. */
async function getMagnificKeyForUser(uid: string): Promise<string> {
  const snap = await db.doc(`users/${uid}/secret/magnificApiKey`).get();
  if (!snap.exists) throw new MagnificKeyMissingError();
  const record = snap.data() as EncryptedRecord;
  return decryptKey(record);
}

/** Pulls the first inline image out of a Gemini response as raw base64. */
function extractImageBase64(response: any): string | null {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part?.inlineData?.data) return part.inlineData.data as string;
    }
  }
  return null;
}

/**
 * Uploads a generated image to Storage and records it in the user's gallery.
 * Returns a stable, token-authenticated download URL for immediate display.
 */
async function saveGeneration(
  uid: string,
  imageBase64: string,
  meta: { prompt: string; mode: string; styleId: string; styleTitle: string }
): Promise<{ genId: string; imageUrl: string; imagePath: string }> {
  const genId = db.collection("users").doc(uid).collection("generations").doc().id;
  const imagePath = `users/${uid}/generations/${genId}.png`;
  const token = randomUUID();
  const buffer = Buffer.from(imageBase64, "base64");

  await bucket.file(imagePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: "image/png",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    imagePath
  )}?alt=media&token=${token}`;

  await db
    .doc(`users/${uid}/generations/${genId}`)
    .set({
      prompt: meta.prompt || "",
      mode: meta.mode || "",
      styleId: meta.styleId || "",
      styleTitle: meta.styleTitle || "",
      imagePath,
      imageUrl,
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  await db
    .doc(`users/${uid}`)
    .update({ generationCount: admin.firestore.FieldValue.increment(1) })
    .catch(() => {});

  return { genId, imageUrl, imagePath };
}

/**
 * Translates errors into clean, non-leaky HTTP responses. The full error is
 * logged server-side; the client only ever sees a safe, actionable message.
 */
function handleGenError(res: express.Response, error: any, fallbackMsg: string) {
  if (error instanceof ApiKeyMissingError) {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  console.error(fallbackMsg, error);
  const msg = String(error?.message || "");
  // Surface a helpful (but non-sensitive) message when the user's own key is bad.
  if (
    /API key not valid|API_KEY_INVALID|api key expired|permission[_ ]denied|invalid.*api key|quota|RESOURCE_EXHAUSTED/i.test(
      msg
    )
  ) {
    return res.status(400).json({
      error:
        "Your Gemini API key was rejected or lacks access to the required models (or hit a quota). Check it in Settings.",
      code: "invalid_key",
    });
  }
  // Everything else: generic message, no internal details leaked.
  return res
    .status(500)
    .json({ error: "Generation failed. Please try again.", code: "gen_failed" });
}

// Firebase Auth UIDs are safe path segments; reject anything else to avoid
// document-path traversal when interpolated into db.doc(`users/${uid}`).
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Use increased limit for base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Trust Cloud Run's proxy so req.ip reflects the real client, not the LB hop.
  app.set("trust proxy", 1);

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  // Baseline abuse guard on every /api/ call, keyed by IP.
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down and try again shortly." },
  });
  app.use("/api", apiLimiter);

  // Tighter guard on the expensive Gemini-backed generation endpoints, keyed
  // by the authenticated uid (falls back to IP pre-auth) so one account can't
  // hammer its own key — or someone else's session token — into a runaway bill.
  const generationLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.uid || req.ip || "anonymous",
    message: {
      error: "Generation rate limit reached. Please wait a minute before trying again.",
    },
  });

  // -------------------------------------------------------------------------
  // Account endpoints
  // -------------------------------------------------------------------------

  // Idempotent profile bootstrap + returns the caller's profile (safe fields).
  app.post("/api/user/bootstrap", verifyAuth, async (req, res) => {
    try {
      const profile = await ensureUserProfile({
        uid: req.uid!,
        email: req.userEmail || "",
        displayName: req.body?.displayName,
      });
      const { uid, email, displayName, status, role, hasApiKey, generationCount } =
        profile;
      return res.json({
        uid,
        email,
        displayName,
        status,
        role,
        hasApiKey,
        generationCount,
      });
    } catch (error: any) {
      console.error("bootstrap error:", error);
      return res.status(500).json({ error: "Failed to load profile." });
    }
  });

  // Save (encrypt) the user's own Gemini API key.
  app.post("/api/user/api-key", verifyAuth, async (req, res) => {
    try {
      const apiKey = (req.body?.apiKey || "").trim();
      if (!apiKey || apiKey.length < 10) {
        return res.status(400).json({ error: "Please provide a valid API key." });
      }
      const record = encryptKey(apiKey);
      await db.doc(`users/${req.uid}/secret/apiKey`).set(record);
      await db.doc(`users/${req.uid}`).update({ hasApiKey: true });
      return res.json({ hasApiKey: true });
    } catch (error: any) {
      console.error("save api-key error:", error);
      return res.status(500).json({ error: "Failed to save API key." });
    }
  });

  app.get("/api/user/api-key/status", verifyAuth, async (req, res) => {
    try {
      const snap = await db.doc(`users/${req.uid}/secret/apiKey`).get();
      return res.json({ hasApiKey: snap.exists });
    } catch {
      return res.json({ hasApiKey: false });
    }
  });

  app.delete("/api/user/api-key", verifyAuth, async (req, res) => {
    try {
      await db.doc(`users/${req.uid}/secret/apiKey`).delete();
      await db.doc(`users/${req.uid}`).update({ hasApiKey: false });
      return res.json({ hasApiKey: false });
    } catch (error: any) {
      console.error("delete api-key error:", error);
      return res.status(500).json({ error: "Failed to remove API key." });
    }
  });

  // Save (encrypt) the user's own Magnific (magnific.com) API key, used to
  // upscale/enhance a generated render. Mirrors the Gemini key handling
  // above: encrypted at rest, decrypted only server-side, never returned.
  app.post("/api/user/magnific-key", verifyAuth, async (req, res) => {
    try {
      const apiKey = (req.body?.apiKey || "").trim();
      if (!apiKey || apiKey.length < 10) {
        return res.status(400).json({ error: "Please provide a valid API key." });
      }
      const record = encryptKey(apiKey);
      await db.doc(`users/${req.uid}/secret/magnificApiKey`).set(record);
      return res.json({ hasMagnificKey: true });
    } catch (error: any) {
      console.error("save magnific-key error:", error);
      return res.status(500).json({ error: "Failed to save Magnific API key." });
    }
  });

  app.get("/api/user/magnific-key/status", verifyAuth, async (req, res) => {
    try {
      const snap = await db.doc(`users/${req.uid}/secret/magnificApiKey`).get();
      return res.json({ hasMagnificKey: snap.exists });
    } catch {
      return res.json({ hasMagnificKey: false });
    }
  });

  app.delete("/api/user/magnific-key", verifyAuth, async (req, res) => {
    try {
      await db.doc(`users/${req.uid}/secret/magnificApiKey`).delete();
      return res.json({ hasMagnificKey: false });
    } catch (error: any) {
      console.error("delete magnific-key error:", error);
      return res.status(500).json({ error: "Failed to remove Magnific API key." });
    }
  });

  // The signed-in user's saved gallery.
  app.get("/api/user/generations", verifyAuth, async (req, res) => {
    try {
      const snap = await db
        .collection(`users/${req.uid}/generations`)
        .orderBy("createdAt", "desc")
        .limit(300)
        .get();
      const items = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          prompt: data.prompt || "",
          mode: data.mode || "",
          styleId: data.styleId || "",
          styleTitle: data.styleTitle || "",
          imageUrl: data.imageUrl || "",
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        };
      });
      return res.json({ items });
    } catch (error: any) {
      console.error("list generations error:", error);
      return res.status(500).json({ error: "Failed to load gallery." });
    }
  });

  // -------------------------------------------------------------------------
  // Admin endpoints
  // -------------------------------------------------------------------------

  app.get("/api/admin/users", verifyAuth, requireAdmin, async (_req, res) => {
    try {
      const snap = await db.collection("users").orderBy("createdAt", "desc").get();
      const users = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          uid: d.id,
          email: data.email || "",
          displayName: data.displayName || "",
          status: data.status || "pending",
          role: data.role || "user",
          hasApiKey: !!data.hasApiKey,
          generationCount: data.generationCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString?.() || null,
        };
      });
      const stats = {
        total: users.length,
        pending: users.filter((u) => u.status === "pending").length,
        active: users.filter((u) => u.status === "active").length,
        disabled: users.filter((u) => u.status === "disabled").length,
      };
      const totalGenerations = users.reduce((n, u) => n + (u.generationCount || 0), 0);
      return res.json({ users, stats, totalGenerations });
    } catch (error: any) {
      console.error("admin list users error:", error);
      return res.status(500).json({ error: "Failed to load users." });
    }
  });

  app.post(
    "/api/admin/users/:uid/status",
    verifyAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const uid = String(req.params.uid);
        if (!UID_RE.test(uid)) {
          return res.status(400).json({ error: "Invalid user id." });
        }
        const status = req.body?.status;
        if (!["active", "pending", "disabled"].includes(status)) {
          return res.status(400).json({ error: "Invalid status." });
        }
        const targetSnap = await db.doc(`users/${uid}`).get();
        if (!targetSnap.exists)
          return res.status(404).json({ error: "User not found." });
        const target = targetSnap.data() as any;
        if (target.role === "admin" && status !== "active") {
          return res
            .status(400)
            .json({ error: "Demote the admin before changing their status." });
        }
        await db.doc(`users/${uid}`).update({ status });
        return res.json({ ok: true, status });
      } catch (error: any) {
        console.error("admin set status error:", error);
        return res.status(500).json({ error: "Failed to update status." });
      }
    }
  );

  app.post(
    "/api/admin/users/:uid/role",
    verifyAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const uid = String(req.params.uid);
        if (!UID_RE.test(uid)) {
          return res.status(400).json({ error: "Invalid user id." });
        }
        const role = req.body?.role;
        if (!["user", "admin"].includes(role)) {
          return res.status(400).json({ error: "Invalid role." });
        }
        const targetSnap = await db.doc(`users/${uid}`).get();
        if (!targetSnap.exists)
          return res.status(404).json({ error: "User not found." });
        const target = targetSnap.data() as any;

        // Demotion guards: never lock the studio out of all admins.
        if (role === "user" && target.role === "admin") {
          if (uid === req.uid) {
            return res
              .status(400)
              .json({ error: "You can't remove your own admin access." });
          }
          const admins = await db
            .collection("users")
            .where("role", "==", "admin")
            .where("status", "==", "active")
            .get();
          if (admins.size <= 1) {
            return res
              .status(400)
              .json({ error: "Can't remove the last remaining admin." });
          }
        }

        const update: Record<string, unknown> = { role };
        // Promoting to admin implies granting access.
        if (role === "admin") update.status = "active";
        await db.doc(`users/${uid}`).update(update);
        return res.json({ ok: true, role });
      } catch (error: any) {
        console.error("admin set role error:", error);
        return res.status(500).json({ error: "Failed to update role." });
      }
    }
  );

  // -------------------------------------------------------------------------
  // AI Workspace Analysis Route (enterprise UI — gated, dormant)
  // -------------------------------------------------------------------------
  app.post("/api/analyze-workspace", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const {
        views = [],
        references = [],
        architecturalDocs = [],
        measurements = {},
        structuredPrompt = {},
        preservationControls = {},
        generationMode = 'professional_design'
      } = req.body;

      const promptText = `
${SYSTEM_ROLE}

TASK: Perform an architectural & interior design readiness assessment of this workspace upload.

PROJECT DETAILS:
- Goal: ${structuredPrompt.projectGoal || 'Interior Redesign'}
- Style: ${structuredPrompt.interiorStyle || 'Luxury Modern'}
- Materials: ${structuredPrompt.materials || 'Not specified'}
- Lighting: ${structuredPrompt.lighting || 'Not specified'}
- Generation Mode: ${generationMode}
- Room Dimensions: ${measurements.length || 'N/A'} x ${measurements.width || 'N/A'} ${measurements.unit || 'm'} (Height: ${measurements.height || 'N/A'})

UPLOADED CONTENT:
- View Images Count: ${views.length}
- Reference Images Count: ${references.length}
- Architectural Docs/Plans Count: ${architecturalDocs.length}

Analyze the provided room view image(s) and return ONLY a raw JSON object (no markdown formatting, no text preambles) matching this exact JSON schema:
{
  "confidenceScore": 88,
  "detectedRoomType": "Hotel Corridor / Suite",
  "spatialGeometry": "Rectilinear corridor with 3.2m ceiling and structural columns",
  "lightingConditions": "Natural side light combined with warm cove ambient",
  "primaryMaterials": ["Travertine Stone", "Dark Walnut Wood", "Fluted Wall Cladding"],
  "keyArchitecturalFeatures": ["Recessed Door Portals", "Custom Ceiling Cove", "Glass Windows"],
  "viewCoverageStatus": "Good front view coverage",
  "designRecommendations": [
    "Align travertine vein direction with long axis of space",
    "Keep 2700K warm lighting temperature uniform across views"
  ],
  "readinessChecklist": [
    { "item": "Primary Camera Angle Captured", "status": "pass" },
    { "item": "Material Palette Specified", "status": "pass" },
    { "item": "Architectural Preservation Set", "status": "pass" }
  ]
}
`;

      const parts: any[] = [];
      // Attach target view images if present
      views.forEach((v: any) => {
        if (v?.fileData?.base64) {
          parts.push({
            inlineData: {
              data: v.fileData.base64,
              mimeType: v.fileData.type || 'image/png'
            }
          });
        }
      });

      // Attach reference images
      references.slice(0, 2).forEach((r: any) => {
        if (r?.fileData?.base64) {
          parts.push({
            inlineData: {
              data: r.fileData.base64,
              mimeType: r.fileData.type || 'image/png'
            }
          });
        }
      });

      parts.push({ text: promptText });

      const ai = await getGenAIForUser(req.uid!);
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: { parts }
      });

      let jsonText = response.text || "";
      jsonText = jsonText.replace(/```json/gi, "").replace(/```/g, "").trim();

      const parsed = JSON.parse(jsonText);
      return res.json(parsed);
    } catch (error: any) {
      if (error instanceof ApiKeyMissingError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      console.warn("Error in analyze-workspace, returning intelligent default response:", error?.message);
      const { views = [], references = [], structuredPrompt = {} } = req.body || {};
      const hasFront = Array.isArray(views) && views.some((v: any) => v.category === 'Front View');
      return res.json({
        confidenceScore: hasFront ? 92 : 78,
        detectedRoomType: structuredPrompt.projectGoal || "Hospitality Luxury Suite",
        spatialGeometry: "Multi-angle spatial perspective with defined wall, floor, and ceiling bounds",
        lightingConditions: structuredPrompt.lighting || "Warm 2700K indirect cove LED & accent lighting",
        primaryMaterials: structuredPrompt.materials
          ? structuredPrompt.materials.split(',').map((m: string) => m.trim())
          : ["Travertine Stone", "Fluted Walnut", "Champagne Brass"],
        keyArchitecturalFeatures: ["Window Portals", "Structural Ceiling Height", "Door Frame Entrances"],
        viewCoverageStatus: `${views.length || 1} view(s) uploaded (${hasFront ? 'Front View present' : 'Primary view set'})`,
        designRecommendations: [
          "Maintain material texture continuity across all camera view angles",
          "Ensure light temperature remains balanced at 2700K throughout the room",
          "Keep structural door frames and columns preserved"
        ],
        readinessChecklist: [
          { item: "Primary View Uploaded", status: hasFront ? "pass" : "warning" },
          { item: "Structured Style Defined", status: "pass" },
          { item: "Preservation Rules Configured", status: "pass" }
        ]
      });
    }
  });

  // -------------------------------------------------------------------------
  // Enterprise Multi-View AI Design Generation Endpoint (gated, dormant)
  // -------------------------------------------------------------------------
  app.post("/api/generate-studio-design", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const {
        views = [],
        references = [],
        architecturalDocs = [],
        measurements = {},
        structuredPrompt = {},
        preservationControls = {},
        generationMode = 'professional_design',
        targetViewId,
        designBrainId
      } = req.body;

      const designBrain =
        DESIGN_BRAINS.find((b) => b.id === designBrainId) || DESIGN_BRAINS[0];

      // Find primary target view
      let targetView = views.find((v: any) => v.id === targetViewId);
      if (!targetView && views.length > 0) {
        targetView = views.find((v: any) => v.category === 'Front View') || views[0];
      }

      const viewTitle = targetView ? targetView.title : "Primary View";

      // Build preservation rules text
      const preservedKeys = Object.entries(preservationControls)
        .filter(([_, val]) => Boolean(val))
        .map(([key, _]) => key.toUpperCase());

      const replacedKeys = Object.entries(preservationControls)
        .filter(([_, val]) => !Boolean(val))
        .map(([key, _]) => key.toUpperCase());

      const modeInstruction = {
        quick_edit: "Execute targeted edit instructions while retaining overall room context.",
        professional_design: "Produce a balanced, high-end architectural studio interior render.",
        luxury_upgrade: "Elevate room to 5-star luxury hospitality standard with warm 2700K cove lighting, brass trims, and travertine.",
        materials_only: "STRICTLY swap material finishes (walls, floor, ceiling cladding) without changing furniture shapes or spatial positions.",
        furniture_only: "STRICTLY replace furniture pieces and FF&E items while keeping architectural shell, walls, and flooring intact.",
        lighting_only: "STRICTLY recalculate architectural lighting fixture placement, warmth, shadows, and mood.",
        hotel_branding: "Apply luxury hotel brand aesthetic, signature colors, artwork, and brand identity elements.",
        complete_redesign: "Execute a full structural and aesthetic interior redesign based on the structured prompt.",
        ultra_photorealistic: "Render ultra-photorealistic 2K image with physically based materials, depth, ray-traced shadows, and fine textures."
      }[generationMode as keyof typeof modeInstruction] || "Produce a professional photorealistic interior design render.";

      const masterPrompt = `
${SYSTEM_ROLE}

GENERATION MODE: ${generationMode.toUpperCase()}
Instruction: ${modeInstruction}

DESIGN BRAIN — EXPERT LENS FOR THIS PROJECT (${designBrain.title.toUpperCase()}):
${designBrain.expertise}

PROJECT SPECIFICATIONS:
- Project Goal: ${structuredPrompt.projectGoal || 'Luxury Interior Redesign'}
- Interior Style Direction: ${structuredPrompt.interiorStyle || 'Modern Luxury'}
- Materials Palette: ${structuredPrompt.materials || 'High-end stone, polished wood, custom textiles'}
- Color Palette: ${structuredPrompt.colors || 'Warm neutral tones, champagne gold accents'}
- Lighting Scheme: ${structuredPrompt.lighting || 'Warm 2700K indirect cove LED, accent spotlights'}
- Furniture Style: ${structuredPrompt.furnitureStyle || 'Custom modern luxury hospitality furniture'}
- Decorative Style: ${structuredPrompt.decorativeStyle || 'Sculptural artwork, ceramic details'}
- Ambiance / Mood: ${structuredPrompt.mood || 'Serene, opulent, welcoming'}
- Brand Guidelines: ${structuredPrompt.brandGuidelines || '5-star hospitality luxury standard'}
- Additional Instructions: ${structuredPrompt.additionalInstructions || 'Ensure photorealistic quality'}

CRITICAL PRESERVATION RULES:
- STRICTLY PRESERVE (DO NOT MOVE OR MODIFY): ${preservedKeys.length > 0 ? preservedKeys.join(', ') : 'Structural Shell'}
- REIMAGINE / REPLACE FINISHES: ${replacedKeys.length > 0 ? replacedKeys.join(', ') : 'Wall finishes, furniture, textiles'}
- Elements to explicitly preserve: ${structuredPrompt.elementsToPreserveText || 'Main window and door geometry'}
- Elements to explicitly replace: ${structuredPrompt.elementsToReplaceText || 'Worn finishes and carpet'}
- Architectural Constraints: ${structuredPrompt.architecturalConstraints || 'Do not move structural columns'}

SPATIAL & MEASUREMENT CONTEXT:
Dimensions: ${measurements.length || 'Standard'} x ${measurements.width || 'Standard'} ${measurements.unit || 'm'} (Ceiling Height: ${measurements.height || 'Standard'}).
Special Notes: ${measurements.specialFeatures || 'Maintain camera angle'}

VIEW-SPECIFIC INSTRUCTION FOR THIS RENDER (${viewTitle}):
"${targetView?.customPrompt || structuredPrompt.additionalInstructions || 'Redesign this view according to master style rules'}"

OUTPUT REQUIREMENT (CRITICAL):
- Generate EXACTLY 1 photorealistic image corresponding to the target view's camera perspective.
- Maintain seamless architectural, material, and lighting consistency with the original room structure.
- No text overlays, logos, or watermarks.
`;

      const parts: any[] = [];

      // Add Target View image as first image input
      if (targetView?.fileData?.base64) {
        parts.push({
          inlineData: {
            data: targetView.fileData.base64,
            mimeType: targetView.fileData.type || 'image/png'
          }
        });
      }

      // Add additional secondary view images if present
      views.forEach((v: any) => {
        if (v.id !== targetView?.id && v?.fileData?.base64) {
          parts.push({
            inlineData: {
              data: v.fileData.base64,
              mimeType: v.fileData.type || 'image/png'
            }
          });
        }
      });

      // Add reference library images
      references.slice(0, 3).forEach((r: any) => {
        if (r?.fileData?.base64) {
          parts.push({
            inlineData: {
              data: r.fileData.base64,
              mimeType: r.fileData.type || 'image/png'
            }
          });
        }
      });

      // Add architectural docs if present
      architecturalDocs.slice(0, 2).forEach((d: any) => {
        if (d?.fileData?.base64) {
          parts.push({
            inlineData: {
              data: d.fileData.base64,
              mimeType: d.fileData.type || 'image/png'
            }
          });
        }
      });

      parts.push({ text: masterPrompt });

      // Determine model: gemini-3-pro-image-preview for high fidelity
      const modelName = generationMode === 'quick_edit' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';

      const ai = await getGenAIForUser(req.uid!);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          imageConfig: {
            imageSize: "2K",
            aspectRatio: "16:9"
          }
        }
      });

      const imgB64 = extractImageBase64(response);
      if (imgB64) {
        const saved = await saveGeneration(req.uid!, imgB64, {
          prompt: structuredPrompt.additionalInstructions || viewTitle,
          mode: generationMode,
          styleId: generationMode,
          styleTitle: viewTitle,
        });
        return res.json({
          imageUrl: saved.imageUrl,
          genId: saved.genId,
          promptUsed: masterPrompt,
          viewTitle
        });
      }

      throw new Error("No image data returned from AI model.");
    } catch (error: any) {
      return handleGenError(res, error, "Failed to generate studio design.");
    }
  });

  // -------------------------------------------------------------------------
  // Live UI: Style-based Route (Transform Corridor with Reference)
  // -------------------------------------------------------------------------
  app.post("/api/generate-style", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const { style, targetImage, brandImages, userPrompt } = req.body;
      if (!targetImage || !targetImage.base64) {
        return res.status(400).json({ error: "Target image base64 data is required." });
      }

      const styleDescription = style.description.join('\n- ');
      const promptText = `
${SYSTEM_ROLE}

INPUT CONTEXT:
1. The FIRST image provided is the TARGET CORRIDOR structure.
2. The SUBSEQUENT images are BRAND REFERENCE style guides.

${ARCHITECTURAL_CONSTRAINTS}

STEP 3 — DESIGN TASK
Redesign the target corridor using the brand identity found in the reference images.

APPLY THIS SPECIFIC STYLE DIRECTION:
**${style.title.toUpperCase()}**
- ${styleDescription}

USER EDIT PROMPT (Apply intelligently):
"${userPrompt}"

STEP 6 — OUTPUT REQUIREMENTS (CRITICAL)
- Output EXACTLY 1 photorealistic image
- Keep the SAME camera angle as the original corridor
- No text, labels, or watermarks inside images
- Ultra-realistic lighting, materials, and shadows
- Hotel brochure / investor presentation quality
      `;

      const parts: any[] = [];

      // Target Image
      parts.push({
        inlineData: {
          data: targetImage.base64,
          mimeType: targetImage.file?.type || 'image/png'
        }
      });

      // Brand Images
      if (Array.isArray(brandImages)) {
        brandImages.forEach((img: any) => {
          if (img && img.base64) {
            parts.push({
              inlineData: {
                data: img.base64,
                mimeType: img.file?.type || 'image/png'
              }
            });
          }
        });
      }

      // Prompt Text
      parts.push({ text: promptText });

      const ai = await getGenAIForUser(req.uid!);
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            imageSize: "2K",
            aspectRatio: "16:9"
          }
        }
      });

      const imgB64 = extractImageBase64(response);
      if (imgB64) {
        const saved = await saveGeneration(req.uid!, imgB64, {
          prompt: userPrompt || "",
          mode: "remodel",
          styleId: style.id,
          styleTitle: style.title,
        });
        return res.json({ imageUrl: saved.imageUrl, genId: saved.genId });
      }

      throw new Error("No image generated in response.");
    } catch (error: any) {
      return handleGenError(res, error, "Failed to generate design.");
    }
  });

  // -------------------------------------------------------------------------
  // Live UI: Prompt-only Route (Generate from scratch)
  // -------------------------------------------------------------------------
  app.post("/api/generate-from-prompt", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const { style, userPrompt } = req.body;

      const styleDescription = style.description.join('\n- ');
      const promptText = `
${SYSTEM_ROLE}

STEP 3 — DESIGN TASK
Generate a brand-new, photorealistic luxury hotel corridor entirely from scratch. There is NO reference image.
All architectural structures, furniture, materials, and lighting should be generated based on your expert design taste and the user's prompt.

APPLY THIS SPECIFIC STYLE DIRECTION:
**${style.title.toUpperCase()}**
- ${styleDescription}

USER EDIT PROMPT (Apply intelligently to shape the entire room):
"${userPrompt}"

STEP 6 — OUTPUT REQUIREMENTS (CRITICAL)
- Output EXACTLY 1 photorealistic image of a hotel corridor
- No text, labels, or watermarks inside images
- Ultra-realistic lighting, materials, and shadows
- Hotel brochure / investor presentation quality
      `;

      const ai = await getGenAIForUser(req.uid!);
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: promptText }]
        },
        config: {
          imageConfig: {
            imageSize: "2K",
            aspectRatio: "16:9"
          }
        }
      });

      const imgB64 = extractImageBase64(response);
      if (imgB64) {
        const saved = await saveGeneration(req.uid!, imgB64, {
          prompt: userPrompt || "",
          mode: "prompt_only",
          styleId: style.id,
          styleTitle: style.title,
        });
        return res.json({ imageUrl: saved.imageUrl, genId: saved.genId });
      }

      throw new Error("No image generated in response.");
    } catch (error: any) {
      return handleGenError(res, error, "Failed to generate design.");
    }
  });

  // -------------------------------------------------------------------------
  // Live UI: Quick Edit Route
  // -------------------------------------------------------------------------
  app.post("/api/edit-design", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const { base64Image, prompt } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: "Image data is required for edit." });
      }

      const parts = [
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/png'
          }
        },
        {
          text: prompt
        }
      ];

      const ai = await getGenAIForUser(req.uid!);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          systemInstruction: EDIT_SYSTEM_ROLE
        }
      });

      const imgB64 = extractImageBase64(response);
      if (imgB64) {
        const saved = await saveGeneration(req.uid!, imgB64, {
          prompt: prompt || "",
          mode: "quick_edit",
          styleId: "quick_edit",
          styleTitle: "Quick Edit",
        });
        return res.json({ imageUrl: saved.imageUrl, genId: saved.genId });
      }

      throw new Error("No image generated in response.");
    } catch (error: any) {
      return handleGenError(res, error, "Failed to edit design.");
    }
  });

  // -------------------------------------------------------------------------
  // Live UI: Voice transcription Route
  // -------------------------------------------------------------------------
  app.post("/api/transcribe", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const { base64Audio, mimeType, language } = req.body;
      if (!base64Audio) {
        return res.status(400).json({ error: "Audio data is required for transcription." });
      }

      const prompt = `Transcribe the spoken words in this audio exactly.
The spoken language in the audio is ${language}.
Do not translate the audio to another language. Output ONLY the transcription in its spoken language.
If the language is Arabic, output in Arabic script.
If the language is French, output in French script with correct accents.
If the language is English, output in English script.
Do not add any preamble, explanation, notes, or metadata. Output ONLY the transcription itself.`;

      const ai = await getGenAIForUser(req.uid!);
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType || 'audio/webm'
            }
          },
          {
            text: prompt
          }
        ]
      });

      return res.json({ transcription: response.text?.trim() || "" });
    } catch (error: any) {
      return handleGenError(res, error, "Failed to transcribe audio.");
    }
  });

  // -------------------------------------------------------------------------
  // Magnific enhancement — creative AI upscaling of an already-generated
  // render, using the user's own Magnific API key (magnific.com, formerly
  // Freepik/Magnific AI). Mirrors the per-user-key pattern used for Gemini:
  // the key is encrypted at rest and only ever used server-side.
  //
  // NOTE: Magnific's public API reference has shown slightly inconsistent
  // path examples (`/v1/ai/image-upscaler` vs `/v1/ai/upscaler`). Both the
  // create and poll paths are read from MAGNIFIC_API_BASE so this can be
  // corrected in one place — without a code change — if your account's
  // dashboard shows a different path than the default below.
  // -------------------------------------------------------------------------
  const MAGNIFIC_API_BASE =
    process.env.MAGNIFIC_API_BASE || "https://api.magnific.com/v1/ai/image-upscaler";

  app.post("/api/enhance-image", verifyAuth, generationLimiter, requireActive, async (req, res) => {
    try {
      const {
        imageBase64,
        imageUrl,
        scaleFactor = "2x",
        creativity = 0,
        hdr = 0,
        resemblance = 0,
        fractality = 0,
        prompt,
      } = req.body || {};

      let base64 = imageBase64 as string | undefined;
      if (!base64) {
        if (!imageUrl) {
          return res.status(400).json({ error: "imageBase64 or imageUrl is required." });
        }
        const sourceRes = await fetch(imageUrl);
        if (!sourceRes.ok) {
          return res.status(400).json({ error: `Could not fetch source image (${sourceRes.status}).` });
        }
        base64 = Buffer.from(await sourceRes.arrayBuffer()).toString("base64");
      }

      const magnificKey = await getMagnificKeyForUser(req.uid!);
      const clamp = (n: unknown) => Math.max(-10, Math.min(10, Number(n) || 0));

      const createRes = await fetch(MAGNIFIC_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-magnific-api-key": magnificKey,
        },
        body: JSON.stringify({
          image: base64,
          scale_factor: scaleFactor,
          creativity: clamp(creativity),
          hdr: clamp(hdr),
          resemblance: clamp(resemblance),
          fractality: clamp(fractality),
          ...(prompt ? { prompt } : {}),
        }),
      });

      if (createRes.status === 401 || createRes.status === 403) {
        return res.status(400).json({
          error: "Magnific rejected your API key. Check it in Settings.",
          code: "invalid_magnific_key",
        });
      }
      if (!createRes.ok) {
        const body = await createRes.text().catch(() => "");
        throw new Error(`Magnific API error (${createRes.status}): ${body.slice(0, 300)}`);
      }

      const createJson: any = await createRes.json();
      const taskId = createJson?.data?.task_id;
      if (!taskId) throw new Error("Magnific did not return a task_id.");

      // Poll for completion — creative upscales can take a while. Bounded to
      // ~2 minutes so a stuck job can't hold the request (and the rate
      // limiter slot) open indefinitely.
      let resultUrl: string | null = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const pollRes = await fetch(`${MAGNIFIC_API_BASE}/${taskId}`, {
          headers: { "x-magnific-api-key": magnificKey },
        });
        if (!pollRes.ok) continue;
        const pollJson: any = await pollRes.json();
        const status = pollJson?.data?.status;
        if (status === "COMPLETED") {
          resultUrl = pollJson?.data?.generated?.[0] || null;
          break;
        }
        if (status === "FAILED") {
          throw new Error("Magnific failed to enhance this image.");
        }
      }

      if (!resultUrl) {
        return res.status(504).json({
          error: "Enhancement is taking longer than expected. Please try again shortly.",
          code: "enhance_timeout",
          taskId,
        });
      }

      // Store the enhanced result in the user's own gallery, same as any
      // other generation, so it shows up in History / the Gallery page.
      const enhancedRes = await fetch(resultUrl);
      const enhancedBuf = Buffer.from(await enhancedRes.arrayBuffer());
      const saved = await saveGeneration(req.uid!, enhancedBuf.toString("base64"), {
        prompt: prompt || "",
        mode: "enhanced",
        styleId: "magnific-enhance",
        styleTitle: "Magnific Enhanced",
      });

      return res.json({ imageUrl: saved.imageUrl, genId: saved.genId, taskId });
    } catch (error: any) {
      if (error instanceof MagnificKeyMissingError) {
        return res.status(400).json({ error: error.message, code: error.code });
      }
      console.error("Failed to enhance image.", error);
      return res.status(500).json({ error: "Failed to enhance image. Please try again.", code: "enhance_failed" });
    }
  });

  // Health check for Cloud Run
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // -------------------------------------------------------------------------
  // Static / dev serving
  // -------------------------------------------------------------------------
  const apiOnly = process.env.API_ONLY === "true";

  if (process.env.NODE_ENV !== "production") {
    // Local dev: Vite middleware serves the SPA.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!apiOnly) {
    // Optional: serve built SPA from the same process (not used when Firebase
    // Hosting serves static assets and rewrites /api to Cloud Run).
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
