import { geminiFlash } from "@/lib/gemini";
import { updateSession } from "@/lib/redis";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: Request) {
  const { transcript, sessionId, previousInsights } = await req.json();

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

1. **Key Updates** — what's new or changed since the conversation started
2. **Key Points** — the most important ideas, facts, or decisions mentioned

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

        // Send only what's new to Telegram
        if (fullInsights && previousInsights) {
          // Ask Gemini for just the delta
          const deltaResult = await geminiFlash.generateContent([
            {
              text: `Compare these two insight updates and output ONLY what is new or changed in the latest version. Be very brief — just the new bullet points or changes, nothing else.

Previous insights:
${previousInsights}

Latest insights:
${fullInsights}`,
            },
          ]);
          const delta = deltaResult.response.text();
          if (delta.trim()) {
            await sendTelegramMessage(delta).catch(console.error);
          }
        } else if (fullInsights) {
          await sendTelegramMessage(fullInsights).catch(console.error);
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
