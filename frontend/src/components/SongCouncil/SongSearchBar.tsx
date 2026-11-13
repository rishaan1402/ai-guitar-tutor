"use client";

import React, { useState } from "react";

interface SongSearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export default function SongSearchBar({ onSearch, loading }: SongSearchBarProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim() && !loading) onSearch(query.trim());
  }

  return (
    <div className="w-full max-w-2xl">
      <label htmlFor="song-query" className="label-mono mb-2 block text-cream/50">
        Song and artist
      </label>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          id="song-query"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Wonderwall by Oasis, Hotel California, Blackbird..."
          disabled={loading}
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
            backdropFilter: "blur(12px)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = "1px solid rgba(var(--accent-rgb),0.6)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(var(--accent-rgb),0.15)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.15)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="btn-gradient px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Analyze"}
        </button>
      </form>
    </div>
  );
}
