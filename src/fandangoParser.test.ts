import { describe, it, expect } from "vitest";
import { parseFandangoText } from "./fandangoParser";

// Exact text from a real Fandango paste (movie already selected on Fandango's side)
const FANDANGO_EXAMPLE = `AMC Headquarters 10
1.36 mi

Order Food and Drinks
Remove this theater from my favorites
Standard

Laser at AMC, Reserved seating, Closed caption, Accessibility devices available, Recliner Seats
1:15p
3:50p
6:30p
10:30p

Check Seats
AMC Loews East Hanover 12
6.21 mi

Order Food and Drinks
Remove this theater from my favorites
Standard

Laser at AMC, Reserved seating, Closed caption, Accessibility devices available, Recliner Seats
11:10a
1:45p
4:15p
7:30p
10:00p`;

const DATE = "2025-05-15";

describe("parseFandangoText", () => {
  describe("theater extraction", () => {
    it("extracts both theater names", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      const theaters = [...new Set(result.map(r => r.theater))];
      expect(theaters).toContain("AMC Headquarters 10");
      expect(theaters).toContain("AMC Loews East Hanover 12");
    });

    it("does not treat distance lines as theater names", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result.every(r => !/^\d+\.\d+ mi$/.test(r.theater))).toBe(true);
    });

    it("does not treat boilerplate as theater names", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      const boilerplate = ["Check Seats", "Order Food and Drinks", "Standard"];
      expect(result.every(r => !boilerplate.includes(r.theater))).toBe(true);
    });
  });

  describe("showtime count", () => {
    it("extracts all 9 showtimes from the example", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result).toHaveLength(9);
    });

    it("assigns 4 showtimes to AMC Headquarters 10", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result.filter(r => r.theater === "AMC Headquarters 10")).toHaveLength(4);
    });

    it("assigns 5 showtimes to AMC Loews East Hanover 12", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result.filter(r => r.theater === "AMC Loews East Hanover 12")).toHaveLength(5);
    });
  });

  describe("PM time conversion", () => {
    it("converts 1:15p to 13:15", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result[0].startLocal).toBe("2025-05-15T13:15");
    });

    it("converts 3:50p to 15:50", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result[1].startLocal).toBe("2025-05-15T15:50");
    });

    it("converts 10:30p to 22:30", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result[3].startLocal).toBe("2025-05-15T22:30");
    });

    it("converts 12:00p (noon) to 12:00, not 24:00", () => {
      const text = `Theater One\n1.0 mi\n12:00p`;
      const result = parseFandangoText(text, DATE);
      expect(result[0].startLocal).toBe("2025-05-15T12:00");
    });
  });

  describe("AM time conversion", () => {
    it("converts 11:10a to 11:10", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, DATE);
      expect(result[4].startLocal).toBe("2025-05-15T11:10");
    });

    it("converts 12:00a (midnight) to 00:00", () => {
      const text = `Theater One\n1.0 mi\n12:00a`;
      const result = parseFandangoText(text, DATE);
      expect(result[0].startLocal).toBe("2025-05-15T00:00");
    });

    it("converts 9:30a to 09:30 (zero-padded)", () => {
      const text = `Theater One\n1.0 mi\n9:30a`;
      const result = parseFandangoText(text, DATE);
      expect(result[0].startLocal).toBe("2025-05-15T09:30");
    });
  });

  describe("date handling", () => {
    it("uses the provided date in all startLocal values", () => {
      const result = parseFandangoText(FANDANGO_EXAMPLE, "2026-07-04");
      expect(result.every(r => r.startLocal.startsWith("2026-07-04T"))).toBe(true);
    });

    it("returns empty array when date is empty string", () => {
      expect(parseFandangoText(FANDANGO_EXAMPLE, "")).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(parseFandangoText("", DATE)).toEqual([]);
    });

    it("returns empty array when no times found", () => {
      const text = `Theater One\n1.36 mi\nOrder Food and Drinks\nRemove this theater from my favorites`;
      expect(parseFandangoText(text, DATE)).toEqual([]);
    });

    it("handles single theater with one showtime", () => {
      const text = `Regal Cinemas\n2.5 mi\n7:00p`;
      expect(parseFandangoText(text, DATE)).toEqual([
        { theater: "Regal Cinemas", startLocal: "2025-05-15T19:00" },
      ]);
    });

    it("handles leading and trailing whitespace in the pasted text", () => {
      const text = `\n\nAMC Test Theater\n1.0 mi\n\n2:30p\n\n`;
      const result = parseFandangoText(text, DATE);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ theater: "AMC Test Theater", startLocal: "2025-05-15T14:30" });
    });
  });
});
