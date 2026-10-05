import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

// Build-machine tooling only. Installed applications never need Node, Rust or PATH edits.
const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const windows = process.platform === "win32";
if (!windows && process.platform !== "linux")
  throw Error("Packaging currently supports Windows and Ubuntu only.");
const { values } = parseArgs({
  options: {
    "media-dir": { type: "string" },
    "media-license": { type: "string" },
    "webview-online": { type: "boolean", default: false },
  },
});
const cargoDir = path.join(os.homedir(), ".cargo", "bin");
const env = {
  ...process.env,
  PATH: cargoDir + path.delimiter + process.env.PATH,
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || "2",
};
function output(command, args, options = {}) {
  return execFileSync(command, args, {
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  }).trim();
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} failed (${result.status}).`);
}
// Invoke the installed CLI through Node, avoiding .cmd/shell quoting on Windows.
function tauri(args) {
  run(
    process.execPath,
    [
      path.join(root, "frontend/node_modules/@tauri-apps/cli/tauri.js"),
      ...args,
    ],
    {
      cwd: path.join(root, "frontend"),
    },
  );
}
const target = output(path.join(cargoDir, windows ? "rustc.exe" : "rustc"), [
  "-vV",
]).match(/^host: (.+)$/m)?.[1];
if (!target) throw Error("Cannot determine Rust host target.");
if (windows && target !== "x86_64-pc-windows-msvc")
  throw Error("The bundled Windows media build requires x64 MSVC.");

const staging = path.join(root, "target", "packaging");
const licenses = path.join(staging, "licenses");
await fs.mkdir(licenses, { recursive: true });
for (const name of ["NotoSans-LICENSE.txt", "RUST-DEPENDENCIES.json"])
  await fs.copyFile(
    path.join(root, "licenses", name),
    path.join(licenses, name),
  );
let mediaDir = values["media-dir"] && path.resolve(values["media-dir"]);
let mediaLicense =
  values["media-license"] && path.resolve(values["media-license"]);
if (values["media-dir"] && !mediaLicense)
  throw Error(
    "Custom --media-dir requires --media-license with the matching FFmpeg license.",
  );
if (windows && !mediaDir) {
  run("powershell.exe", [
    "-NoProfile",
    "-File",
    "scripts/packaging/windows-media.ps1",
  ]);
  mediaDir = path.join(staging, "ffmpeg-windows", "bin");
  mediaLicense = path.join(staging, "ffmpeg-windows", "LICENSE");
  await fs.copyFile(
    path.join(staging, "ffmpeg-windows", "README.txt"),
    path.join(licenses, "FFmpeg-README.txt"),
  );
}
mediaLicense ||= "/usr/share/doc/ffmpeg/copyright";
await fs.copyFile(mediaLicense, path.join(licenses, "FFmpeg-COPYRIGHT.txt"));
const binaries = [];
await fs.mkdir("frontend/src-tauri/binaries", { recursive: true });
for (const name of ["ffmpeg", "ffprobe"]) {
  const source = mediaDir
    ? path.join(mediaDir, name + (windows ? ".exe" : ""))
    : output("which", [name]);
  const version = output(source, ["-version"]);
  if (name === "ffmpeg") {
    const encoders = output(source, ["-hide_banner", "-encoders"]);
    const filters = output(source, ["-hide_banner", "-filters"]);
    if (
      !/\blibx264\b/.test(encoders) ||
      !/\baac\b/.test(encoders) ||
      !/\bsubtitles\b/.test(filters)
    )
      throw Error(
        "FFmpeg must include libx264, AAC and the subtitles/libass filter.",
      );
  }
  const data = await fs.readFile(source);
  const bundled = path.resolve(
    `frontend/src-tauri/binaries/studio-${name}-${target}${windows ? ".exe" : ""}`,
  );
  await fs.writeFile(bundled, data, { mode: 0o755 });
  binaries.push({
    name,
    bundled,
    version,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await fs.writeFile(
  path.join(licenses, "media-manifest.json"),
  JSON.stringify(
    {
      platform: target,
      date: new Date().toISOString(),
      binaries: binaries.map(({ bundled, ...entry }) => entry),
    },
    null,
    2,
  ) + "\n",
);
const config = JSON.parse(
  await fs.readFile("frontend/src-tauri/tauri.conf.json", "utf8"),
);
config.bundle.targets = [windows ? "nsis" : "deb"];
config.bundle.externalBin = [
  "binaries/studio-ffmpeg",
  "binaries/studio-ffprobe",
];
config.bundle.icon = windows
  ? ["icons/icon.ico", "icons/icon.png"]
  : ["icons/icon.png"];
config.bundle.resources = { "../../target/packaging/licenses/": "licenses/" };
if (windows) {
  config.bundle.windows = {
    webviewInstallMode: {
      type: values["webview-online"]
        ? "downloadBootstrapper"
        : "offlineInstaller",
      silent: true,
    },
    nsis: {
      installMode: "currentUser",
      languages: ["Vietnamese", "English"],
      displayLanguageSelector: true,
    },
  };
}
const configPath = "frontend/src-tauri/tauri.bundle.generated.json";
async function saveConfig() {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
}
await saveConfig();
tauri([
  "build",
  "--no-bundle",
  "--config",
  "src-tauri/tauri.bundle.generated.json",
]);
let platformLabel = "windows-x64";
if (!windows) {
  // Derive runtime library versions from the app and media binaries on the build distro.
  const debian = path.join(staging, "debian");
  await fs.mkdir(debian, { recursive: true });
  await fs.writeFile(
    path.join(debian, "control"),
    "Source: ai-video-studio\nSection: video\nPriority: optional\nMaintainer: AI Video Studio\n\nPackage: ai-video-studio\nArchitecture: any\nDescription: AI Video Studio\n",
  );
  const dependencies = output(
    "dpkg-shlibdeps",
    [
      "-O",
      path.join(root, "target/release/ai-video-studio"),
      ...binaries.map((b) => b.bundled),
    ],
    { cwd: staging },
  ).match(/^shlibs:Depends=(.+)$/m)?.[1];
  if (!dependencies)
    throw Error("dpkg-shlibdeps did not report runtime dependencies.");
  config.bundle.linux = {
    deb: {
      depends: [
        ...new Set([
          ...dependencies.split(/,\s*/),
          "gstreamer1.0-plugins-good",
          "gstreamer1.0-libav",
        ]),
      ],
      recommends: ["gnome-keyring"],
    },
  };
  const release = await fs.readFile("/etc/os-release", "utf8");
  const distro = release.match(/^ID="?([\w.-]+)"?$/m)?.[1];
  const version = release.match(/^VERSION_ID="?([\w.-]+)"?$/m)?.[1];
  if (!distro || !version)
    throw Error("Cannot label installer distro version.");
  platformLabel = `${distro}-${version}-${output("dpkg", ["--print-architecture"])}`;
  await saveConfig();
}
tauri([
  "bundle",
  "--config",
  "src-tauri/tauri.bundle.generated.json",
  "--bundles",
  windows ? "nsis" : "deb",
]);
const extension = windows ? ".exe" : ".deb";
const bundleDir = path.join(
  root,
  "target/release/bundle",
  windows ? "nsis" : "deb",
);
const installers = (await fs.readdir(bundleDir)).filter(
  (name) => name.endsWith(extension) && name.includes(config.version),
);
if (installers.length !== 1)
  throw Error(
    `Expected one installer for ${config.version}, found ${installers.length}.`,
  );
const destination = path.join(root, "target/installers", platformLabel);
await fs.mkdir(destination, { recursive: true });
const filename = `ai-video-studio_${config.version}_${platformLabel}${windows ? "_setup" : ""}${extension}`;
const data = await fs.readFile(path.join(bundleDir, installers[0]));
await fs.writeFile(path.join(destination, filename), data);
await fs.writeFile(
  path.join(destination, "SHA256SUMS"),
  `${createHash("sha256").update(data).digest("hex")}  ${filename}\n`,
);
console.log(`Installer ready: ${path.join(destination, filename)}`);
