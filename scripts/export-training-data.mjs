// Exports every captured LLM prompt->completion pair as JSONL, in the
// standard {messages:[...]} fine-tuning shape (OpenAI/most SFT trainers
// accept this directly). Run once you have enough real analyses to be worth
// fine-tuning a small model on:
//   node scripts/export-training-data.mjs [output.jsonl]
import { writeFileSync, readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const outPath = process.argv[2] ?? "training-data.jsonl";

const snap = await db.collection("trainingData").where("mock", "==", false).get();
console.log(`Found ${snap.size} real (non-mock) prompt/completion pairs.`);

const lines = [];
for (const doc of snap.docs) {
  const d = doc.data();
  lines.push(
    JSON.stringify({
      messages: [
        { role: "system", content: d.system },
        { role: "user", content: d.user },
        { role: "assistant", content: JSON.stringify(d.output) },
      ],
      metadata: { schemaName: d.schemaName, model: d.model, analysisId: d.analysisId, at: d.at },
    })
  );
}

writeFileSync(outPath, lines.join("\n") + (lines.length ? "\n" : ""));
console.log(`Wrote ${lines.length} examples to ${outPath}`);
process.exit(0);
