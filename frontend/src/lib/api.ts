const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("X-Session-Id", getSessionId());

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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
// Song Learning Council
// ---------------------------------------------------------------------------

export interface PracticeChord {
  symbol: string;
  available_in_app: boolean;
  chord_key: string | null;
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
