"use client";

import { type ClassAnalytics } from "@/lib/api";

interface Props {
  analytics: ClassAnalytics;
}

export default function ClassAnalyticsView({ analytics }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total students */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 col-span-1">
        <p className="text-gray-400 text-sm mb-1">Total Students</p>
        <p className="text-3xl font-bold text-white">{analytics.total_students}</p>
      </div>

      {/* Most practiced */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-gray-400 text-sm mb-3">Most Practiced Chords</p>
        {analytics.most_practiced.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet</p>
        ) : (
          <ol className="space-y-1">
            {analytics.most_practiced.slice(0, 5).map((item, i) => (
              <li key={item.chord_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  <span className="text-gray-500 mr-2">{i + 1}.</span>
                  {item.chord_name}
                </span>
                <span className="text-gray-400">{item.total_attempts} attempts</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Lowest avg score */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-gray-400 text-sm mb-3">Needs Most Work</p>
        {analytics.lowest_avg_score.length === 0 ? (
          <p className="text-gray-500 text-sm">No data yet</p>
        ) : (
          <ol className="space-y-1">
            {analytics.lowest_avg_score.slice(0, 5).map((item, i) => (
              <li key={item.chord_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  <span className="text-gray-500 mr-2">{i + 1}.</span>
                  {item.chord_name}
                </span>
                <span className="text-red-400">{Math.round(item.avg_score * 100)}%</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
