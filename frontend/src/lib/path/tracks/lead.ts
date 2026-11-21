/**
 * Track 2: Lead & technique. Single notes to solos: picking, fretting-hand
 * technique, pentatonic and major scales, bends, slides, vibrato, the whole
 * neck, modes and arpeggios. The app listens to each note you play.
 */
import { LEAD_RIFFS } from "../../groove/lead";
import { ear, echo, fret, groove, hear, improvise, ladder, lead, notes, play, q, quiz, read, S, tab, type PathTrack } from "../steps";

const riff = (id: string) => LEAD_RIFFS.find((r) => r.id === id)!;

const PENT1 = "6:5R 6:8 5:5 5:7 4:5 4:7R 3:5 3:7 2:5 2:8 1:5R 1:8";
const PENT2 = "6:8 6:10 5:7 5:10 4:7R 4:10 3:7 3:9 2:8 2:10R 1:8 1:10";

export const LEAD_TRACK: PathTrack = {
  id: "lead",
  title: "Lead & technique",
  blurb: "Riffs, scales, bends and solos: from your first single notes to improvising over a band.",
  levels: [
    {
      id: "lead-1",
      title: "Lead 1 · First riffs",
      blurb: "Single notes: picking one string at a time, your first riff and two melodies.",
      sessions: [
        S("l1-open", "Picking single strings", "Every open string, one at a time.",
          read("Reading the lead highway", `Lead parts are **single notes**. On the highway each lane is a **string** (low E on the left, high e on the right) and the number is the **fret** (0 = open).

Hold the pick between your thumb and the side of your index finger. Pick **one string** and let it ring. Rest your palm lightly on the bridge to steady your hand.`),
          play("Find the open strings", "Pick each open string, thick to thin. The app listens for each note.", notes("6:0 5:0 4:0 3:0 2:0 1:0")),
          groove(riff("lead-open"))),
        S("l1-riff", "Your first riff", "Night Drive: frets 0, 3, 5 on the low strings.",
          read("One finger per fret", `Numbers on the highway are frets; the lane is the string. Use **finger 1 for fret 3** and **finger 3 for fret 5**: one finger per fret keeps your hand still and your notes clean.`,
            tab(`e|----------------|
B|----------------|
G|----------------|
D|----------------|
A|----------0--2--|
E|--0--3--5-------|`, "Night Drive")),
          groove(riff("lead-night"))),
        S("l1-melodies", "Gig: two melodies", "Ode to Joy and Twinkle Twinkle on the top strings.",
          read("Melodies on the top strings", `Stay on the **top two strings**. Keep your hand over frets 1 to 5 and let your fingers do the walking: index for fret 1, ring for fret 3.`),
          groove(riff("lead-ode")),
          groove(riff("lead-twinkle"), "follow")),
      ],
    },
    {
      id: "lead-2",
      title: "Lead 2 · Hands that work together",
      blurb: "Alternate picking, one finger per fret and finger independence: the daily warm-up of every pro.",
      sessions: [
        S("l2-alt", "Alternate picking", "Down, up, down, up.",
          read("Down-up", `**Alternate picking** means strict down-up-down-up strokes, whatever the notes. It's the foundation of speed and evenness.

- Small motions: the pick barely leaves the string.
- Move from the wrist (and a little forearm rotation), not the elbow.
- Practise **slowly and evenly** with a click. Speed is the reward for accuracy, never the goal.`,
            tab(`e|--------------------|
B|--------------------|
G|--------------------|
D|--------------------|
A|--------------------|
E|--0--0--0--0--------|
     D  U  D  U        `, "Four notes, alternate picking")),
          play("Even picks", "Pick the low E four times then the A four times, alternating down-up. Even volume on every note.", notes("6:0 5:0 6:0 5:0"))),
        S("l2-chromatic", "The 1-2-3-4 exercise", "One finger per fret across the strings.",
          read("Chromatic warm-up", `The most famous warm-up in guitar: on each string, frets **1 2 3 4** with fingers **1 2 3 4**, then move to the next string.

- Keep fingers **close to the strings** when they're not pressing.
- Leave each finger down until you need it again (on the way up).
- Alternate pick every note.`,
            tab(`e|------------------------1-2-3-4|
B|----------------1-2-3-4---------|
G|--------1-2-3-4-----------------|
D|-1-2-3-4------------------------|`, "Chromatic: one finger per fret")),
          play("Chromatic, low strings", "Frets 1 2 3 4 on the low E, then on the A string.", notes("6:1 6:2 6:3 6:4 5:1 5:2 5:3 5:4"))),
        S("l2-spider", "The spider", "Finger independence.",
          read("Spider walk", `Now cross strings **between** fingers: finger 1 on the low E fret 1, finger 2 on the A string fret 2, finger 3 on the low E fret 3, finger 4 on the A string fret 4. Then move the whole pattern across.

This feels awkward on purpose: it trains fingers to move **independently**, which you need for chords and fast lines alike.`),
          play("Spider", "1 and 3 on the low E, 2 and 4 on the A string.", notes("6:1 5:2 6:3 5:4 5:1 4:2 5:3 4:4"))),
        S("l2-ladder", "1-2-3-4 speed ladder", "Build speed the right way.",
          read("Clean first, then fast", `Play the chromatic exercise with the band. Every clean run (2+ stars) raises the speed by **4 bpm**. Your best is saved: next time you start a rung below it.

Relax: tension is the enemy of speed. If your shoulders rise, stop and breathe.`),
          ladder("Chromatic ladder", "One finger per fret, alternate picking, as clean as you can.", lead("ladder-chromatic", "1-2-3-4 ladder", [["6:1", "6:2", "6:3", "6:4"], ["5:1", "5:2", "5:3", "5:4"], ["4:1", "4:2", "4:3", "4:4"], ["3:1", "3:2", "3:3", "3:4"]], { style: "rock", bpm: 60, loops: 1 }), 60, 100)),
        S("l2-practice", "How to practise", "Deliberate practice, slow and short.",
          read("Practise like a pro", `Hours don't make players; **focused minutes** do.

1. **Warm up** 5 minutes (chromatic, spider).
2. **One technique**, slow, with a metronome: start where it's perfect, then raise 4 bpm at a time. Back off when it gets sloppy.
3. **Apply it** to music: a riff, a solo, a song.
4. **Play for fun** at the end.

Record yourself weekly. Rest when your hand hurts: pain is a signal to stop, not to push through.`),
          quiz("Practice",
            q("When the exercise gets sloppy, you should…", ["Push through faster", "Slow down until it's clean", "Skip it"], 1, "Clean and slow builds the motion; sloppy and fast builds mistakes."),
            q("How much should you raise the tempo at a time?", ["About 4 bpm", "20 bpm", "Double it"], 0, "Small steps: your hands adapt to what you repeat."),
            q("Pain in your wrist means…", ["Keep going, it builds strength", "Stop and rest; check your posture", "Squeeze harder"], 1, "Pain is a warning. Tension and bad angles cause injury."))),
      ],
    },
    {
      id: "lead-3",
      title: "Lead 3 · The minor pentatonic",
      blurb: "The five-note scale behind rock, blues and pop solos.",
      sessions: [
        S("l3-box1", "Box 1", "A minor pentatonic at the 5th fret.",
          read("Five notes", `The **minor pentatonic** has five notes: in A, **A C D E G**. It's almost impossible to play a "wrong" note with it over a minor or blues song: that's why it's every guitarist's first solo scale.

The **box 1** shape sits at the 5th fret: two notes per string. Amber dots are the root, **A**. Index finger on the 5th fret, ring (or little) finger on the 7th and 8th.`,
            fret(PENT1, "A minor pentatonic, box 1", 4, 9),
            hear("Hear it", "6:5 6:8 5:5 5:7 4:5 4:7 3:5 3:7 2:5 2:8 1:5 1:8", 0.3)),
          play("Up the box", "Play box 1 from the low E to the high e, alternate picking.", notes("6:5 6:8 5:5 5:7 4:5 4:7 3:5 3:7 2:5 2:8 1:5 1:8"))),
        S("l3-down", "Down the box and patterns", "Descending and in groups of three.",
          read("Patterns", `Scales come alive in **patterns**. Play the box down, then in **groups of three**: notes 1-2-3, 2-3-4, 3-4-5… This is how you train your fingers to find notes without thinking.`,
            fret(PENT1, "Box 1", 4, 9)),
          play("Down the box", "From the high e back to the low E.", notes("1:8 1:5 2:8 2:5 3:7 3:5 4:7 4:5 5:7 5:5 6:8 6:5"))),
        S("l3-licks", "Your first licks", "Short phrases that sound like music.",
          read("Licks and phrasing", `A **lick** is a short musical phrase. The secret of sounding good isn't speed, it's **phrasing**:

- **Leave space.** Play a phrase, then rest, like a singer breathing.
- **End on the root** (A) and it sounds resolved.
- **Repeat** a good idea before moving on.`,
            tab(`e|--8-5--------------|
B|------8-5---------|
G|----------7-5-7---|`, "Classic descending lick")),
          groove(lead("p-pent-lick", "Pentatonic lick", [["1:8", "1:5", "2:8", "2:5"], ["3:7", "3:5", "3:7", "-"], ["1:8", "1:5", "2:8", "2:5"], ["3:7", "-", "4:7", "-"]], { style: "rock", bpm: 70 }))),
        S("l3-echo", "Call and response", "The app plays a lick; you answer with it.",
          read("Learning licks by ear", `Every great player learned by **copying what they heard**. The app plays a short pentatonic lick; you play it back. All the notes are in box 1.

Listen twice, sing it, then find it. If you're stuck, tap *Show me the notes*.`, fret(PENT1, "A minor pentatonic, box 1", 4, 9)),
          echo("Play it back", "Listen, then play the lick back. Any octave counts.", ["1:8 1:5 2:8", "2:5 3:7 3:5", "3:7 2:5 1:5", "1:5 2:8 2:5 3:7"])),
        S("l3-jam", "Jam in A minor", "Your first real solo, scored.",
          read("How a solo is scored", `The band plays **Am, G, F, G**. You solo with box 1. The app listens and scores three things:

1. **Notes in the scale**: aim for over 90%.
2. **Phrases**: leave space. Play an idea, rest, answer it.
3. **Ending home**: finish on an **A**.`),
          improvise("Jam", "Play short phrases with space between them; end on A.", { bars: [["Am"], ["G"], ["F"], ["G"]], bpm: 84, scale: "A C D E G", home: "A", loops: 3, figure: fret(PENT1, "Box 1", 4, 9) })),
        S("l3-gig", "Gig: solo over A minor", "Call and answer with the band.",
          read("Improvising", `Now **you** choose the notes. The band plays a minor groove; stay in box 1 and play short phrases. Try: two notes, rest; three notes, rest; then something longer that ends on an **A**.

There are no wrong answers here, only notes held too long on the wrong beat. If something sounds sour, **bend or slide** to the next scale note and it becomes a choice.`),
          groove(lead("gig-pent-solo", "A minor jam", [["2:5", "2:8", "1:5", "-"], ["2:8", "2:5", "3:7", "-"], ["3:5", "3:7", "4:7", "-"], ["4:5", "-", "4:7", "-"]], { style: "rock", bpm: 76, loops: 2 }), "follow")),
      ],
    },
    {
      id: "lead-4",
      title: "Lead 4 · Expression",
      blurb: "Hammer-ons, pull-offs, slides, bends and vibrato: how notes talk.",
      sessions: [
        S("l4-legato", "Hammer-ons and pull-offs", "Two notes, one pick.",
          read("Legato", `**Hammer-on (h):** pick a note, then **slam** another finger down higher on the same string. The second note sounds without picking.

**Pull-off (p):** with two fingers down, pick the higher note, then **flick** that finger off sideways, plucking the string as it leaves to sound the lower one.

Together they're **legato**: smooth, flowing lines.`,
            tab(`G|--5h7--7p5--|`, "Hammer on, pull off")),
          play("5 hammer 7, 7 pull 5", "On the G string: pick fret 5 and hammer 7; then pick 7 and pull off to 5.", notes("3:5 3:7 3:7 3:5"))),
        S("l4-slides", "Slides", "Glide between notes.",
          read("Sliding", `Pick a note and **keep pressure** while you slide your finger to another fret. The note glides there. Ease off the pressure too much and it dies; press too hard and it stalls.

Slides connect positions: a slide from fret 5 to 7 on the G string moves your hand up without a gap.`,
            tab(`G|--5/7--7\\5--|`, "/ slide up, \\ slide down")),
          play("Slide up", "Pick the G string at fret 5 and slide to 7. The app listens for the arrival.", notes("3:5 3:7"))),
        S("l4-bends", "Bends", "Push the string, raise the pitch.",
          read("Bending in tune", `A **bend** pushes the string across the fret to raise its pitch. Most bends are a **whole step** (two frets) or a **half step** (one fret).

- Use **three fingers** together: ring finger bending, middle and index behind it pushing too.
- Turn from the **wrist**, like turning a door key, not by pushing with the fingertip.
- **Bend in tune**: first play the target note (two frets higher) to hear where you're going.

In box 1, the classic bends are the **G string 7th fret** (D up to E) and the **B string 8th fret** (G up to A).`,
            hear("Target: E (G string fret 9)", "3:9"), hear("Target: A (B string fret 10)", "2:10")),
          play("Bend to pitch", "Bend the G string at fret 7 up a whole step (to sound like fret 9), then the B string at fret 8 (to sound like fret 10). The app listens for the bent pitch.", notes("3:7b2 2:8b2"))),
        S("l4-vibrato", "Vibrato", "Make a note sing.",
          read("Vibrato", `**Vibrato** is a small, repeated bend and release that makes a sustained note sing. It's the most personal thing in your playing: B.B. King's fast shiver and David Gilmour's slow wide sway are instantly recognisable.

- Same motion as bending, but small and even: **up–back, up–back**.
- Start slow and narrow; match it to the tempo.
- Apply it at the **end** of phrases, on long notes.

Then try a **bend with vibrato**: bend up, hold, and add vibrato at the top. That's the classic rock "crying" note.`),
          quiz("Expression",
            q("A whole-step bend raises the note by…", ["One fret", "Two frets", "An octave"], 1, "A whole step = two half steps = two frets."),
            q("How do you check a bend is in tune?", ["Play the target note first and match it", "Bend as far as possible", "Look at the fret"], 0, "Hear the target fret first, then bend to the same pitch."),
            q("A pull-off is…", ["Picking each note", "Plucking the string as the finger leaves it", "Sliding down"], 1, "The leaving finger plucks the string to sound the lower note."))),
      ],
    },
    {
      id: "lead-5",
      title: "Lead 5 · Blues lead",
      blurb: "The blue note, the second box, double stops and playing over a 12-bar.",
      sessions: [
        S("l5-blue", "The blue note", "The ♭5 adds the grit.",
          read("The blues scale", `Add one note to the minor pentatonic, the **♭5 (flat five)**, and you get the **blues scale**: in A, **A C D E♭ E G**.

The E♭ is a **passing note**: slide through it on the way to E or D, don't sit on it. That half-step rub is the cry of the blues.`,
            fret("6:5R 6:8 5:5 5:6=b5 5:7 4:5 4:7R 3:5 3:7 3:8=b5 2:5 2:8 1:5R 1:8", "A blues scale, box 1", 4, 9)),
          play("Through the blue note", "D, E♭, E on the A string, then the same on the G string.", notes("5:5 5:6 5:7 3:7 3:8 3:9"))),
        S("l5-box2", "Box 2", "The next shape up the neck.",
          read("Connecting boxes", `Box 1 isn't the only shape. **Box 2** starts where box 1 ends (fret 8 on the low E) and goes up to fret 10. Same five notes, new places.

Move between boxes with a **slide**: G string 7 → 9 takes you into box 2.`,
            fret(PENT2, "A minor pentatonic, box 2", 6, 11)),
          play("Box 2 up", "Two notes on each string, low to high.", notes("6:8 6:10 5:7 5:10 4:7 4:10 3:7 3:9 2:8 2:10 1:8 1:10"))),
        S("l5-12bar", "Soloing over the 12-bar", "Follow the chords.",
          read("Target the chord tones", `The pentatonic works over the whole 12-bar, but great blues players **follow the chords**:

- Over **A7**: lean on A and C# (bend C up a half step).
- Over **D7**: lean on D and C (the ♭7 of D, already in the scale).
- Over **E7**: lean on E and the D (♭7 of E); B to E is a strong move.

And **call and response**: play a question (a rising phrase), then answer it (a falling phrase that ends on A).`),
          groove(lead("gig-blues-lead", "Blues answers", [["2:5", "2:8", "1:5", "-"], ["3:7", "3:5", "4:7", "-"], ["2:8", "2:5", "3:7", "3:5"], ["4:7", "-", "-", "-"]], { style: "rock", bpm: 72, loops: 3 }), "follow")),
        S("l5-jam", "Blues jam", "Twelve bars of blues, your solo.",
          read("Solo the blues", `A full 12-bar blues in A. Use the **blues scale** (box 1 plus the ♭5). Ideas:
- Start with a phrase, then **repeat it** with a different ending.
- Over the **E7** in bar 9, play a phrase that heads back to **A**.
- Bend, slide, and leave space.`),
          improvise("Blues jam", "Call and answer through all 12 bars; end on A.", { bars: [["A7"], ["A7"], ["A7"], ["A7"], ["D7"], ["D7"], ["A7"], ["A7"], ["E7"], ["D7"], ["A7"], ["E7"]], bpm: 80, scale: "A C D D# E G", home: "A", loops: 1, figure: fret("6:5R 6:8 5:5 5:6=b5 5:7 4:5 4:7R 3:5 3:7 3:8=b5 2:5 2:8 1:5R 1:8", "A blues scale", 4, 9) })),
        S("l5-double", "Double stops", "Two notes at once.",
          read("Double stops", `Play **two strings together** with one finger barring them, or two fingers. In box 1, barre the B and high e strings with your index at the 5th fret, or with your ring finger at the 8th. Chuck Berry built rock and roll on double stops.

Double stops cut through a band and add a rhythmic punch to solos. Try them at the end of a phrase.`,
            tab(`e|--5--5--8--5--|
B|--5--5--8--5--|`, "Double stops on the top two strings"))),
      ],
    },
    {
      id: "lead-6",
      title: "Lead 6 · Major scale and melody",
      blurb: "The major scale, major pentatonic and playing melodies by ear.",
      sessions: [
        S("l6-major", "The major scale", "Do re mi on the neck.",
          read("Do re mi", `The **major scale** is the do-re-mi you know: seven notes, the pattern of **whole (W) and half (H) steps**: **W W H W W W H**.

C major is all the natural notes, **C D E F G A B**. In the open position, starting on the A string 3rd fret:`,
            fret("5:3R 4:0 4:2 4:3 3:0 3:2 2:0 2:1R", "C major, open position", 0, 4),
            hear("Hear it", "5:3 4:0 4:2 4:3 3:0 3:2 2:0 2:1", 0.4)),
          play("C major", "Play the C major scale up from the A string, 3rd fret.", notes("5:3 4:0 4:2 4:3 3:0 3:2 2:0 2:1"))),
        S("l6-movable", "A movable major scale", "One shape, every key.",
          read("Movable shape", `This shape starts on the **low E string** with the **middle finger** (here, G at the 3rd fret). Slide it anywhere and the root names the key.`,
            fret("6:3R 6:5 5:2 5:3 5:5 4:2 4:4 4:5R", "G major, root on the low E", 1, 6)),
          play("G major", "Up the shape from the 3rd fret.", notes("6:3 6:5 5:2 5:3 5:5 4:2 4:4 4:5"))),
        S("l6-majpent", "Major pentatonic", "Country, pop and happy solos.",
          read("Five happy notes", `The **major pentatonic** is the major scale without the 4th and 7th: in G, **G A B D E**. Sweet and open: country, soul, the Allman Brothers, pop melodies.

Secret: **G major pentatonic is the same notes as E minor pentatonic** (the relative minor). Same box, different home note.`,
            fret("6:3R 6:5 5:2 5:5 4:2 4:5R", "G major pentatonic (part)", 1, 6)),
          play("G major pentatonic", "Up from G.", notes("6:3 6:5 5:2 5:5 4:2 4:5"))),
        S("l6-ear", "Playing by ear", "Find a melody on the neck.",
          read("By ear", `To work out a melody:
1. **Sing it.** If you can't sing it, you can't find it.
2. Find the **first note** by trying notes until one matches.
3. For each next note: is it **higher or lower**? A small step or a jump?
4. Most melodies move by **steps** within a scale.

Train your ear to hear **direction** first; intervals come next.`),
          ear("Higher or lower?", "higher", ["first", "second"], 10)),
      ],
    },
    {
      id: "lead-7",
      title: "Lead 7 · The whole neck",
      blurb: "All five pentatonic boxes, octaves and three-notes-per-string scales.",
      sessions: [
        S("l7-octaves", "Octave shapes", "Find any note's twin.",
          read("Octaves", `Every note has twins up and down the neck. **Octave shapes** find them instantly:

- **Low E → D string**: two strings over, **two frets up**.
- **A → G string**: two strings over, two frets up.
- **D → B string**: two strings over, **three frets up** (the B string is tuned differently).
- **G → high e**: two strings over, three frets up.

Wes Montgomery made a whole style out of playing melodies in octaves.`,
            fret("6:5R 4:7R 5:3R 3:5R", "A and C octaves", 2, 8)),
          play("Octaves", "A on the low E then its octave on the D string; C on the A string then on the G string.", notes("6:5 4:7 5:3 3:5"))),
        S("l7-five", "The five pentatonic boxes", "Connect them all.",
          read("Five boxes, one scale", `The minor pentatonic has **five boxes**, each starting on the next scale note, covering the whole neck between them (they repeat after fret 12). In A:

1. Box 1: frets 5–8 (root on the low E)
2. Box 2: 7–10
3. Box 3: 9–13
4. Box 4: 12–15
5. Box 5: 2–5 (then box 1 again)

These line up exactly with the **CAGED** chord shapes. Learn one new box a week, then practise **sliding between** them on one string.`,
            fret(PENT1, "Box 1", 4, 9), fret(PENT2, "Box 2", 6, 11),
            fret("6:10 6:12 5:10 5:12R 4:10 4:12 3:9 3:12 2:10R 2:13 1:10 1:12", "Box 3", 8, 14)),
          play("Slide across the neck", "On the G string, walk the scale up across the boxes: 5, 7, 9, 12, 14.", notes("3:5 3:7 3:9 3:12 3:14"))),
        S("l7-3nps", "Three notes per string", "Scales for speed and legato.",
          read("3NPS", `Rock and fusion players use **three-notes-per-string** scales: every string has three notes, so picking patterns repeat and legato flows. Wider stretches, but symmetrical fingering.

A minor (natural): **A B C** on the low E (5 7 8), **D E F** on A (5 7 8), **G A B** on D (5 7 9)...`,
            fret("6:5R 6:7 6:8 5:5 5:7 5:8 4:5 4:7R 4:9", "A natural minor, 3 notes per string", 4, 10)),
          play("3NPS run", "Three notes on each low string.", notes("6:5 6:7 6:8 5:5 5:7 5:8 4:5 4:7 4:9"))),
      ],
    },
    {
      id: "lead-8",
      title: "Lead 8 · Advanced soloing",
      blurb: "Modes, arpeggios, outlining chords and the techniques of virtuosos.",
      sessions: [
        S("l8-modes", "Modes you'll actually use", "Dorian and Mixolydian.",
          read("Colour scales", `**Modes** are the major scale started from different notes. Two are everywhere:

- **Dorian** (minor with a major 6th): A B C D E **F#** G. Jazzy, funky minor: Santana, Pink Floyd, Daft Punk. Use it over **minor 7** grooves.
- **Mixolydian** (major with a ♭7): A B **C#** D E F# **G**. Bluesy major: the Grateful Dead, the Allmans, rock'n'roll. Use it over **dominant 7** chords.

Trick: mix the **minor pentatonic** with the mode's special notes. Over Am7: pentatonic + F#. Over A7: pentatonic + C# and F#.`,
            fret("6:5R 6:7 6:8 5:5 5:7 5:9 4:5 4:7R", "A Dorian (lower part): F# on the A string, 9th fret", 4, 10)),
          quiz("Modes",
            q("Dorian is minor with a…", ["Major 6th", "Flat 2nd", "Major 7th"], 0, "The raised 6th (F# in A Dorian) gives it the bright, soulful colour."),
            q("Over A7, which mode fits?", ["A Mixolydian", "A Phrygian", "A Lydian"], 0, "Mixolydian has the ♭7 (G) of a dominant 7 chord."),
            q("A Dorian has the same notes as…", ["G major", "C major", "A major"], 0, "A is the 2nd note of G major; Dorian is the 2nd mode."))),
        S("l8-arps", "Arpeggios", "Play the chord, one note at a time.",
          read("Outlining chords", `An **arpeggio** is a chord's notes played one by one. Soloing with arpeggios makes the **chord changes audible in your line**: the mark of a great improviser, from Charlie Parker to Eric Johnson.

Start with the **Am arpeggio** at the 5th fret (A C E), then the **C major** (C E G).`,
            fret("6:5R 6:8 5:7 4:7R 3:5 2:5 1:5R", "A minor arpeggio", 4, 9)),
          play("Am arpeggio", "Up the A minor arpeggio.", notes("6:5 6:8 5:7 4:7 3:5 2:5 1:5"))),
        S("l8-virtuoso", "Virtuoso techniques", "Tapping, sweeps, economy picking, hybrid picking.",
          read("The toolbox", `**Economy picking**: when you change strings, keep the pick moving in the same direction (down to the next higher string). Faster than strict alternate for many lines.

**Sweep picking**: one continuous down (or up) motion across strings, one note per string, fretting hand lifting each note as the next sounds. Used for fast arpeggios.

**Tapping**: hammer a note with a **picking-hand finger** on the fretboard, pull off to a fretted note. Eddie Van Halen's *Eruption*.

**Hybrid picking**: pick plus middle and ring fingers. Country chicken-picking and wide intervals.

Each one is a project of weeks. Pick one, use a metronome, start painfully slow.`),
          quiz("Toolbox",
            q("Economy picking means…", ["Always alternate", "Keep the pick's direction when crossing to the next string", "Use only downstrokes"], 1, "One stroke carries through to the next string."),
            q("Sweeps are mostly used for…", ["Fast arpeggios", "Chords", "Bends"], 0, "One note per string in a single sweep."))),
        S("l8-craft", "Building a solo", "Tell a story.",
          read("Shape a solo", `Great solos have a **shape**:

1. **Start simple and low**, with space.
2. **Develop a motif**: repeat an idea, then vary its rhythm or end note.
3. **Build** in range, intensity and density.
4. **Peak** with your strongest phrase (a big bend, a high note).
5. **Resolve** back to the song.

Quote the **vocal melody**. Leave **silence**. Play **for the song**, not for yourself.`),
          groove(lead("gig-final-solo", "Final solo: A minor", [["4:7", "-", "3:5", "3:7"], ["2:5", "-", "2:8", "-"], ["1:5", "1:8", "1:10", "-"], ["1:12", "-", "-", "-"], ["2:10", "1:12", "2:10", "2:8"], ["3:9", "-", "3:7", "-"], ["2:5", "3:7", "3:5", "-"], ["4:7", "-", "-", "-"]], { style: "rock", bpm: 80, loops: 1 }), "follow")),
      ],
    },
  ],
};
