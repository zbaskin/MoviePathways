import { useEffect, useMemo, useState } from "react";
import type { AppState, Movie, Theater, Showtime } from "./types";
import { buildDefaultState, clampInt, formatDate, formatTime, generateItineraries, uid } from "./utils";

const STORAGE_KEY = "movie_pathways_state_v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultState();
    const parsed = JSON.parse(raw) as AppState;
    // Light validation + fallback
    return {
      ...buildDefaultState(),
      ...parsed,
      settings: { ...buildDefaultState().settings, ...(parsed.settings || {}) },
      movies: Array.isArray(parsed.movies) ? parsed.movies : [],
      theaters: Array.isArray(parsed.theaters) ? parsed.theaters : [],
      showtimes: Array.isArray(parsed.showtimes) ? parsed.showtimes : [],
    };
  } catch {
    return buildDefaultState();
  }
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => saveState(state), [state]);

  const movieById = useMemo(() => new Map(state.movies.map(m => [m.id, m])), [state.movies]);
  const theaterById = useMemo(() => new Map(state.theaters.map(t => [t.id, t])), [state.theaters]);

  const itineraries = useMemo(() => generateItineraries(state), [state]);

  function updateSettings(partial: Partial<AppState["settings"]>) {
    setState(s => ({ ...s, settings: { ...s.settings, ...partial } }));
  }

  function addMovie(title: string, runtimeMins: number) {
    const m: Movie = { id: uid("mov"), title: title.trim(), runtimeMins: clampInt(runtimeMins, 1, 600) };
    setState(s => ({ ...s, movies: [...s.movies, m] }));
  }

  function updateMovie(id: string, patch: Partial<Movie>) {
    setState(s => ({
      ...s,
      movies: s.movies.map(m => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function deleteMovie(id: string) {
    setState(s => ({
      ...s,
      movies: s.movies.filter(m => m.id !== id),
      showtimes: s.showtimes.filter(st => st.movieId !== id),
    }));
  }

  function addTheater(name: string) {
    const t: Theater = { id: uid("the"), name: name.trim() };
    setState(s => ({ ...s, theaters: [...s.theaters, t] }));
  }

  function updateTheater(id: string, patch: Partial<Theater>) {
    setState(s => ({
      ...s,
      theaters: s.theaters.map(t => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  function deleteTheater(id: string) {
    setState(s => ({
      ...s,
      theaters: s.theaters.filter(t => t.id !== id),
      showtimes: s.showtimes.filter(st => st.theaterId !== id),
    }));
  }

  function addShowtime(movieId: string, theaterId: string, startLocal: string) {
    const st: Showtime = { id: uid("sho"), movieId, theaterId, startLocal };
    setState(s => ({ ...s, showtimes: [...s.showtimes, st] }));
  }

  function updateShowtime(id: string, patch: Partial<Showtime>) {
    setState(s => ({
      ...s,
      showtimes: s.showtimes.map(st => (st.id === id ? { ...st, ...patch } : st)),
    }));
  }

  function deleteShowtime(id: string) {
    setState(s => ({ ...s, showtimes: s.showtimes.filter(st => st.id !== id) }));
  }

  function resetAll() {
    setState(buildDefaultState());
  }

  return (
    <div className="container">
      <h1>Movie Pathways</h1>

      <div className="row">
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <h2>Settings</h2>
          <div className="row">
            <div className="col">
              <label>Trailer leeway X (mins)</label>
              <input
                type="number"
                min={0}
                max={60}
                value={state.settings.trailerLeewayMins}
                onChange={(e) => updateSettings({ trailerLeewayMins: clampInt(Number(e.target.value), 0, 120) })}
              />
              <small>You can arrive up to X minutes after posted start.</small>
            </div>

            <div className="col">
              <label>Travel time T (mins)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={state.settings.travelMins}
                onChange={(e) => updateSettings({ travelMins: clampInt(Number(e.target.value), 0, 240) })}
              />
              <small>Applies only when switching theaters.</small>
            </div>

            <div className="col">
              <label>Max results</label>
              <input
                type="number"
                min={1}
                max={200}
                value={state.settings.maxResults}
                onChange={(e) => updateSettings({ maxResults: clampInt(Number(e.target.value), 1, 200) })}
              />
            </div>

            <div className="col">
              <label>Beam width (advanced)</label>
              <input
                type="number"
                min={50}
                max={2000}
                value={state.settings.beamWidth}
                onChange={(e) => updateSettings({ beamWidth: clampInt(Number(e.target.value), 50, 5000) })}
              />
              <small>Bigger = more thorough, slower.</small>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="danger" onClick={resetAll}>Reset all data</button>
          </div>
        </div>

        <TheatersCard
          theaters={state.theaters}
          onAdd={addTheater}
          onUpdate={updateTheater}
          onDelete={deleteTheater}
        />

        <MoviesCard
          movies={state.movies}
          onAdd={addMovie}
          onUpdate={updateMovie}
          onDelete={deleteMovie}
        />

      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <ShowtimesCard
          movies={state.movies}
          theaters={state.theaters}
          showtimes={state.showtimes}
          onAdd={addShowtime}
          onUpdate={updateShowtime}
          onDelete={deleteShowtime}
        />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <h2>Results</h2>
          <small>
            Sorted by preference score, then movie count, then earliest finish.
            {state.movies.some(m => m.rank != null)
              ? " (You have ranked movies.)"
              : " (No rankings set: prioritizing max movie count.)"}
          </small>

          <div style={{ marginTop: 12 }} className="itin">
            {itineraries.length === 0 ? (
              <div className="muted">Add movies, theaters, and showtimes to generate itineraries.</div>
            ) : (
              itineraries.map((it, idx) => {
                const first = it.shows[0];
                const last = it.shows[it.shows.length - 1];
                return (
                  <div key={idx} className="itin-item">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="badge">{it.movieCount} movies</span>
                        <span className="badge">pref: {it.preferenceScore}</span>
                        <span className="badge">travel: {it.totalTravelMins}m</span>
                      </div>
                      <div className="muted">
                        {formatDate(first.startMs)} • {formatTime(first.startMs)} → {formatTime(last.endMs)}
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }} className="itin">
                      {it.shows.map((s, i) => {
                        const movie = movieById.get(s.movieId);
                        const theater = theaterById.get(s.theaterId);
                        const title = movie?.title ?? "Unknown movie";
                        const th = theater?.name ?? "Unknown theater";
                        return (
                          <div key={s.showtimeId} className="itin-item" style={{ borderStyle: "dashed" }}>
                            <div style={{ fontWeight: 650 }}>{title}</div>
                            <div className="muted">
                              {th} • {formatTime(s.startMs)}–{formatTime(s.endMs)}
                              {" • "}posted {formatTime(s.startMs)}
                              {state.settings.trailerLeewayMins > 0
                                ? ` (arrive by ${formatTime(s.startMs + state.settings.trailerLeewayMins * 60_000)})`
                                : ""}
                            </div>
                            {i < it.shows.length - 1 ? (
                              <div className="muted">
                                Next: {it.shows[i].theaterId === it.shows[i + 1].theaterId
                                  ? "same theater (0m travel)"
                                  : `switch theaters (+${state.settings.travelMins}m travel)`}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MoviesCard(props: {
  movies: Movie[];
  onAdd: (title: string, runtimeMins: number) => void;
  onUpdate: (id: string, patch: Partial<Movie>) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [runtime, setRuntime] = useState<number>(120);

  return (
    <div className="card" style={{ flex: 1, minWidth: 320 }}>
      <h2>Movies</h2>

      <div className="row">
        <div className="col" style={{ flex: 1 }}>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Howl's Moving Castle" />
        </div>
        <div className="col" style={{ width: 140 }}>
          <label>Runtime (mins)</label>
          <input
            type="number"
            min={1}
            max={600}
            value={runtime}
            onChange={(e) => setRuntime(clampInt(Number(e.target.value), 1, 600))}
          />
        </div>
        <button
          onClick={() => {
            if (!title.trim()) return;
            props.onAdd(title, runtime);
            setTitle("");
          }}
        >
          Add
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Title</th>
              <th style={{ width: 90 }}>Runtime</th>
              <th style={{ width: 120 }}>Rank (1=best)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {props.movies.length === 0 ? (
              <tr><td colSpan={4} className="muted">No movies yet.</td></tr>
            ) : (
              props.movies.map(m => (
                <tr key={m.id}>
                  <td>
                    <input
                      value={m.title}
                      onChange={(e) => props.onUpdate(m.id, { title: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={m.runtimeMins}
                      onChange={(e) => props.onUpdate(m.id, { runtimeMins: clampInt(Number(e.target.value), 1, 600) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={m.rank ?? ""}
                      placeholder="(none)"
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        props.onUpdate(m.id, { rank: v === "" ? undefined : clampInt(Number(v), 1, 9999) });
                      }}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="secondary" onClick={() => props.onDelete(m.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <small>
          If you set any ranks, results prioritize ranked movies. If none are ranked, results prioritize max movie count.
        </small>
      </div>
    </div>
  );
}

function TheatersCard(props: {
  theaters: Theater[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, patch: Partial<Theater>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="card" style={{ flex: 1, minWidth: 280 }}>
      <h2>Theaters</h2>

      <div className="row">
        <div className="col" style={{ flex: 1 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., AMC Lincoln Square 13" />
        </div>
        <button
          onClick={() => {
            if (!name.trim()) return;
            props.onAdd(name);
            setName("");
          }}
        >
          Add
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {props.theaters.length === 0 ? (
              <tr><td colSpan={2} className="muted">No theaters yet.</td></tr>
            ) : (
              props.theaters.map(t => (
                <tr key={t.id}>
                  <td>
                    <input
                      value={t.name}
                      onChange={(e) => props.onUpdate(t.id, { name: e.target.value })}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="secondary" onClick={() => props.onDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <small>Deleting a theater removes any showtimes assigned to it.</small>
      </div>
    </div>
  );
}

function ShowtimesCard(props: {
  movies: Movie[];
  theaters: Theater[];
  showtimes: Showtime[];
  onAdd: (movieId: string, theaterId: string, startLocal: string) => void;
  onUpdate: (id: string, patch: Partial<Showtime>) => void;
  onDelete: (id: string) => void;
}) {
  const [movieId, setMovieId] = useState<string>("");
  const [theaterId, setTheaterId] = useState<string>("");
  const [startLocal, setStartLocal] = useState<string>("");

  useEffect(() => {
    if (!movieId && props.movies[0]) setMovieId(props.movies[0].id);
  }, [props.movies, movieId]);

  useEffect(() => {
    if (!theaterId && props.theaters[0]) setTheaterId(props.theaters[0].id);
  }, [props.theaters, theaterId]);

  return (
    <div className="card" style={{ flex: 1 }}>
      <h2>Showtimes</h2>

      <div className="row">
        <div className="col" style={{ minWidth: 220, flex: 1 }}>
          <label>Movie</label>
          <select value={movieId} onChange={(e) => setMovieId(e.target.value)} disabled={props.movies.length === 0}>
            {props.movies.length === 0 ? (
              <option value="">Add a movie first</option>
            ) : (
              props.movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)
            )}
          </select>
        </div>

        <div className="col" style={{ minWidth: 220, flex: 1 }}>
          <label>Theater</label>
          <select value={theaterId} onChange={(e) => setTheaterId(e.target.value)} disabled={props.theaters.length === 0}>
            {props.theaters.length === 0 ? (
              <option value="">Add a theater first</option>
            ) : (
              props.theaters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
            )}
          </select>
        </div>

        <div className="col" style={{ minWidth: 260 }}>
          <label>Start (local)</label>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
          />
        </div>

        <button
          onClick={() => {
            if (!movieId || !theaterId || !startLocal) return;
            props.onAdd(movieId, theaterId, startLocal);
          }}
          disabled={!movieId || !theaterId || !startLocal}
        >
          Add
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "35%" }}>Movie</th>
              <th style={{ width: "35%" }}>Theater</th>
              <th>Start</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {props.showtimes.length === 0 ? (
              <tr><td colSpan={4} className="muted">No showtimes yet.</td></tr>
            ) : (
              props.showtimes
                .slice()
                .sort((a, b) => (a.startLocal < b.startLocal ? -1 : 1))
                .map(st => (
                  <tr key={st.id}>
                    <td>
                      <select
                        value={st.movieId}
                        onChange={(e) => props.onUpdate(st.id, { movieId: e.target.value })}
                      >
                        {props.movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        value={st.theaterId}
                        onChange={(e) => props.onUpdate(st.id, { theaterId: e.target.value })}
                      >
                        {props.theaters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="datetime-local"
                        value={st.startLocal}
                        onChange={(e) => props.onUpdate(st.id, { startLocal: e.target.value })}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="secondary" onClick={() => props.onDelete(st.id)}>Delete</button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>

        <small>
          Tip: keep showtimes for a single day if you want “one-day itineraries”. Multi-day input will produce multi-day paths.
        </small>
      </div>
    </div>
  );
}
