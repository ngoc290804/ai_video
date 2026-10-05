/* Generated from contracts/project.schema.json. Do not edit. */
export type Id = string;

export type FrameRate = {
  "numerator": number;
  "denominator": number;
};

export type ProviderKind = "text" | "image" | "video" | "voice";

export type Binding = {
  "connectionId": Id;
  "modelId": string;
  "presetId"?: Id;
};

export type VideoSettings = {
  "targetDurationMs": number;
  "durationPolicy": "target" | "strict";
  "width": number;
  "height": number;
  "aspectRatio": "16:9" | "9:16" | "1:1" | "4:3" | "custom";
  "fps": FrameRate;
  "fit": "contain" | "cover";
  "backgroundColor": string;
};

export type Character = {
  "id": Id;
  "name": string;
  "role": "male_lead" | "female_lead" | "supporting" | "antagonist" | "narrator" | "custom";
  "customRole"?: string;
  "personality": string;
  "strengths": string;
  "background": string;
  "appearance": string;
  "clothing": string;
  "mannerisms": string;
  "continuityNotes": string;
  "referenceAssetIds": (Id)[];
  "primaryReferenceAssetId"?: Id;
  "voice"?: {
  "binding": Binding;
  "voiceId": string;
  "speed": number;
  "language": string;
};
  "lockedFields": (string)[];
};

export type Dialogue = {
  "id": Id;
  "speakerId"?: Id;
  "kind": "dialogue" | "narration";
  "text": string;
  "emotion"?: string;
  "pronunciationNotes"?: string;
  "voiceOverride"?: {
  "binding": Binding;
  "voiceId": string;
};
  "audioAssetId"?: Id;
  "startFrame": number;
  "durationFrames"?: number;
};

export type Shot = {
  "id": Id;
  "description": string;
  "characterIds": (Id)[];
  "imagePrompt": string;
  "videoPrompt": string;
  "negativePrompt"?: string;
  "camera": string;
  "durationFrames": number;
  "referenceAssetIds": (Id)[];
  "selectedImageAssetId"?: Id;
  "selectedVideoAssetId"?: Id;
};

export type Scene = {
  "id": Id;
  "title": string;
  "summary": string;
  "location": string;
  "timeOfDay": string;
  "mood": string;
  "characterIds": (Id)[];
  "continuityNotes": string;
  "targetDurationMs": number;
  "shots": (Shot)[];
  "dialogues": (Dialogue)[];
  "lockedFields": (string)[];
  "reviewStatus": "draft" | "approved";
};

export type Chapter = {
  "id": Id;
  "title": string;
  "summary": string;
  "sceneIds": (Id)[];
};

export type Asset = {
  "id": Id;
  "kind": "image" | "video" | "audio" | "subtitle";
  "relativePath": string;
  "originalName"?: string;
  "mime": string;
  "bytes": number;
  "sha256": string;
  "createdAt": string;
  "origin": "imported" | "generated" | "rendered";
  "width"?: number;
  "height"?: number;
  "durationMs"?: number;
  "fps"?: FrameRate;
  "sampleRate"?: number;
  "channels"?: number;
  "provenance"?: {
  "jobId": Id;
  "connectionId"?: Id;
  "modelId"?: string;
  "promptHash"?: string;
  "inputHash": string;
  "providerRequestId"?: string;
};
};

export type TimelineItem = {
  "id": Id;
  "sceneId"?: Id;
  "shotId"?: Id;
  "assetId": Id;
  "inFrame": number;
  "durationFrames": number;
  "transitionOut": {
  "kind": "cut" | "crossfade";
  "durationFrames": number;
};
  "sourceAudio": "mute" | "keep";
  "sourceAudioGainDb": number;
};

export type AudioTrack = {
  "id": Id;
  "assetId": Id;
  "kind": "voice" | "music";
  "startFrame": number;
  "inFrame": number;
  "durationFrames": number;
  "gainDb": number;
  "fadeInFrames": number;
  "fadeOutFrames": number;
  "loop": boolean;
};

export type SubtitleCue = {
  "id": Id;
  "startFrame": number;
  "endFrame": number;
  "text": string;
};

export type Project = {
  "schemaVersion": 1;
  "id": Id;
  "revision": number;
  "title": string;
  "createdAt": string;
  "updatedAt": string;
  "language": string;
  "story": {
  "idea": string;
  "synopsis": string;
  "fullContent": string;
  "genre": string;
  "audience": string;
  "style": string;
  "constraints": string;
  "ending": string;
  "lockedFields": (string)[];
};
  "video": VideoSettings;
  "providerBindings": {
  "text": Binding | null;
  "image": Binding | null;
  "video": Binding | null;
  "voice": Binding | null;
};
  "characters": (Character)[];
  "chapters": (Chapter)[];
  "scenes": (Scene)[];
  "assets": (Asset)[];
  "timeline": {
  "items": (TimelineItem)[];
  "audioTracks": (AudioTrack)[];
  "subtitles": (SubtitleCue)[];
  "subtitleMode": "none" | "sidecar" | "burn_in";
};
};
