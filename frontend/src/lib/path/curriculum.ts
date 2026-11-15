/**
 * The learning path: levels of short sessions. Each session teaches one idea,
 * then you use it straight away:
 *   Learn (video + diagram) -> Check (play it, the app listens) ->
 *   Practice (a Groove on the highway) -> Gig (a one-minute song)
 * Songs are traditional / public domain, arranged with only the chords learned so far.
 */
import type { Groove } from "../groove/groove";
import { LEAD_RIFFS } from "../groove/lead";

const riff = (id: string) => LEAD_RIFFS.find((r) => r.id === id)!;

export interface PathSession {
  id: string;
  title: string;
  /** One line under the title. */
  blurb: string;
  newChords: string[];
  /** Short teaching points shown with the video. */
  points: string[];
  practice?: Groove;
  gig?: Groove;
}

export interface PathLevel {
  id: string;
  title: string;
  blurb: string;
  sessions: PathSession[];
}

const g = (id: string, title: string, bars: string[][], o: Partial<Groove> = {}): Groove => ({
  id,
  title,
  style: "folk",
  bpm: 66,
  bars,
  strum: "D...D...",
  loops: 2,
  ...o,
});

export const LEVELS: PathLevel[] = [
  {
    id: "basics-1",
    title: "Basics 1 · First chords",
    blurb: "Five open chords and your first changes. By the end you'll play a whole song.",
    sessions: [
      {
        id: "b1-em",
        title: "Em, your first chord",
        blurb: "Two fingers, all six strings.",
        newChords: ["Em"],
        points: ["Fingers 2 and 3 on the 2nd fret of the A and D strings.", "Press just behind the fret, on your fingertips.", "Strum all six strings in one smooth move."],
      },
      {
        id: "b1-am",
        title: "Am and your first change",
        blurb: "Em to Am: the shape moves down one string.",
        newChords: ["Am"],
        points: ["Same two fingers as Em, moved down one string; add finger 1 on the B string, 1st fret.", "Don't strum the low E string.", "Change slowly first: the band waits for you."],
        practice: g("p-em-am", "Em ↔ Am", [["Em"], ["Am"], ["Em"], ["Am"]], { focus: ["Em", "Am"], style: "ballad", bpm: 62, tip: "Move fingers 2 and 3 together, then add 1." }),
      },
      {
        id: "b1-e",
        title: "E major",
        blurb: "Am's shape, one string higher.",
        newChords: ["E"],
        points: ["The Am shape moved up one string: frets 2, 2, 1.", "All six strings ring.", "Am to E is one move: keep the shape, shift it."],
        practice: g("p-am-e", "Am ↔ E", [["Am"], ["E"], ["Am"], ["E"]], { focus: ["Am", "E"], style: "ballad", bpm: 62, tip: "Keep the shape locked and move it as one piece." }),
      },
      {
        id: "b1-a",
        title: "A major",
        blurb: "Three fingers in a row on the 2nd fret.",
        newChords: ["A"],
        points: ["Fingers 1, 2, 3 side by side on the 2nd fret of the D, G and B strings.", "Skip the low E string.", "E to A is the most common change in rock and blues."],
        practice: g("p-e-a", "E ↔ A", [["E"], ["A"], ["E"], ["A"]], { focus: ["E", "A"], style: "folk", bpm: 64 }),
      },
      {
        id: "b1-d",
        title: "D major",
        blurb: "A little triangle on the top strings.",
        newChords: ["D"],
        points: ["Strum only the top four strings, from the open D.", "Finger 3 on the B string, 3rd fret, makes the triangle.", "A to D: lift together, land together."],
        practice: g("p-a-d", "A ↔ D", [["A"], ["D"], ["A"], ["D"]], { focus: ["A", "D"], style: "folk", bpm: 64 }),
      },
      {
        id: "b1-gig",
        title: "Gig: Drunken Sailor",
        blurb: "A traditional sea shanty with Em and D.",
        newChords: [],
        points: ["Two chords, one song: Em most of the time, D for the lift.", "Keep strumming even if a change is late: the music follows you."],
        practice: g("p-em-d", "Em ↔ D", [["Em"], ["D"], ["Em"], ["D"]], { focus: ["Em", "D"], style: "folk", bpm: 66 }),
        gig: g("gig-sailor", "Drunken Sailor (traditional)", [["Em"], ["D"], ["Em"], ["Em", "D"], ["Em"], ["D"], ["Em"], ["D", "Em"]], { style: "folk", bpm: 72, strum: "D.D.D.D.", loops: 1, focus: ["Em", "D"] }),
      },
    ],
  },
  {
    id: "basics-2",
    title: "Basics 2 · The big three",
    blurb: "G, C and D: the chords behind thousands of songs.",
    sessions: [
      {
        id: "b2-g",
        title: "G major",
        blurb: "A big, bright chord across all six strings.",
        newChords: ["G"],
        points: ["Fingers 2 and 3 on the low strings, finger 4 (or 3) on the high e, 3rd fret.", "Arch your fingers so the open strings ring.", "G to D: your ring finger can guide the move."],
        practice: g("p-g-d", "G ↔ D", [["G"], ["D"], ["G"], ["D"]], { focus: ["G", "D"], style: "folk", bpm: 64 }),
      },
      {
        id: "b2-c",
        title: "C major",
        blurb: "A staircase shape: frets 3, 2, 1.",
        newChords: ["C"],
        points: ["Ring finger on the A string 3rd fret, middle on D 2nd, index on B 1st.", "Skip the low E string.", "G to C is the change most beginners find hardest: it's normal."],
        practice: g("p-g-c", "G ↔ C", [["G"], ["C"], ["G"], ["C"]], { focus: ["G", "C"], style: "pop", bpm: 62, tip: "Lead with your ring finger: it moves the least." }),
      },
      {
        id: "b2-loop",
        title: "The four-chord loop",
        blurb: "G, C, Em, D: the loop behind half the radio.",
        newChords: [],
        points: ["You know every chord here. Now string them together.", "Try a down, down, down, down-up strum."],
        practice: g("p-gced", "Late Night in G", [["G"], ["C"], ["Em"], ["D"]], { focus: ["C", "Em"], style: "pop", bpm: 70, strum: "D.D.D.DU" }),
      },
      {
        id: "b2-gig",
        title: "Gig: Amazing Grace",
        blurb: "A traditional hymn with G, C and D.",
        newChords: [],
        points: ["Slow and steady: let each chord ring.", "The C-to-G moves come back again and again."],
        practice: g("p-c-g", "C ↔ G", [["C"], ["G"], ["C"], ["G"]], { focus: ["C", "G"], style: "ballad", bpm: 64 }),
        gig: g("gig-grace", "Amazing Grace (traditional)", [["G"], ["G"], ["C"], ["G"], ["G"], ["G"], ["D"], ["D"], ["G"], ["G"], ["C"], ["G"], ["G"], ["D"], ["G"], ["G"]], { style: "ballad", bpm: 70, strum: "D...D...", loops: 1, focus: ["G", "C"] }),
      },
    ],
  },
  {
    id: "chords-3",
    title: "Chords 3 · Rhythm and colour",
    blurb: "A minor-key chord, a real strum pattern, and the 7ths that make blues.",
    sessions: [
      {
        id: "c3-dm",
        title: "D minor",
        blurb: "D's sad sibling.",
        newChords: ["Dm"],
        points: ["Like D, top four strings only.", "Index on the high e, 1st fret; middle on G 2nd; ring on B 3rd.", "Am to Dm: think of it as a small hop."],
        practice: g("p-am-dm", "Am ↔ Dm", [["Am"], ["Dm"], ["Am"], ["Dm"]], { focus: ["Am", "Dm"], style: "ballad", bpm: 64 }),
      },
      {
        id: "c3-strum",
        title: "The everyday strum",
        blurb: "Down, down-up, up-down-up.",
        newChords: [],
        points: ["Keep your hand moving down and up all the time, even when you miss the strings.", "The pattern: D . D U . U D U.", "Start slow; speed comes on its own."],
        practice: g("p-strum", "Sunset Loop in C", [["C"], ["Am"], ["Dm"], ["G"]], { focus: ["Dm", "G"], style: "pop", bpm: 66, strum: "D.DU.UDU" }),
      },
      {
        id: "c3-7ths",
        title: "7th chords for blues",
        blurb: "A7 and E7: lift a finger, add some grit.",
        newChords: ["A7", "E7"],
        points: ["A7 is A with the G-string finger lifted.", "E7 is E with the D-string finger lifted.", "7ths want to move: that's what makes blues swing."],
        practice: g("p-a7-e7", "A ↔ E7", [["A"], ["E7"], ["A"], ["E7"]], { focus: ["A", "E7"], style: "rock", bpm: 70, strum: "D.D.D.D." }),
      },
      {
        id: "c3-gig",
        title: "Gig: Scarborough Fair & a 12-bar blues",
        blurb: "A traditional ballad, then the blues.",
        newChords: [],
        points: ["Scarborough Fair lives on Am with G, C and D around it.", "Then a 12-bar blues in A: the most played progression in rock."],
        practice: g("gig-scarborough", "Scarborough Fair (traditional)", [["Am"], ["G"], ["Am"], ["Am"], ["C"], ["Am"], ["D"], ["Am"]], { style: "ballad", bpm: 68, strum: "D...D.D.", loops: 1, focus: ["Am", "G"] }),
        gig: g("gig-blues", "12-bar blues in A", [["A"], ["A"], ["A"], ["A7"], ["D"], ["D"], ["A"], ["A"], ["E7"], ["D"], ["A"], ["E7"]], { style: "rock", bpm: 78, strum: "D.DU.UDU", loops: 1, focus: ["A", "D"] }),
      },
    ],
  },
];

