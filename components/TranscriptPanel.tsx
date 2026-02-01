"use client";

import { useEffect, useRef } from "react";

interface Props {
  transcript: string;
}

export default function TranscriptPanel({ transcript }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2 text-gray-200">Transcript</h2>
      <div className="flex-1 overflow-y-auto bg-gray-800 rounded-lg p-4 text-sm text-gray-100 whitespace-pre-wrap">
        {transcript || (
          <span className="text-gray-500 italic">
            Transcript will appear here as you speak...
          </span>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
