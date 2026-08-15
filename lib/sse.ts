"use client";

// Minimal SSE-over-POST reader for /api/analyze. EventSource can't POST a body,
// so we read the fetch stream and parse `event:`/`data:` frames ourselves.

export interface AnalyzeHandlers {
  onStart?: (data: { stages: string[] }) => void;
  onProgress?: (data: { stage: string; status: string }) => void;
  onDone?: (result: any) => void;
  onError?: (message: string) => void;
}

export async function streamAnalyze(input: unknown, handlers: AnalyzeHandlers): Promise<void> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok || !res.body) {
    handlers.onError?.(`Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === "start") handlers.onStart?.(parsed);
      else if (event === "progress") handlers.onProgress?.(parsed);
      else if (event === "done") handlers.onDone?.(parsed);
      else if (event === "error") handlers.onError?.(parsed.message ?? "Analysis failed");
    }
  }
}
