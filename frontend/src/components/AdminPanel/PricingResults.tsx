"use client";

/** The pricing experiment so far: visits, "I'd pay" clicks and conversion per price. */
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
interface Row { prices: { monthly?: number; yearly?: number }; views: number; interest: number; monthly: number; yearly: number; conversion: number | null }

export default function PricingResults() {
  const [data, setData] = useState<{ variants: Record<string, Row>; emails: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${API}/api/pricing/results`, { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Request failed: ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel overflow-hidden" aria-labelledby="pricing-results-h">
      <div className="px-4 py-3 panel-header">
        <h2 id="pricing-results-h" className="text-sm font-semibold text-gray-300">Pricing experiment</h2>
      </div>
      <div className="overflow-x-auto p-4">
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {data && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-gray-400">
              <tr><th className="py-2">Price</th><th>Visits</th><th>Would pay</th><th>Yearly</th><th>Monthly</th><th>Conversion</th></tr>
            </thead>
            <tbody>
              {Object.entries(data.variants).map(([v, r]) => (
                <tr key={v} className="border-t border-white/10 text-cream">
                  <td className="py-2">{v}: ${r.prices.monthly}/mo · ${r.prices.yearly}/yr</td>
                  <td>{r.views}</td><td>{r.interest}</td><td>{r.yearly}</td><td>{r.monthly}</td>
                  <td>{r.conversion === null ? "–" : `${(r.conversion * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <p className="mt-3 text-xs text-gray-400">{data.emails} email{data.emails === 1 ? "" : "s"} to tell when Pro is ready.</p>}
      </div>
    </section>
  );
}
