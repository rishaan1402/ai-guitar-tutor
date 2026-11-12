import { getAccessToken, getRefreshToken, refreshAccessToken, setTokens, clearTokens } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** FastAPI sends `detail` as a string, or as a list of field errors on 422. */
export function errorMessage(body: { detail?: unknown }, fallback: string): string {
  const d = body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length > 0) {
    const msg = String(d[0]?.msg ?? "");
    // Pydantic prefixes validator messages with "Value error, "
    return msg.replace(/^Value error, /, "") || fallback;
  }
  return fallback;
}

/** Error from the API, carrying the HTTP status so callers can tailor the message. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** The browser's IANA time zone (e.g. "America/Denver"), or null if unavailable. */
export function localTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** `?tz=<zone>` so the server buckets days (streak, calendar) in local time. */
function tzQuery(): string {
  const tz = localTimeZone();
  return tz ? `?tz=${encodeURIComponent(tz)}` : "";
}

async function request<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const headers = new Headers(options?.headers);

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // If 401 and we haven't retried yet, try to refresh the token
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
    // Refresh failed — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(errorMessage(body, `Request failed: ${res.status}`), res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function listChords(): Promise<{ chords: string[] }> {
  return request("/chords");
}

export interface LessonInfo {
  chord_name: string;
  metadata?: Record<string, unknown>;
  video_url?: string;
  audio_url?: string;
}

/** Load a chord lesson. Stateless: the server keeps no per-browser session. */
export function getLesson(chord: string): Promise<{ lesson: LessonInfo }> {
  return request(`/lesson/${encodeURIComponent(chord)}`);
}

export const MAX_UPLOAD_MB = 2;

export async function submitAudio(
  audioBlob: Blob,
  chordName: string,
  previousScores: number[] = [],
): Promise<Record<string, unknown>> {
  if (audioBlob.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(submitErrorMessage(new ApiError("", 413)));
  }
  const form = new FormData();
  form.append("audio", audioBlob, "recording.wav");
  // Sending the chord and earlier scores keeps scoring stateless on the server
  form.append("chord_name", chordName);
  form.append("previous_scores", JSON.stringify(previousScores));
  try {
    return await request("/submit_audio", { method: "POST", body: form });
  } catch (err) {
    throw new Error(submitErrorMessage(err));
  }
}

/** Friendly copy for upload failures (size cap, unreadable format). */
export function submitErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 413) {
      return `That recording was too large to upload (over ${MAX_UPLOAD_MB} MB). Record a shorter take — one strum is enough.`;
    }
    if (err.status === 422) {
      return err.message && !err.message.startsWith("Request failed")
        ? err.message
        : "We couldn't read that audio. Please record again.";
    }
  }
  return err instanceof Error ? err.message : "Failed to submit audio";
}

export function getVideoUrl(chord: string): string {
  return `${API_BASE}/video/${encodeURIComponent(chord)}`;
}

export function getAudioUrl(chord: string): string {
  return `${API_BASE}/audio/${encodeURIComponent(chord)}`;
}

export interface FretPosition {
  string: number;
  fret?: number;
  note?: string;
  finger?: number;
  action?: string;
}

export interface ChordFingering {
  chord: string;
  display_name: string;
  root: string;
  quality: string;
  notes: string[];
  /** The voicing to teach first (open shape where one exists). */
  positions: FretPosition[];
  /** Lowest barre voicing, for players moving up the neck. */
  alt_positions?: FretPosition[];
}

export function getFingering(chord: string): Promise<ChordFingering> {
  return request(`/fingering/${encodeURIComponent(chord)}`);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface UserResponse {
  id: string;
  email: string;
  display_name: string;
  role: string;
  skill_level: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function signup(
  email: string,
  password: string,
  displayName: string
): Promise<{ tokens: TokenResponse; user: UserResponse }> {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(errorMessage(body, `Signup failed: ${res.status}`));
  }
  const tokens: TokenResponse = await res.json();
  setTokens(tokens.access_token, tokens.refresh_token);
  const user = await getMe();
  return { tokens, user };
}

export async function login(
  email: string,
  password: string
): Promise<{ tokens: TokenResponse; user: UserResponse }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(errorMessage(body, `Login failed: ${res.status}`));
  }
  const tokens: TokenResponse = await res.json();
  setTokens(tokens.access_token, tokens.refresh_token);
  const user = await getMe();
  return { tokens, user };
}

export function getMe(): Promise<UserResponse> {
  return request("/api/auth/me");
}

