/**
 * Track 3: Theory & fretboard. Notes on the neck, intervals, scales and keys,
 * chords from scales, reading music, modes and harmony, and ear training,
 * always tied back to the guitar.
 */
import { ear, echo, fret, fretgame, g, groove, hear, hearChord, notes, pcs, play, q, quiz, read, rhythm, S, tab, type PathTrack } from "../steps";

export const THEORY_TRACK: PathTrack = {
  id: "theory",
  title: "Theory & fretboard",
  blurb: "Know every note on the neck and why music works: intervals, keys, harmony and a trained ear.",
  levels: [
    {
      id: "theory-1",
      title: "Theory 1 · Notes on the neck",
      blurb: "The musical alphabet and every note on the low strings.",
      sessions: [
        S("t1-alphabet", "The musical alphabet", "Twelve notes, then they repeat.",
          read("Twelve notes", `Music uses **seven letter names**: **A B C D E F G**, then back to A. Between most of them there's a note in between, a **sharp (♯)** or **flat (♭)**: A♯ is the same note as B♭.

The full list of twelve: **A A♯ B C C♯ D D♯ E F F♯ G G♯**, then A again, an **octave** higher.

Two pairs have **no note between them**: **B–C** and **E–F**. Remember that and you can name every fret.

One fret = one **half step**. Two frets = a **whole step**.`),
          quiz("Alphabet",
            q("What comes one half step above E?", ["E♯ (a separate note)", "F", "F♯"], 1, "E–F is a natural half step: no note between them."),
            q("A♯ is the same note as…", ["B♭", "A♭", "B"], 0, "Sharp raises, flat lowers: A♯ and B♭ are one key on the piano."),
            q("How many different notes before the names repeat?", ["7", "8", "12"], 2, "Twelve half steps make an octave."),
            q("Two frets up from B is…", ["C", "C♯", "D"], 1, "B to C is one fret (no note between), then C♯."))),
        S("t1-low-e", "Notes on the low E string", "The map for every barre chord.",
          read("The low E string", `Walk up the low E string using the alphabet: **E (open), F (1), F♯ (2), G (3), G♯ (4), A (5), A♯ (6), B (7), C (8), C♯ (9), D (10), D♯ (11), E (12)**.

The **12th fret** is the octave: the names start over. Memorise the natural notes: **E F G A B C D E** at **0 1 3 5 7 8 10 12**.`,
            fret("6:0=E 6:1=F 6:3=G 6:5=A 6:7=B 6:8=C 6:10=D 6:12=E", "Natural notes on the low E", 0, 12)),
          play("Name it, play it", "Play the natural notes up the low E string: F G A B C D E.", notes("6:1 6:3 6:5 6:7 6:8 6:10 6:12"))),
        S("t1-a-string", "Notes on the A string", "The second map.",
          read("The A string", `Same idea on the A string: **A (0), B (2), C (3), D (5), E (7), F (8), G (10), A (12)**.

With the low E and A strings memorised you can find **any barre chord or power chord root**.`,
            fret("5:0=A 5:2=B 5:3=C 5:5=D 5:7=E 5:8=F 5:10=G 5:12=A", "Natural notes on the A string", 0, 12)),
          play("A string run", "Play B C D E F G A up the A string.", notes("5:2 5:3 5:5 5:7 5:8 5:10 5:12"))),
        S("t1-fretgame", "Fretboard game", "Name the note, fast.",
          read("Speed matters", `Knowing notes isn't enough: you need them **instantly**. A fret lights up; tap its name. Aim for every answer right in under **3 seconds**.`),
          fretgame("Low strings", "Name each note on the low E and A strings.", [6, 5], [0, 12], 12),
          fretgame("The first five frets", "Now every string, frets 0 to 5.", [6, 5, 4, 3, 2, 1], [0, 5], 12)),
        S("t1-find", "Find it anywhere", "Any note, any string.",
          read("Use octaves and landmarks", `To find a note on the higher strings, use **octave shapes** from the low strings (see the Lead track) or landmarks:

- The **5th fret** of each string equals the next open string (except the G string: its **4th** fret = open B).
- The **12th fret** is the open string an octave up.
- Fret dots at **3, 5, 7, 9, 12** are your signposts.

Exercise: pick a note and find it on all six strings, in any order. Say its name out loud as you play it.`),
          play("Note hunt", "Play each note anywhere on the neck: **C, G, D, A, E** (the order of fifths!).", pcs("C G D A E")),
          quiz("Landmarks",
            q("The 5th fret of the low E string matches which open string?", ["A", "D", "B"], 0, "That's how you tune by ear: 5th fret = next open string."),
            q("On the G string, which fret matches the open B?", ["5th", "4th", "3rd"], 1, "The G–B pair is a major 3rd apart, so it's the 4th fret."))),
      ],
    },
    {
      id: "theory-2",
      title: "Theory 2 · Intervals",
      blurb: "The distance between notes, by name, by shape and by ear.",
      sessions: [
        S("t2-names", "Interval names", "Half steps, thirds, fifths.",
          read("Counting distance", `An **interval** is the distance between two notes, counted in half steps (frets):

| Half steps | Interval | Sounds like |
|---|---|---|
| 1 | minor 2nd | *Jaws* |
| 2 | major 2nd | *Happy Birthday* (first two notes) |
| 3 | minor 3rd | sad, *Greensleeves* |
| 4 | major 3rd | bright, *When the Saints* |
| 5 | perfect 4th | *Here Comes the Bride* |
| 6 | tritone | tense, *The Simpsons* |
| 7 | perfect 5th | *Twinkle Twinkle* (1st to 3rd note) |
| 12 | octave | *Somewhere Over the Rainbow* |`,
            hear("minor 3rd", "5:3 5:6", 0.6), hear("major 3rd", "5:3 5:7", 0.6), hear("perfect 5th", "5:3 5:10", 0.6)),
          quiz("Intervals",
            q("How many half steps in a perfect 5th?", ["5", "7", "8"], 1, "C to G: C C♯ D D♯ E F F♯ G = 7."),
            q("C to E is a…", ["minor 3rd", "major 3rd", "perfect 4th"], 1, "Four half steps: major 3rd."),
            q("Which interval makes a chord minor or major?", ["The 3rd", "The 5th", "The octave"], 0, "Minor 3rd = minor chord; major 3rd = major chord."))),
        S("t2-ear1", "Ear training: 3rds and 5ths", "Hear the shapes of music.",
          read("Listening", `Sing along with each interval, then guess. Link each one to a song you know. Five minutes of ear training a day changes how you hear music within weeks.`),
          ear("3rds and 5ths", "interval", ["minor 3rd", "major 3rd", "perfect 5th"], 10)),
        S("t2-shapes", "Interval shapes on the neck", "Geometry you can see.",
          read("Shapes", `On neighbouring strings (except the G–B pair) intervals have fixed shapes:

- **Perfect 4th**: same fret, next string up.
- **Perfect 5th**: next string up, **two frets higher** (the power chord!).
- **Major 3rd**: next string up, one fret **lower**.
- **Minor 3rd**: next string up, two frets lower.
- **Octave**: two strings up, two frets higher.

Across the **G–B** pair, add one fret to every shape above.`,
            fret("5:3R=C 4:5=G 4:3=F 4:2=E", "From C: 4th (F), 5th (G), major 3rd (E)", 1, 6)),
          play("Build from C", "C, then its major 3rd (E), its 5th (G) and its octave (C).", notes("5:3 4:2 4:5 3:5"))),
        S("t2-echo", "Play back melodies", "Hear it, find it.",
          read("Ear to hands", `The app plays three notes from the C major scale on the G and B strings. Find them and play them back.

Start by finding the **first note**; then ask: does the next one go **up or down**? A **step** or a **jump**?`),
          echo("Three-note melodies", "Listen, then play it back (any octave).", ["3:5 3:7 2:5", "2:5 3:7 3:5", "3:5 2:5 2:8", "2:8 2:5 3:5", "3:7 2:5 2:6"])),
        S("t2-ear2", "Ear training: all the intervals", "The full set.",
          ear("Steps and leaps", "interval", ["minor 2nd", "major 2nd", "perfect 4th", "perfect 5th", "octave"], 10),
          ear("The full set", "interval", ["minor 3rd", "major 3rd", "perfect 4th", "tritone", "perfect 5th", "minor 7th", "octave"], 12)),
      ],
    },
    {
      id: "theory-3",
      title: "Theory 3 · Scales and keys",
      blurb: "The major scale formula, keys, the circle of fifths and relative minors.",
      sessions: [
        S("t3-formula", "The major scale formula", "W W H W W W H.",
          read("Building any major scale", `Every major scale follows the same step pattern: **whole, whole, half, whole, whole, whole, half**.

From **G**: G (W) A (W) B (H) C (W) D (W) E (W) **F♯** (H) G. To keep the pattern, F becomes F♯: that's why **G major has one sharp**.

From **D**: D E **F♯** G A B **C♯** D: two sharps.

On one string it's easy to see: frets 0 2 4 5 7 9 11 12.`,
            fret("6:3R 6:5 6:7 6:8 6:10 6:12 6:14 6:15R", "G major on one string: W W H W W W H", 2, 15)),
          play("Major scale on one string", "G major up the low E string, from the 3rd fret.", notes("6:3 6:5 6:7 6:8 6:10 6:12 6:14 6:15")),
          quiz("Formula",
            q("The major scale pattern is…", ["W W H W W W H", "W H W W H W W", "H W W W H W W"], 0, "Whole whole half, whole whole whole half."),
            q("Which note is sharp in G major?", ["C♯", "F♯", "G♯"], 1, "E to the 7th degree must be a whole step: F♯."),
            q("How many sharps in D major?", ["1", "2", "3"], 1, "F♯ and C♯."))),
        S("t3-circle", "The circle of fifths", "Every key in one picture.",
          read("Around the circle", `Arrange keys a **fifth apart** and the sharps pile up one at a time:

**C (0) → G (1♯) → D (2♯) → A (3♯) → E (4♯) → B (5♯) → F♯ (6♯)**

Going the other way, by fourths, flats pile up:

**C (0) → F (1♭) → B♭ (2♭) → E♭ (3♭) → A♭ (4♭)**

Neighbours on the circle are **closely related**: songs in C use F and G constantly. The sharps appear in the order **F C G D A E B** (*Father Charles Goes Down And Ends Battle*); flats in reverse.`),
          quiz("Circle",
            q("Which key has three sharps?", ["A", "E", "D"], 0, "C G D A: A is three steps round."),
            q("Which key has one flat?", ["F", "B♭", "D"], 0, "One step the other way from C."),
            q("The first sharp to appear is always…", ["C♯", "F♯", "G♯"], 1, "Father Charles: F♯ first."))),
        S("t3-minor", "Relative minor", "Same notes, different home.",
          read("Major and minor twins", `Every major key has a **relative minor** that uses the **same notes**, starting on the 6th degree: C major ↔ **A minor**, G major ↔ **E minor**, D major ↔ **B minor**.

On the neck: the relative minor is **three frets below** the major root. The same pentatonic box is "major" or "minor" depending on which note feels like home.

The **natural minor** scale pattern: **W H W W H W W**.`),
          quiz("Relatives",
            q("Relative minor of G major?", ["E minor", "A minor", "B minor"], 0, "Count down three half steps: G → F♯ → F → E."),
            q("Relative major of D minor?", ["F major", "A major", "B♭ major"], 0, "Three half steps up from D: F."),
            q("C major and A minor share…", ["The same notes", "No notes", "Only the root"], 0, "All white keys; only the home note differs."))),
      ],
    },
    {
      id: "theory-4",
      title: "Theory 4 · Chords from scales",
      blurb: "How chords are built, the chords in every key, and why progressions work.",
      sessions: [
        S("t4-triads", "Building triads", "Stack thirds.",
          read("Stacking thirds", `A **triad** stacks two thirds on a root:

| Type | Recipe | In C |
|---|---|---|
| Major | major 3rd + minor 3rd | C E G |
| Minor | minor 3rd + major 3rd | C E♭ G |
| Diminished | minor 3rd + minor 3rd | C E♭ G♭ |
| Augmented | major 3rd + major 3rd | C E G♯ |

Add another third on top and you have a **7th chord**.`, hearChord("C", "C"), hearChord("Cm", "Cm"), hearChord("Cdim", "Cdim"), hearChord("Caug", "Caug")),
          ear("Four triads", "quality", ["major", "minor", "diminished", "augmented"], 12)),
        S("t4-key", "The chords in a key", "I ii iii IV V vi vii°.",
          read("Harmonising the scale", `Build a triad on each note of the major scale using only notes of the scale and you get the same pattern in **every major key**:

| I | ii | iii | IV | V | vi | vii° |
|---|---|---|---|---|---|---|
| major | minor | minor | major | major | minor | dim |
| C | Dm | Em | F | G | Am | B° |
| G | Am | Bm | C | D | Em | F♯° |

Capital Roman numerals = major, small = minor. That's why G, C, D and Em sound right together: they're all in G major.`),
          quiz("Keys",
            q("In G major, the vi chord is…", ["Em", "E", "Am"], 0, "6th note of G major is E; vi is minor."),
            q("In D major, the IV and V are…", ["G and A", "G and Bm", "E and A"], 0, "D E F♯ G A: G is 4, A is 5, both major."),
            q("Which chord is diminished in a major key?", ["ii", "vii", "iii"], 1, "The 7th degree builds a diminished triad."))),
        S("t4-function", "Why progressions work", "Home, away, tension, home.",
          read("Function", `Chords have **jobs**:

- **Tonic** (I, vi): home, stable.
- **Subdominant** (IV, ii): moving away.
- **Dominant** (V, vii°): tension that wants to resolve home.

Classic progressions are just journeys: **I–IV–V–I** (rock and roll), **I–V–vi–IV** (pop), **ii–V–I** (jazz), **vi–IV–I–V**.

Feel it: play **G → C → D** and stop. You *need* to hear G again. That pull is the **dominant**.`, hearChord("D7 (V7 in G)", "D7")),
          groove(g("p-t4-145", "I–IV–V in G", [["G"], ["C"], ["D"], ["G"]], { style: "folk", bpm: 72, focus: ["D", "G"] })),
          groove(g("p-t4-pop", "I–V–vi–IV in C", [["C"], ["G"], ["Am"], ["F"]], { style: "pop", bpm: 76, strum: "D.DU.UDU", focus: ["Am", "F"] }))),
        S("t4-progear", "Hear the progression", "Name four chords by ear.",
          read("Progressions by ear", `Four common progressions sound different once you know what to listen for:
- **I–IV–V–I**: classic, resolved, folk and rock and roll.
- **I–V–vi–IV**: the pop anthem.
- **vi–IV–I–V**: the same chords, starting sad.
- **I–vi–IV–V**: the 1950s doo-wop loop.

Listen for the **minor chord (vi)**: where does it fall?`),
          ear("Which progression?", "progression", ["I–IV–V–I", "I–V–vi–IV", "vi–IV–I–V", "I–vi–IV–V"], 8)),
        S("t4-ear", "Hear major and minor", "The most important ear skill.",
          ear("Major or minor?", "quality", ["major", "minor"], 12),
          ear("Sevenths", "quality", ["major 7", "minor 7", "dominant 7", "half-diminished"], 12)),
      ],
    },
    {
      id: "theory-5",
      title: "Theory 5 · Reading music",
      blurb: "Tab in detail, rhythm notation, time signatures and the basics of standard notation.",
      sessions: [
        S("t5-tab", "Reading tab", "Every symbol.",
          read("Tablature", `**Tab** shows six lines, one per string, **high e on top**. Numbers are frets; read left to right; stacked numbers are played together.

| Symbol | Means |
|---|---|
| h / p | hammer-on / pull-off |
| / \\ | slide up / down |
| b | bend (b9 = bend to the pitch of fret 9) |
| r | release a bend |
| ~ | vibrato |
| x | muted (dead) note |
| PM | palm mute |
| <12> | natural harmonic |

Tab rarely shows rhythm, so **always listen to the recording** too.`,
            tab(`e|-------------------------|
B|--------8b10r8-5----------|
G|--5h7-------------7~~-----|
D|-------------------------|`, "A lick: hammer-on, bend and release, vibrato")),
          quiz("Tab",
            q("In tab, the top line is…", ["The low E", "The high e", "The A string"], 1, "Tab looks down at the neck from the player's view: the high e is on top."),
            q("7b9 means…", ["Play 7 then 9", "Bend fret 7 up to the pitch of fret 9", "Slide 7 to 9"], 1, "b = bend; the second number is the target pitch."),
            q("Stacked numbers in one column are…", ["Played together", "Played fast", "Optional"], 0, "Same column = same moment: a chord or double stop."))),
        S("t5-rhythm", "Rhythm notation", "Note values and rests.",
          read("Note values", `In 4/4:

| Note | Beats | Count |
|---|---|---|
| Whole | 4 | 1 2 3 4 |
| Half | 2 | 1 2 |
| Quarter | 1 | 1 |
| Eighth | ½ | 1 & |
| Sixteenth | ¼ | 1 e & a |

A **dot** adds half the value (dotted half = 3 beats). A **tie** joins two notes into one. Every note value has a matching **rest**: silence of the same length. Rests are music too.`),
          rhythm("Quarters and eighths", "Quarter, quarter, eighth eighth, quarter: **1 2 3 & 4**.", "x.x.xxx.", 72),
          rhythm("Dotted rhythm", "Dotted quarter + eighth, twice: **1 (2) & 3 (4) &**.", "x..xx..x", 72),
          quiz("Values",
            q("A dotted half note lasts…", ["2 beats", "3 beats", "4 beats"], 1, "Half (2) + half of that (1) = 3."),
            q("How many sixteenths in a quarter note?", ["2", "4", "8"], 1, "1 e & a."))),
        S("t5-time", "Time signatures", "4/4, 3/4, 6/8 and odd times.",
          read("The two numbers", `The **top number** is how many beats in a bar; the **bottom** is which note gets the beat (4 = quarter, 8 = eighth).

- **4/4**: most pop, rock, hip-hop.
- **3/4**: waltzes, *Amazing Grace*.
- **6/8**: two big beats, each split in three: *House of the Rising Sun*, many ballads. Feels like **ONE** two three **FOUR** five six.
- **5/4, 7/8**: odd meters, prog rock and Balkan music: *Take Five* is in 5/4.`),
          rhythm("Feel 6/8", "Six eighth notes per bar, accent 1 and 4. (Here: tap the two big beats.)", "x..x..", 70, 4),
          quiz("Meters",
            q("In 3/4, how many quarter-note beats per bar?", ["3", "4", "6"], 0, "Top number = beats per bar."),
            q("6/8 is usually felt in…", ["Six even beats", "Two big beats", "Three beats"], 1, "Two groups of three eighths."))),
        S("t5-staff", "Standard notation basics", "The five lines.",
          read("The staff", `Guitar music is written on the **treble clef**, sounding an octave lower than written.

- Lines from the bottom: **E G B D F** (*Every Good Boy Deserves Fudge*).
- Spaces: **F A C E**.
- Notes above or below get **ledger lines**.
- Sharps and flats at the start (**key signature**) apply all the way through.

You don't need to sight-read to be a great guitarist, but reading opens up classical repertoire, jazz charts and session work. Ten minutes a day of a beginner reading book goes a long way.`),
          quiz("Staff",
            q("Treble clef lines, bottom to top?", ["E G B D F", "F A C E", "G B D F A"], 0, "Every Good Boy Deserves Fudge."),
            q("Treble clef spaces spell…", ["FACE", "EGBDF", "CAGE"], 0, "F A C E, bottom to top."))),
      ],
    },
    {
      id: "theory-6",
      title: "Theory 6 · Advanced harmony",
      blurb: "Modes, extensions, borrowed chords, secondary dominants and substitutions.",
      sessions: [
        S("t6-modes", "The seven modes", "One scale, seven moods.",
          read("Modes from brightest to darkest", `Start the major scale on each note and you get seven **modes**:

| Mode | Built on | Character | Special note |
|---|---|---|---|
| Lydian | 4th | dreamy, floating | ♯4 |
| Ionian (major) | 1st | happy, settled | — |
| Mixolydian | 5th | bluesy major | ♭7 |
| Dorian | 2nd | soulful minor | 6 |
| Aeolian (natural minor) | 6th | sad | ♭6 |
| Phrygian | 3rd | Spanish, dark | ♭2 |
| Locrian | 7th | unstable | ♭2 ♭5 |

Think of each as **major or minor plus one special note**. That note is the flavour: lean on it.`),
          quiz("Modes",
            q("Which mode is major with a ♯4?", ["Lydian", "Mixolydian", "Dorian"], 0, "Lydian: the floating, film-score sound."),
            q("Phrygian's special note is…", ["♭2", "♯4", "6"], 0, "The half step above the root gives it the Spanish feel."),
            q("E Phrygian has the same notes as…", ["C major", "E major", "A major"], 0, "E is the 3rd degree of C major."))),
        S("t6-ext", "Extended chords", "9ths, 11ths and 13ths.",
          read("Beyond the 7th", `Keep stacking thirds past the 7th: **9th**, **11th**, **13th** (the 2nd, 4th and 6th an octave up).

- **Dominant 9** (C9): funk and soul. **Major 9**: smooth R&B. **Minor 9**: neo-soul.
- **13th** chords: jazz and blues endings.

Guitarists drop notes they can't fit, usually the **5th**, sometimes the root (the bass player has it).`,
            fret("5:3R 4:2 3:3 2:3 1:3", "C9: x 3 2 3 3 3", 1, 5)),
          quiz("Extensions",
            q("A 9th is the same note as the…", ["2nd", "4th", "6th"], 0, "An octave plus a step: the 2nd an octave up."),
            q("Which note do guitarists usually leave out of big chords?", ["The 3rd", "The 5th", "The 7th"], 1, "The 5th adds the least colour; the 3rd and 7th define the chord."))),
        S("t6-borrow", "Borrowed chords and secondary dominants", "Colour from outside the key.",
          read("Outside the key", `**Borrowed chords (modal interchange):** take chords from the parallel minor. In C major: **F minor (iv)**, **A♭ (♭VI)**, **B♭ (♭VII)**. The **iv minor** is the bittersweet sound of a thousand ballads; **♭VII** is pure rock (*G–F–C*).

**Secondary dominants:** make any chord in the key feel like a temporary home by playing **its own V7** first. In C, **A7 → Dm** (V of ii), **E7 → Am** (V of vi), **D7 → G** (V of V). That's the "Beatles" pull.`),
          groove(g("p-t6-sec", "Secondary dominants", [["C"], ["A7"], ["Dm"], ["G7"], ["C"], ["E7"], ["Am"], ["D7"]], { style: "pop", bpm: 76, loops: 1, focus: ["E7", "Am"] }), "follow"),
          quiz("Colour",
            q("In C, which chord is the V of Am?", ["E7", "G7", "D7"], 0, "E is the 5th of A."),
            q("♭VII in C major is…", ["B♭", "B", "Bm"], 0, "Borrowed from C minor: B♭ major."))),
        S("t6-subs", "Substitutions", "Same job, different chord.",
          read("Substitution", `Chords that share notes can **replace** each other:

- **Relative substitution**: Am for C, Em for G (they share two notes).
- **Tritone substitution** (jazz): replace a V7 with the dominant 7 a **tritone** away. In C, **D♭7 instead of G7**: D♭7 → C slides down by half steps. They share the same tense tritone (F and B/C♭).
- **Diminished passing chords**: C → C♯dim → Dm, climbing by half steps.

Reharmonising a simple song with these is how arrangers make it sound new.`),
          quiz("Subs",
            q("The tritone sub for G7 is…", ["D♭7", "D7", "C♯m"], 0, "G to D♭ is a tritone; both contain B and F."),
            q("Why does Am substitute for C?", ["It shares two notes (C and E)", "It's louder", "It has no 3rd"], 0, "C E G vs A C E: two common tones."))),
      ],
    },
    {
      id: "theory-7",
      title: "Theory 7 · Pro ears",
      blurb: "The ear-training gym and how to transcribe anything.",
      sessions: [
        S("t7-gym", "The ear gym", "Mixed drills, hard mode.",
          ear("All intervals", "interval", ["minor 2nd", "major 2nd", "minor 3rd", "major 3rd", "perfect 4th", "tritone", "perfect 5th", "minor 6th", "major 6th", "minor 7th", "major 7th", "octave"], 15),
          ear("Every chord type", "quality", ["major", "minor", "diminished", "augmented", "sus2", "sus4", "dominant 7", "major 7", "minor 7"], 15)),
        S("t7-transcribe", "Transcribing", "Learn songs straight from the record.",
          read("The method", `Transcribing (working out music by ear) is the fastest way to grow. Every great player did it.

1. **Bass note first.** Find the lowest note of each chord; that's usually the root.
2. **Major or minor?** Your ear gym pays off here.
3. **Use the key.** Find the home chord, then expect chords from that key.
4. **Slow it down.** Use a player with half speed; most phones can.
5. **Write it down** as a chart, then play along with the record.
6. Solos: **sing a phrase**, find it, repeat.

Start with simple songs you love. Your first transcription takes hours; your hundredth takes minutes.`),
          quiz("Method",
            q("When working out chords, find what first?", ["The bass note", "The highest note", "The lyrics"], 0, "The bass usually gives the root of the chord."),
            q("Once you know the key, the chords are…", ["Usually from that key", "Random", "Always major"], 0, "Most songs stay mostly in the key's seven chords."))),
        S("t7-dictation", "Melodic dictation", "Longer phrases, no notes shown.",
          echo("Five-note phrases in G", "Listen and play back. The notes are in G major, around the 2nd to 5th frets.", ["4:5 4:2 5:5 4:2 4:4", "3:2 3:4 3:5 4:4 4:5", "4:5 3:2 3:4 3:2 4:5", "5:2 5:3 5:5 4:2 4:5"]),
          ear("Harder progressions", "progression", ["ii–V–I", "I–bVII–IV–I", "I–iii–IV–V", "vi–ii–V–I"], 8)),
        S("t7-final", "Final exam: theory", "Everything in one go.",
          quiz("Final exam",
            q("Notes of an A major chord?", ["A C E", "A C♯ E", "A D E"], 1, "A major: A, major 3rd C♯, 5th E."),
            q("In E major, the V chord is…", ["B", "A", "C♯m"], 0, "E F♯ G♯ A B: B is 5."),
            q("Dorian over Dm7 uses which note that natural minor doesn't?", ["B", "B♭", "C♯"], 0, "D Dorian has the major 6th, B."),
            q("A C9 chord contains…", ["C E G B♭ D", "C E G B D", "C E♭ G B♭ D"], 0, "Dominant 7 (B♭) plus the 9th (D)."),
            q("What makes G7 want to resolve to C?", ["The tritone B–F resolving to C–E", "The note G", "Its volume"], 0, "B moves up to C, F down to E."),
            q("Relative minor of E♭ major?", ["C minor", "G minor", "B♭ minor"], 0, "Three half steps below E♭ is C."))),
      ],
    },
  ],
};
