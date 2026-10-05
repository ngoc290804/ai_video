import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
const cargo = path.join(os.homedir(), ".cargo/bin/cargo");
const metadata = JSON.parse(
  execFileSync(cargo, ["metadata", "--locked", "--format-version", "1"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  }),
);
await fs.writeFile(
  "licenses/RUST-DEPENDENCIES.json",
  JSON.stringify(
    metadata.packages.map((p) => ({
      name: p.name,
      version: p.version,
      license: p.license,
      repository: p.repository,
    })),
    null,
    2,
  ),
);
