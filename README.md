# Movie Pathways

Movie Pathways is a small React + TypeScript web app that helps you plan “full day at the theater” marathons. Enter movies (with runtimes), theaters, and showtimes, then generate feasible itineraries that chain multiple movies together.

It accounts for:
- **Fixed travel time** when switching theaters (0 minutes if staying in the same theater)
- **Trailer leeway (X minutes)** so you can arrive up to `X` minutes after the posted start time and still consider the showing “catchable”
- **Optional movie preference ranking** to push your must-sees to the top

If no preferences are set, the app prioritizes itineraries with the **maximum number of movies**.

---

## Features

- Add/edit/delete **Movies** (title, runtime, optional rank)
- Add/edit/delete **Theaters**
- Add/edit/delete **Showtimes** (movie + theater + datetime)
- Configure:
  - **Trailer leeway (X minutes)**
  - **Fixed travel time (T minutes)**
  - **Max results** (how many itineraries to return)
  - **Beam width** (advanced: search thoroughness vs. speed)
- Generates and ranks itineraries by:
  1. **Preference score** (if any movies are ranked)
  2. **Movie count**
  3. **Earliest finish time**
- Persists data in **LocalStorage** (so you don’t lose your entries on refresh)

---

## How it works (scheduling rules)

Each showtime has:
- `start` (posted start time)
- `end = start + runtime`

A transition from showtime **A → B** is valid if:

- Travel time is **0** when staying in the same theater, otherwise **T**
- You can arrive up to `X` minutes after `B.start`

So A → B is allowed when:

`A.end + travelTime(A, B) <= B.start + X`

This models “I can show up a bit late because trailers exist.”

**Note:** In the current MVP, arriving late does *not* push the movie end time later. End time is still computed from the posted start time. (This matches the model of catching a movie after it begins.)

---

## Tech stack

- React
- TypeScript
- Vite

---

## Getting started

### Prerequisites
- Node.js (recommended: current LTS)

### Install & run

```bash
npm install
npm run dev
