"""Load test: many learners at once, latency percentiles.

    python scripts/loadtest.py BASE_URL CONCURRENCY TOTAL [grade|gen]

grade: graded takes (POST /submit_audio with the G major reference
recording); gen: Learn any song for a stored song (POST /api/council/generate,
"Let It Be by The Beatles": seed it first with backend/tests/e2e_seed.py).
Run against a local or staging backend, never production: every request is
real work and the rate limits apply. Each simulated learner gets its own
X-Forwarded-For so per-IP limits don't skew the numbers.

Results (2026-11-23, one CPU per instance, Postgres capped at 25 connections):
- 1 instance, 50 at once: grading p95 1.7 s; stored-song search p95 0.6 s
- 3 instances, 60 each (180 at once): grading p95 2.2-2.4 s, all succeeded
  with DB_POOL_SIZE=2 / DB_MAX_OVERFLOW=2; with the old 5/10 a third of
  requests failed with "too many clients".
"""
import asyncio, statistics, sys, time
import httpx
WAV = open(__import__("pathlib").Path(__file__).resolve().parents[1] / "data/lessons/G_major/reference.wav", "rb").read()
BASE = sys.argv[1]; CONC = int(sys.argv[2]); TOTAL = int(sys.argv[3]); PATH = sys.argv[4] if len(sys.argv) > 4 else "grade"

async def one(client, lat, codes):
    t = time.perf_counter()
    if PATH == "grade":
        r = await client.post(f"{BASE}/submit_audio", data={"chord_name": "G_major"}, files={"audio": ("g.wav", WAV, "audio/wav")})
    else:
        r = await client.post(f"{BASE}/api/council/generate", json={"song_query": "Let It Be by The Beatles"})
    lat.append(time.perf_counter() - t); codes[r.status_code] = codes.get(r.status_code, 0) + 1

async def main():
    lat, codes = [], {}
    sem = asyncio.Semaphore(CONC)
    async with httpx.AsyncClient(timeout=120, headers={"X-Forwarded-For": "10.0.0.1"}) as client:
        async def run(i):
            async with sem:
                # each simulated user has its own address, so per-IP limits don't skew the test
                client.headers["X-Forwarded-For"] = f"10.0.{i // 250}.{i % 250}"
                await one(client, lat, codes)
        t0 = time.perf_counter()
        await asyncio.gather(*(run(i) for i in range(TOTAL)))
        wall = time.perf_counter() - t0
    lat.sort()
    p = lambda q: lat[min(len(lat) - 1, int(q * len(lat)))]
    print(f"{PATH} conc={CONC} n={TOTAL} codes={codes} p50={p(0.5):.2f}s p95={p(0.95):.2f}s max={lat[-1]:.2f}s throughput={TOTAL/wall:.1f}/s")

asyncio.run(main())
