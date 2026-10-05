import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
const cargoDir = path.join(os.homedir(), ".cargo", "bin");
const env = {
  ...process.env,
  PATH: cargoDir + path.delimiter + process.env.PATH,
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS || "2",
};
function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    cwd,
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
}
const mode = process.argv[2];
if (mode === "dev") run("pnpm", ["--dir", "frontend", "tauri", "dev"]);
else if (mode === "check") {
  run("node", ["scripts/contracts.mjs", "--check"]);
  run("pnpm", ["--dir", "frontend", "check"]);
  run("cargo", ["fmt", "--all", "--", "--check"]);
  run("cargo", [
    "clippy",
    "--workspace",
    "--all-targets",
    "--",
    "-D",
    "warnings",
  ]);
} else if (mode === "test") {
  run("pnpm", ["--dir", "frontend", "test"]);
  run("cargo", ["test", "-p", "studio-backend"]);
} else if (mode === "build") {
  run("pnpm", ["--dir", "frontend", "build"]);
  run("cargo", ["build", "--release", "--workspace"]);
} else throw Error("Unknown mode");
