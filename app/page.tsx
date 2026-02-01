"use client";

import { useState, useCallback, useRef } from "react";
import AudioCapture from "@/components/AudioCapture";
import TranscriptPanel from "@/components/TranscriptPanel";
import InsightsPanel from "@/components/InsightsPanel";

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [insights, setInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const lastSynthLength = useRef(0);
  const synthTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestSynthesis = useCallback(async (fullTranscript: string) => {
    if (fullTranscript.trim().length < 50) return;
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullTranscript }),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let newInsights = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const { text } = JSON.parse(line.slice(6));
              if (text) {
                newInsights += text;
                setInsights(newInsights);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("Synthesis error:", err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const onTranscriptChunk = useCallback(
    (text: string) => {
      setTranscript((prev) => {
        const updated = prev + text;

        // Trigger synthesis when 200+ new characters have been transcribed
        if (updated.length - lastSynthLength.current > 200) {
          lastSynthLength.current = updated.length;
          if (synthTimeout.current) clearTimeout(synthTimeout.current);
          synthTimeout.current = setTimeout(() => {
            requestSynthesis(updated);
          }, 1000);
        }

        return updated;
      });
    },
    [requestSynthesis]
  );

  return (
    <main className="h-screen flex">
      {/* Left panel: Audio controls */}
      <div className="w-48 flex-shrink-0 border-r border-gray-700 flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold mb-6">Audio Assistant</h1>
        <AudioCapture onTranscriptChunk={onTranscriptChunk} />
      </div>

      {/* Right side: Transcript + Insights stacked */}
      <div className="flex-1 flex flex-col p-4 gap-4 min-w-0">
        <div className="flex-1 min-h-0">
          <TranscriptPanel transcript={transcript} />
        </div>
        <div className="flex-1 min-h-0">
          <InsightsPanel insights={insights} loading={insightsLoading} />
        </div>
      </div>
    </main>
  );
}
