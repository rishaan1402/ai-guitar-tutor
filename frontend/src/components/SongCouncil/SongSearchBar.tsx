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
    <div className="w-full max-w-2xl mx-auto">
      <h2 className="gradient-text text-3xl font-bold text-center mb-2">
        Song Learning Council
      </h2>
      <p className="text-center text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
        Type any song name — 4 AI specialists will build you a personalised lesson plan
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
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
            e.currentTarget.style.border = "1px solid rgba(124,58,237,0.6)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.15)";
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
