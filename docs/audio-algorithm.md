# Audio Algorithm Design — AI Guitar Tutor

This document describes the algorithm used by the AI Guitar Tutor system to evaluate guitar chords played by the user.

The goal of the algorithm is to determine whether the user played the correct chord and identify common beginner mistakes.

This document guides implementation of the **Audio Evaluation Engine**.

---

# Overview

The audio evaluation system analyzes a recorded chord and compares it with the expected chord structure.

The algorithm performs the following tasks:

• detect frequencies in the recorded audio
• map frequencies to musical notes
• determine which strings are active
• compare detected notes with the expected chord
• classify mistakes
• generate a chord accuracy score

---

# High-Level Processing Pipeline

The evaluation pipeline is composed of several stages.

Audio Input
↓
Preprocessing
↓
Frame Segmentation
↓
Frequency Spectrum Analysis
↓
Pitch Detection
↓
Note Identification
↓
Chord Matching
↓
Error Detection
↓
Score Calculation

Each stage is described below.

---

# Stage 1 — Audio Input

The system records audio using the device microphone.

Recommended recording settings:

Sample rate: 44.1 kHz
Channels: mono
Recording duration: 2–4 seconds

The recording should capture a single chord strum.

---

# Stage 2 — Preprocessing

Before performing analysis, the audio signal should be cleaned.

Goals:

• remove background noise
• normalize volume
• isolate the chord sound

Typical preprocessing steps:

High-pass filtering
Spectral noise gating
Volume normalization

This improves the accuracy of frequency detection.

---

# Stage 3 — Frame Segmentation

Audio is split into small frames for time-frequency analysis.

Typical parameters:

Frame size: 2048 samples
Hop length: 512 samples

This allows the algorithm to track how frequencies change over time.

Libraries commonly used:

librosa
numpy

---

# Stage 4 — Frequency Spectrum Analysis

The signal is transformed into the frequency domain using FFT (Fast Fourier Transform).

This produces a spectrum showing the energy of each frequency.

Example:

82 Hz
110 Hz
147 Hz
196 Hz

Each frequency peak corresponds to a vibrating guitar string or harmonic.

---

# Stage 5 — Pitch Detection

The algorithm identifies fundamental frequencies corresponding to musical notes.

Recommended methods:

YIN pitch detection
Harmonic Product Spectrum
CREPE neural pitch detection (optional)

Output example:

Detected frequencies:

98 Hz
147 Hz
196 Hz

These frequencies correspond to musical notes.

---

# Stage 6 — Note Identification

Detected frequencies are mapped to musical notes.

Example mapping:

82 Hz → E2
110 Hz → A2
147 Hz → D3
196 Hz → G3
247 Hz → B3
330 Hz → E4

Mapping is performed using the formula:

note = 12 * log2(frequency / reference_frequency)

Reference frequency is typically A4 = 440 Hz.

---

# Stage 7 — Chord Matching

The system compares detected notes with the expected notes of the target chord.

Example:

Target chord: G Major

Expected notes:

G
B
D

Detected notes:

G
D

Comparison results:

Missing note: B

This indicates an incomplete chord.

---

# Stage 8 — String Activity Detection

The system estimates which guitar strings are active.

Each guitar string corresponds to a frequency band.

Example:

Low E string → ~82 Hz
A string → ~110 Hz
D string → ~147 Hz
G string → ~196 Hz
B string → ~247 Hz
High E string → ~330 Hz

If energy in a band is too low, the string is likely muted.

Example:

Expected strings: 6
Detected strings: 4

Result:

Muted string detected.

---

# Stage 9 — Error Classification

Common errors should be classified.

Possible errors:

Muted string
Missing note
Wrong chord structure
Extra note
Weak signal

Example output:

{
"issue": "muted_string",
"string": "B"
}

---

# Stage 10 — Score Calculation

The system computes a score representing chord accuracy.

Example scoring formula:

score =
0.5 × note accuracy

* 0.3 × string activation
* 0.2 × signal quality

Example:

Note accuracy: 0.8
String activation: 0.7
Signal quality: 0.9

Score = 0.79

Threshold:

Score ≥ 0.80 → chord accepted

---

# Example Evaluation Output

Example result returned by the Audio Engine:

{
"score": 0.72,
"detected_notes": ["G","D"],
"missing_notes": ["B"],
"issue": "muted_string"
}

This result is passed to the Feedback Engine.

---

# Performance Considerations

The algorithm must run quickly enough to provide near real-time feedback.

Optimization strategies:

• cache FFT results
• avoid redundant signal transformations
• limit analysis to relevant frequency ranges

---

# Limitations

The algorithm may face challenges due to:

• background noise
• low-quality microphones
• harmonic overlap between strings
• acoustic resonance

Improving robustness may require machine learning models in the future.

---

# Future Improvements

Possible improvements include:

• machine-learning pitch detection models
• chord classification neural networks
• real-time chord evaluation
• improved noise suppression

---

# Summary

The audio evaluation algorithm transforms recorded audio into musical information and determines whether the user played the correct chord.

The algorithm pipeline:

Audio Input
→ Preprocessing
→ FFT Analysis
→ Pitch Detection
→ Note Mapping
→ Chord Matching
→ Error Classification
→ Score Calculation

This system enables the AI Guitar Tutor to act as an automated practice instructor.
