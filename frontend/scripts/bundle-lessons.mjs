// Copy every lesson video + reference recording into the static build so the
// Android app plays them from inside the APK (instant, works offline).
// Folder names swap '#' for 'sharp' (see src/lib/native.ts bundledLessonPath).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const src = resolve(import.meta.dirname, "../../data/lessons");
const out = resolve(import.meta.dirname, "../out-build/lessons");
if (!existsSync(resolve(out, ".."))) {
  console.error("out-build/ missing: run the mobile build first");
  process.exit(1);
}
let n = 0;
for (const key of readdirSync(src)) {
  const dest = join(out, key.replace(/#/g, "sharp"));
  mkdirSync(dest, { recursive: true });
  for (const f of ["lesson.mp4", "reference.wav"]) {
    if (existsSync(join(src, key, f))) cpSync(join(src, key, f), join(dest, f));
  }
  n++;
}
console.log(`bundled ${n} lessons into out-build/lessons`);
