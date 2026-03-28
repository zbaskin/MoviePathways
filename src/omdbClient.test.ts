import { vi, describe, it, expect, beforeEach } from "vitest";
import { searchOmdb, getOmdbMovie } from "./omdbClient";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => mockFetch.mockReset());

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSearchResponse(movies: { Title: string; Year: string; imdbID: string }[]) {
  return {
    ok: true,
    json: async () => ({ Response: "True", Search: movies }),
  };
}

function makeNotFoundResponse(error = "Movie not found!") {
  return {
    ok: true,
    json: async () => ({ Response: "False", Error: error }),
  };
}

function makeMovieResponse(overrides: Record<string, string> = {}) {
  return {
    ok: true,
    json: async () => ({
      Response: "True",
      Title: "Avengers: Doomsday",
      Year: "2026",
      imdbID: "tt123",
      Runtime: "149 min",
      ...overrides,
    }),
  };
}

// ── searchOmdb ────────────────────────────────────────────────────────────────

describe("searchOmdb", () => {
  it("returns parsed results on success", async () => {
    mockFetch.mockResolvedValueOnce(
      makeSearchResponse([
        { Title: "Avengers: Doomsday", Year: "2026", imdbID: "tt123" },
        { Title: "Avengers: Endgame", Year: "2019", imdbID: "tt456" },
      ])
    );

    const results = await searchOmdb("Avengers", "testkey");

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ title: "Avengers: Doomsday", year: "2026", imdbId: "tt123" });
    expect(results[1]).toEqual({ title: "Avengers: Endgame", year: "2019", imdbId: "tt456" });
  });

  it("includes the api key and query in the request URL", async () => {
    mockFetch.mockResolvedValueOnce(makeSearchResponse([]));
    await searchOmdb("inception", "mykey");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("s=inception");
    expect(url).toContain("apikey=mykey");
  });

  it("returns empty array when OMDB reports no results", async () => {
    mockFetch.mockResolvedValueOnce(makeNotFoundResponse());
    expect(await searchOmdb("xyznotamovie", "key")).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    expect(await searchOmdb("inception", "key")).toEqual([]);
  });

  it("returns empty array on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    expect(await searchOmdb("inception", "key")).toEqual([]);
  });

  it("returns empty array when query is empty", async () => {
    expect(await searchOmdb("", "key")).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array when apiKey is empty", async () => {
    expect(await searchOmdb("inception", "")).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── getOmdbMovie ──────────────────────────────────────────────────────────────

describe("getOmdbMovie", () => {
  it("returns movie with parsed runtime", async () => {
    mockFetch.mockResolvedValueOnce(makeMovieResponse({ Runtime: "149 min" }));

    const result = await getOmdbMovie("Avengers: Doomsday", "key");

    expect(result).toEqual({
      title: "Avengers: Doomsday",
      year: "2026",
      imdbId: "tt123",
      runtimeMins: 149,
    });
  });

  it("includes the api key and title in the request URL", async () => {
    mockFetch.mockResolvedValueOnce(makeMovieResponse());
    await getOmdbMovie("Inception", "mykey");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("t=Inception");
    expect(url).toContain("apikey=mykey");
  });

  it("returns runtimeMins: null when runtime is N/A", async () => {
    mockFetch.mockResolvedValueOnce(makeMovieResponse({ Runtime: "N/A" }));
    const result = await getOmdbMovie("some doc", "key");
    expect(result?.runtimeMins).toBeNull();
  });

  it("returns runtimeMins: null when runtime is missing", async () => {
    mockFetch.mockResolvedValueOnce(makeMovieResponse({ Runtime: "" }));
    const result = await getOmdbMovie("some doc", "key");
    expect(result?.runtimeMins).toBeNull();
  });

  it("returns null when movie not found", async () => {
    mockFetch.mockResolvedValueOnce(makeNotFoundResponse());
    expect(await getOmdbMovie("xyznotreal", "key")).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    expect(await getOmdbMovie("Inception", "key")).toBeNull();
  });

  it("returns null on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    expect(await getOmdbMovie("Inception", "key")).toBeNull();
  });

  it("returns null when title is empty", async () => {
    expect(await getOmdbMovie("", "key")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when apiKey is empty", async () => {
    expect(await getOmdbMovie("Inception", "")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
