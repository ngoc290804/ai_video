// One-time import of the types in the user's specification. JSON schemas are authoritative afterwards.
import ts from "../frontend/node_modules/typescript/lib/typescript.js";
import fs from "node:fs";
const spec = fs.readFileSync("AI_VIDEO_STUDIO_SPEC.md", "utf8");
const source = spec.slice(
  spec.indexOf("type Id ="),
  spec.indexOf("\n```", spec.indexOf("type Id =")),
);
const ast = ts.createSourceFile(
  "domain.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const defs = {};
function schema(n) {
  if (ts.isTypeReferenceNode(n)) {
    const name = n.typeName.getText(ast);
    if (name === "Record")
      return {
        type: "object",
        properties: Object.fromEntries(
          ["text", "image", "video", "voice"].map((k) => [
            k,
            schema(n.typeArguments[1]),
          ]),
        ),
        required: ["text", "image", "video", "voice"],
        additionalProperties: false,
      };
    return { $ref: "#/definitions/" + name };
  }
  if (ts.isArrayTypeNode(n))
    return { type: "array", items: schema(n.elementType), maxItems: 10000 };
  if (ts.isUnionTypeNode(n)) return { anyOf: n.types.map(schema) };
  if (ts.isLiteralTypeNode(n)) {
    if (n.literal.kind === ts.SyntaxKind.NullKeyword) return { type: "null" };
    return {
      const: ts.isStringLiteral(n.literal)
        ? n.literal.text
        : Number(n.literal.getText(ast)),
    };
  }
  if (ts.isTypeLiteralNode(n)) {
    const properties = {},
      required = [];
    for (const m of n.members) {
      const k = m.name.getText(ast);
      properties[k] = schema(m.type);
      if (!m.questionToken) required.push(k);
    }
    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }
  if (n.kind === ts.SyntaxKind.StringKeyword)
    return { type: "string", maxLength: 200000 };
  if (n.kind === ts.SyntaxKind.NumberKeyword) return { type: "number" };
  if (n.kind === ts.SyntaxKind.BooleanKeyword) return { type: "boolean" };
  throw Error(n.getText(ast));
}
for (const n of ast.statements)
  if (ts.isTypeAliasDeclaration(n)) defs[n.name.text] = schema(n.type);
defs.Id = { type: "string", format: "uuid" };
function walk(s, key = "") {
  if (
    s.type === "number" &&
    !["speed", "sourceAudioGainDb", "gainDb"].includes(key)
  ) {
    s.type = "integer";
    s.minimum = 0;
    s.maximum = Number.MAX_SAFE_INTEGER;
  }
  if (["createdAt", "updatedAt"].includes(key)) s.format = "date-time";
  if (s.properties)
    for (const [k, v] of Object.entries(s.properties)) walk(v, k);
  if (s.items) walk(s.items);
  if (s.anyOf) s.anyOf.forEach((v) => walk(v, key));
}
Object.values(defs).forEach((s) => walk(s));
defs.FrameRate.properties.numerator.minimum = 1;
defs.FrameRate.properties.denominator.minimum = 1;
defs.Project.properties.schemaVersion = { const: 1 };
for (const k of ["width", "height"])
  Object.assign(defs.VideoSettings.properties[k], {
    minimum: 2,
    maximum: 7680,
    multipleOf: 2,
  });
for (const n of ["Shot", "TimelineItem", "AudioTrack"])
  defs[n].properties.durationFrames.minimum = 1;
defs.Asset.properties.sha256 = { type: "string", pattern: "^[a-f0-9]{64}$" };
defs.Asset.properties.relativePath = {
  type: "string",
  maxLength: 500,
  pattern: "^assets/[A-Za-z0-9_./-]+$",
};
fs.writeFileSync(
  "contracts/project.schema.json",
  JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Project",
      $ref: "#/definitions/Project",
      definitions: defs,
    },
    null,
    2,
  ) + "\n",
);
