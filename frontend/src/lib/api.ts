import { getAccessToken, refreshAccessToken, setTokens, clearTokens } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

async function request<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("X-Session-Id", getSessionId());

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
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function listChords(): Promise<{ chords: string[] }> {
  return request("/chords");
}

export function getLesson(chord: string): Promise<{ lesson: Record<string, unknown> }> {
  return request(`/lesson/${encodeURIComponent(chord)}`);
}

export function learnChord(chordName: string): Promise<Record<string, unknown>> {
  return request("/learn_chord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chord_name: chordName }),
  });
}

export function submitAudio(audioBlob: Blob): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.wav");
  return request("/submit_audio", { method: "POST", body: form });
}

export function getSession(): Promise<Record<string, unknown>> {
  return request("/session");
}

export function resetSession(): Promise<{ status: string; message: string }> {
  return request("/reset", { method: "POST" });
}

export function getVideoUrl(chord: string): string {
  return `${API_BASE}/video/${encodeURIComponent(chord)}`;
}

export function getAudioUrl(chord: string): string {
  return `${API_BASE}/audio/${encodeURIComponent(chord)}`;
}

export interface ChordFingering {
  chord: string;
  display_name: string;
  root: string;
  quality: string;
  notes: string[];
  positions: {
    string: number;
    fret?: number;
    note?: string;
    finger?: number;
    action?: string;
  }[];
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
    throw new Error(body.detail || `Signup failed: ${res.status}`);
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
    throw new Error(body.detail || `Login failed: ${res.status}`);
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
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore errors on logout
  }
  clearTokens();
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
  return request("/api/progress/");
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

export interface ClassAnalytics {
  most_practiced: { chord_name: string; total_attempts: number }[];
  lowest_avg_score: { chord_name: string; avg_score: number }[];
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
  return request("/api/progress/calendar");
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
