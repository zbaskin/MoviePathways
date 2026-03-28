export interface OmdbResult {
  title: string;
  year: string;
  imdbId: string;
}

export interface OmdbMovie extends OmdbResult {
  runtimeMins: number | null;
}

const BASE = "https://www.omdbapi.com/";

function parseRuntime(raw: string): number | null {
  const match = raw?.match(/^(\d+)\s*min/);
  return match ? parseInt(match[1], 10) : null;
}

export async function searchOmdb(query: string, apiKey: string): Promise<OmdbResult[]> {
  if (!query || !apiKey) return [];
  try {
    const url = `${BASE}?s=${encodeURIComponent(query)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.Response !== "True" || !Array.isArray(data.Search)) return [];
    return data.Search.map((m: { Title: string; Year: string; imdbID: string }) => ({
      title: m.Title,
      year: m.Year,
      imdbId: m.imdbID,
    }));
  } catch {
    return [];
  }
}

export async function getOmdbMovie(title: string, apiKey: string): Promise<OmdbMovie | null> {
  if (!title || !apiKey) return null;
  try {
    const url = `${BASE}?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response !== "True") return null;
    return {
      title: data.Title,
      year: data.Year,
      imdbId: data.imdbID,
      runtimeMins: parseRuntime(data.Runtime),
    };
  } catch {
    return null;
  }
}
