import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface Session {
  id: string;
  transcript: string;
  insights: string;
  createdAt: number;
  updatedAt: number;
}

const SESSION_PREFIX = "session:";
const SESSION_LIST = "sessions";

export async function createSession(): Promise<Session> {
  const id = crypto.randomUUID();
  const session: Session = {
    id,
    transcript: "",
    insights: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await redis.set(`${SESSION_PREFIX}${id}`, JSON.stringify(session));
  await redis.lpush(SESSION_LIST, id);
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const data = await redis.get<string>(`${SESSION_PREFIX}${id}`);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<Session, "transcript" | "insights">>
): Promise<Session | null> {
  const session = await getSession(id);
  if (!session) return null;
  const updated = { ...session, ...updates, updatedAt: Date.now() };
  await redis.set(`${SESSION_PREFIX}${id}`, JSON.stringify(updated));
  return updated;
}

export async function listSessions(): Promise<Session[]> {
  const ids = await redis.lrange(SESSION_LIST, 0, 49);
  const sessions: Session[] = [];
  for (const id of ids) {
    const s = await getSession(id as string);
    if (s) sessions.push(s);
  }
  return sessions;
}