LEVELS.push({
  id: "lead-1",
  title: "Lead 1 · First riffs",
  blurb: "Single notes: picking one string at a time, your first riff and two melodies.",
  sessions: [
    {
      id: "l1-open",
      title: "Picking single strings",
      blurb: "Every open string, one at a time.",
      newChords: [],
      points: ["Hold the pick between thumb and the side of your index finger.", "Pick just one string and let it ring.", "Low E on the left of the highway, high e on the right."],
      practice: riff("lead-open"),
    },
    {
      id: "l1-riff",
      title: "Your first riff",
      blurb: "Night Drive: frets 0, 3, 5 on the low strings.",
      newChords: [],
      points: ["Numbers on the highway are frets; the lane is the string.", "Use finger 1 for fret 3 and finger 3 for fret 5."],
      practice: riff("lead-night"),
    },
    {
      id: "l1-melodies",
      title: "Gig: two melodies",
      blurb: "Ode to Joy and Twinkle Twinkle on the top strings.",
      newChords: [],
      points: ["Stay on the top two strings.", "Keep your hand over frets 1 to 5 and let your fingers do the walking."],
      practice: riff("lead-ode"),
      gig: riff("lead-twinkle"),
    },
  ],
});

export const ALL_SESSIONS: PathSession[] = LEVELS.flatMap((l) => l.sessions);

export function sessionById(id: string | null | undefined): PathSession | undefined {
  return ALL_SESSIONS.find((s) => s.id === id);
}

export function levelOf(id: string): PathLevel | undefined {
  return LEVELS.find((l) => l.sessions.some((s) => s.id === id));
}

/** The first session without stars (what "Today's lesson" opens). */
export function nextSession(done: Record<string, number>): PathSession {
  return ALL_SESSIONS.find((s) => !(done[s.id] > 0)) ?? ALL_SESSIONS[ALL_SESSIONS.length - 1];
}

/** Chords taught up to and including this session (what a song may use). */
export function chordsUpTo(id: string): string[] {
  const out: string[] = [];
  for (const s of ALL_SESSIONS) {
    out.push(...s.newChords);
    if (s.id === id) break;
  }
  return Array.from(new Set(out));
}
