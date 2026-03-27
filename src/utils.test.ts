import { describe, it, expect } from "vitest";
import {
  uid,
  clampInt,
  parseLocalDateTimeToMs,
  moviePreferencePoints,
  buildScheduledShows,
  canTransition,
  sortItineraries,
  generateItineraries,
  buildDefaultState,
} from "./utils";
import type { AppState, Movie, Theater, Showtime, ScheduledShow } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  movies: Movie[],
  theaters: Theater[],
  showtimes: Showtime[],
  overrideSettings?: Partial<AppState["settings"]>
): AppState {
  return {
    ...buildDefaultState(),
    settings: { ...buildDefaultState().settings, ...overrideSettings },
    movies,
    theaters,
    showtimes,
  };
}

function makeMovie(id: string, title: string, runtimeMins: number, rank?: number): Movie {
  return { id, title, runtimeMins, rank };
}

function makeTheater(id: string, name: string): Theater {
  return { id, name };
}

function makeShowtime(id: string, movieId: string, theaterId: string, startLocal: string): Showtime {
  return { id, movieId, theaterId, startLocal };
}

// ---------------------------------------------------------------------------
// uid
// ---------------------------------------------------------------------------

describe("uid", () => {
  it("returns a string with the given prefix", () => {
    const result = uid("test");
    expect(typeof result).toBe("string");
    expect(result.startsWith("test_")).toBe(true);
  });

  it("returns a string with default prefix 'id'", () => {
    const result = uid();
    expect(result.startsWith("id_")).toBe(true);
  });

  it("generates unique values on repeated calls", () => {
    const results = new Set(Array.from({ length: 100 }, () => uid("x")));
    expect(results.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// clampInt
// ---------------------------------------------------------------------------

describe("clampInt", () => {
  it("returns the value when within bounds", () => {
    expect(clampInt(5, 1, 10)).toBe(5);
  });

  it("clamps to min when value is below range", () => {
    expect(clampInt(-5, 0, 10)).toBe(0);
  });

  it("clamps to max when value is above range", () => {
    expect(clampInt(100, 0, 10)).toBe(10);
  });

  it("truncates fractional parts", () => {
    expect(clampInt(3.9, 1, 10)).toBe(3);
    expect(clampInt(3.1, 1, 10)).toBe(3);
  });

  it("returns min for Infinity", () => {
    expect(clampInt(Infinity, 0, 10)).toBe(0);
  });

  it("returns min for NaN", () => {
    expect(clampInt(NaN, 0, 10)).toBe(0);
  });

  it("handles min === max (boundary equality)", () => {
    expect(clampInt(5, 7, 7)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// parseLocalDateTimeToMs
// ---------------------------------------------------------------------------

describe("parseLocalDateTimeToMs", () => {
  it("parses a valid datetime-local string to a finite number", () => {
    const ms = parseLocalDateTimeToMs("2026-01-15T10:30");
    expect(Number.isFinite(ms)).toBe(true);
    expect(ms).toBeGreaterThan(0);
  });

  it("returns NaN for an invalid string", () => {
    const ms = parseLocalDateTimeToMs("not-a-date");
    expect(Number.isNaN(ms)).toBe(true);
  });

  it("returns NaN for an empty string", () => {
    const ms = parseLocalDateTimeToMs("");
    expect(Number.isNaN(ms)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// moviePreferencePoints
// ---------------------------------------------------------------------------

describe("moviePreferencePoints", () => {
  it("returns 0 for an unranked movie", () => {
    const m = makeMovie("m1", "Unranked", 120, undefined);
    expect(moviePreferencePoints(m)).toBe(0);
  });

  it("returns higher points for rank 1 than rank 2", () => {
    const m1 = makeMovie("m1", "Top", 120, 1);
    const m2 = makeMovie("m2", "Second", 120, 2);
    expect(moviePreferencePoints(m1)).toBeGreaterThan(moviePreferencePoints(m2));
  });

  it("rank 1 gives 99999 points (100000 - 1)", () => {
    const m = makeMovie("m1", "Best", 120, 1);
    expect(moviePreferencePoints(m)).toBe(99999);
  });

  it("rank 9999 gives 90001 points", () => {
    const m = makeMovie("m1", "Worst", 120, 9999);
    expect(moviePreferencePoints(m)).toBe(100000 - 9999);
  });
});

// ---------------------------------------------------------------------------
// buildScheduledShows
// ---------------------------------------------------------------------------

describe("buildScheduledShows", () => {
  it("returns empty array when no showtimes", () => {
    const state = makeState(
      [makeMovie("m1", "Movie", 120)],
      [makeTheater("t1", "Theater")],
      []
    );
    expect(buildScheduledShows(state)).toEqual([]);
  });

  it("skips a showtime whose movie id does not exist", () => {
    const state = makeState(
      [makeMovie("m1", "Movie", 120)],
      [makeTheater("t1", "Theater")],
      [makeShowtime("s1", "NONEXISTENT", "t1", "2026-03-27T10:00")]
    );
    expect(buildScheduledShows(state)).toEqual([]);
  });

  it("skips a showtime with an invalid date string", () => {
    const state = makeState(
      [makeMovie("m1", "Movie", 120)],
      [makeTheater("t1", "Theater")],
      [makeShowtime("s1", "m1", "t1", "not-a-date")]
    );
    expect(buildScheduledShows(state)).toEqual([]);
  });

  it("computes correct startMs and endMs from runtime", () => {
    const state = makeState(
      [makeMovie("m1", "Movie", 90)],
      [makeTheater("t1", "Theater")],
      [makeShowtime("s1", "m1", "t1", "2026-03-27T10:00")]
    );
    const shows = buildScheduledShows(state);
    expect(shows).toHaveLength(1);
    const s = shows[0];
    expect(s.showtimeId).toBe("s1");
    expect(s.movieId).toBe("m1");
    expect(s.theaterId).toBe("t1");
    expect(s.endMs - s.startMs).toBe(90 * 60_000);
  });

  it("sorts shows by startMs ascending", () => {
    const state = makeState(
      [makeMovie("m1", "Movie", 90)],
      [makeTheater("t1", "Theater")],
      [
        makeShowtime("s2", "m1", "t1", "2026-03-27T14:00"),
        makeShowtime("s1", "m1", "t1", "2026-03-27T10:00"),
      ]
    );
    const shows = buildScheduledShows(state);
    expect(shows[0].showtimeId).toBe("s1");
    expect(shows[1].showtimeId).toBe("s2");
  });
});

// ---------------------------------------------------------------------------
// canTransition
// ---------------------------------------------------------------------------

describe("canTransition", () => {
  function show(startMs: number, endMs: number, theaterId = "t1"): ScheduledShow {
    return { showtimeId: uid("s"), movieId: "m1", theaterId, startMs, endMs };
  }

  const base = 1_000_000_000_000; // some arbitrary ms base

  it("returns ok=false when B starts before A", () => {
    const a = show(base + 1000, base + 2000);
    const b = show(base, base + 500);
    expect(canTransition(a, b, 20, 15).ok).toBe(false);
  });

  it("allows transition in same theater with no travel cost", () => {
    // A ends at base+100min, B starts at base+100min, same theater, leeway 20min
    const a = show(base, base + 100 * 60_000, "t1");
    const b = show(base + 100 * 60_000, base + 200 * 60_000, "t1");
    const result = canTransition(a, b, 20, 15);
    expect(result.ok).toBe(true);
    expect(result.travelAppliedMins).toBe(0);
  });

  it("adds travel time when switching theaters", () => {
    // A ends at base+100min, B starts at base+120min, different theaters, travel=15min
    // arriveDeadline = 120min + 20min = 140min; earliestArrival = 100min + 15min = 115min => ok
    const a = show(base, base + 100 * 60_000, "t1");
    const b = show(base + 120 * 60_000, base + 220 * 60_000, "t2");
    const result = canTransition(a, b, 20, 15);
    expect(result.ok).toBe(true);
    expect(result.travelAppliedMins).toBe(15);
  });

  it("blocks when cannot arrive in time even with leeway", () => {
    // A ends at base+100min, B starts at base+100min, different theaters, travel=30min, leeway=20min
    // arriveDeadline = 100min + 20min = 120min; earliestArrival = 100min + 30min = 130min => NOT ok
    const a = show(base, base + 100 * 60_000, "t1");
    const b = show(base + 100 * 60_000, base + 200 * 60_000, "t2");
    const result = canTransition(a, b, 20, 30);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sortItineraries
// ---------------------------------------------------------------------------

describe("sortItineraries", () => {
  function fakeItinerary(preferenceScore: number, movieCount: number, finishMs: number) {
    return {
      shows: [],
      preferenceScore,
      movieCount,
      finishMs,
      totalTravelMins: 0,
    };
  }

  it("sorts by preferenceScore descending first", () => {
    const its = [fakeItinerary(10, 1, 100), fakeItinerary(50, 1, 100), fakeItinerary(20, 1, 100)];
    const sorted = sortItineraries(its);
    expect(sorted.map(i => i.preferenceScore)).toEqual([50, 20, 10]);
  });

  it("breaks ties by movieCount descending", () => {
    const its = [fakeItinerary(10, 2, 100), fakeItinerary(10, 5, 100), fakeItinerary(10, 3, 100)];
    const sorted = sortItineraries(its);
    expect(sorted.map(i => i.movieCount)).toEqual([5, 3, 2]);
  });

  it("breaks further ties by finishMs ascending (earlier finish wins)", () => {
    const its = [fakeItinerary(10, 3, 300), fakeItinerary(10, 3, 100), fakeItinerary(10, 3, 200)];
    const sorted = sortItineraries(its);
    expect(sorted.map(i => i.finishMs)).toEqual([100, 200, 300]);
  });

  it("returns a new array and does not mutate the input", () => {
    const its = [fakeItinerary(10, 1, 100), fakeItinerary(50, 1, 100)];
    const original = [...its];
    sortItineraries(its);
    expect(its[0].preferenceScore).toBe(original[0].preferenceScore);
  });
});

// ---------------------------------------------------------------------------
// BUG 1: generateItineraries — single-day filter must exclude off-date shows
// ---------------------------------------------------------------------------

describe("generateItineraries — Bug 1: single-day filtering", () => {
  /*
   * Scenario:
   *  - Two movies: MovieA (90 min), MovieB (90 min)
   *  - One theater
   *  - Three showtimes:
   *      s1: MovieA  on 2026-03-27T10:00  (TARGET day)
   *      s2: MovieB  on 2026-03-27T13:00  (TARGET day, fits after s1)
   *      s3: MovieA  on 2026-03-28T10:00  (WRONG day)
   *  - Mode: single-day, selectedDate: "2026-03-27"
   *
   * BUG: With the bug, `initial` seeds from `shows` (all 3), so beam entries
   * carry s3. Then `shows[j]` (wrong array) can fetch the wrong element
   * when j indexes into filteredShows.
   *
   * EXPECTED (fixed): Every itinerary returned must only contain shows
   * that fall on 2026-03-27. s3 must never appear in any itinerary.
   */

  const movieA = makeMovie("mA", "Movie A", 90);
  const movieB = makeMovie("mB", "Movie B", 90);
  const theaterX = makeTheater("tX", "Theater X");

  const showtimeA_day1 = makeShowtime("s1", "mA", "tX", "2026-03-27T10:00");
  const showtimeB_day1 = makeShowtime("s2", "mB", "tX", "2026-03-27T13:00");
  const showtimeA_day2 = makeShowtime("s3", "mA", "tX", "2026-03-28T10:00"); // wrong day

  const state = makeState(
    [movieA, movieB],
    [theaterX],
    [showtimeA_day1, showtimeB_day1, showtimeA_day2],
    {
      itineraryMode: "single-day",
      selectedDate: "2026-03-27",
      trailerLeewayMins: 20,
      travelMins: 0,
      maxResults: 20,
      beamWidth: 200,
    }
  );

  it("does not include off-date showtimes in any itinerary", () => {
    const itineraries = generateItineraries(state);
    expect(itineraries.length).toBeGreaterThan(0);

    for (const itin of itineraries) {
      for (const show of itin.shows) {
        // The off-date showtime id must never appear
        expect(show.showtimeId).not.toBe("s3");
      }
    }
  });

  it("includes on-date showtimes in generated itineraries", () => {
    const itineraries = generateItineraries(state);

    const allShowtimeIds = new Set(itineraries.flatMap(i => i.shows.map(s => s.showtimeId)));
    // s1 and s2 must appear somewhere (they are valid for the selected date)
    expect(allShowtimeIds.has("s1")).toBe(true);
    expect(allShowtimeIds.has("s2")).toBe(true);
  });

  it("can build a two-movie itinerary from on-date shows", () => {
    const itineraries = generateItineraries(state);
    const twoMovieItin = itineraries.find(i => i.movieCount === 2);
    // s1 at 10:00, s2 at 13:00 — MovieA ends at 11:30, MovieB starts at 13:00 => fits
    expect(twoMovieItin).toBeDefined();
    if (twoMovieItin) {
      const ids = twoMovieItin.shows.map(s => s.showtimeId);
      expect(ids).toContain("s1");
      expect(ids).toContain("s2");
    }
  });

  it("returns empty array when no showtimes fall on the selected date", () => {
    const noMatchState = makeState(
      [movieA],
      [theaterX],
      [showtimeA_day2], // only wrong-day showtime
      {
        itineraryMode: "single-day",
        selectedDate: "2026-03-27",
        trailerLeewayMins: 20,
        travelMins: 0,
        maxResults: 20,
        beamWidth: 200,
      }
    );
    expect(generateItineraries(noMatchState)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BUG 1 (continued): index mismatch between shows[] and filteredShows[]
// ---------------------------------------------------------------------------

describe("generateItineraries — Bug 1: index coherence after filtering", () => {
  /*
   * Scenario designed to trigger the index-mismatch branch of the bug.
   *
   * Setup: shows sorted by startMs will be:
   *   idx in `shows`:         0=s_wrong, 1=s_day1_A, 2=s_day1_B
   *   idx in `filteredShows`: 0=s_day1_A, 1=s_day1_B
   *
   * The adjacency list `nexts` is built on filteredShows indices (0, 1).
   * But `shows[j]` uses the unfiltered array, so `shows[1]` === s_day1_A,
   * but `filteredShows[1]` === s_day1_B. The expansion step fetches the
   * WRONG show when the bug is present.
   *
   * With the bug fixed, shows fetched during expansion must match exactly
   * what filteredShows contains.
   */

  const movieA = makeMovie("mA", "Movie A", 90);
  const movieB = makeMovie("mB", "Movie B", 90);
  const theaterX = makeTheater("tX", "Theater X");

  // s_wrong is earliest overall (08:00 on WRONG date) — it lands at index 0 in sorted `shows`
  const s_wrong = makeShowtime("s_wrong", "mA", "tX", "2026-03-26T08:00"); // wrong day
  const s_day1_A = makeShowtime("s_day1_A", "mA", "tX", "2026-03-27T10:00");
  const s_day1_B = makeShowtime("s_day1_B", "mB", "tX", "2026-03-27T13:00");

  const state = makeState(
    [movieA, movieB],
    [theaterX],
    [s_wrong, s_day1_A, s_day1_B],
    {
      itineraryMode: "single-day",
      selectedDate: "2026-03-27",
      trailerLeewayMins: 20,
      travelMins: 0,
      maxResults: 20,
      beamWidth: 200,
    }
  );

  it("does not produce itineraries containing wrong-day shows", () => {
    const itineraries = generateItineraries(state);
    for (const itin of itineraries) {
      for (const show of itin.shows) {
        expect(show.showtimeId).not.toBe("s_wrong");
      }
    }
  });

  it("multi-show itinerary uses correct show objects (not index-shifted ones)", () => {
    const itineraries = generateItineraries(state);
    const two = itineraries.find(i => i.movieCount === 2);
    expect(two).toBeDefined();
    if (two) {
      // Both shows must be on the correct date
      for (const show of two.shows) {
        const d = new Date(show.startMs);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        expect(dateStr).toBe("2026-03-27");
      }
    }
  });

  it("does not watch the same movie twice in one itinerary", () => {
    const itineraries = generateItineraries(state);
    for (const itin of itineraries) {
      const movieIds = itin.shows.map(s => s.movieId);
      const unique = new Set(movieIds);
      expect(unique.size).toBe(movieIds.length);
    }
  });
});

// ---------------------------------------------------------------------------
// BUG 2: BeamEntry (formerly Partial) — type naming (structural test)
// ---------------------------------------------------------------------------

describe("generateItineraries — Bug 2: internal type naming does not conflict", () => {
  /*
   * TypeScript's built-in Partial<T> is a global utility type.
   * The local `type Partial` inside generateItineraries shadows it.
   * While this is a compile-time concern, we can write a runtime test
   * that ensures the function still works correctly and produces the
   * expected shaped output, proving no runtime confusion exists.
   *
   * The actual rename from `Partial` to `BeamEntry` is verified by the
   * build step (npm run build) and by reading the source.
   */

  it("generateItineraries returns Itinerary-shaped objects", () => {
    const state = makeState(
      [makeMovie("m1", "Film", 90)],
      [makeTheater("t1", "Cinema")],
      [makeShowtime("s1", "m1", "t1", "2026-03-27T10:00")],
      { itineraryMode: "multi-day", trailerLeewayMins: 20, travelMins: 0, maxResults: 5, beamWidth: 50 }
    );
    const its = generateItineraries(state);
    expect(its.length).toBeGreaterThan(0);
    for (const it of its) {
      expect(typeof it.preferenceScore).toBe("number");
      expect(typeof it.movieCount).toBe("number");
      expect(typeof it.finishMs).toBe("number");
      expect(typeof it.totalTravelMins).toBe("number");
      expect(Array.isArray(it.shows)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// generateItineraries — multi-day mode (regression guard)
// ---------------------------------------------------------------------------

describe("generateItineraries — multi-day mode", () => {
  it("includes showtimes from multiple days when mode is multi-day", () => {
    const movieA = makeMovie("mA", "Alpha", 90);
    const movieB = makeMovie("mB", "Beta", 90);
    const theaterX = makeTheater("tX", "X");

    const state = makeState(
      [movieA, movieB],
      [theaterX],
      [
        makeShowtime("s1", "mA", "tX", "2026-03-27T10:00"),
        makeShowtime("s2", "mB", "tX", "2026-03-28T10:00"),
      ],
      { itineraryMode: "multi-day", trailerLeewayMins: 20, travelMins: 0, maxResults: 20, beamWidth: 200 }
    );

    const itineraries = generateItineraries(state);
    expect(itineraries.length).toBeGreaterThan(0);

    const allIds = new Set(itineraries.flatMap(i => i.shows.map(s => s.showtimeId)));
    expect(allIds.has("s1")).toBe(true);
    expect(allIds.has("s2")).toBe(true);
  });

  it("returns empty when state has no showtimes at all", () => {
    const state = makeState(
      [makeMovie("m1", "Film", 90)],
      [makeTheater("t1", "Cinema")],
      [],
      { itineraryMode: "multi-day" }
    );
    expect(generateItineraries(state)).toEqual([]);
  });

  it("respects maxResults setting", () => {
    const movies = Array.from({ length: 5 }, (_, i) =>
      makeMovie(`m${i}`, `Movie ${i}`, 90)
    );
    const theater = makeTheater("t1", "Theater");
    const showtimes = movies.map((m, i) =>
      makeShowtime(`s${i}`, m.id, "t1", `2026-03-27T${String(10 + i * 2).padStart(2, "0")}:00`)
    );
    const state = makeState(movies, [theater], showtimes, {
      itineraryMode: "multi-day",
      maxResults: 3,
      trailerLeewayMins: 20,
      travelMins: 0,
      beamWidth: 200,
    });
    const itineraries = generateItineraries(state);
    expect(itineraries.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// buildDefaultState
// ---------------------------------------------------------------------------

describe("buildDefaultState", () => {
  it("returns a state with empty arrays", () => {
    const s = buildDefaultState();
    expect(s.movies).toEqual([]);
    expect(s.theaters).toEqual([]);
    expect(s.showtimes).toEqual([]);
  });

  it("includes sensible default settings", () => {
    const s = buildDefaultState();
    expect(s.settings.trailerLeewayMins).toBeGreaterThanOrEqual(0);
    expect(s.settings.travelMins).toBeGreaterThanOrEqual(0);
    expect(s.settings.maxResults).toBeGreaterThan(0);
    expect(s.settings.beamWidth).toBeGreaterThan(0);
    expect(["single-day", "multi-day"]).toContain(s.settings.itineraryMode);
  });
});
