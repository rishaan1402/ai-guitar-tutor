/**
 * Track 1: Chords & rhythm. From the first chord to pro rhythm playing:
 * open chords, strumming and time, barre chords, power chords, sevenths,
 * colour chords, triads and comping. Songs are traditional / public domain.
 */
import { chord, ear, fig, fret, g, groove, hearChord, ladder, notes, play, q, quiz, read, rhythm, S, strumRhythm, tab, type PathTrack } from "../steps";

export const CHORDS_TRACK: PathTrack = {
  id: "chords",
  title: "Chords & rhythm",
  blurb: "Open chords to barre chords, strumming to sixteenth-note funk: the engine of every band.",
  levels: [
    {
      id: "basics-1",
      title: "Basics 1 · First chords",
      blurb: "Holding the guitar, five open chords and your first changes. By the end you'll play a whole song.",
      sessions: [
        S("b1-start", "Your guitar", "Parts, posture, tuning and how to read a chord box.",
          read("The guitar", `Six strings, numbered from the **thinnest (1, high e)** to the **thickest (6, low E)**. From thick to thin they are tuned **E A D G B e**: remember it as *Eddie Ate Dynamite, Good Bye Eddie*.

- **Frets** are the metal bars across the neck. Pressing a string just behind a fret makes it shorter, and higher.
- Each fret is one **half step** (one semitone) higher than the last.
- The **nut** is the white strip at the top of the neck; open strings ring from there.`,
            fret("6:0=E 5:0=A 4:0=D 3:0=G 2:0=B 1:0=e", "Open strings: thick (bottom) to thin (top)", 0, 4)),
          read("Posture and hands", `**Sitting:** guitar body on your right leg (left leg if you play left-handed), neck pointing slightly up, back straight.

**Fretting hand:** thumb behind the neck roughly opposite your middle finger, fingers curved like you're holding a ball. Press with **fingertips**, right behind the fret, not on top of it.

**Strumming hand:** a loose wrist does the work, not the elbow. Hold the pick between thumb pad and the side of your index finger with about 2 mm showing.

**Tune before you play.** Use the tuner pedal in the studio: an out-of-tune guitar makes right chords sound wrong.`),
          read("Reading a chord box", `A chord box is the neck standing up, as if you looked at it hanging on a wall.

- **Vertical lines** are strings: low E on the left, high e on the right.
- **Horizontal lines** are frets; the thick line on top is the nut.
- **Dots** with numbers are your fingers: 1 index, 2 middle, 3 ring, 4 little finger.
- **o** over a string: play it open. **x**: don't play it.`, fig("Em"), fig("C")),
          quiz("Check yourself",
            q("Which string is string 1?", ["The thickest (low E)", "The thinnest (high e)", "The middle (G)"], 1, "Strings are numbered from the thinnest: 1 is high e, 6 is low E."),
            q("What are the open strings, thick to thin?", ["E A D G B E", "E B G D A E", "A D G C E A"], 0, "E A D G B e: Eddie Ate Dynamite, Good Bye Eddie."),
            q("An x over a string in a chord box means…", ["Play it open", "Don't play it", "Press it with finger 1"], 1, "x means leave that string out; o means play it open."),
            q("Where do you press a string?", ["Right on top of the fret", "Just behind the fret", "In the middle between frets"], 1, "Just behind the fret needs the least pressure and buzzes least."))),
        S("b1-em", "Em, your first chord", "Two fingers, all six strings.",
          ...chord("Em", "Fingers 2 and 3 on the 2nd fret of the A and D strings.", "Press just behind the fret, on your fingertips.", "Strum all six strings in one smooth move.")),
        S("b1-am", "Am and your first change", "Em to Am: the shape moves down one string.",
          ...chord("Am", "Same two fingers as Em, moved down one string; add finger 1 on the B string, 1st fret.", "Don't strum the low E string.", "Change slowly first: the band waits for you."),
          groove(g("p-em-am", "Em ↔ Am", [["Em"], ["Am"], ["Em"], ["Am"]], { focus: ["Em", "Am"], style: "ballad", bpm: 62, tip: "Move fingers 2 and 3 together, then add 1." }))),
        S("b1-e", "E major", "Am's shape, one string higher.",
          ...chord("E", "The Am shape moved up one string: frets 2, 2, 1.", "All six strings ring.", "Am to E is one move: keep the shape, shift it."),
          groove(g("p-am-e", "Am ↔ E", [["Am"], ["E"], ["Am"], ["E"]], { focus: ["Am", "E"], style: "ballad", bpm: 62, tip: "Keep the shape locked and move it as one piece." }))),
        S("b1-a", "A major", "Three fingers in a row on the 2nd fret.",
          ...chord("A", "Fingers 1, 2, 3 side by side on the 2nd fret of the D, G and B strings.", "Skip the low E string.", "E to A is the most common change in rock and blues."),
          groove(g("p-e-a", "E ↔ A", [["E"], ["A"], ["E"], ["A"]], { focus: ["E", "A"], style: "folk", bpm: 64 }))),
        S("b1-d", "D major", "A little triangle on the top strings.",
          ...chord("D", "Strum only the top four strings, from the open D.", "Finger 3 on the B string, 3rd fret, makes the triangle.", "A to D: lift together, land together."),
          groove(g("p-a-d", "A ↔ D", [["A"], ["D"], ["A"], ["D"]], { focus: ["A", "D"], style: "folk", bpm: 64 }))),
        S("b1-gig", "Gig: Drunken Sailor", "A traditional sea shanty with Em and D.",
          read("Before the gig", `Two chords, one song: **Em** most of the time, **D** for the lift.

Keep strumming even if a change is late: in *Follow me* mode the music follows you. A steady right hand matters more than a perfect left hand.`),
          groove(g("p-em-d", "Em ↔ D", [["Em"], ["D"], ["Em"], ["D"]], { focus: ["Em", "D"], style: "folk", bpm: 66 })),
          groove(g("gig-sailor", "Drunken Sailor (traditional)", [["Em"], ["D"], ["Em"], ["Em", "D"], ["Em"], ["D"], ["Em"], ["D", "Em"]], { style: "folk", bpm: 72, strum: "D.D.D.D.", loops: 1, focus: ["Em", "D"] }), "follow")),
      ],
    },
    {
      id: "basics-2",
      title: "Basics 2 · The big three",
      blurb: "G, C and D: the chords behind thousands of songs, and your first real strum.",
      sessions: [
        S("b2-g", "G major", "A big, bright chord across all six strings.",
          ...chord("G", "Fingers 2 and 3 on the low strings, finger 4 (or 3) on the high e, 3rd fret.", "Arch your fingers so the open strings ring.", "G to D: your ring finger can guide the move."),
          groove(g("p-g-d", "G ↔ D", [["G"], ["D"], ["G"], ["D"]], { focus: ["G", "D"], style: "folk", bpm: 64 }))),
        S("b2-c", "C major", "A staircase shape: frets 3, 2, 1.",
          ...chord("C", "Ring finger on the A string 3rd fret, middle on D 2nd, index on B 1st.", "Skip the low E string.", "G to C is the change most beginners find hardest: it's normal."),
          groove(g("p-g-c", "G ↔ C", [["G"], ["C"], ["G"], ["C"]], { focus: ["G", "C"], style: "pop", bpm: 62, tip: "Lead with your ring finger: it moves the least." }))),
        S("b2-count", "Counting time", "Beats, bars and the count of four.",
          read("Beats and bars", `Music has a steady pulse: the **beat**. Beats come in groups called **bars** (or measures). Most pop, rock and folk counts **four beats per bar**: *1 2 3 4, 1 2 3 4*.

- A **quarter note** lasts one beat: strum on every number.
- An **eighth note** lasts half a beat: count *1 & 2 & 3 & 4 &*. Down on the numbers, **up on the "&"**.
- **BPM** (beats per minute) is the speed. 60 bpm is one beat a second.

Your strumming hand should **never stop moving**: down on the beat, up between. To leave a strum out, keep the motion and just miss the strings.`),
          rhythm("Quarter notes", "Tap on every beat, with the click: **1 2 3 4**.", "x.x.x.x.", 70),
          rhythm("Eighth notes", "Now twice as many: **1 & 2 & 3 & 4 &**. Down-up, down-up.", "xxxxxxxx", 66),
          quiz("Counting",
            q("How many eighth notes fit in a bar of 4/4?", ["4", "8", "16"], 1, "Four beats, two eighths each: 1 & 2 & 3 & 4 &."),
            q("You strum up on…", ["the numbers", "the \"&\"s", "beat 1 only"], 1, "Down on the beat, up on the &: the hand swings like a pendulum."))),
        S("b2-ladder", "G ↔ C speed ladder", "The hardest beginner change, faster each time.",
          read("Climb the ladder", `Speed comes from **clean repetitions**, not from rushing. The ladder starts slow; every time you play the change cleanly (2 stars or more), it goes up **4 bpm**. Miss, and you stay on the same rung.

Your best speed is saved, so tomorrow you start just below it. Watch it climb over a week.`),
          ladder("G ↔ C ladder", "Play the change cleanly to climb a rung.", g("ladder-gc", "G ↔ C ladder", [["G"], ["C"], ["G"], ["C"]], { style: "pop", strum: "D.D.D.D.", focus: ["G", "C"] }), 60, 96)),
        S("b2-loop", "The four-chord loop", "G, C, Em, D: the loop behind half the radio.",
          read("Down, down, down, down-up", `You know every chord here. Now string them together with a strum that's **D . D . D . D U**: down on 1, 2, 3, then down-up on 4.

Change chords **on the "&" of 4**, during that last up-strum, so the new chord lands on beat 1. That tiny early move is the secret of smooth changes.`),
          groove(g("p-gced", "Late Night in G", [["G"], ["C"], ["Em"], ["D"]], { focus: ["C", "Em"], style: "pop", bpm: 70, strum: "D.D.D.DU" }))),
        S("b2-gig", "Gig: Amazing Grace", "A traditional hymn in 3/4 with G, C and D.",
          read("Three beats to a bar", `*Amazing Grace* is a **waltz**: three beats per bar, counted **1 2 3, 1 2 3**, with the weight on 1. Strum down on each beat.`),
          rhythm("Waltz time", "Three beats in each bar: tap **1 2 3**, a little stronger on 1.", "x.x.x.", 76, 4),
          groove(g("p-c-g", "C ↔ G", [["C"], ["G"], ["C"], ["G"]], { focus: ["C", "G"], style: "ballad", bpm: 64 })),
          groove(g("gig-grace", "Amazing Grace (traditional)", [["G"], ["G"], ["C"], ["G"], ["G"], ["G"], ["D"], ["D"], ["G"], ["G"], ["C"], ["G"], ["G"], ["D"], ["G"], ["G"]], { style: "ballad", bpm: 84, strum: "D.D.D.", loops: 1, focus: ["G", "C"], beatsPerBar: 3 }), "follow")),
      ],
    },
    {
      id: "chords-3",
      title: "Chords 3 · Rhythm and colour",
      blurb: "A minor-key chord, a real strum pattern, and the 7ths that make blues.",
      sessions: [
        S("c3-dm", "D minor", "D's sad sibling.",
          ...chord("Dm", "Like D, top four strings only.", "Index on the high e, 1st fret; middle on G 2nd; ring on B 3rd.", "Am to Dm: think of it as a small hop."),
          groove(g("p-am-dm", "Am ↔ Dm", [["Am"], ["Dm"], ["Am"], ["Dm"]], { focus: ["Am", "Dm"], style: "ballad", bpm: 64 }))),
        S("c3-strum", "The everyday strum", "Down, down-up, up-down-up.",
          read("The pattern", `The most-used strum in pop and folk: **D . D U . U D U**.

The strums land on **1, 2 &, & 4 &**: the gaps are the **&** of 1 and beat **3**. Say it out loud, **"down, down-up, up-down-up"**, while the hand keeps going down-up the whole time. In the gaps your hand still moves; it just misses the strings.`,
            tab(`count:  1 & 2 & 3 & 4 &
strum:  D   D U   U D U`, "Missed strums are still played in the air")),
          rhythm("Feel the pattern", "Tap the dots: **1, 2 &, & 4 &**.", "x.xx.xxx", 72),
          groove(g("p-strum", "Sunset Loop in C", [["C"], ["Am"], ["Dm"], ["G"]], { focus: ["Dm", "G"], style: "pop", bpm: 66, strum: "D.DU.UDU" }))),
        S("c3-7ths", "7th chords for blues", "A7 and E7: lift a finger, add some grit.",
          ...chord("A7", "A7 is A with the G-string finger lifted: the open G is the 7th.", "7ths want to move: that's what makes blues swing."),
          ...chord("E7", "E7 is E with the D-string finger lifted.", "Listen: the chord sounds unfinished, it leans toward A."),
          groove(g("p-a7-e7", "A ↔ E7", [["A"], ["E7"], ["A"], ["E7"]], { focus: ["A", "E7"], style: "rock", bpm: 70, strum: "D.D.D.D." }))),
        S("c3-gig", "Gig: Scarborough Fair & a 12-bar blues", "A traditional ballad, then the blues.",
          read("The 12-bar blues", `The **12-bar blues** is the most played progression in rock and blues. In the key of A it uses three chords: **A**, **D** and **E7**.

| Bars 1–4 | A A A A7 |
| Bars 5–8 | D D A A |
| Bars 9–12 | E7 D A E7 |

The last bar (E7) is the **turnaround**: it pulls you back to the top.`),
          groove(g("gig-scarborough", "Scarborough Fair (traditional)", [["Am"], ["G"], ["Am"], ["Am"], ["C"], ["Am"], ["D"], ["Am"]], { style: "ballad", bpm: 68, strum: "D...D.D.", loops: 1, focus: ["Am", "G"] }), "follow"),
          groove(g("gig-blues", "12-bar blues in A", [["A"], ["A"], ["A"], ["A7"], ["D"], ["D"], ["A"], ["A"], ["E7"], ["D"], ["A"], ["E7"]], { style: "rock", bpm: 78, strum: "D.DU.UDU", loops: 1, focus: ["A", "D"] }), "follow")),
      ],
    },
    {
      id: "rhythm-4",
      title: "Rhythm 4 · Time and groove",
      blurb: "Syncopation, sixteenths, swing and dynamics: what makes rhythm guitar feel good.",
      sessions: [
        S("r4-push", "The push: syncopation", "Accents between the beats.",
          read("Off the beat", `**Syncopation** means accenting notes *between* the beats. The most common move in pop is the **push**: the chord change arrives on the "&" of 4, half a beat early, and is held over beat 1.

Another classic is the **3-3-2** pattern: in eight eighth notes, accents on 1, the & of 2, and 4: *ONE two three FOUR five six SEVEN eight*. You hear it everywhere from Latin music to pop.`),
          rhythm("3-3-2", "Tap the dots: **1**, **& of 2**, **4**.", "x..x..x.", 80),
          rhythm("Push into the bar", "Hits on **1**, **3**, and the **& of 4**.", "x...x..x", 76)),
        S("r4-16", "Sixteenth notes", "Four strums per beat: 1 e & a.",
          read("Counting sixteenths", `Split every beat into four: **1 e & a, 2 e & a, 3 e & a, 4 e & a**. The hand now moves twice as fast: down on 1 and &, up on e and a.

Sixteenth strumming drives funk, reggaeton and a lot of modern pop. Keep the wrist loose and the strokes small: only brush 3 or 4 strings.`),
          rhythm("Sixteenths", "Tap every sixteenth at a slow tempo: **1 e & a**.", "xxxxxxxxxxxxxxxx", 56, 1),
          rhythm("Funk cell", "A classic sixteenth pattern. Count **1 e & a** slowly and tap the dots.", "x.xxx.x.x.xx.x.x", 60, 2)),
        S("r4-swing", "Swing and shuffle", "Long-short eighths: the blues feel.",
          read("Swing", `In **straight** time, the two eighths in a beat are equal. In **swing** (or **shuffle**), the first is longer and the second shorter, like a triplet with the middle note left out: **ONE-(and)-a TWO-(and)-a**.

Blues, jazz, rockabilly and a lot of country swing. Listen first, then tap.`),
          rhythm("Shuffle", "Each beat: long, short. Tap **1 – a 2 – a 3 – a 4 – a**.", "x.xx.xx.xx.x", 84, 2),
          groove(g("p-shuffle", "Shuffle in A", [["A"], ["A7"], ["D"], ["A"]], { style: "rock", bpm: 80, strum: "D.DUD.DU", focus: ["A7", "D"] }))),
        S("r4-dyn", "Dynamics and muting", "Loud, soft, accents and percussive chucks.",
          read("Play with feel", `Rhythm is more than timing:

- **Dynamics**: verses softer, choruses bigger. Strum fewer strings and closer to the neck for soft, all strings near the bridge for loud.
- **Accents**: hit beats 2 and 4 a little harder (where the snare drum is) and the groove snaps into place.
- **The chuck**: rest the strumming hand's palm on the strings right as you strum, for a percussive *chk*. Classic on beats 2 and 4 in acoustic pop.
- **Fretting-hand mute**: relax the fretting fingers so they touch but don't press the strings, and strum a dead *chick*.

Good rhythm players use silence on purpose.`),
          quiz("Feel",
            q("Where does the snare usually hit in pop and rock?", ["Beats 1 and 3", "Beats 2 and 4", "Every eighth note"], 1, "The backbeat: 2 and 4. Accent those and you lock with the drummer."),
            q("How do you play quieter without stopping the hand?", ["Strum fewer strings, lighter, nearer the neck", "Squeeze the pick harder", "Press the frets less"], 0, "Fewer strings and a lighter touch; the hand keeps its motion."),
            q("A chuck is…", ["A muted percussive strum", "A fast down strum", "A chord with no third"], 0, "Palm (or fretting fingers) kill the strings as you strum: a drum-like hit."))),
        S("r4-strum", "Strum it for real", "The mic hears your strums.",
          read("From tapping to strumming", `So far you've tapped rhythms. Now **strum them on the guitar**: the mic hears each strum and checks it against the beat.

Tips for a clean reading:
- **Mute the strings** with your fretting hand resting on them: each strum becomes a crisp *chk*, easy to hear.
- Keep the hand moving down-up all the time; only hit the strings on the dots.
- Headphones keep the click out of the mic.`),
          strumRhythm("Quarter strums", "Down-strums on every beat: **1 2 3 4**.", "x.x.x.x.", 72),
          strumRhythm("Eighth strums", "Down-up on every eighth: **1 & 2 & 3 & 4 &**.", "xxxxxxxx", 72),
          strumRhythm("The everyday strum", "**1, 2 &, & 4 &**: down, down-up, up-down-up.", "x.xx.xxx", 76)),
        S("r4-gig", "Gig: Rhythm workout", "Four chords, three feels.",
          groove(g("gig-r4-pop", "Pop push", [["G"], ["D"], ["Em"], ["C"]], { style: "pop", bpm: 84, strum: "D.DU.UDU", loops: 2, focus: ["Em", "C"] }), "play"),
          groove(g("gig-r4-folk", "Folk 3/4", [["G"], ["C"], ["D"], ["G"]], { style: "folk", bpm: 90, strum: "D.DUDU", loops: 2, beatsPerBar: 3, focus: ["C", "D"] }), "play")),
      ],
    },
    {
      id: "songs-1",
      title: "Songs 1 · Traditional songbook",
      blurb: "Four traditional songs with the open chords you know, plus D7.",
      sessions: [
        S("sg-saints", "When the Saints Go Marching In", "G, C and a new chord: D7.",
          ...chord("D7", "A little triangle pointing the other way from D: index on B 1st fret, middle on G 2nd, ring on e 2nd.", "Strum from the open D string.", "D7 pulls strongly back to G."),
          read("The song", `A New Orleans spiritual from the early 1900s, now played by every brass band on earth. It's in **G**: almost all G, with a trip to **C** and **D7** pulling home.

Strum **D . D U . U D U** and let it bounce.`),
          groove(g("song-saints", "When the Saints Go Marching In (traditional)", [["G"], ["G"], ["G"], ["G"], ["G"], ["G"], ["D7"], ["D7"], ["G"], ["G"], ["C"], ["C"], ["G"], ["D7"], ["G"], ["G"]], { style: "folk", bpm: 96, strum: "D.DU.UDU", loops: 1, focus: ["G", "D7"] }), "follow")),
        S("sg-susanna", "Oh! Susanna", "D, G and A7: a classic in D.",
          read("The song", `An American song from 1848 by Stephen Foster, long in the public domain. Verse in **D** with **A7** pulling home; the chorus starts on **G**.

Keep the strum light and quick: it's a walking song.`),
          groove(g("song-susanna", "Oh! Susanna (Stephen Foster, 1848)", [["D"], ["D"], ["D"], ["A7"], ["D"], ["D"], ["A7"], ["D"], ["G"], ["G"], ["D"], ["D"], ["D"], ["D"], ["A7"], ["D"]], { style: "folk", bpm: 100, strum: "D.D.D.DU", loops: 1, focus: ["D", "A7"] }), "follow")),
        S("sg-redriver", "Red River Valley", "A cowboy ballad in G.",
          read("The song", `A traditional North American ballad. Slow and steady in **G**, with **D7** and **C**. Let each chord ring and keep the down-strums even.`),
          groove(g("song-redriver", "Red River Valley (traditional)", [["G"], ["G"], ["G"], ["D7"], ["G"], ["G"], ["D7"], ["D7"], ["G"], ["G"], ["C"], ["C"], ["G"], ["D7"], ["G"], ["G"]], { style: "ballad", bpm: 84, strum: "D.D.D.D.", loops: 1, focus: ["G", "C"] }), "follow")),
        S("sg-greensleeves", "Greensleeves", "An English tune from the 1500s, in 3/4.",
          read("The song", `One of the oldest songs most people know. It's a waltz in **A minor**: count **1 2 3**. The **E** major chord at the end of each line gives it that ancient, haunted pull back to Am.

Verse: Am G Am E · Am G Am-E Am. Chorus: C G Am E · C G Am-E Am.`),
          groove(g("song-greensleeves", "Greensleeves (traditional)", [["Am"], ["G"], ["Am"], ["E"], ["Am"], ["G"], ["Am", "E"], ["Am"], ["C"], ["G"], ["Am"], ["E"], ["C"], ["G"], ["Am", "E"], ["Am"]], { style: "ballad", bpm: 90, strum: "D.D.D.", loops: 1, beatsPerBar: 3, focus: ["Am", "E"] }), "follow")),
      ],
    },
    {
      id: "chords-5",
      title: "Chords 5 · Barre chords",
      blurb: "F, Bm and movable shapes: every chord, anywhere on the neck.",
      sessions: [
        S("c5-fmaj7", "Fmaj7: F without the barre", "A pretty chord and a stepping stone.",
          read("The easy F family", `Before the full F barre, learn **Fmaj7**: index on the B string 1st fret, middle on G 2nd, ring on D 3rd, high e open. Top four strings only.

Then try the **mini F**: the same, but lay your index flat across the **B and high e** at the 1st fret. That small barre is the first step to the big one.`, fig("Fmaj7"), fig("F")),
          ...chord("Fmaj7", "Strum the top four strings only.", "C to Fmaj7: fingers 2 and 3 stay in a line; slide them over one string."),
          groove(g("p-c-fmaj7", "C ↔ Fmaj7", [["C"], ["Fmaj7"], ["C"], ["Fmaj7"]], { style: "ballad", bpm: 66, focus: ["C", "Fmaj7"] }))),
        S("c5-f", "The F barre chord", "Index across all six strings.",
          read("How a barre works", `A **barre** is your index finger pressing several strings at once. For **F**, the index lies across all six strings at the 1st fret, and fingers 2, 3, 4 make an **E shape** in front of it.

Tips that make it work:
- Roll the index slightly onto its **bony side**, not the soft middle.
- Keep the index close to the fret; the creases of the finger often cause dead strings.
- Pull back gently with the arm instead of squeezing with the thumb.
- It takes **weeks** to ring clean. Everyone goes through this.`, fig("F")),
          ...chord("F", "E shape with fingers 2-3-4, index barring the 1st fret.", "Check each string one at a time and adjust."),
          groove(g("p-c-f", "C ↔ F", [["C"], ["F"], ["Am"], ["F"]], { style: "pop", bpm: 64, focus: ["C", "F"] }))),
        S("c5-move", "Movable shapes: the E shape", "One shape, twelve chords.",
          read("Slide the shape", `The F barre is an open **E chord** pushed up one fret, with the index as a new nut. Move the whole shape and the chord changes name: the **root** is wherever your index sits on the **low E string**.

| Fret | 1 | 3 | 5 | 7 | 8 | 10 |
|---|---|---|---|---|---|---|
| Chord | F | G | A | B | C | D |

Lift finger 2 (the G-string note) and the major chord becomes **minor**: Fm, Gm, Am... everywhere.`,
            fret("6:3R=G 5:5 4:5 3:4 2:3 1:3", "G major, E shape at the 3rd fret", 2, 6)),
          quiz("Moving shapes",
            q("E-shape barre at the 5th fret: which chord?", ["G", "A", "C"], 1, "The 5th fret of the low E string is A."),
            q("E-shape barre at the 8th fret?", ["C", "D", "B"], 0, "The 8th fret of the low E string is C."),
            q("How do you make the E shape minor?", ["Lift the G-string finger", "Add the little finger", "Don't play the low E"], 0, "That finger plays the major 3rd; without it the barre plays the minor 3rd."))),
        S("c5-bm", "Bm: the A-shape barre", "The root on the A string.",
          read("The A shape", `The second family of barre chords uses the **A shape** (for minor, the Am shape), with the root on the **A string**.

**Bm**: index barres the 2nd fret from the A string up; ring, little and middle make an Am shape two frets higher (4, 4, 3). Don't play the low E.`, fig("Bm"), fig("B")),
          ...chord("Bm", "Root on the A string, 2nd fret.", "G to Bm to Em: the classic G-major ballad move."),
          groove(g("p-g-bm", "G · Bm · Em · C", [["G"], ["Bm"], ["Em"], ["C"]], { style: "ballad", bpm: 66, focus: ["G", "Bm"] }))),
        S("c5-gig", "Gig: The House of the Rising Sun", "A traditional ballad in 6/8 with Am, C, D, F and E.",
          read("6/8 feel", `This traditional song is felt in **six**: *1 2 3 4 5 6*, two big pulses per bar. We'll play it as a slow waltz, three beats a bar, a strum per beat.`),
          groove(g("gig-rising", "The House of the Rising Sun (traditional)", [["Am"], ["C"], ["D"], ["F"], ["Am"], ["C"], ["E"], ["E"], ["Am"], ["C"], ["D"], ["F"], ["Am"], ["E"], ["Am"], ["E"]], { style: "ballad", bpm: 96, strum: "D.D.D.", loops: 1, beatsPerBar: 3, focus: ["D", "F"] }), "follow")),
      ],
    },
    {
      id: "chords-6",
      title: "Chords 6 · Power chords and rock",
      blurb: "Two-note chords, palm muting and riffs: the sound of rock and punk.",
      sessions: [
        S("c6-power", "Power chords", "Root and fifth, nothing else.",
          read("What a power chord is", `A **power chord** (written **5**, like E5) has just the **root** and the **fifth** (often with the root doubled on top). No third, so it's neither major nor minor: it works in any song and sounds huge with distortion.

**Shape:** index on the root (low E or A string); ring finger on the **next string, two frets up** (the fifth). Add the little finger on the string after that, same fret as the ring finger, for the octave.`,
            fret("6:5R=1 5:7=3 4:7=4", "A5: root on the low E, 5th fret", 4, 8),
            fret("5:3R=1 4:5=3 3:5=4", "C5: root on the A string, 3rd fret", 2, 6)),
          ...chord("E5", "Open E5: the low E open, plus the A and D strings at the 2nd fret.", "Only strum the three low strings."),
          ...chord("A5", "Open A5: the A string open, plus D and G at the 2nd fret.", "Mute the low E with the tip of your fretting finger."),
          groove(g("p-e5-a5", "E5 ↔ A5", [["E5"], ["A5"], ["E5"], ["A5"]], { style: "rock", bpm: 90, strum: "DDDDDDDD", focus: ["E5", "A5"] }))),
        S("c6-move", "Moving power chords", "One shape all over the neck.",
          read("Find the root", `Power chords move with no change in shape. Know the notes on the **low E** and **A** strings and you can play any of them.

| Low E | E 0 | F 1 | G 3 | A 5 | B 7 | C 8 | D 10 |
| A string | A 0 | B 2 | C 3 | D 5 | E 7 | F 8 | G 10 |`),
          ...chord("G5", "Root on the low E, 3rd fret."),
          ...chord("C5", "Root on the A string, 3rd fret."),
          ...chord("D5", "Root on the A string, 5th fret."),
          groove(g("p-g5-c5-d5", "Garage loop", [["G5"], ["C5"], ["D5"], ["C5"]], { style: "rock", bpm: 96, strum: "DDDDDDDD", focus: ["C5", "D5"] }))),
        S("c6-palm", "Palm muting", "The chug.",
          read("The chug", `Rest the edge of your strumming palm **lightly on the strings right where they meet the bridge**. Pick down: you get a tight, percussive **chug** instead of a ring. Too far toward the neck and the note dies completely; too far back and it rings open.

Rock rhythm is often **muted eighths** with **open accents**: chug chug chug chug, then lift the palm for a big open hit.`),
          rhythm("Eighth-note chug", "Steady down-strokes on every eighth.", "xxxxxxxx", 100, 2),
          rhythm("Gallop", "Eighth and two sixteenths: **da-da-dum**, the metal gallop.", "x.xxx.xxx.xxx.xx", 80, 2)),
        S("c6-gig", "Gig: Riff rock", "Power chords at speed.",
          groove(g("gig-riffrock", "Riff Rock", [["E5"], ["G5"], ["A5"], ["A5"], ["E5"], ["G5"], ["D5"], ["C5"]], { style: "rock", bpm: 104, strum: "DDDDDDDD", loops: 2, focus: ["D5", "C5"] }), "follow")),
      ],
    },
    {
      id: "chords-7",
      title: "Chords 7 · Sevenths and jazz colour",
      blurb: "Major 7, minor 7, dominant 7 and the ii–V–I.",
      sessions: [
        S("c7-types", "Three kinds of 7th", "Dreamy, mellow and bluesy.",
          read("Add a fourth note", `A 7th chord is a triad plus a fourth note, the **seventh**.

- **Major 7 (maj7)**: major triad + major 7th. Dreamy, soft: Cmaj7, Fmaj7.
- **Minor 7 (m7)**: minor triad + minor 7th. Mellow, soulful: Am7, Dm7, Em7.
- **Dominant 7 (7)**: major triad + minor 7th. Bluesy, restless, wants to move: G7, D7, A7.`, fig("Cmaj7"), fig("Am7"), fig("G7"), hearChord("Cmaj7", "Cmaj7"), hearChord("Am7", "Am7"), hearChord("G7", "G7")),
          ear("Hear the difference", "quality", ["major 7", "minor 7", "dominant 7"], 9)),
        S("c7-shapes", "Open 7th shapes", "Cmaj7, Am7, Dm7, G7.",
          ...chord("Cmaj7", "C with the index lifted: the open B is the major 7th."),
          ...chord("Am7", "Am with the ring finger lifted: the open G is the 7th."),
          ...chord("Dm7", "Index barres the B and high e at the 1st fret; middle on G 2nd."),
          ...chord("G7", "Like G, with the index on the high e at the 1st fret."),
          groove(g("p-7ths", "Seventh heaven", [["Cmaj7"], ["Am7"], ["Dm7"], ["G7"]], { style: "ballad", bpm: 70, focus: ["Dm7", "G7"] }))),
        S("c7-251", "The ii–V–I", "The progression behind jazz standards.",
          read("ii–V–I", `In a major key, chord **ii** is minor 7, **V** is dominant 7 and **I** is major 7. In C: **Dm7 → G7 → Cmaj7**.

The dominant G7 contains a tense interval (B and F, a tritone) that **resolves** inward to C and E. That pull is why this progression ends thousands of songs.`),
          groove(g("p-251", "ii–V–I in C", [["Dm7"], ["G7"], ["Cmaj7"], ["Cmaj7"]], { style: "ballad", bpm: 72, strum: "D.D.D.D.", focus: ["G7", "Cmaj7"] }))),
        S("c7-movable", "Movable 7th shapes", "Barre 7ths for any key.",
          read("E-shape and A-shape sevenths", `The barre shapes have 7th versions too:

- **E-shape dominant 7**: barre, lift the little finger (the D-string octave).
- **E-shape minor 7**: barre with only finger 3 on the A string.
- **A-shape minor 7**: index barres from the A string (the root); finger 3 on the D string two frets up; finger 2 on the B string one fret up.
- **A-shape dominant 7**: index barres from the A string; fingers on the D and B strings two frets up, G string left on the barre.

Learn **one** of each first; jazz players get through whole evenings on six shapes.`,
            fret("6:5R=1 5:7=3 4:5=1 3:6=2 2:5=1 1:5=1", "A7, E shape at the 5th fret", 4, 8),
            fret("5:5R=1 4:7=3 3:5=1 2:6=2 1:5=1", "Dm7, A shape at the 5th fret", 4, 8)),
          ...chord("Bm7b5", "Half-diminished: x 2 3 2 3 x. The ii chord of a minor key."),
          groove(g("p-minor251", "Minor ii–V–i", [["Bm7b5"], ["E7"], ["Am"], ["Am"]], { style: "ballad", bpm: 70, focus: ["Bm7b5", "E7"] }))),
        S("c7-gig", "Gig: Autumn changes", "A long ii–V–I journey.",
          groove(g("gig-autumn", "Autumn Changes", [["Am7"], ["Dm7"], ["G7"], ["Cmaj7"], ["Fmaj7"], ["Bm7b5"], ["E7"], ["Am"]], { style: "ballad", bpm: 76, strum: "D.D.D.D.", loops: 2, focus: ["Bm7b5", "E7"] }), "follow")),
      ],
    },
    {
      id: "chords-8",
      title: "Chords 8 · Colour chords and the capo",
      blurb: "Sus, add9, slash chords and how to play any song in any key.",
      sessions: [
        S("c8-sus", "Sus chords", "Suspended: no third, open and airy.",
          read("Sus2 and sus4", `Replace the 3rd of a chord with the **2nd (sus2)** or the **4th (sus4)** and the chord floats: not major, not minor. Usually it **resolves** back to the plain chord.

Open favourites:
- **Dsus2** x x 0 2 3 0, **Dsus4** x x 0 2 3 3
- **Asus2** x 0 2 2 0 0, **Asus4** x 0 2 2 3 0

Wiggle between D, Dsus4 and Dsus2 with your little finger and ring finger: instant singer-songwriter.`,
            fret("4:0=o 3:2=1 2:3=3 1:0=o", "Dsus2", 0, 4),
            fret("4:0=o 3:2=1 2:3=3 1:3=4", "Dsus4", 0, 4), hearChord("D", "D"), hearChord("Dsus4", "Dsus4"), hearChord("Dsus2", "Dsus2")),
          ear("Sus or not?", "quality", ["major", "sus2", "sus4"], 9)),
        S("c8-add9", "add9 and the anchored fingers", "Cadd9 and the G family.",
          read("Anchor fingers", `**Cadd9** (x 3 2 0 3 3) keeps fingers 3 and 4 on the B and high e at the 3rd fret, exactly where a **G** with those fingers puts them. Play **G (3 2 0 0 3 3)** with ring and little finger on the top strings and you can switch G ↔ Cadd9 ↔ Em7 ↔ Dsus4 moving only two fingers.

This is how acoustic players sound smooth: **keep common fingers anchored**.`,
            fret("6:3=2 5:2=1 2:3=3 1:3=4", "G with anchors", 0, 4),
            fret("5:3=2 4:2=1 2:3=3 1:3=4", "Cadd9", 0, 4)),
          quiz("Colour",
            q("What does add9 add?", ["The 9th (the 2nd an octave up), keeping the 3rd", "A 7th and a 9th", "Takes away the 3rd"], 0, "add9 = triad + 9th. sus2 would replace the 3rd instead."),
            q("Why anchor fingers between chords?", ["Fewer fingers move, so changes are faster and smoother", "It makes chords louder", "It tunes the guitar"], 0, "Common notes held still are the easiest move of all."))),
        S("c8-slash", "Slash chords and walking bass", "G/B, C/G and bass lines.",
          read("Chord over a bass note", `**G/B** means a G chord with **B in the bass**. Slash chords make the bass line walk smoothly: **G → G/B → C** climbs G, B, C.

Open G/B: x 2 0 0 3 3. Common walk-downs: **C → C/B → Am** and **G → D/F# → Em**.`,
            fret("5:2R=1 2:3=3 1:3=4", "G/B: B in the bass", 0, 4)),
          quiz("Slash chords",
            q("In D/F#, which note is lowest?", ["D", "F#", "A"], 1, "The note after the slash is the bass note."),
            q("G → G/B → C: the bass goes…", ["G, B, C", "G, D, C", "G, G, C"], 0, "A walking bass line: root, the 3rd, then the next root."))),
        S("c8-capo", "The capo and transposing", "Easy shapes, any key.",
          read("How a capo works", `A **capo** clamps all strings at one fret: a movable nut. Play your open shapes and they sound **higher by one half step per fret**.

- Capo 2 + G shape = **A** sounding.
- Capo 3 + Em shape = **Gm** sounding.

So a song in **E♭** is easy with **capo 1** and **D** shapes: D up one half step is E♭.

To **transpose** (change key) by ear for a singer, move every chord up or down the same number of half steps, or move the capo.`),
          quiz("Capo maths",
            q("Capo 2, you play a C shape. What sounds?", ["C", "D", "B"], 1, "C up two half steps: C → C# → D."),
            q("A song is in A. You want to play G shapes. Capo at…", ["2", "3", "5"], 0, "G up two half steps is A."),
            q("Capo 5 + Em shape sounds as…", ["Am", "Bm", "Gm"], 0, "E up five half steps: F F# G G# A."))),
      ],
    },
    {
      id: "chords-9",
      title: "Chords 9 · Pro rhythm guitar",
      blurb: "CAGED, triads, voice leading, comping and reading charts like a session player.",
      sessions: [
        S("c9-caged", "The CAGED system", "Five shapes connect every chord on the neck.",
          read("C A G E D", `Every major chord can be played with five open-chord shapes moved up the neck: **C, A, G, E and D**. They connect in that order: the top of one shape is the bottom of the next.

For a **C major** chord:
1. **C shape** at the open position (root on the A string, 3rd fret)
2. **A shape** barred at the 3rd fret
3. **G shape** around frets 5–8
4. **E shape** barred at the 8th fret
5. **D shape** at frets 10–13, then the C shape again at 12.

Learning CAGED means you can always find the chord **right where your hand already is**. It's also the map for scales and solos (see the Lead track).`,
            fret("5:3R 4:2 3:0 2:1 1:0", "C shape", 0, 4),
            fret("5:3R 4:5 3:5 2:5 1:3", "A shape at 3", 2, 6),
            fret("6:8R 5:10 4:10 3:9 2:8 1:8", "E shape at 8", 7, 11)),
          quiz("CAGED",
            q("What order do the shapes connect in, going up the neck?", ["C A G E D", "A B C D E", "E A D G B"], 0, "C → A → G → E → D, then C again an octave up."),
            q("An E-shape barre at the 8th fret is…", ["C", "G", "A"], 0, "The root on the low E string at the 8th fret is C."))),
        S("c9-triads", "Triads on the top strings", "Small shapes, big sound.",
          read("Three-note chords", `A **triad** is just the three notes of a chord: root, 3rd, 5th. On the **top three strings** (G, B, e) each major triad has three **inversions** (which note is on top):

- **Root position**, **1st inversion** (3rd in the bass), **2nd inversion** (5th in the bass).

Small triads leave room for the bass and keys. In a band, a pro guitarist plays **less**, higher, and lets every note count.`,
            fret("3:5=C 2:5=E 1:3=G", "C triad, root position (C lowest)", 2, 6),
            fret("3:9=E 2:8=G 1:8=C", "C triad, 1st inversion (E lowest)", 7, 10)),
          play("Play the C triads", "Pluck each note of the two C triad shapes, low to high, as the dots light up.", notes("3:5 2:5 1:3 3:9 2:8 1:8"))),
        S("c9-voice", "Voice leading", "Move every note the shortest way.",
          read("Smooth voice leading", `**Voice leading** means moving from chord to chord with the **smallest possible movement** in each note. Keep common notes, move the others by a step.

C → F on the top strings: **C triad (G C E) → F triad (A C F)**: G goes up to A, C stays, E goes up to F. Two notes move one fret or two. That's why pros sound smooth even when chords change fast.

Practise any progression by staying in **one area of the neck** and finding the nearest triad each time.`),
          quiz("Smooth",
            q("Common tone between C (C E G) and Am (A C E)?", ["C and E", "G only", "None"], 0, "C and E are in both: keep them, move G up to A."),
            q("Good voice leading moves each note…", ["by the smallest step", "by an octave", "always up"], 0, "Small steps sound smooth and connected."))),
        S("c9-comp", "Comping funk and R&B", "Sixteenths with space.",
          read("Comping", `**Comping** (accompanying) is how guitarists support singers and soloists: short chord stabs, rhythmic, leaving space.

Funk rule: the strumming hand plays **all sixteenths**, but the fretting hand lets only a few ring; the rest are muted scratches. Use **9th chords** and small triads high on the neck. Sit **in the pocket** with the drummer's hi-hat.`),
          rhythm("Funk scratch", "Hits on **1**, **e of 2**, **& of 3**, **a of 4**: everything else is muted air.", "x....x....x....x", 66, 2),
          rhythm("Stabs", "Short hits on the offbeats: **& 2 & 3 & 4 &**.", "..x...x...x...x.", 72, 2)),
        S("c9-charts", "Charts and the Nashville numbers", "Read any chart, play in any key.",
          read("Numbers", `Session players write chords as **numbers** relative to the key: in G, **1 = G, 2 = Am, 3 = Bm, 4 = C, 5 = D, 6 = Em**. A chart of **1 5 6 4** works in every key: G D Em C in G; C G Am F in C.

Chart symbols you'll see:
- **|: :|** repeat; **1. / 2.** first and second endings
- **D.S.** go back to the sign; **Coda** jump to the ending
- **/** one beat of the current chord; a diamond = let it ring
- **N.C.** no chord (stop)`),
          quiz("Numbers",
            q("In C, 1 5 6 4 is…", ["C G Am F", "C F G Am", "C E A F"], 0, "C is 1, G is 5, Am is 6, F is 4."),
            q("In D, the 4 chord is…", ["G", "A", "Em"], 0, "D E F# G: G is the 4th note."),
            q("N.C. means…", ["Next chord", "No chord: stop or let the band play", "Normal capo"], 1, "No chord: rest or play the riff/melody only."))),
        S("c9-gig", "Final gig: the whole toolbox", "Barres, sevenths and a push.",
          groove(g("gig-c9", "Night Session", [["Am7"], ["Dm7"], ["G7"], ["Cmaj7"], ["F"], ["Bm7b5"], ["E7"], ["Am"], ["F"], ["G"], ["Em"], ["Am"], ["Dm7"], ["G7"], ["C"], ["E7"]], { style: "pop", bpm: 84, strum: "D.DU.UDU", loops: 1, focus: ["Bm7b5", "E7"] }), "play")),
      ],
    },
    {
      id: "chords-10",
      title: "Chords 10 · Advanced harmony and rhythm",
      blurb: "Jazz voicings, inversions, altered chords, ghost notes and odd meters.",
      sessions: [
        S("c10-drop2", "Drop-2 voicings", "The jazz guitarist's four-note shapes.",
          read("Drop 2", `Take a four-note chord stacked closely (C E G B), **drop the second-highest note an octave**, and you get a **drop-2 voicing**: four notes on four neighbouring strings, easy to finger and beautifully spread. Jazz guitarists play almost everything with them.

On the top four strings:
- **Cmaj7**: x x 10 12 12 12
- **Dm7**: x x 12 14 13 13
- **G7**: x x 5 7 6 7

Move between them with the **smallest finger moves** (voice leading).`,
            fret("4:10R 3:12 2:12 1:12", "Cmaj7 drop 2", 9, 13), fret("4:5R 3:7 2:6 1:7", "G7 drop 2", 4, 8)),
          play("Play the voicings", "Pluck each note of Cmaj7 then G7, low to high.", notes("4:10 3:12 2:12 1:12 4:5 3:7 2:6 1:7")),
          groove(g("p-drop2", "ii–V–I in drop 2", [["Dm7"], ["G7"], ["Cmaj7"], ["Cmaj7"]], { style: "ballad", bpm: 80, strum: "D...D...", focus: ["G7", "Cmaj7"] }))),
        S("c10-inversions", "Triad inversions everywhere", "Every chord, three ways, on one string set.",
          read("Inversions", `A triad has three notes, so it has three **inversions** depending on which is lowest:
- **Root position**: C E G
- **1st inversion**: E G C
- **2nd inversion**: G C E

On the G, B and e strings, the three C shapes climb the neck: frets 5-5-3, 9-8-8, 12-13-12. Learn them for every chord you use and you can play any progression without moving more than a fret or two.`,
            fret("3:5R 2:5 1:3", "Root position", 2, 6), fret("3:9 2:8 1:8R", "1st inversion", 7, 10), fret("3:12 2:13R 1:12", "2nd inversion", 11, 14)),
          play("Climb the inversions", "Play all three C shapes, low to high.", notes("3:5 2:5 1:3 3:9 2:8 1:8 3:12 2:13 1:12")),
          quiz("Inversions",
            q("In a 1st-inversion triad, the lowest note is…", ["the root", "the 3rd", "the 5th"], 1, "1st inversion puts the 3rd in the bass: E G C for C major."),
            q("G B D with B lowest is…", ["G root position", "G 1st inversion", "G 2nd inversion"], 1, "The 3rd (B) is lowest: 1st inversion."))),
        S("c10-altered", "Altered dominants", "Tension that begs to resolve.",
          read("Altered chords", `A dominant 7th can take **altered** notes for more tension: **♭9, #9, ♭5/#11, #5/♭13**.

The most famous is the **7#9**, the "Hendrix chord": E G# D and a G on top. The G (#9) clashes against the G# (3rd): bluesy, gritty and unforgettable. It's played x 7 6 7 8 x.

In jazz, altered dominants make the V chord sound more urgent before it resolves to I.`, fig("E7#9")),
          ...chord("E7#9", "x 7 6 7 8 x: root on the A string with your middle finger.", "Mute the low E with your fretting thumb or the tip of your middle finger.", "Hit it hard and short: it's a rhythm chord."),
          groove(g("p-hendrix", "Purple riff", [["E7#9"], ["E7#9"], ["G"], ["A"]], { style: "rock", bpm: 92, strum: "D.D..DU.", focus: ["E7#9", "G"] }))),
        S("c10-ghost", "Ghost notes and the pocket", "The notes you feel more than hear.",
          read("Ghost notes", `**Ghost notes** are muted strums between the real hits: the strumming hand never stops, and the fretting hand releases pressure so the in-between strums are just a percussive *chk*. They fill the groove without adding harmony.

**The pocket** is where your hits sit against the drummer: a little behind the beat feels laid-back (soul, reggae), right on it feels driving (rock), a hair ahead feels urgent (punk).`),
          strumRhythm("Sixteenth groove", "Hit the dots; everything else is a muted ghost strum.", "x..xx.x...x..x.x", 72),
          strumRhythm("Funk push", "Accents on 1, the a of 2 and the & of 3.", "x......x..x.....", 76)),
        S("c10-odd", "Odd meters", "Five and seven.",
          read("Counting in five and seven", `**5/4** is usually felt as **3 + 2**: *ONE two three FOUR five*. (*Take Five* is the classic.)

**7/8** is usually **2 + 2 + 3**: *ONE two THREE four FIVE six seven*. It turns up in Balkan folk, prog rock and film music.

The trick is always the same: **find the groupings**, count them out loud, and tap the first beat of each group.`),
          quiz("Odd meters",
            q("5/4 is most often grouped as…", ["3 + 2", "4 + 1", "1 + 1 + 1 + 1 + 1"], 0, "Three then two (or two then three): never five even beats."),
            q("7/8 grouped 2 + 2 + 3 accents which eighths?", ["1, 3 and 5", "1, 4 and 7", "1 and 5"], 0, "Groups start on eighths 1, 3 and 5."),
            q("In 6/8 how many main pulses does a bar have?", ["2", "3", "6"], 0, "Two groups of three eighths."))),
        S("c10-gig", "Gig: Jazz blues in F", "Twelve bars, jazz chords.",
          read("Jazz blues", `The jazz version of the 12-bar adds a **ii–V** (Gm7 C7) at the end and a **D7** that leads to it:

F7 · B♭7 · F7 · F7 · B♭7 · B♭7 · F7 · D7 · Gm7 · C7 · F7 · C7`),
          groove(g("gig-jazzblues", "Jazz blues in F", [["F7"], ["Bb7"], ["F7"], ["F7"], ["Bb7"], ["Bb7"], ["F7"], ["D7"], ["Gm7"], ["C7"], ["F7"], ["C7"]], { style: "ballad", bpm: 100, strum: "D.D.D.D.", loops: 1, focus: ["Gm7", "C7"] }), "play")),
      ],
    },
  ],
};
