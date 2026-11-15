/**
 * Track 4: Fingerstyle & genres. Fingerpicking from PIMA to Travis picking
 * and harmonics, then the styles: blues, rock, funk, folk/country, reggae,
 * bossa, jazz, and finally the working musician.
 */
import { fret, g, groove, hear, lead, notes, play, q, quiz, read, rhythm, S, tab, type PathTrack } from "../steps";

export const STYLES_TRACK: PathTrack = {
  id: "styles",
  title: "Fingerstyle & genres",
  blurb: "Fingerpicking, then the sounds of blues, rock, funk, folk, reggae, bossa and jazz, and life as a working player.",
  levels: [
    {
      id: "finger-1",
      title: "Fingerstyle 1 · PIMA",
      blurb: "Your thumb plays the bass, your fingers the treble.",
      sessions: [
        S("f1-pima", "Fingers have names", "P I M A.",
          read("PIMA", `Fingerstyle names come from Spanish:

- **p** (pulgar) thumb: plays the **bass strings** (6, 5, 4).
- **i** (índice) index: **G string**.
- **m** (medio) middle: **B string**.
- **a** (anular) ring: **high e**.

Rest your hand so each finger hovers over its string. Pluck **through** the string with the fingertip (and a bit of nail), moving from the knuckle, not the wrist. The thumb moves forward, the fingers pull up into the palm.`),
          play("p i m a", "Hold Em and pluck: thumb on the low E, then G, B and high e with i, m, a.", notes("6:0 3:0 2:0 1:0"))),
        S("f1-arp", "Arpeggio patterns", "Chords one string at a time.",
          read("Pattern p-i-m-a", `Fingerpicked chords are **arpeggios**: the thumb plays the chord's **root** (the lowest note of the shape), then i-m-a climb the top strings.

- **C**: thumb on the A string (3rd fret).
- **Am**: thumb on the open A.
- **G**: thumb on the low E (3rd fret).
- **Em**: thumb on the open low E.

Keep the chord held down the whole time so every note rings into the next.`,
            tab(`e|-------0-------0-------3-------0---|
B|-----1-------1-------0-------0-----|
G|---0-------2-------0-------0-------|
D|-----------------------------------|
A|-3-------0-------------------------|
E|-----------------3-------0---------|
   C       Am      G       Em`, "p i m a on four chords"), hear("Hear it", "5:3 3:0 2:1 1:0 5:0 3:2 2:1 1:0", 0.3)),
          play("C and Am", "Pluck p i m a on C, then on Am.", notes("5:3 3:0 2:1 1:0 5:0 3:2 2:1 1:0"))),
        S("f1-groove", "Fingerpicking with a band", "Keep the thumb steady.",
          read("Thumb is the clock", `In fingerstyle the **thumb is your drummer**: it keeps the beat no matter what the fingers do. If you get lost, keep the thumb going and the fingers will find their way back.

Play the loop below with p-i-m-a on each chord; the band waits for your change.`),
          groove(g("p-f1-arp", "Fingerpicked ballad", [["C"], ["Am"], ["G"], ["Em"]], { style: "ballad", bpm: 64, strum: "D.D.D.D.", focus: ["G", "Em"], tip: "Thumb on the root, then i m a." }))),
      ],
    },
    {
      id: "finger-2",
      title: "Fingerstyle 2 · Travis picking",
      blurb: "The alternating bass behind folk, country and singer-songwriters.",
      sessions: [
        S("f2-bass", "Alternating bass", "Boom-boom from the thumb.",
          read("Travis picking", `Named after Merle Travis, this style has the **thumb alternating between two bass strings on every beat** while the fingers add notes between.

On **C**: the thumb alternates **A string (3rd fret)** and **D string (2nd fret)**: *boom, boom, boom, boom*. Mute lightly with the palm for that warm thump.`,
            tab(`e|-----------------|
B|-----------------|
G|-----------------|
D|---2---2---2---2-|
A|-3---3---3---3---|`, "Thumb only: alternating bass on C")),
          play("Alternate", "Thumb only: A string 3rd fret, D string 2nd fret, twice.", notes("5:3 4:2 5:3 4:2"))),
        S("f2-add", "Adding the fingers", "Notes between the bass.",
          read("Pinch and between", `Now add **i** and **m** on the **&**s (between thumb notes): thumb A, finger B string, thumb D, finger G string. Then try a **pinch**: thumb and a finger at the same time on beat 1.

It feels like patting your head and rubbing your belly. Go slow: the thumb must become automatic first.`,
            tab(`e|-------------------|
B|---1-------1-------|
G|-------0-------0---|
D|-----2-------2-----|
A|-3-------3---------|`, "Basic Travis pattern on C")),
          play("Travis on C", "Thumb A, B string, thumb D, G string.", notes("5:3 2:1 4:2 3:0 5:3 2:1 4:2 3:0"))),
        S("f2-gig", "Gig: Travis in G", "Alternating bass through a progression.",
          read("Bass strings for each chord", `**G**: thumb on the low E (3rd fret) and D string. **C**: A string (3) and D string (2). **D**: the open D and A strings. Keep it moving.`),
          groove(g("gig-travis", "Travis in G", [["G"], ["C"], ["G"], ["D"]], { style: "folk", bpm: 70, strum: "D.D.D.D.", focus: ["G", "C"] }), "follow")),
      ],
    },
    {
      id: "finger-3",
      title: "Fingerstyle 3 · Classical and percussive",
      blurb: "Rest strokes, harmonics, and the guitar as a drum.",
      sessions: [
        S("f3-strokes", "Free and rest strokes", "Classical tone production.",
          read("Two strokes", `**Free stroke (tirando):** the finger plucks and moves into the air above the next string. Used for arpeggios and chords.

**Rest stroke (apoyando):** the finger plucks and comes to **rest on the next string**. Fuller, louder: used for melodies so they sing over the accompaniment.

Classical guitarists shape their nails for tone and alternate **i-m** for scales, never the same finger twice.`),
          play("i-m melody", "Alternate i and m with rest strokes: C major from the A string.", notes("5:3 4:0 4:2 4:3 3:0 3:2 2:0 2:1"))),
        S("f3-harm", "Natural harmonics", "Bell tones.",
          read("Harmonics", `Touch a string **lightly, right over the fret wire** (not pressing) at the **12th, 7th or 5th fret**, pluck, and release: a bell-like **harmonic** rings.

- 12th fret: an octave above the open string.
- 7th fret: an octave and a fifth.
- 5th fret: two octaves.

They're also a precise way to **check tuning**.`,
            tab(`E|--<12>--<7>--<5>--|`, "Harmonics on the low E")),
          play("Harmonics", "12th-fret harmonics on the low E, A, D and G strings.", notes("6:12h 5:12h 4:12h 3:12h"))),
        S("f3-perc", "Percussive guitar", "Slaps, thumps and the body as a drum.",
          read("The guitar is a drum", `Modern acoustic players add percussion:

- **Thumb slap**: the side of the thumb slaps the bass strings on beats **1 and 3** (a kick drum).
- **Palm slap/chuck**: the palm or fingers hit the strings on **2 and 4** (the snare).
- **Body taps**: knuckles on the top of the guitar.

Start with the chuck on 2 and 4 while strumming; that alone transforms a song.`),
          rhythm("Kick and snare", "Kick on 1 and 3, snare on 2 and 4: tap all four beats, accenting 2 and 4.", "x.x.x.x.", 84, 2)),
      ],
    },
    {
      id: "genre-blues",
      title: "Genres 1 · Blues",
      blurb: "The shuffle, the turnaround and the language of the blues.",
      sessions: [
        S("gb-shuffle", "The blues shuffle", "The boogie riff.",
          read("Boogie", `The classic blues **shuffle riff** rocks between the 5th and 6th of the chord over a power chord. On **A**: A string open with the D string at the 2nd fret, then the 4th fret, swung.

Every blues player from Jimmy Reed to Stevie Ray Vaughan used it.`,
            tab(`D|--2--2--4--2--|
A|--0--0--0--0--|`, "Shuffle on A, swung")),
          rhythm("Swing feel", "Long-short: **1 – a 2 – a**.", "x.xx.xx.xx.x", 88, 2),
          groove(g("p-gb-shuffle", "Shuffle 12-bar", [["A5"], ["A5"], ["A5"], ["A5"], ["D5"], ["D5"], ["A5"], ["A5"], ["E5"], ["D5"], ["A5"], ["E5"]], { style: "rock", bpm: 86, strum: "D.DD.DD.", loops: 1, focus: ["A5", "D5"] }), "follow")),
        S("gb-turn", "The turnaround", "The last two bars.",
          read("Turnarounds", `The **turnaround** is the lick in bars 11–12 that leads back to the top. A classic in A: a descending line on the G string against the open high e, landing on **E7**.

Learn three turnarounds and use them in every blues you play.`,
            tab(`e|--5--5--5--5--|-------|
B|--5--5--5--5--|-------|
G|--6--5--4--3--|--1----|
D|--------------|--2----|
A|--------------|-------|
E|--------------|--0----|`, "Descending turnaround to E7")),
          quiz("Blues form",
            q("In a 12-bar blues in A, bar 5 goes to…", ["D (the IV)", "E (the V)", "A"], 0, "Bars 5–6 are the IV chord."),
            q("The turnaround ends on…", ["The V chord", "The I chord", "The IV chord"], 0, "The V pulls you back to bar 1."))),
        S("gb-slide", "Slide guitar", "Glass, steel and open tunings.",
          read("Bottleneck", `**Slide guitar** uses a glass or metal tube on a finger (usually the ring or little finger) resting **over the fret wire**, not pressing. Mute behind the slide with the fingers trailing behind.

Many slide players use **open tunings**: **open G (D G D G B D)** or **open E**, so a straight slide across all strings is a major chord. Listen to Elmore James, Duane Allman and Bonnie Raitt.`),
          quiz("Slide",
            q("Where does the slide sit to be in tune?", ["Directly over the fret wire", "Behind the fret", "Between frets"], 0, "Over the wire: the slide replaces the fret."),
            q("Open G tuning is…", ["D G D G B D", "E A D G B E", "D A D G A D"], 0, "Strum open strings: a G major chord."))),
      ],
    },
    {
      id: "genre-rock",
      title: "Genres 2 · Rock and metal",
      blurb: "Riffs, drop D, gallops and tight palm-muted rhythm.",
      sessions: [
        S("gr-riffs", "Riff writing", "The heart of rock.",
          read("Riffs", `A **riff** is a short, repeated figure that defines a song. Great riffs mix **single notes from the pentatonic** with **power chords**, and use **rests** as hard as notes.

Write your own: pick a key (E is the rock key: open low E!), use the E minor pentatonic (E G A B D) on the low strings, and add a power chord at the end of the bar.`,
            tab(`D|-----------------2-|
A|---------2--0-----2-|
E|--0--3-------3--0---|`, "An original riff in E")),
          groove(lead("p-gr-riff", "Riff in E", [["6:0", "6:3", "5:2", "5:0"], ["6:3", "-", "6:0", "-"]], { style: "rock", bpm: 92 }))),
        S("gr-dropd", "Drop D and heavy rhythm", "One-finger power chords.",
          read("Drop D", `Tune the low E **down a whole step to D** (D A D G B E). Now the three low strings at the same fret are a **power chord**: one finger plays it. Grunge, metal and modern rock live here.

Combine with the **gallop** (eighth + two sixteenths) and **palm muting** for metal rhythm. Tight, precise downpicking is the skill: practise it to a metronome.`),
          rhythm("Gallop", "da-da-DUM: eighth then two sixteenths.", "x.xxx.xxx.xxx.xx", 90, 2),
          rhythm("Downpicked eighths", "Even, driving eighths at speed.", "xxxxxxxx", 132, 2)),
        S("gr-gig", "Gig: Arena rock", "Power chords and a push.",
          groove(g("gig-arena", "Arena", [["E5"], ["E5"], ["C5"], ["D5"], ["E5"], ["G5"], ["A5"], ["A5"]], { style: "rock", bpm: 112, strum: "DDDDDDDD", loops: 2, focus: ["C5", "D5"] }), "play")),
      ],
    },
    {
      id: "genre-funk",
      title: "Genres 3 · Funk and R&B",
      blurb: "Sixteenth-note scratching, 9th chords and playing in the pocket.",
      sessions: [
        S("gf-scratch", "The scratch", "Muted sixteenths.",
          read("Chicken scratch", `Funk guitar is a **drum**. The strumming hand moves in **constant sixteenths**; the fretting hand presses only for the hits and **releases** (still touching) for the muted scratches.

Use small chord shapes high on the neck (the top 3–4 strings). Think Nile Rodgers and Jimmy Nolen.`),
          rhythm("Scratch and hit", "Hit on **1** and **the & of 2**: everything else is scratch (the hand moves, you only tap the dots).", "x.....x.........", 92, 2),
          rhythm("Funk cell", "Count 1 e & a, hit the dots.", "x..x..x...x..x..", 88, 2)),
        S("gf-9th", "The 9th chord", "The funk chord.",
          read("Dominant 9", `The **E9** shape, **x 7 6 7 7 7** with the root on the A string, is the James Brown chord. Slide it up and down a fret for instant funk.

Also learn **minor 7** and **minor 9** shapes for R&B and neo-soul.`,
            fret("5:7R 4:6 3:7 2:7 1:7", "E9: x 7 6 7 7 7", 5, 9)),
          quiz("Funk",
            q("In funk rhythm the strumming hand…", ["Moves in constant 16ths", "Only moves on hits", "Plays whole notes"], 0, "Constant motion; the fretting hand decides what sounds."),
            q("E9 contains…", ["E G♯ B D F♯", "E G B D", "E G♯ B D♯"], 0, "Dominant 7 (D) plus the 9th (F♯)."))),
      ],
    },
    {
      id: "genre-world",
      title: "Genres 4 · Folk, country, reggae and bossa",
      blurb: "Boom-chick, the skank and the bossa nova.",
      sessions: [
        S("gw-country", "Country: boom-chick", "Bass note, strum, bass note, strum.",
          read("Boom-chick", `Country rhythm alternates a **bass note** (boom, beat 1) and a **strum** (chick, beat 2), then the **other bass note** (beat 3) and a strum (4). On **G**: low E 3rd fret, strum, D string, strum.

Add **bass walks** between chords: G → C walking G, A, B, C on the low strings.`),
          rhythm("Boom-chick", "Bass on 1 and 3, strum on 2 and 4: tap all four.", "x.x.x.x.", 100, 2),
          groove(g("p-gw-country", "Country two-step", [["G"], ["G"], ["C"], ["D"]], { style: "folk", bpm: 96, strum: "D.D.D.D.", focus: ["C", "D"] }))),
        S("gw-reggae", "Reggae: the skank", "Everything on the offbeat.",
          read("Offbeat", `Reggae guitar plays short, choked chords **only on the offbeats** (the "&"s, or beats 2 and 4 in slow reggae): the **skank**. Use small shapes on the top strings, upstrokes, and let go of the pressure right after each hit so it's staccato.

The bass and drums hold beat 1; the guitar stays out of their way.`),
          rhythm("Skank", "Tap only the **&**s.", ".x.x.x.x", 76, 2),
          groove(g("p-gw-reggae", "Island offbeat", [["Am"], ["D"], ["Am"], ["D"]], { style: "pop", bpm: 72, strum: ".U.U.U.U", focus: ["Am", "D"] }))),
        S("gw-bossa", "Bossa nova", "Thumb on the bass, fingers syncopated.",
          read("Bossa", `Bossa nova (Brazil, 1950s) keeps a steady **thumb bass on beats 1 and 3** while the fingers pluck chord tones in a **syncopated** pattern. Chords are sevenths and ninths: **Am7, D7, Gmaj7, Cmaj7**.

Listen to João Gilberto: soft, swaying and precise.`),
          rhythm("Bossa pattern", "Finger hits: count 1 e & a and tap the dots.", "x..x..x...x..x..", 70, 2),
          groove(g("p-gw-bossa", "Bossa in C", [["Cmaj7"], ["Am7"], ["Dm7"], ["G7"]], { style: "ballad", bpm: 74, strum: "D..U..D.", focus: ["Dm7", "G7"] }))),
      ],
    },
    {
      id: "genre-jazz",
      title: "Genres 5 · Jazz",
      blurb: "Comping, chord-melody and the swing feel.",
      sessions: [
        S("gj-comp", "Comping: four to the bar", "Freddie Green style.",
          read("Four to the bar", `Big-band guitar plays **one short chord on every beat**, accenting 2 and 4, using three-note shapes (root, 3rd, 7th) on the low strings: the **shell voicings**.

- **Shell maj7**: root, 7th, 3rd.
- **Shell 7**: root, ♭7, 3rd.

Light, short and swinging: you're part of the rhythm section.`,
            fret("6:3R 4:4 3:4", "Gmaj7 shell: 3 x 4 4 x x", 2, 6),
            fret("6:3R 4:3 3:4", "G7 shell: 3 x 3 4 x x", 2, 6)),
          rhythm("Four to the bar", "Every beat, swung: lean on **2** and **4**.", "x.x.x.x.", 120, 2),
          groove(g("p-gj-251", "ii–V–I comping", [["Am7"], ["D7"], ["Gmaj7"], ["Gmaj7"]], { style: "ballad", bpm: 100, strum: "D.D.D.D.", focus: ["D7", "Gmaj7"] }))),
        S("gj-melody", "Chord melody", "Melody and harmony together.",
          read("Chord melody", `In **chord melody** you play the tune on the **top string** of each chord, so one guitar sounds like a whole band. Steps:

1. Learn the melody on the B and high e strings.
2. Under each important melody note, put a chord shape whose **top note is that melody note**.
3. Between chords, play the melody alone.

It's the summit of solo guitar: Joe Pass, Ted Greene, Lenny Breau.`),
          quiz("Jazz",
            q("Shell voicings contain…", ["Root, 3rd and 7th", "Root, 5th, octave", "Only the 5th"], 0, "The 3rd and 7th define the chord; the root grounds it."),
            q("In chord melody the melody note is usually…", ["The top note of the chord", "The bass note", "Not played"], 0, "Highest notes stand out to the ear."))),
      ],
    },
    {
      id: "pro",
      title: "Pro · The working musician",
      blurb: "Practice systems, tone, recording, performing and staying healthy for a lifetime of playing.",
      sessions: [
        S("pro-routine", "A practice system", "Plan your growth.",
          read("The pro routine", `A balanced daily hour:

| Minutes | Focus |
|---|---|
| 5 | Warm-up (chromatic, stretches) |
| 15 | Technique (one skill, metronome, logged tempo) |
| 15 | Repertoire (learning a song) |
| 10 | Theory and ear (this app's drills) |
| 15 | Creative: improvise, write, jam with a Groove |

Keep a **practice log**: date, what, tempo, notes. Review weekly. Set goals per month: *"play the F barre cleanly at 80 bpm changes"*, not *"get better"*.`),
          quiz("Routine",
            q("A good goal is…", ["Get better at guitar", "Play the F–C change cleanly at 80 bpm by the 30th", "Practise more"], 1, "Specific, measurable, dated."),
            q("Why log practice tempos?", ["To see real progress and set the next target", "It's required", "To impress people"], 0, "Data beats feelings: you'll see progress you'd otherwise miss."))),
        S("pro-tone", "Tone and gear", "Hands first, then amps.",
          read("Tone", `**Tone is in your hands** first: where you pick (near the bridge = bright, near the neck = warm), how hard, the pick's thickness and angle.

Then the chain: **guitar → pickups → effects → amp → speaker → room**.

- **Single coils**: bright, glassy (Strat). **Humbuckers**: thick, warm (Les Paul).
- **Gain** (drive/distortion): less than you think. Turn it down until it almost stops singing.
- **EQ**: cut before you boost. Mid-range is where the guitar lives in a band mix.
- **Effects order**: tuner → wah/compressor → drive → modulation → delay → reverb.`),
          quiz("Tone",
            q("Picking near the bridge sounds…", ["Brighter", "Warmer", "The same"], 0, "Near the bridge the string is stiffer: more treble."),
            q("Where does reverb usually go in the chain?", ["At the end", "First", "Before the drive"], 0, "Ambience goes last, after the sound is shaped."))),
        S("pro-record", "Recording yourself", "The honest mirror.",
          read("Record", `Recording is the fastest teacher: it hears what you don't.

- **Phone first**: record practice weekly and listen back the next day.
- **Home studio**: an audio interface, headphones and a free DAW. Use a **DI and amp simulator** or a small mic (SM57) in front of the amp, slightly off-centre of the speaker cone.
- **Double-track** rhythm guitars (play the part twice, pan left and right) for a wide, pro sound.
- **Play to a click**: it makes editing and playing with others possible.`)),
        S("pro-stage", "Performing", "From practice room to stage.",
          read("Gigs", `**Before:** rehearse the set **in order**, standing up, as you'll play it. Know your starts and endings cold; nobody remembers the middle of a song, everyone remembers a train-wreck ending.

**On stage:** tune between songs (a clip-on or pedal tuner), keep an eye on the drummer, and **keep going** through mistakes: the audience only notices if you stop.

**Nerves:** normal. Slow breathing, a short warm-up, and a first song you could play asleep.

**Playing with others:** listen more than you play. Leave room for the singer. Turn **down**.`),
          quiz("Stage",
            q("You make a mistake mid-song. You…", ["Stop and restart", "Keep going with the band", "Apologise"], 1, "Keep the form; most people never notice."),
            q("The most important part of the set to rehearse?", ["Starts and endings", "Solos", "Tuning"], 0, "Tight starts and endings make a band sound pro."))),
        S("pro-health", "Playing for life", "Ergonomics and injury prevention.",
          read("Healthy hands", `Guitar is physical. Protect your hands:

- **Warm up** before hard playing; stretch gently after.
- **Minimum pressure**: press only as hard as needed for a clean note. Test by easing off until it buzzes, then add a little.
- **Straight-ish wrists**: avoid sharp bends, especially on barre chords.
- **Breaks**: 5 minutes every 30.
- **Strap height**: the guitar at the same height standing as sitting.
- Sharp pain, numbness or tingling: **stop** and see a professional.

Hearing: use earplugs at loud rehearsals and gigs. Musicians' plugs keep the sound clear.`),
          quiz("Health",
            q("How hard should you press the strings?", ["As hard as possible", "Just enough for a clean note", "Barely touching"], 1, "Excess pressure causes tension, pain and sharp notes."),
            q("Numbness in your fretting hand means…", ["Stop and get it checked", "Play through it", "Press harder"], 0, "Nerve symptoms are a warning sign."))),
        S("pro-final", "Final gig: everything", "A last long play-along.",
          read("You made it here", `If you've worked through every track, you know the neck, hear intervals and chords, read charts and tab, play barre chords, sevenths and colour chords, solo with pentatonics, modes and arpeggios, fingerpick, and play in a dozen styles.

Now the work is **repertoire, ears and other musicians**. Learn songs you love, transcribe, jam, play gigs. That never ends, and that's the joy of it.`),
          groove(g("gig-final", "Finale", [["Am7"], ["D7"], ["Gmaj7"], ["Cmaj7"], ["F"], ["Bm7b5"], ["E7"], ["Am"], ["C"], ["G"], ["Am"], ["F"], ["Dm7"], ["G7"], ["C"], ["E7"]], { style: "pop", bpm: 88, strum: "D.DU.UDU", loops: 1, focus: ["Bm7b5", "E7"] }), "play")),
      ],
    },
  ],
};
