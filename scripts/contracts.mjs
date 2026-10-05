import fs from "node:fs/promises";
const schema = JSON.parse(
  await fs.readFile("contracts/project.schema.json", "utf8"),
);
function type(s) {
  if (s.$ref) return s.$ref.split("/").at(-1);
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.anyOf) return s.anyOf.map(type).join(" | ");
  if (s.type === "object")
    return (
      "{\n" +
      Object.entries(s.properties)
        .map(
          ([k, v]) =>
            `  ${JSON.stringify(k)}${s.required?.includes(k) ? "" : "?"}: ${type(v)};`,
        )
        .join("\n") +
      "\n}"
    );
  if (s.type === "array") return `(${type(s.items)})[]`;
  if (s.type === "integer") return "number";
  return s.type;
}
const text =
  "/* Generated from contracts/project.schema.json. Do not edit. */\n" +
  Object.entries(schema.definitions)
    .map(([name, s]) => `export type ${name} = ${type(s)};\n`)
    .join("\n");
const path = "frontend/src/contracts/project.ts";
if (process.argv.includes("--check")) {
  if ((await fs.readFile(path, "utf8")) !== text)
    throw Error("Contract drift: run pnpm contracts:generate");
} else await fs.writeFile(path, text);
