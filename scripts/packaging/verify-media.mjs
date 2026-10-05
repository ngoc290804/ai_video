import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = process.argv[2] && path.resolve(process.argv[2]);
if (!directory)
  throw Error(
    "Usage: node scripts/packaging/verify-media.mjs <installed-binary-directory>",
  );
const suffix = process.platform === "win32" ? ".exe" : "";
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), "studio media tiếng Việt "),
);
// Only use bundled executables; no globally installed FFmpeg can mask a broken package.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path"),
);
env.PATH =
  process.platform === "win32"
    ? path.join(process.env.SystemRoot || "C:\\Windows", "System32")
    : "/nonexistent";
function run(name, args) {
  return execFileSync(path.join(directory, `studio-${name}${suffix}`), args, {
    cwd: temporary,
    env,
    encoding: "utf8",
    timeout: 60_000,
  });
}
try {
  await fs.mkdir(path.join(temporary, "fonts"));
  await fs.copyFile(
    fileURLToPath(
      new URL(
        "../../frontend/public/fonts/NotoSans-Regular.ttf",
        import.meta.url,
      ),
    ),
    path.join(temporary, "fonts/NotoSans-Regular.ttf"),
  );
  await fs.writeFile(
    path.join(temporary, "subtitles.srt"),
    "1\n00:00:00,000 --> 00:00:01,000\nKiểm tra cài đặt — tiếng Việt\n",
  );
  run("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:s=320x180:r=24:d=1",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-vf",
    "subtitles=subtitles.srt:fontsdir=fonts:force_style='FontName=Noto Sans'",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "output.mp4",
  ]);
  const result = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      "output.mp4",
    ]),
  );
  assert(result.streams.some((stream) => stream.codec_name === "h264"));
  assert(result.streams.some((stream) => stream.codec_name === "aac"));
  assert(Math.abs(Number(result.format.duration) - 1) < 0.2);
  console.log(
    "PASS: bundled FFmpeg/FFprobe render H.264, AAC and Vietnamese subtitles without FFmpeg in PATH.",
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
