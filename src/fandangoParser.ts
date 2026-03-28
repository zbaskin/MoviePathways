export interface ParsedShowtime {
  theater: string;
  startLocal: string; // "YYYY-MM-DDTHH:mm"
}

// Matches Fandango time format: "1:15p", "11:10a", "12:00p"
const TIME_RE = /^(\d{1,2}):(\d{2})([ap])$/;

// Matches the distance line that always follows a theater name: "1.36 mi"
const DISTANCE_RE = /^\d+\.\d+ mi$/;

function convertTime(timeStr: string, date: string): string {
  const m = timeStr.match(TIME_RE);
  if (!m) return "";

  let hours = parseInt(m[1], 10);
  const minutes = m[2];
  const period = m[3];

  // 12-hour → 24-hour conversion
  if (period === "p" && hours !== 12) hours += 12;
  if (period === "a" && hours === 12) hours = 0;

  return `${date}T${String(hours).padStart(2, "0")}:${minutes}`;
}

export function parseFandangoText(text: string, date: string): ParsedShowtime[] {
  if (!date) return [];

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const results: ParsedShowtime[] = [];
  let currentTheater: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] ?? "";

    // Theater detection: any non-time, non-distance line followed by a distance line
    if (DISTANCE_RE.test(nextLine) && !TIME_RE.test(line) && !DISTANCE_RE.test(line)) {
      currentTheater = line;
      continue;
    }

    // Time detection
    if (TIME_RE.test(line) && currentTheater) {
      const startLocal = convertTime(line, date);
      if (startLocal) results.push({ theater: currentTheater, startLocal });
    }
  }

  return results;
}
