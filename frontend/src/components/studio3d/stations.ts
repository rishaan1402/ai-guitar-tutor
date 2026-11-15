/**
 * The studio's interactive objects: where each sits, how the camera frames it,
 * and which feature it opens. Units are metres; the room's back wall is z = -2.5,
 * its left wall x = -3, and the camera looks in from the front-right.
 */
export type StationId =
  | "wall"
  | "amp"
  | "guitar"
  | "pedal"
  | "stand"
  | "turntable"
  | "metronome"
  | "door";

export interface Station {
  id: StationId;
  /** Shown on the card when the camera arrives. */
  label: string;
  kicker: string;
  blurb: string;
  /** Point the camera looks at. */
  target: [number, number, number];
  /** Direction the camera sits in, from the target (normalised later). */
  dir: [number, number, number];
  /** How much of the world (metres, width x height) the shot must show. */
  frame: [number, number];
}

export const STATIONS: Station[] = [
  {
    id: "wall",
    label: "Wall of records",
    kicker: "Progress",
    blurb: "Every chord you master goes up as a gold record. Faded ones are due a quick re-check.",
    target: [-1.05, 1.95, -2.45],
    dir: [0.25, 0.05, 1],
    frame: [2.3, 1.55],
  },
  {
    id: "amp",
    label: "The amp",
    kicker: "Practice a chord",
    blurb: "Pick any chord, watch and listen, then play it in. The amp hears every string.",
    target: [-1.75, 0.45, -1.75],
    dir: [0.55, 0.32, 1],
    frame: [1.25, 0.95],
  },
  {
    id: "guitar",
    label: "Your guitar",
    kicker: "Today's lesson",
    blurb: "Pick it up and play what's next in your plan.",
    target: [-0.72, 0.74, -1.55],
    dir: [0.3, 0.25, 1],
    frame: [0.8, 1.32],
  },
  {
    id: "pedal",
    label: "Tuner pedal",
    kicker: "Tune up",
    blurb: "Stomp it and tune each string until the light turns green.",
    target: [-1.32, 0.08, -0.82],
    dir: [0.35, 0.75, 1],
    frame: [0.42, 0.32],
  },
  {
    id: "stand",
    label: "Music stand",
    kicker: "Songs & charts",
    blurb: "Your chord charts and tabs: transpose, capo, simplify and autoscroll.",
    target: [0.55, 1.05, -0.55],
    dir: [0.2, 0.15, 1],
    frame: [0.85, 1.25],
  },
  {
    id: "turntable",
    label: "Record player",
    kicker: "Learn any song",
    blurb: "Drop the needle on any song: get its chord chart, tabs and a lesson for each section.",
    target: [1.95, 0.78, -1.82],
    dir: [-0.15, 0.55, 1],
    frame: [0.75, 0.5],
  },
  {
    id: "metronome",
    label: "Metronome",
    kicker: "Chord changes",
    blurb: "One-minute changes: switch between two chords until it's automatic.",
    target: [2.62, 0.8, -1.8],
    dir: [-0.35, 0.3, 1],
    frame: [0.45, 0.45],
  },
  {
    id: "door",
    label: "The door",
    kicker: "You",
    blurb: "Profile, settings, sign in or out.",
    target: [-2.95, 1.1, 0.55],
    dir: [1, 0.1, 0.35],
    frame: [1.5, 2.4],
  },
];

export const OVERVIEW = {
  target: [0.1, 0.95, -0.75] as [number, number, number],
  dir: [0.42, 0.72, 1] as [number, number, number],
  frame: [5.6, 3.4] as [number, number],
};

export function stationById(id: StationId) {
  return STATIONS.find((s) => s.id === id)!;
}

/**
 * Camera distance so `frame` (metres) fits the visible area, which on a phone is the
 * top ~65% of the screen (the card covers the rest when an object is focused).
 */
export function distanceFor(frame: [number, number], fovDeg: number, aspect: number, usable = 0.65) {
  const v = Math.tan((fovDeg * Math.PI) / 360);
  const h = v * aspect;
  return Math.max(frame[0] / 2 / h, frame[1] / 2 / (v * usable));
}

export function cameraFor(target: [number, number, number], dir: [number, number, number], dist: number) {
  const len = Math.hypot(...dir);
  return [target[0] + (dir[0] / len) * dist, target[1] + (dir[1] / len) * dist, target[2] + (dir[2] / len) * dist] as [number, number, number];
}
