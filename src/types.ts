export type Id = string;

export type Movie = {
  id: Id;
  title: string;
  runtimeMins: number;
  // Optional: lower rank = more preferred (1 is best). undefined => unranked.
  rank?: number;
};

export type Theater = {
  id: Id;
  name: string;
};

export type Showtime = {
  id: Id;
  movieId: Id;
  theaterId: Id;
  // ISO string, but we’ll store as "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
  startLocal: string;
};

export type Settings = {
  trailerLeewayMins: number; // X
  travelMins: number;        // T, used only when switching theaters
  maxResults: number;        // K
  beamWidth: number;         // internal
};

export type AppState = {
  settings: Settings;
  movies: Movie[];
  theaters: Theater[];
  showtimes: Showtime[];
};

export type ScheduledShow = {
  showtimeId: Id;
  movieId: Id;
  theaterId: Id;
  startMs: number;
  endMs: number;
};

export type Itinerary = {
  shows: ScheduledShow[];
  preferenceScore: number;
  movieCount: number;
  finishMs: number;
  totalTravelMins: number;
};
