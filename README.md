# Vouchr Pathways

A React + TypeScript web app that helps you plan "full day at the theater" marathons. Enter movies (with runtimes), theaters, and showtimes, then generate feasible itineraries that chain multiple movies together.

It accounts for:
- **Fixed travel time** when switching theaters (0 minutes if staying in the same theater)
- **Trailer leeway (X minutes)** so you can arrive up to `X` minutes after the posted start time and still consider the showing "catchable"
- **Optional movie preference ranking** to push your must-sees to the top
- **One-day or multi-day mode** to plan a single date or span multiple days

If no preferences are set, the app prioritizes itineraries with the **maximum number of movies**.

---

## Features

- Add/edit/delete **Movies** (title, runtime, optional rank)
- Add/edit/delete **Theaters**
- Add/edit/delete **Showtimes** (movie + theater + start time)
- **One-day mode** — pick a date; showtime inputs become time-only
- **Multi-day mode** — enter full date-time for each showtime
- Configure via Settings:
  - **Trailer leeway (X minutes)**
  - **Fixed travel time (T minutes)**
  - **Max results** (how many itineraries to return)
  - **Beam width** (advanced: search thoroughness vs. speed)
- Generates and ranks itineraries by:
  1. **Preference score** (if any movies are ranked)
  2. **Movie count**
  3. **Earliest finish time**
- Persists data in **localStorage** (no data lost on refresh)

---

## How it works (scheduling rules)

Each showtime has:
- `start` (posted start time)
- `end = start + runtime`

A transition from showtime **A → B** is valid if:

- Travel time is **0** when staying in the same theater, otherwise **T**
- You can arrive up to `X` minutes after `B.start`

So A → B is allowed when:

```
A.end + travelTime(A, B) <= B.start + X
```

This models "I can show up a bit late because trailers exist."

**Note:** Arriving late does *not* push the movie end time later — end time is always computed from the posted start time.

---

## Tech stack

- **React** + **TypeScript**
- **Vite** (build tool)
- **lucide-react** (icons)
- **Vitest** (unit tests)

---

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

---

## Testing

The core itinerary algorithm is covered by a Vitest test suite.

```bash
npm run test          # run all tests once
npm run test:watch    # re-run on file changes
npm run test:coverage # run with coverage report
```
