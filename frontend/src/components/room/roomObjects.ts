/**
 * The practice room's interactive objects. Coordinates are in the scene's
 * 1600 x 900 viewBox; the hotspot rectangles are what you click / tap / tab to.
 */
export type RoomObjectId = "guitar" | "amp" | "record" | "stand" | "metronome" | "pedal" | "wall";

export interface RoomObject {
  id: RoomObjectId;
  /** What the object is ("Amp") — used in the label tag. */
  thing: string;
  /** What it does ("Practice a chord"). */
  label: string;
  /** One line explaining the feature. */
  blurb: string;
  href: string;
  /** Hotspot in scene coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the label tag sits, as [x, y] in scene coordinates. */
  tag: [number, number];
  /** Pitch of the pluck when hovered (one of the open strings). */
  hz: number;
}

export const ROOM_OBJECTS: RoomObject[] = [
  {
    id: "guitar",
    thing: "Guitar",
    label: "Start here",
    blurb: "30-second setup: mic check, tuner, your first chord.",
    href: "/start",
    x: 742, y: 250, w: 150, h: 520, tag: [817, 232], hz: 82.41,
  },
  {
    id: "amp",
    thing: "Amp",
    label: "Practice a chord",
    blurb: "Play into your mic — it hears every string and tells you what to fix.",
    href: "/practice",
    x: 214, y: 404, w: 330, h: 330, tag: [379, 386], hz: 110.0,
  },
  {
    id: "pedal",
    thing: "Pedal",
    label: "Tuner",
    blurb: "Tune each string by ear-free, needle-steady pitch tracking.",
    href: "/tuner",
    x: 560, y: 690, w: 170, h: 100, tag: [645, 672], hz: 146.83,
  },
  {
    id: "stand",
    thing: "Music stand",
    label: "Songs & charts",
    blurb: "Chord charts with transpose, capo, simplify, autoscroll and tabs.",
    href: "/songs",
    x: 930, y: 270, w: 200, h: 500, tag: [1030, 252], hz: 196.0,
  },
  {
    id: "record",
    thing: "Record player",
    label: "Learn any song",
    blurb: "Name a song — get its chart, section lessons and a play-along.",
    href: "/practice?mode=song",
    x: 1160, y: 470, w: 250, h: 150, tag: [1285, 452], hz: 246.94,
  },
  {
    id: "metronome",
    thing: "Metronome",
    label: "Chord changes",
    blurb: "One-minute changes: switch between two chords against the clock.",
    href: "/practice?mode=transitions",
    x: 1410, y: 400, w: 90, h: 200, tag: [1455, 382], hz: 329.63,
  },
  {
    id: "wall",
    thing: "Record wall",
    label: "Your progress",
    blurb: "Mastered chords go up on the wall: three clean days each.",
    href: "/progress",
    x: 120, y: 96, w: 470, h: 230, tag: [355, 78], hz: 196.0,
  },
];

export const SCENE_W = 1600;
export const SCENE_H = 900;
