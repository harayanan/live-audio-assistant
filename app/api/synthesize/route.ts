import { geminiFlash } from "@/lib/gemini";
import { updateSession } from "@/lib/redis";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: Request) {
  const { transcript, sessionId, previousTranscript } = await req.json();

  if (!transcript || transcript.trim().length === 0) {
    return new Response("No transcript provided", { status: 400 });
  }

  const encoder = new TextEncoder();
  let fullInsights = "";

  // Get only the new portion of the transcript for Telegram
  const newTranscript = previousTranscript
    ? transcript.slice(previousTranscript.length)
    : transcript;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Full insights for the UI panel
        const result = await geminiFlash.generateContentStream([
          {
            text: `You are an insightful assistant. Given the following transcript of a live conversation or speech, extract the key insights — the most important, interesting, or surprising points being discussed. Output concise bullet points only. No headers, no sections, no labels.

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

        // Telegram: generate a short ticker-style update from only the NEW transcript
        if (newTranscript.trim().length > 20) {
          const tickerResult = await geminiFlash.generateContent([
            {
              text: `You are a live insights ticker bot. Given this new segment of a live conversation, output 1-3 short, punchy insight bullet points capturing only what's noteworthy in this segment. No headers, no labels, no preamble. If nothing noteworthy, output nothing.

New segment:
${newTranscript}`,
            },
          ]);
          const ticker = tickerResult.response.text().trim();
          if (ticker) {
            await sendTelegramMessage(ticker).catch(console.error);
          }
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
