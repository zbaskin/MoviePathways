import type { AppState, Id, Itinerary, Movie, ScheduledShow, } from "./types"; // Showtime

export function uid(prefix = "id"): Id {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function parseLocalDateTimeToMs(local: string): number {
  // local is "YYYY-MM-DDTHH:mm"
  const ms = new Date(local).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export function moviePreferencePoints(movie: Movie): number {
  // Ranked movies dominate. Unranked = 0.
  // Rank 1 is best. Map to large positive points.
  if (movie.rank == null) return 0;
  const r = clampInt(movie.rank, 1, 9999);
  return 100000 - r; // simple, monotonic
}

export function buildScheduledShows(state: AppState): ScheduledShow[] {
  const movieById = new Map(state.movies.map(m => [m.id, m]));
  const out: ScheduledShow[] = [];

  for (const st of state.showtimes) {
    const m = movieById.get(st.movieId);
    if (!m) continue;
    const startMs = parseLocalDateTimeToMs(st.startLocal);
    if (!Number.isFinite(startMs)) continue;
    const endMs = startMs + m.runtimeMins * 60_000;
    out.push({
      showtimeId: st.id,
      movieId: st.movieId,
      theaterId: st.theaterId,
      startMs,
      endMs,
    });
  }

  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

/**
 * Can we go from A -> B given your rules?
 * You can arrive up to (B.start + X). No buffer. Travel only if switching theaters.
 */
export function canTransition(
  a: ScheduledShow,
  b: ScheduledShow,
  trailerLeewayMins: number,
  travelMins: number
): { ok: boolean; travelAppliedMins: number } {
  if (b.startMs < a.startMs) return { ok: false, travelAppliedMins: 0 };

  const travelAppliedMins = a.theaterId === b.theaterId ? 0 : travelMins;
  const arriveDeadlineMs = b.startMs + trailerLeewayMins * 60_000;
  const earliestArrivalMs = a.endMs + travelAppliedMins * 60_000;

  return { ok: earliestArrivalMs <= arriveDeadlineMs, travelAppliedMins };
}

export function itineraryScore(
  it: Itinerary
): [number, number, number] {
  // Higher is better for score and count; earlier finish is better (so we invert).
  // We'll sort by: preferenceScore desc, movieCount desc, finishMs asc
  return [it.preferenceScore, it.movieCount, -it.finishMs];
}

export function sortItineraries(its: Itinerary[]): Itinerary[] {
  return [...its].sort((a, b) => {
    if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
    if (b.movieCount !== a.movieCount) return b.movieCount - a.movieCount;
    return a.finishMs - b.finishMs;
  });
}

export function generateItineraries(state: AppState): Itinerary[] {
  const { trailerLeewayMins: X, travelMins: T, maxResults: K, beamWidth } = state.settings;

  const movieById = new Map(state.movies.map(m => [m.id, m]));
  const shows = buildScheduledShows(state);
  const n = shows.length;
  if (n === 0) return [];

  // Precompute adjacency list (forward edges).
  const nexts: number[][] = Array.from({ length: n }, () => []);
  const travelCost: number[][] = Array.from({ length: n }, () => []); // parallel array storing travel minutes

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const res = canTransition(shows[i], shows[j], X, T);
      if (res.ok) {
        nexts[i].push(j);
        travelCost[i].push(res.travelAppliedMins);
      }
    }
  }

  // Beam search over partial itineraries.
  type Partial = {
    lastIdx: number;
    usedMovieIds: Set<string>;    // NEW: prevent watching same movie twice
    usedShowtimeIds: Set<string>; // prevent duplicates if same showtime somehow appears twice
    shows: ScheduledShow[];
    preferenceScore: number;
    totalTravelMins: number;
  };

  const initial: Partial[] = shows.map((s, idx) => {
    const m = movieById.get(s.movieId);
    const score = m ? moviePreferencePoints(m) : 0;
    return {
      lastIdx: idx,
      usedMovieIds: new Set([s.movieId]),
      usedShowtimeIds: new Set([s.showtimeId]),
      shows: [s],
      preferenceScore: score,
      totalTravelMins: 0,
    };
  });

  let beam: Partial[] = initial;

  const finished: Itinerary[] = [];
  const seenItineraryKeys = new Set<string>();

  function finalize(p: Partial) {
    const finishMs = p.shows[p.shows.length - 1].endMs;
    const it: Itinerary = {
      shows: p.shows,
      preferenceScore: p.preferenceScore,
      movieCount: p.shows.length,
      finishMs,
      totalTravelMins: p.totalTravelMins,
    };

    // Key to dedupe: list of showtime IDs
    const key = it.shows.map(s => s.showtimeId).join(">");
    if (!seenItineraryKeys.has(key)) {
      seenItineraryKeys.add(key);
      finished.push(it);
    }
  }

  // Expand up to length n (worst case). Beam width keeps it controlled.
  for (let step = 0; step < n; step++) {
    // Always consider current beam members as finished candidates.
    for (const p of beam) finalize(p);

    const expanded: Partial[] = [];

    for (const p of beam) {
      const i = p.lastIdx;
      const candidates = nexts[i];
      const costs = travelCost[i];

      for (let k = 0; k < candidates.length; k++) {
        const j = candidates[k];
        const nextShow = shows[j];
        if (p.usedShowtimeIds.has(nextShow.showtimeId)) continue;

        // NEW: don't watch the same movie twice
        if (p.usedMovieIds.has(nextShow.movieId)) continue;

        const m = movieById.get(nextShow.movieId);
        const addScore = m ? moviePreferencePoints(m) : 0;
        const addTravel = costs[k];

        expanded.push({
          lastIdx: j,
          usedMovieIds: new Set([...p.usedMovieIds, nextShow.movieId]),
          usedShowtimeIds: new Set([...p.usedShowtimeIds, nextShow.showtimeId]),
          shows: [...p.shows, nextShow],
          preferenceScore: p.preferenceScore + addScore,
          totalTravelMins: p.totalTravelMins + addTravel,
        });
      }
    }

    if (expanded.length === 0) break;

    // Sort expanded by our scoring; keep best beamWidth.
    expanded.sort((a, b) => {
      // preferenceScore desc, movieCount desc, finish asc, then travel asc
      if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
      if (b.shows.length !== a.shows.length) return b.shows.length - a.shows.length;
      const af = a.shows[a.shows.length - 1].endMs;
      const bf = b.shows[b.shows.length - 1].endMs;
      if (af !== bf) return af - bf;
      return a.totalTravelMins - b.totalTravelMins;
    });

    beam = expanded.slice(0, beamWidth);
  }

  return sortItineraries(finished).slice(0, clampInt(K, 1, 200));
}

export function buildDefaultState(): AppState {
  return {
    settings: {
      trailerLeewayMins: 20,
      travelMins: 15,
      maxResults: 20,
      beamWidth: 200,
    },
    movies: [],
    theaters: [],
    showtimes: [],
  };
}
