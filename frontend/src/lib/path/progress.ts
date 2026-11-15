/** Path progress: on the server when signed in, in this browser when not. */
import { getPathProgress, savePathProgress } from "../api";
import { getAccessToken } from "../auth";

const KEY = "os:path-progress";

function local(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export async function loadPathProgress(): Promise<Record<string, number>> {
  if (getAccessToken()) {
    try {
      const { sessions } = await getPathProgress();
      return { ...local(), ...sessions };
    } catch {
      /* offline: fall back to this device */
    }
  }
  return local();
}

export async function recordSession(id: string, stars: number): Promise<void> {
  const l = local();
  l[id] = Math.max(l[id] ?? 0, stars);
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* storage blocked */
  }
  if (getAccessToken()) await savePathProgress(id, stars).catch(() => {});
}
