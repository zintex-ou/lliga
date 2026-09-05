import webpush from "web-push";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { teamKey } from "@/lib/stats";

/** VAPID keys: from env, or generated once and stored in settings so the install stays portable. */
function vapid() {
  let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const rows = db.select().from(schema.settings).all();
    pub = rows.find((r) => r.key === "vapid_public")?.value; priv = rows.find((r) => r.key === "vapid_private")?.value;
    if (!pub || !priv) {
      const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey;
      db.insert(schema.settings).values([{ key: "vapid_public", value: pub }, { key: "vapid_private", value: priv }]).onConflictDoNothing().run();
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@lliga.local", pub, priv);
  return { pub, priv };
}
export function vapidPublicKey() { return vapid().pub; }

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

async function sendTo(subs: (typeof schema.pushSubscriptions.$inferSelect)[], payload: PushPayload) {
  vapid();
  const data = JSON.stringify({ ...payload, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" });
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data, { TTL: 60 * 60 * 12 }); }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id)).run(); }
  }));
  return subs.length;
}

/** Everyone following either team or the group (or everything). */
export async function notifyMatch(teamNames: string[], groupName: string, payload: PushPayload) {
  const keys = teamNames.map(teamKey);
  const subs = db.select().from(schema.pushSubscriptions).all().filter((s) => (!s.teamKey && !s.groupName) || (s.teamKey && keys.includes(s.teamKey)) || (s.groupName && s.groupName === groupName));
  return sendTo(subs, payload);
}
export async function notifyAll(payload: PushPayload) {
  return sendTo(db.select().from(schema.pushSubscriptions).all(), payload);
}

