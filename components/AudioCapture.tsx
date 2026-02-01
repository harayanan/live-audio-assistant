"use client";

import { useRef, useState, useCallback } from "react";

interface Props {
  sessionId: string | null;
  onTranscriptChunk: (text: string) => void;
}

export default function AudioCapture({ sessionId, onTranscriptChunk }: Props) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendAudioChunk = useCallback(
    async (blob: Blob) => {
      const formData = new FormData();
      formData.append("audio", blob, "audio.webm");
      if (sessionId) formData.append("sessionId", sessionId);

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const { text } = JSON.parse(line.slice(6));
                if (text) onTranscriptChunk(text);
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error("Transcription error:", err);
      }
    },
    [sessionId, onTranscriptChunk]
  );

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = mr;

    let chunks: Blob[] = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mr.onstop = () => {
      if (chunks.length > 0) {
        sendAudioChunk(new Blob(chunks, { type: "audio/webm;codecs=opus" }));
        chunks = [];
      }
    };

    mr.start();
    setRecording(true);

    intervalRef.current = setInterval(() => {
      if (mr.state === "recording") {
        mr.stop();
        setTimeout(() => {
          if (mediaRecorderRef.current) {
            mr.start();
          }
        }, 50);
      }
    }, 5000);
  }, [sendAudioChunk]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={recording ? stop : start}
        className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl transition-colors ${
          recording
            ? "bg-red-500 hover:bg-red-600 animate-pulse"
            : "bg-blue-500 hover:bg-blue-600"
        }`}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        {recording ? "■" : "🎤"}
      </button>
      <p className="text-sm text-gray-400">
        {recording ? "Recording... click to stop" : "Click to start recording"}
      </p>
    </div>
  );
}
