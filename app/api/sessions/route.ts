import { createSession, listSessions } from "@/lib/redis";

export async function POST() {
  const session = await createSession();
  return Response.json(session);
}

export async function GET() {
  const sessions = await listSessions();
  return Response.json(sessions);
}
