import { useEffect, useMemo, useState } from "react";
import { Film, MapPin, Clock, Route, Plus, Trash2, Settings2, X } from "lucide-react";
import type { AppState, Movie, Theater, Showtime } from "./types";
import { buildDefaultState, clampInt, formatDate, formatTime, generateItineraries, uid } from "./utils";

const STORAGE_KEY = "movie_pathways_state_v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultState();
    const parsed = JSON.parse(raw) as AppState;
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSettingsOpen(false);
    }
    if (settingsOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

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
    setState(s => ({ ...s, movies: s.movies.map(m => (m.id === id ? { ...m, ...patch } : m)) }));
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
    setState(s => ({ ...s, theaters: s.theaters.map(t => (t.id === id ? { ...t, ...patch } : t)) }));
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
    setState(s => ({ ...s, showtimes: s.showtimes.map(st => (st.id === id ? { ...st, ...patch } : st)) }));
  }

  function deleteShowtime(id: string) {
    setState(s => ({ ...s, showtimes: s.showtimes.filter(st => st.id !== id) }));
  }

  function resetAll() {
    setState(buildDefaultState());
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <img src="/src/assets/red-logo.png" className="navbar-logo" alt="" />
          <span className="navbar-title">
            Movie <span className="navbar-title-accent">Pathways</span>
          </span>
        </div>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
          <Settings2 size={18} />
        </button>
      </nav>

      <div className="container">
        {settingsOpen && (
          <>
            <div className="overlayBackdrop" onClick={() => setSettingsOpen(false)} aria-hidden="true" />
            <div
              className="settingsPanel"
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panelHeader">
                <div className="panelTitle">Settings</div>
                <button className="icon-btn" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                  <X size={16} />
                </button>
              </div>

              <div className="settings-grid">
                <div className="settings-row">
                  <label>Itinerary mode</label>
                  <select
                    value={state.settings.itineraryMode}
                    onChange={(e) => updateSettings({ itineraryMode: e.target.value as "single-day" | "multi-day" })}
                  >
                    <option value="single-day">One-day</option>
                    <option value="multi-day">Multi-day</option>
                  </select>
                </div>

                {state.settings.itineraryMode === "single-day" && (
                  <div className="settings-row">
                    <label>Selected day</label>
                    <input
                      type="date"
                      value={state.settings.selectedDate}
                      onChange={(e) => updateSettings({ selectedDate: e.target.value })}
                    />
                    <small>Showtime inputs become time-only.</small>
                  </div>
                )}

                <div className="settings-row">
                  <label>Trailer leeway (mins)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={state.settings.trailerLeewayMins}
                    onChange={(e) => updateSettings({ trailerLeewayMins: clampInt(Number(e.target.value), 0, 120) })}
                  />
                  <small>You can arrive up to this many minutes after the posted start.</small>
                </div>

                <div className="settings-row">
                  <label>Travel time (mins)</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={state.settings.travelMins}
                    onChange={(e) => updateSettings({ travelMins: clampInt(Number(e.target.value), 0, 240) })}
                  />
                  <small>Applies only when switching theaters.</small>
                </div>

                <div className="settings-row">
                  <label>Max results</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={state.settings.maxResults}
                    onChange={(e) => updateSettings({ maxResults: clampInt(Number(e.target.value), 1, 200) })}
                  />
                </div>

                <div className="settings-row">
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

                <div>
                  <button className="danger" onClick={resetAll}>Reset all data</button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="top-grid">
          <MoviesCard
            movies={state.movies}
            onAdd={addMovie}
            onUpdate={updateMovie}
            onDelete={deleteMovie}
          />
          <TheatersCard
            theaters={state.theaters}
            onAdd={addTheater}
            onUpdate={updateTheater}
            onDelete={deleteTheater}
          />
        </div>

        <ShowtimesCard
          movies={state.movies}
          theaters={state.theaters}
          showtimes={state.showtimes}
          onAdd={addShowtime}
          onUpdate={updateShowtime}
          onDelete={deleteShowtime}
          mode={state.settings.itineraryMode}
          selectedDate={state.settings.selectedDate}
        />

        <div className="card">
          <div className="card-header">
            <Route size={16} className="card-header-icon" />
            <h2 className="card-title">Results</h2>
          </div>

          <p className="results-hint">
            Sorted by preference score, then movie count, then earliest finish.
            {state.movies.some(m => m.rank != null)
              ? " Ranked movies are prioritized."
              : " No rankings set — prioritizing max movie count."}
          </p>

          <div className="itin">
            {itineraries.length === 0 ? (
              <div className="results-empty">
                <Route size={32} style={{ opacity: 0.2 }} />
                <div className="empty-state-text">No itineraries yet</div>
                <div className="results-steps">
                  <div className="results-step"><span className="results-step-num">1</span>Add movies</div>
                  <div className="results-step"><span className="results-step-num">2</span>Add theaters</div>
                  <div className="results-step"><span className="results-step-num">3</span>Add showtimes</div>
                  <div className="results-step"><span className="results-step-num">4</span>See paths</div>
                </div>
              </div>
            ) : (
              itineraries.map((it, idx) => {
                const first = it.shows[0];
                const last = it.shows[it.shows.length - 1];
                return (
                  <div key={idx} className="itin-card">
                    <div className="itin-card-header">
                      <div className="itin-card-left">
                        <div className="itin-rank">#{idx + 1}</div>
                        <span className="badge badge-accent">{it.movieCount} movies</span>
                        <span className="badge badge-blue">score: {it.preferenceScore}</span>
                        <span className="badge badge-default">travel: {it.totalTravelMins}m</span>
                      </div>
                      <div className="itin-meta">
                        {formatDate(first.startMs)} · {formatTime(first.startMs)} → {formatTime(last.endMs)}
                      </div>
                    </div>

                    <div className="itin-timeline">
                      {it.shows.map((s, i) => {
                        const movie = movieById.get(s.movieId);
                        const theater = theaterById.get(s.theaterId);
                        const title = movie?.title ?? "Unknown movie";
                        const th = theater?.name ?? "Unknown theater";
                        const sameTheaterNext =
                          i < it.shows.length - 1 &&
                          it.shows[i].theaterId === it.shows[i + 1].theaterId;
                        return (
                          <div key={s.showtimeId} className="itin-timeline-item">
                            <div className="itin-show-title">{title}</div>
                            <div className="itin-show-detail">
                              {th} · {formatTime(s.startMs)}–{formatTime(s.endMs)}
                              {state.settings.trailerLeewayMins > 0
                                ? ` · arrive by ${formatTime(s.startMs + state.settings.trailerLeewayMins * 60_000)}`
                                : ""}
                            </div>
                            {i < it.shows.length - 1 && (
                              <div className="itin-travel-note">
                                {sameTheaterNext ? "Same theater" : `+${state.settings.travelMins}m travel`}
                              </div>
                            )}
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
    </>
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

  function handleAdd() {
    if (!title.trim()) return;
    props.onAdd(title, runtime);
    setTitle("");
  }

  return (
    <div className="card cardFixed">
      <div className="card-header">
        <Film size={16} className="card-header-icon" />
        <h2 className="card-title">Movies</h2>
      </div>

      <div className="add-form">
        <div className="col" style={{ flex: 1 }}>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="e.g., Howl's Moving Castle"
          />
        </div>
        <div className="col" style={{ width: 120 }}>
          <label>Runtime (mins)</label>
          <input
            type="number"
            min={1}
            max={600}
            value={runtime}
            onChange={(e) => setRuntime(clampInt(Number(e.target.value), 1, 600))}
          />
        </div>
        <button onClick={handleAdd} style={{ alignSelf: "flex-end" }}>
          <Plus size={14} />Add
        </button>
      </div>

      <div className="cardBodyScroll">
        {props.movies.length === 0 ? (
          <div className="empty-state">
            <Film size={28} className="empty-state-icon" />
            <div className="empty-state-text">No movies added yet</div>
            <div className="empty-state-hint">Add your first movie above</div>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Title</th>
                  <th style={{ width: 80 }}>Mins</th>
                  <th style={{ width: 90 }}>Rank</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {props.movies.map(m => (
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
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          props.onUpdate(m.id, { rank: v === "" ? undefined : clampInt(Number(v), 1, 9999) });
                        }}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="icon-btn danger-icon"
                        onClick={() => props.onDelete(m.id)}
                        aria-label="Delete movie"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small style={{ display: "block", marginTop: 8 }}>
              Ranks prioritize movies in results. Lower number = higher priority.
            </small>
          </>
        )}
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

  function handleAdd() {
    if (!name.trim()) return;
    props.onAdd(name);
    setName("");
  }

  return (
    <div className="card cardFixed">
      <div className="card-header">
        <MapPin size={16} className="card-header-icon" />
        <h2 className="card-title">Theaters</h2>
      </div>

      <div className="add-form">
        <div className="col" style={{ flex: 1 }}>
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="e.g., AMC Lincoln Square 13"
          />
        </div>
        <button onClick={handleAdd} style={{ alignSelf: "flex-end" }}>
          <Plus size={14} />Add
        </button>
      </div>

      <div className="cardBodyScroll">
        {props.theaters.length === 0 ? (
          <div className="empty-state">
            <MapPin size={28} className="empty-state-icon" />
            <div className="empty-state-text">No theaters added yet</div>
            <div className="empty-state-hint">Add your first theater above</div>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {props.theaters.map(t => (
                  <tr key={t.id}>
                    <td>
                      <input
                        value={t.name}
                        onChange={(e) => props.onUpdate(t.id, { name: e.target.value })}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="icon-btn danger-icon"
                        onClick={() => props.onDelete(t.id)}
                        aria-label="Delete theater"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small style={{ display: "block", marginTop: 8 }}>
              Deleting a theater removes its showtimes.
            </small>
          </>
        )}
      </div>
    </div>
  );
}

function ShowtimesCard(props: {
  mode: "single-day" | "multi-day";
  selectedDate: string;
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

  function timeFromStartLocal(sl: string): string {
    const tIndex = sl.indexOf("T");
    return tIndex >= 0 ? sl.slice(tIndex + 1) : "";
  }

  function combineDateAndTime(date: string, time: string): string {
    if (!date || !time) return "";
    return `${date}T${time}`;
  }

  function handleAdd() {
    if (!movieId || !theaterId || !startLocal) return;
    const normalized =
      props.mode === "single-day"
        ? combineDateAndTime(props.selectedDate, startLocal)
        : startLocal;
    if (!normalized) return;
    props.onAdd(movieId, theaterId, normalized);
  }

  return (
    <div className="card cardFixed">
      <div className="card-header">
        <Clock size={16} className="card-header-icon" />
        <h2 className="card-title">Showtimes</h2>
      </div>

      <div className="add-form">
        <div className="col" style={{ minWidth: 160, flex: 1 }}>
          <label>Movie</label>
          <select value={movieId} onChange={(e) => setMovieId(e.target.value)} disabled={props.movies.length === 0}>
            {props.movies.length === 0
              ? <option value="">Add a movie first</option>
              : props.movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)
            }
          </select>
        </div>

        <div className="col" style={{ minWidth: 160, flex: 1 }}>
          <label>Theater</label>
          <select value={theaterId} onChange={(e) => setTheaterId(e.target.value)} disabled={props.theaters.length === 0}>
            {props.theaters.length === 0
              ? <option value="">Add a theater first</option>
              : props.theaters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
            }
          </select>
        </div>

        <div className="col" style={{ minWidth: 160 }}>
          <label>Start time</label>
          {props.mode === "single-day" ? (
            <input type="time" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          ) : (
            <input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          )}
        </div>

        <button
          onClick={handleAdd}
          disabled={!movieId || !theaterId || !startLocal || (props.mode === "single-day" && !props.selectedDate)}
          style={{ alignSelf: "flex-end" }}
        >
          <Plus size={14} />Add
        </button>
      </div>

      <div className="cardBodyScroll">
        {props.showtimes.length === 0 ? (
          <div className="empty-state">
            <Clock size={28} className="empty-state-icon" />
            <div className="empty-state-text">No showtimes added yet</div>
            <div className="empty-state-hint">Select a movie, theater, and time above</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "35%" }}>Movie</th>
                <th style={{ width: "35%" }}>Theater</th>
                <th>Start</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {props.showtimes
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
                      {props.mode === "single-day" ? (
                        <input
                          type="time"
                          value={timeFromStartLocal(st.startLocal)}
                          onChange={(e) => {
                            const normalized = combineDateAndTime(props.selectedDate, e.target.value);
                            if (!normalized) return;
                            props.onUpdate(st.id, { startLocal: normalized });
                          }}
                          disabled={!props.selectedDate}
                        />
                      ) : (
                        <input
                          type="datetime-local"
                          value={st.startLocal}
                          onChange={(e) => props.onUpdate(st.id, { startLocal: e.target.value })}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="icon-btn danger-icon"
                        onClick={() => props.onDelete(st.id)}
                        aria-label="Delete showtime"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
