/**
 * Daily practice reminders.
 *
 * - Android app: notifications scheduled on the phone for the next few days at
 *   your hour; a day you've already played is skipped. Works signed out, offline.
 * - Website: Web Push. The browser subscribes, the server keeps the subscription
 *   on your account, and an hourly job sends the reminder only if you haven't
 *   played that day. Needs an account (the server has to know when you played).
 */
import { getAccessToken } from "./auth";
import { isNativeApp } from "./native";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const LOCAL_KEY = "os:reminder";
const PLAYED_KEY = "os:last-practice";
const NATIVE_IDS = [9001, 9002, 9003];

export interface ReminderPref {
  hour: number | null;
}

const today = () => new Date().toLocaleDateString("en-CA");
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function readPref(): ReminderPref {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{"hour":null}');
  } catch {
    return { hour: null };
  }
}
function writePref(p: ReminderPref) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
}

async function authed(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  if (!res.ok && res.status !== 204) throw new Error((await res.json().catch(() => ({}))).detail || `Request failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** What this device can do. */
export function reminderSupport(): "app" | "web" | "none" {
  if (typeof window === "undefined") return "none";
  if (isNativeApp()) return "app";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "web" : "none";
}

export function currentReminder(): ReminderPref {
  return readPref();
}

/* ------------------------------------------------------------------ app */

async function rescheduleNative(hour: number | null) {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: NATIVE_IDS.map((id) => ({ id })) });
  if (hour === null) return;
  let played: string | null = null;
  try {
    played = localStorage.getItem(PLAYED_KEY);
  } catch {
    /* storage blocked */
  }
  const now = new Date();
  const notifications = [];
  for (let d = 0; d < 4 && notifications.length < NATIVE_IDS.length; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, 0, 0);
    if (at <= now) continue;
    if (d === 0 && played === today()) continue; // already played today
    notifications.push({
      id: NATIVE_IDS[notifications.length],
      title: "Time to play",
      body: "Five minutes with your guitar keeps your streak going.",
      schedule: { at, allowWhileIdle: true },
      extra: { url: "/studio" },
    });
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

/* ------------------------------------------------------------------ web */

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function subscribeWeb(): Promise<void> {
  const { key } = await authed("/api/reminders/vapid-key");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await authed("/api/reminders/subscriptions", { method: "POST", body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }) });
}

async function unsubscribeWeb(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await authed("/api/reminders/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }) }).catch(() => {});
  await sub.unsubscribe();
}

/* ------------------------------------------------------------------ public */

/** Turn reminders on at `hour` (0-23), or off with null. Throws a readable message when it can't. */
export async function setReminder(hour: number | null): Promise<void> {
  const kind = reminderSupport();
  if (kind === "app") {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if (hour !== null && (await LocalNotifications.requestPermissions()).display !== "granted") {
      throw new Error("Notifications are off for Open Strings. Turn them on in your phone's settings.");
    }
    await rescheduleNative(hour);
  } else if (kind === "web") {
    if (!getAccessToken()) throw new Error("Sign in first: the reminder needs to know when you've played.");
    if (hour !== null) {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for this site. Allow them in your browser's site settings.");
      await subscribeWeb();
    } else {
      await unsubscribeWeb();
    }
    await authed("/api/reminders", { method: "PUT", body: JSON.stringify({ hour, tz: tz() }) });
  } else {
    throw new Error("This browser can't show reminders. Install the app, or try Chrome, Edge, Firefox or Safari 16.4+.");
  }
  writePref({ hour });
}

/** Call when the learner plays (a graded take, a Groove): today's app reminder is dropped. */
export function notePracticed(): void {
  try {
    localStorage.setItem(PLAYED_KEY, today());
  } catch {
    /* storage blocked */
  }
  const { hour } = readPref();
  if (hour !== null && reminderSupport() === "app") void rescheduleNative(hour).catch(() => {});
}

/** App start: keep the next few days' reminders scheduled. */
export function refreshAppReminders(): void {
  const { hour } = readPref();
  if (hour !== null && reminderSupport() === "app") void rescheduleNative(hour).catch(() => {});
}
