import { geminiFlash } from "@/lib/gemini";
import { updateSession } from "@/lib/redis";

export async function POST(req: Request) {
  const { transcript, sessionId } = await req.json();

  if (!transcript || transcript.trim().length === 0) {
    return new Response("No transcript provided", { status: 400 });
  }

  const encoder = new TextEncoder();
  let fullInsights = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await geminiFlash.generateContentStream([
          {
            text: `You are an insightful assistant. Given the following transcript of a conversation or speech, provide:

1. **Key Points** — the most important ideas mentioned
2. **Summary** — a concise summary of what was discussed
3. **Action Items** — any tasks or next steps mentioned
4. **Open Questions** — any unresolved questions or topics worth exploring

Be concise and use bullet points. If the transcript is short, keep your output proportionally brief.

Transcript:
${transcript}`,
          },
        ]);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullInsights += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }

        // Persist insights to Redis
        if (sessionId && fullInsights) {
          await updateSession(sessionId, { insights: fullInsights });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
