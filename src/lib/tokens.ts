import { createHmac } from "node:crypto";
const secret = process.env.AUTH_SECRET || "change-me-in-production-please-0123456789";
/** Unguessable, stable token for a referee's private calendar feed: "<id>-<hmac>". */
export function refereeToken(id: number) { return `${id}-${createHmac("sha256", secret).update(`ref:${id}`).digest("hex").slice(0, 16)}`; }
export function parseRefereeToken(token: string): number | null { const [id] = token.split("-"); const n = Number(id); return n && refereeToken(n) === token ? n : null; }
