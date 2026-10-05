import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
const root = process.cwd();
const cargo = path.join(os.homedir(), ".cargo", "bin", "cargo");
const rustc = path.join(os.homedir(), ".cargo", "bin", "rustc");
const target = execFileSync(rustc, ["-vV"], { encoding: "utf8" }).match(
  /host: (.+)/,
)[1];
if (process.platform !== "linux")
  throw Error(
    "This package script currently verifies Ubuntu/Linux only. Windows/macOS media binaries and installer validation remain release gates.",
  );
await fs.mkdir("frontend/src-tauri/binaries", { recursive: true });
await fs.mkdir("licenses", { recursive: true });
const manifest = {
  platform: target,
  date: new Date().toISOString(),
  binaries: [],
};
for (const name of ["ffmpeg", "ffprobe"]) {
  const source = execFileSync("which", [name], { encoding: "utf8" }).trim();
  const data = await fs.readFile(source);
  const version = execFileSync(source, ["-version"], { encoding: "utf8" });
  await fs.writeFile(
    `frontend/src-tauri/binaries/studio-${name}-${target}`,
    data,
    { mode: 0o755 },
  );
  manifest.binaries.push({
    name,
    source,
    version,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await fs.copyFile(
  "/usr/share/doc/ffmpeg/copyright",
  "licenses/FFmpeg-COPYRIGHT.txt",
);
await fs.writeFile(
  "licenses/media-manifest.json",
  JSON.stringify(manifest, null, 2),
);
const config = JSON.parse(
  await fs.readFile("frontend/src-tauri/tauri.conf.json", "utf8"),
);
config.bundle.externalBin = [
  "binaries/studio-ffmpeg",
  "binaries/studio-ffprobe",
];
config.bundle.icon = ["icons/icon.png"];
config.bundle.resources = { "../../licenses/": "licenses/" };
config.bundle.linux = {
  deb: {
    depends: [
      "libwebkit2gtk-4.1-0",
      "libgtk-3-0t64",
      "libavdevice62",
      "libavfilter11",
      "libavformat62",
      "libavcodec62",
      "libavutil60",
      "libswscale9",
      "libswresample6",
    ],
  },
};
await fs.writeFile(
  "frontend/src-tauri/tauri.package.json",
  JSON.stringify(config, null, 2),
);
const env = {
  ...process.env,
  PATH: path.dirname(cargo) + path.delimiter + process.env.PATH,
  CARGO_BUILD_JOBS: "2",
};
const result = spawnSync(
  "pnpm",
  [
    "--dir",
    "frontend",
    "tauri",
    "build",
    "--config",
    "src-tauri/tauri.package.json",
    "--bundles",
    "deb",
  ],
  { stdio: "inherit", env },
);
if (result.status) process.exit(result.status);
const out = "target/release/bundle/deb";
const checks = [];
for (const file of await fs.readdir(out)) {
  if (file.endsWith(".deb"))
    checks.push(
      createHash("sha256")
        .update(await fs.readFile(path.join(out, file)))
        .digest("hex") +
        "  " +
        file,
    );
}
await fs.writeFile(path.join(out, "SHA256SUMS"), checks.join("\n") + "\n");
console.log("Unsigned Ubuntu development installer:", out);
