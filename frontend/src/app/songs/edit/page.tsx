"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import SongSheetPlayer from "@/components/SongSheet/SongSheetPlayer";
import { useAuth } from "@/context/AuthContext";
import { deleteSong, getSong, saveSong } from "@/lib/api";
import { DRAFT_KEY } from "@/lib/songDraft";

const TEMPLATE = `{title: My Song}
{artist: }
{key: G}
{time: 4/4}
{difficulty: beginner}
{strumming: D - D U - U D U}

{start_of_verse: Verse}
| G | D | Em | C |
{end_of_verse}

{start_of_chorus: Chorus}
[C]Your own [G]words or [D]notes go here
{end_of_chorus}
`;

const SNIPPETS: { label: string; text: string }[] = [
  { label: "Verse", text: "\n{start_of_verse: Verse}\n| G | C | D | G |\n{end_of_verse}\n" },
  { label: "Chorus", text: "\n{start_of_chorus: Chorus}\n| C | G | D | D |\n{end_of_chorus}\n" },
  { label: "Bars", text: "| G . . . | C . D . |\n" },
  { label: "Tab", text: "\n{start_of_tab: Riff}\ne|---------------|\nB|---------------|\nG|---------------|\nD|---------------|\nA|---------------|\nE|---------------|\n{end_of_tab}\n" },
  { label: "Note", text: "{comment: }\n" },
];

function SongEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, loading, isTeacher } = useAuth();
  const id = params.get("id");
  const fromDraft = params.get("draft") === "1";

  const [content, setContent] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"private" | "class">("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Until the user places the cursor, snippets go at the end rather than position 0
  const touched = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (id) {
      getSong(id)
        .then((s) => {
          if (!s.can_edit) throw new Error("You can only edit your own sheets.");
          setContent(s.content);
          setVisibility(s.visibility === "class" ? "class" : "private");
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load sheet"));
    } else if (fromDraft) {
      let draft: string | null = null;
      try {
        draft = sessionStorage.getItem(DRAFT_KEY);
      } catch {
        // storage blocked: fall back to the template
      }
      setContent(draft ?? TEMPLATE);
    } else {
      setContent(TEMPLATE);
    }
  }, [id, fromDraft]);

  const insert = (text: string) => {
    const el = textRef.current;
    if (!el || content === null) return;
    const start = touched.current ? el.selectionStart : content.length;
    const end = touched.current ? el.selectionEnd : content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    touched.current = true;
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const handleSave = async () => {
    if (content === null) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveSong(content, visibility, id ?? undefined);
      router.push(`/songs/view?id=${encodeURIComponent(saved.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("Delete this sheet? This can't be undone.")) return;
    try {
      await deleteSong(id);
      router.push("/songs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  };

  if (loading || !user || content === null) {
    return error ? <p className="text-red-300">{error}</p> : <div className="skeleton h-96 rounded-xl" />;
  }

  const tabBtn = (t: "edit" | "preview") =>
    `px-4 py-1.5 rounded-md text-sm font-medium capitalize ${tab === t ? "bg-white/10 text-white" : "text-gray-400"}`;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Link href={id ? `/songs/view?id=${encodeURIComponent(id)}` : "/songs"} className="text-sm text-gray-400 hover:text-white">
            ← {id ? "Back to sheet" : "All songs"}
          </Link>
          <h1 className="text-h2 gradient-text mt-1">{id ? "Edit sheet" : "New sheet"}</h1>
        </div>
        <div className="flex items-center gap-3">
          {isTeacher && (
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "private" | "class")}
              className="h-9 rounded-lg border border-white/10 bg-transparent text-sm text-gray-200 px-2"
              aria-label="Who can see this sheet"
            >
              <option value="private" className="bg-gray-900">Only me</option>
              <option value="class" className="bg-gray-900">My class</option>
            </select>
          )}
          {id && (
            <button type="button" onClick={handleDelete} className="text-sm text-gray-500 hover:text-red-300">
              Delete
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={saving} className="btn-gradient text-sm px-5 py-2">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      {/* Phones get tabs; wide screens show both side by side */}
      <div className="flex gap-1 mb-3 rounded-lg p-1 w-fit lg:hidden bg-white/5">
        <button type="button" className={tabBtn("edit")} onClick={() => setTab("edit")}>edit</button>
        <button type="button" className={tabBtn("preview")} onClick={() => setTab("preview")}>preview</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={tab === "edit" ? "" : "hidden lg:block"}>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SNIPPETS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => insert(s.text)}
                className="text-xs px-2.5 py-1 rounded-md border border-white/10 text-gray-300 hover:bg-white/5"
              >
                + {s.label}
              </button>
            ))}
          </div>
          <label htmlFor="sheet-source" className="sr-only">ChordPro source</label>
          <textarea
            id="sheet-source"
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={() => {
              touched.current = true;
            }}
            spellCheck={false}
            className="field-input font-mono text-sm leading-relaxed min-h-[60vh] resize-y"
          />
          <details className="mt-3 text-xs text-gray-400">
            <summary className="cursor-pointer text-gray-300">Format help</summary>
            <ul className="mt-2 space-y-1 font-mono">
              <li>{"{title: Name}"} {"{artist: Name}"} {"{key: G}"} {"{capo: 2}"} {"{tempo: 90}"}</li>
              <li>{"{difficulty: beginner|intermediate|advanced}"} {"{strumming: D - D U}"}</li>
              <li>{"{start_of_verse: Verse 1}"} … {"{end_of_verse}"} (also chorus, bridge, tab)</li>
              <li>{"| G . . . | C . D . |"}  bars; &quot;.&quot; holds a beat, &quot;%&quot; repeats the bar</li>
              <li>{"[G]words [C]more"}  chords above your own text</li>
              <li>{"{comment: Tip for the player}"}</li>
            </ul>
            <p className="mt-2 font-sans">
              Only add lyrics you have the right to use. Private sheets are visible only to you.
            </p>
          </details>
        </div>

        <div className={`glass-card ${tab === "preview" ? "" : "hidden lg:block"}`}>
          <SongSheetPlayer content={content} compact />
        </div>
      </div>
    </div>
  );
}

export default function SongEditPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <SongEditor />
      </Suspense>
    </AppShell>
  );
}