export function updateProfile(data: {
  display_name?: string;
  skill_level?: string;
}): Promise<UserResponse> {
  return request("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    // The backend revokes this refresh token so it can't be reused
    if (refreshToken) {
      await request("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } catch {
    // ignore errors on logout
  }
  clearTokens();
}

export async function deleteAccount(password: string): Promise<void> {
  await request("/api/auth/me", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  clearTokens();
}

async function postPublic(path: string, payload: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(errorMessage(body, `Request failed: ${res.status}`));
  }
}

export function requestPasswordReset(email: string): Promise<void> {
  return postPublic("/api/auth/password-reset/request", { email });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return postPublic("/api/auth/password-reset/confirm", { token, new_password: newPassword });
}

// ---------------------------------------------------------------------------
// Progress (authenticated)
// ---------------------------------------------------------------------------

export interface ChordProgressItem {
  chord_name: string;
  best_score: number;
  total_attempts: number;
  mastered: boolean;
  last_practiced: string | null;
  streak_days: number;
}

export interface ProgressResponse {
  chords: ChordProgressItem[];
  mastered_count: number;
  total_attempted: number;
  practice_streak: number;
}

export function getProgress(): Promise<ProgressResponse> {
  return request(`/api/progress/${tzQuery()}`);
}

export interface TransitionHistoryItem {
  id: string;
  chord_a: string;
  chord_b: string;
  chord_a_symbol: string;
  chord_b_symbol: string;
  tpm: number;
  got_count: number;
  miss_count: number;
  created_at: string;
}

export function getTransitionHistory(): Promise<TransitionHistoryItem[]> {
  return request("/api/progress/transitions");
}

export function saveTransitionDrill(data: {
  chord_a: string;
  chord_b: string;
  chord_a_symbol: string;
  chord_b_symbol: string;
  tpm: number;
  got_count: number;
  miss_count: number;
}): Promise<{ id: string }> {
  return request("/api/progress/transitions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function migrateProgress(data: {
  chord_name: string;
  best_score: number;
  total_attempts: number;
  last_practiced: string | null;
}): Promise<{ imported: boolean }> {
  return request("/api/progress/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function migrateTransitions(
  items: {
    chord_a: string;
    chord_b: string;
    chord_a_symbol: string;
    chord_b_symbol: string;
    tpm: number;
    got_count: number;
    miss_count: number;
    date: string;
  }[]
): Promise<{ imported: number }> {
  return request("/api/progress/migrate-transitions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

// ---------------------------------------------------------------------------
// Song Learning Council
// ---------------------------------------------------------------------------

export interface FingeringPosition {
  string: number;
  fret?: number;
  note?: string;
  finger?: number;
  action?: string;
}

export interface PracticeChord {
  symbol: string;
  available_in_app: boolean;
  chord_key: string | null;
  positions?: FingeringPosition[];
  chord_function?: string;
}

export interface SongSection {
  name: string;
  chords: string[];
}

export interface LessonDocument {
  lesson_id: string;
  song_title: string;
  artist: string;
  overall_difficulty: string;
  chairman_summary: string;
  theory_section: string;
  technique_section: string;
  ear_training_section: string;
  practice_plan: string;
  practice_chords: PracticeChord[];
  // Song metadata (surfaced from SongObject)
  key: string;
  time_signature: string;
  tempo_feel: string;
  song_sections: SongSection[];
  chord_functions: Record<string, string>;
}

export interface TipRequest {
  lesson_id: string;
  chord_key: string;
  chord_symbol: string;
  score: number;
  detected_notes: string[];
  missing_notes: string[];
  extra_notes: string[];
  attempt: number;
}

export interface TipResponse {
  tip: string;
  all_chords_attempted: boolean;
  chord_scores: Record<string, number[]>;
}

export function generateSongLesson(songQuery: string): Promise<LessonDocument> {
  return request("/api/council/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ song_query: songQuery }),
  });
}

export function getSongTip(params: TipRequest): Promise<TipResponse> {
  return request("/api/council/practice/tip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function reviseSongLesson(lessonId: string): Promise<LessonDocument> {
  return request("/api/council/practice/revise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_id: lessonId }),
  });
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];      // always 4 options
  correct_index: number;  // 0–3
  explanation: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
}

export function getQuiz(lessonId: string): Promise<QuizResponse> {
  return request("/api/council/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_id: lessonId }),
  });
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------

export interface StudentSummary {
  id: string;
  display_name: string;
  email: string;
  skill_level: string;
  total_attempts: number;
  mastered_count: number;
  avg_score: number;
  last_active: string | null;
}

export interface StudentProgress {
  user: UserResponse;
  chords: ChordProgressItem[];
  transitions: TransitionHistoryItem[];
}

export function getStudents(page = 1, perPage = 20): Promise<StudentSummary[]> {
  return request(`/api/teacher/students?page=${page}&per_page=${perPage}`);
}

export function getStudentProgress(studentId: string): Promise<StudentProgress> {
  return request(`/api/teacher/students/${studentId}/progress`);
}

export function getStudentReport(studentId: string): Promise<{ report: string }> {
  return request(`/api/teacher/students/${studentId}/report`);
}

// Field names match backend teacher/router.py class_analytics()
export interface ClassAnalytics {
  most_practiced_chords: { chord: string; total_attempts: number }[];
  lowest_avg_score_chords: { chord: string; avg_score: number }[];
  total_students: number;
}

export function getClassAnalytics(): Promise<ClassAnalytics> {
  return request("/api/teacher/analytics");
}

export function assignChord(data: {
  student_id: string;
  chord_name: string;
  note?: string;
}): Promise<{ id: string }> {
  return request("/api/teacher/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  skill_level: string;
  created_at: string;
}

export interface SystemStats {
  total_users: number;
  users_by_role: Record<string, number>;
  total_chord_attempts: number;
  total_transition_drills: number;
}

export function getAdminUsers(
  page = 1,
  perPage = 20,
  role?: string
): Promise<AdminUser[]> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (role) params.set("role", role);
  return request(`/api/admin/users?${params}`);
}

export function updateUserRole(userId: string, role: string): Promise<{ id: string; role: string }> {
  return request(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export function deleteUser(userId: string): Promise<void> {
  return request(`/api/admin/users/${userId}`, { method: "DELETE" });
}

export function getSystemStats(): Promise<SystemStats> {
  return request("/api/admin/stats");
}

// ---------------------------------------------------------------------------
// Personalization & Progress
// ---------------------------------------------------------------------------

export interface PlanItem {
  type: "warmup" | "focus" | "new" | "transition";
  chord_key?: string;
  chord_symbol?: string;
  chord_a?: string;
  chord_b?: string;
  chord_a_symbol?: string;
  chord_b_symbol?: string;
  description: string;
  best_score?: number;
  attempts?: number;
  difficulty?: string;
  miss_rate?: number;
}

export interface DailyPlan {
  skill_level: string;
  display_name: string;
  items: PlanItem[];
  total: number;
}

export function getPlan(): Promise<DailyPlan> {
  return request("/api/plan/next");
}

export interface CalendarDay {
  date: string;
  attempts: number;
  avg_score: number;
}

export function getCalendar(): Promise<CalendarDay[]> {
  return request(`/api/progress/calendar${tzQuery()}`);
}

export interface ChordAttempt {
  id: string;
  score: number;
  missing_notes: string[];
  extra_notes: string[];
  issue: string | null;
  feedback_text: string;
  created_at: string;
}

export function getChordHistory(chordName: string): Promise<ChordAttempt[]> {
  return request(`/api/progress/chord/${encodeURIComponent(chordName)}/history`);
}

export function submitTipFeedback(tipId: string, helpful: boolean): Promise<{ status: string }> {
  return request(`/api/progress/feedback/${tipId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ helpful }),
  });
}

export function getInviteCode(): Promise<{ code: string }> {
  return request("/api/teacher/invite-code");
}

export function rotateInviteCode(): Promise<{ code: string }> {
  return request("/api/teacher/invite-code/rotate", { method: "POST" });
}

export function removeStudent(studentId: string): Promise<void> {
  return request(`/api/teacher/students/${studentId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Class membership (student side)
// ---------------------------------------------------------------------------

export interface TeacherInfo {
  id: string;
  display_name: string;
}

export interface Assignment {
  id: string;
  teacher_name: string;
  chord_name: string | null;
  note: string | null;
  created_at: string;
}

export function joinClass(code: string): Promise<TeacherInfo> {
  return request("/api/class/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

export function getMyTeachers(): Promise<TeacherInfo[]> {
  return request("/api/class/teachers");
}

export function leaveClass(teacherId: string): Promise<void> {
  return request(`/api/class/teachers/${teacherId}`, { method: "DELETE" });
}

export function getMyAssignments(): Promise<Assignment[]> {
  return request("/api/class/assignments");
}

// ---------------------------------------------------------------------------
// Song sheets (ChordPro)
// ---------------------------------------------------------------------------

export interface SongSummary {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  difficulty: string | null;
  source: "library" | "mine" | "class";
  owner_name?: string | null;
  visibility?: "private" | "class" | null;
}

export interface SongDetail extends SongSummary {
  content: string;
  can_edit: boolean;
}

export function listSongs(params: { q?: string; difficulty?: string } = {}): Promise<SongSummary[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.difficulty) qs.set("difficulty", params.difficulty);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/api/songs${suffix}`);
}

export function getSong(id: string): Promise<SongDetail> {
  return request(`/api/songs/${encodeURIComponent(id)}`);
}

export function saveSong(
  content: string,
  visibility: "private" | "class",
  id?: string,
): Promise<SongDetail> {
  return request(id ? `/api/songs/${encodeURIComponent(id)}` : "/api/songs", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, visibility }),
  });
}

export function deleteSong(id: string): Promise<void> {
  return request(`/api/songs/${encodeURIComponent(id)}`, { method: "DELETE" });
}
