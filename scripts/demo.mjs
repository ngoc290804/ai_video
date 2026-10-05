// Deterministic offline demo, no provider calls. Source assets are generated local SVG/PPM shapes.
import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const dir = "examples/offline-demo";
await fs.mkdir(dir + "/assets/images", { recursive: true });
for (const sub of [
  "jobs",
  "revisions",
  "proposals",
  "cache/normalized",
  "cache/thumbnails",
  "temp",
  "manifests",
])
  await fs.mkdir(dir + "/" + sub, { recursive: true });
const date = "2026-09-28T00:00:00.000Z";
const sceneId = randomUUID(),
  shotId = randomUUID(),
  assetId = randomUUID();
const output = dir + "/assets/images/" + assetId + ".png";
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "color=c=0x3c5640:s=1280x720",
  "-vf",
  "drawbox=x=780:y=110:w=180:h=180:color=0xbbdf78:t=fill,drawbox=x=0:y=500:w=1280:h=220:color=0x26372a:t=fill",
  "-frames:v",
  "1",
  output,
]);
const bytes = await fs.readFile(output);
const p = {
  schemaVersion: 1,
  id: randomUUID(),
  revision: 0,
  title: "Demo offline — Chuyến đi xanh",
  createdAt: date,
  updatedAt: date,
  language: "vi",
  story: {
    idea: "Một chuyến đi nhỏ để nhìn thành phố bằng đôi mắt mới.",
    synopsis: "An tìm một khu vườn yên tĩnh giữa nhịp sống thành phố.",
    fullContent: "Buổi sáng, An rời nhà và bước vào một khu vườn đầy ánh nắng.",
    genre: "Phim ngắn",
    audience: "Mọi lứa tuổi",
    style: "Minh họa tối giản",
    constraints: "Demo local, không sử dụng AI.",
    ending: "Một khoảng lặng xanh.",
    lockedFields: [],
  },
  video: {
    targetDurationMs: 4000,
    durationPolicy: "strict",
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    fps: { numerator: 30, denominator: 1 },
    fit: "contain",
    backgroundColor: "#101114",
  },
  providerBindings: { text: null, image: null, video: null, voice: null },
  characters: [
    {
      id: randomUUID(),
      name: "An",
      role: "supporting",
      personality: "Tò mò và điềm tĩnh",
      strengths: "Quan sát",
      background: "Sống trong thành phố",
      appearance: "Tóc ngắn, nụ cười nhẹ",
      clothing: "Áo sơ mi xanh",
      mannerisms: "Bước chậm",
      continuityNotes: "",
      referenceAssetIds: [],
      lockedFields: [],
    },
  ],
  chapters: [
    {
      id: randomUUID(),
      title: "Một sáng xanh",
      summary: "Bắt đầu hành trình",
      sceneIds: [sceneId],
    },
  ],
  scenes: [
    {
      id: sceneId,
      title: "Khu vườn",
      summary: "Ánh sáng qua những tán lá.",
      location: "Khu vườn",
      timeOfDay: "Sáng",
      mood: "Yên bình",
      characterIds: [],
      continuityNotes: "",
      targetDurationMs: 4000,
      shots: [
        {
          id: shotId,
          description: "Khung cảnh khu vườn tối giản",
          characterIds: [],
          imagePrompt: "",
          videoPrompt: "",
          camera: "Tĩnh",
          durationFrames: 120,
          referenceAssetIds: [],
          selectedImageAssetId: assetId,
        },
      ],
      dialogues: [],
      lockedFields: [],
      reviewStatus: "approved",
    },
  ],
  assets: [
    {
      id: assetId,
      kind: "image",
      relativePath: "assets/images/" + assetId + ".png",
      originalName: "Minh họa local — không AI.png",
      mime: "image/png",
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      createdAt: date,
      origin: "imported",
      width: 1280,
      height: 720,
    },
  ],
  timeline: {
    items: [
      {
        id: randomUUID(),
        sceneId,
        shotId,
        assetId,
        inFrame: 0,
        durationFrames: 120,
        transitionOut: { kind: "cut", durationFrames: 0 },
        sourceAudio: "mute",
        sourceAudioGainDb: 0,
      },
    ],
    audioTracks: [],
    subtitles: [
      {
        id: randomUUID(),
        startFrame: 0,
        endFrame: 120,
        text: "Một khoảng lặng xanh giữa lòng thành phố.",
      },
    ],
    subtitleMode: "burn_in",
  },
};
await fs.writeFile(dir + "/project.json", JSON.stringify(p, null, 2));
console.log("Offline demo:", dir);
