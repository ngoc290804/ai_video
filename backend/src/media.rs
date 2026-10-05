use crate::{
    domain::{self, id, n, s},
    error::{invalid, Error, Result},
    storage,
};
use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};

pub fn binary(name: &str) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let file = dir.join(format!("studio-{name}{}", std::env::consts::EXE_SUFFIX));
            if file.exists() {
                return file;
            }
        }
    }
    #[cfg(debug_assertions)]
    {
        PathBuf::from(name)
    }
    #[cfg(not(debug_assertions))]
    {
        std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(Path::new("."))
            .join(format!("studio-{name}{}", std::env::consts::EXE_SUFFIX))
    }
}
pub fn version(name: &str) -> Result<String> {
    let o = Command::new(binary(name))
        .arg("-version")
        .output()
        .map_err(|_| Error::new("FFMPEG_MISSING", format!("Không tìm thấy {name}")))?;
    if !o.status.success() {
        return Err(Error::new("FFMPEG_MISSING", "Media engine không chạy được"));
    }
    Ok(String::from_utf8_lossy(&o.stdout)
        .lines()
        .next()
        .unwrap_or("")
        .to_owned())
}
pub fn probe(path: &Path) -> Result<Value> {
    let o = Command::new(binary("ffprobe"))
        .args([
            "-v",
            "error",
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            "mov,matroska,webm,avi,mp3,wav,flac,ogg,aac,image2,png_pipe,jpeg_pipe,webp_pipe,mpegts,mpeg",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
        ])
        .arg(path)
        .output()
        .map_err(|_| Error::new("FFMPEG_MISSING", "Cần FFprobe để đọc media"))?;
    if !o.status.success() {
        return Err(Error::new(
            "PROVIDER_OUTPUT_INVALID",
            "Không đọc được media hoặc định dạng không được hỗ trợ",
        ));
    }
    let v: Value = serde_json::from_slice(&o.stdout)?;
    if v["streams"].as_array().is_none_or(|a| a.is_empty()) {
        return Err(invalid("Media không có stream"));
    }
    Ok(v)
}
pub fn duration(probe: &Value) -> u64 {
    probe["format"]["duration"]
        .as_str()
        .and_then(|x| x.parse::<f64>().ok())
        .filter(|x| x.is_finite() && *x >= 0.0)
        .map(|s| (s * 1000.0).round() as u64)
        .unwrap_or(0)
}
pub fn import(dir: &Path, path: &Path, origin: &str) -> Result<Value> {
    let bytes = fs::metadata(path)?.len();
    if fs2::available_space(dir)? < bytes.saturating_add(64 * 1024 * 1024) {
        return Err(Error::new("DISK_FULL", "Không đủ dung lượng để nhập media"));
    }
    let meta = probe(path)?;
    let streams = meta["streams"].as_array().unwrap();
    let video = streams.iter().find(|s| s["codec_type"] == "video");
    let audio = streams.iter().find(|s| s["codec_type"] == "audio");
    let mut header = [0; 32];
    let len = fs::File::open(path)?.read(&mut header)?;
    let image_format = image::guess_format(&header[..len]).ok().filter(|f| {
        matches!(
            f,
            image::ImageFormat::Png | image::ImageFormat::Jpeg | image::ImageFormat::WebP
        )
    });
    let kind = if image_format.is_some() {
        "image"
    } else if video.is_some() {
        "video"
    } else if audio.is_some() {
        "audio"
    } else {
        return Err(invalid("Chỉ nhận ảnh, video hoặc audio"));
    };
    if kind == "image" {
        if bytes > 20 * 1024 * 1024 {
            return Err(invalid("Ảnh vượt 20 MiB"));
        }
        let (w, h) = image::ImageReader::open(path)?
            .with_guessed_format()?
            .into_dimensions()
            .map_err(|_| invalid("Không đọc được ảnh"))?;
        if u64::from(w) * u64::from(h) > 40_000_000 {
            return Err(invalid("Ảnh vượt 40 triệu pixel"));
        }
    }
    let ext = match image_format {
        Some(image::ImageFormat::Png) => "png",
        Some(image::ImageFormat::Jpeg) => "jpg",
        Some(image::ImageFormat::WebP) => "webp",
        _ => {
            if kind == "video" {
                "media"
            } else {
                "audio"
            }
        }
    };
    let aid = id();
    let relative = format!(
        "assets/{}/{}.{}",
        match kind {
            "image" => "images",
            "video" => "videos",
            _ => "audio",
        },
        aid,
        ext
    );
    let dest = dir.join(&relative);
    fs::create_dir_all(dest.parent().unwrap())?;
    let part = dest.with_extension("partial");
    fs::copy(path, &part)?;
    fs::File::open(&part)?.sync_all()?;
    let sha = storage::sha_file(&part)?;
    fs::rename(&part, &dest)?;
    let mut a = json!({"id":aid,"kind":kind,"relativePath":relative,"originalName":path.file_name().unwrap_or_default().to_string_lossy(),"mime":match kind{"image"=>match ext{"jpg"=>"image/jpeg","webp"=>"image/webp",_=>"image/png"},"video"=>"video/mp4",_=>"audio/mpeg"},"bytes":bytes,"sha256":sha,"createdAt":domain::now(),"origin":origin});
    if let Some(v) = video {
        a["width"] = v["width"].clone();
        a["height"] = v["height"].clone();
    }
    if kind != "image" {
        a["durationMs"] = json!(duration(&meta));
    }
    if let Some(v) = audio {
        a["sampleRate"] = json!(v["sample_rate"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(48000));
        a["channels"] = v["channels"].clone();
    }
    if kind == "image" {
        let thumb = dir.join("cache/thumbnails").join(format!("{aid}.jpg"));
        fs::create_dir_all(thumb.parent().unwrap())?;
        // FFmpeg applies EXIF/rotation while decoding, preserving original bytes.
        let _ = Command::new(binary("ffmpeg"))
            .args(["-v", "error", "-nostdin", "-y", "-i"])
            .arg(&dest)
            .args([
                "-frames:v",
                "1",
                "-vf",
                "scale=480:480:force_original_aspect_ratio=decrease",
            ])
            .arg(thumb)
            .output();
    }
    Ok(a)
}
pub fn verify_asset(dir: &Path, a: &Value) -> Result<PathBuf> {
    let path = storage::scoped(dir, s(a, "relativePath"))?;
    if storage::sha_file(&path)? != s(a, "sha256") {
        return Err(Error::new(
            "ASSET_CHANGED",
            format!("Asset {} đã đổi", s(a, "id")),
        ));
    }
    Ok(path)
}
pub fn preflight(p: &Value, dir: &Path) -> Result<Value> {
    domain::validate(p)?;
    let items = domain::array(&p["timeline"], "items");
    if items.is_empty() {
        return Err(invalid("Timeline chưa có media"));
    }
    if items.len() > 16
        && items
            .iter()
            .any(|i| i["transitionOut"]["kind"] == "crossfade")
    {
        return Err(Error::new(
            "PROVIDER_UNSUPPORTED",
            "Crossfade hiện giới hạn 16 đoạn mỗi render; chia phim thành các phần rồi ghép cut",
        ));
    }
    let engine = version("ffmpeg")?;
    version("ffprobe")?;
    let enc = Command::new(binary("ffmpeg"))
        .args(["-hide_banner", "-encoders"])
        .output()?;
    if !String::from_utf8_lossy(&enc.stdout).contains("libx264") {
        return Err(Error::new(
            "ENCODER_UNAVAILABLE",
            "FFmpeg cần encoder libx264",
        ));
    }
    let planned = domain::frames(p);
    let target =
        (n(&p["video"], "targetDurationMs") as f64 * domain::fps(p) / 1000.0).round() as u64;
    if p["video"]["durationPolicy"] == "strict" && planned.abs_diff(target) > 1 {
        return Err(Error::new(
            "DURATION_MISMATCH",
            format!("Kế hoạch {planned} frame; mục tiêu {target} frame"),
        ));
    }
    for item in items {
        let a = domain::array(p, "assets")
            .iter()
            .find(|a| a["id"] == item["assetId"])
            .ok_or_else(|| invalid("Asset missing"))?;
        let file = verify_asset(dir, a)?;
        let meta = probe(&file)?;
        for st in meta["streams"].as_array().into_iter().flatten() {
            if ["smpte2084", "arib-std-b67"].contains(&s(st, "color_transfer")) {
                return Err(Error::new(
                    "PROVIDER_UNSUPPORTED",
                    "Chưa hỗ trợ tone-map HDR → SDR",
                ));
            }
        }
    }
    for track in domain::array(&p["timeline"], "audioTracks") {
        let a = domain::array(p, "assets")
            .iter()
            .find(|a| a["id"] == track["assetId"])
            .ok_or_else(|| invalid("Missing audio"))?;
        verify_asset(dir, a)?;
        if n(track, "startFrame") + n(track, "durationFrames") > planned {
            return Err(Error::new(
                "DURATION_MISMATCH",
                "Voice/music vượt timeline; chỉnh slot hoặc trim trước render",
            ));
        }
    }
    let video_bytes_per_second =
        n(&p["video"], "width") as f64 * n(&p["video"], "height") as f64 * domain::fps(p) * 0.18
            / 8.0;
    let estimate = (planned as f64 / domain::fps(p)
        * ((video_bytes_per_second + 24_000.0) * 3.0 + 384_000.0)) as u64;
    if fs2::available_space(dir)? < estimate + 64 * 1024 * 1024 {
        return Err(Error::new(
            "DISK_FULL",
            "Không đủ dung lượng cho cache và render (ước tính)",
        ));
    }
    Ok(
        json!({"project":p,"engine":engine,"plannedFrames":planned,"estimatedBytes":estimate,"inputHash":domain::hash(p)}),
    )
}
fn execute(args: &[String], cwd: &Path, mut control: impl FnMut() -> Result<()>) -> Result<String> {
    control()?;
    let log = cwd.join(format!("ffmpeg-{}.log", id()));
    let stderr = fs::File::create(&log)?;
    let mut child = Command::new(binary("ffmpeg"))
        .args(["-hide_banner", "-nostdin", "-v", "error", "-y"])
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::null())
        .stderr(stderr)
        .spawn()
        .map_err(|_| Error::new("FFMPEG_MISSING", "Không chạy được FFmpeg"))?;
    loop {
        if fs2::available_space(cwd).is_ok_and(|bytes| bytes < 64 * 1024 * 1024) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(Error::new(
                "DISK_FULL",
                "Thiếu dung lượng trong khi render; cache hoàn tất được giữ lại",
            ));
        }
        if let Err(e) = control() {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(&log);
            return Err(e);
        }
        if let Some(status) = child.try_wait()? {
            let diagnostic = fs::read_to_string(&log).unwrap_or_default();
            let _ = fs::remove_file(&log);
            if !status.success() {
                return Err(Error::new(
                    "RENDER_FAILED",
                    format!(
                        "FFmpeg: {}",
                        diagnostic.chars().take(1500).collect::<String>()
                    ),
                ));
            }
            return Ok(diagnostic);
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}
fn args(strings: &[&str]) -> Vec<String> {
    strings.iter().map(|s| s.to_string()).collect()
}
pub fn render(
    manifest: &Value,
    dir: &Path,
    output: &Path,
    mut checkpoint: impl FnMut(usize, usize) -> Result<()>,
) -> Result<Value> {
    let receipt_path = dir.join("manifests").join(format!(
        "output-{}.json",
        domain::hash(&json!({"manifest":manifest,"output":output}))
    ));
    if output.exists() {
        if let Ok(receipt) = storage::read(&receipt_path) {
            if receipt["sha256"] == storage::sha_file(output)? {
                probe(output)?;
                return Ok(receipt);
            }
        }
        return Err(invalid(
            "Đích đã tồn tại và không khớp receipt của tác vụ này",
        ));
    }
    let p = &manifest["project"];
    let items = domain::array(&p["timeline"], "items");
    let total = items.len();
    let video = &p["video"];
    let fps = domain::fps(p);
    let rate = format!(
        "{}/{}",
        n(&video["fps"], "numerator"),
        n(&video["fps"], "denominator")
    );
    let width = n(video, "width");
    let height = n(video, "height");
    let total_seconds = domain::frames(p) as f64 / fps;
    let cache = dir.join("cache/normalized");
    fs::create_dir_all(&cache)?;
    let temp = dir.join("temp").join(id());
    fs::create_dir_all(&temp)?;
    let mut segments = vec![];
    for (index, item) in items.iter().enumerate() {
        checkpoint(index, total)?;
        let a = domain::array(p, "assets")
            .iter()
            .find(|a| a["id"] == item["assetId"])
            .ok_or_else(|| invalid("Missing asset"))?;
        let source = verify_asset(dir, a)?;
        let key = domain::hash(
            &json!({"asset":a["sha256"],"trim":[item["inFrame"],item["durationFrames"]],"audio":[item["sourceAudio"],item["sourceAudioGainDb"]],"video":video,"engine":manifest["engine"],"pipeline":3}),
        );
        let segment = cache.join(format!("{key}.mp4"));
        let frames = n(item, "durationFrames");
        let valid_cache = segment.exists()
            && probe(&segment).is_ok()
            && storage::read(&cache.join(format!("{key}.json")))
                .ok()
                .is_some_and(|receipt| {
                    storage::sha_file(&segment)
                        .ok()
                        .is_some_and(|sha| receipt["sha256"] == sha)
                });
        if !valid_cache {
            let meta = probe(&source)?;
            let has_audio = meta["streams"]
                .as_array()
                .unwrap()
                .iter()
                .any(|s| s["codec_type"] == "audio");
            let mut av = vec![];
            if s(a, "kind") == "image" {
                av.extend(args(&["-loop", "1"]));
            } else {
                av.extend(args(&[
                    "-ss",
                    &(n(item, "inFrame") as f64 / fps).to_string(),
                ]));
            }
            av.extend(args(&[
                "-protocol_whitelist",
                "file,pipe",
                "-i",
                &source.to_string_lossy(),
            ]));
            av.extend(args(&["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]));
            let fit = if s(video, "fit") == "cover" {
                format!("scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}")
            } else {
                format!("scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color={}",s(video,"backgroundColor"))
            };
            av.extend(args(&[
                "-map",
                "0:v:0",
                "-map",
                if has_audio && s(item, "sourceAudio") == "keep" {
                    "0:a:0"
                } else {
                    "1:a:0"
                },
                "-vf",
                &format!("{fit},setsar=1,fps={rate},format=yuv420p,setpts=PTS-STARTPTS"),
                "-af",
                &format!(
                    "aresample=48000,apad,asetpts=PTS-STARTPTS,volume={}dB",
                    item["sourceAudioGainDb"].as_f64().unwrap_or(0.0)
                ),
                "-t",
                &(frames as f64 / fps).to_string(),
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-video_track_timescale",
                "90000",
                "-movflags",
                "+faststart",
                "-f",
                "mp4",
            ]));
            let part = cache.join(format!("{key}.partial.mp4"));
            av.push(part.to_string_lossy().into());
            execute(&av, &temp, || checkpoint(index, total))?;
            let check = probe(&part)?;
            if duration(&check).abs_diff((frames as f64 / fps * 1000.0).round() as u64) > 150 {
                return Err(Error::new(
                    "DURATION_MISMATCH",
                    "Segment không đủ thời lượng",
                ));
            }
            fs::rename(&part, &segment)?;
            storage::atomic(
                &cache.join(format!("{key}.json")),
                &json!({"sha256":storage::sha_file(&segment)?}),
            )?;
        }
        // Safe, generated filenames only inside concat/filter input lists.
        let local = temp.join(format!("segment-{index}.mp4"));
        fs::hard_link(&segment, &local).or_else(|_| fs::copy(&segment, &local).map(|_| ()))?;
        segments.push(local);
    }
    checkpoint(total, total)?;
    let base = temp.join("joined.mp4");
    let cross = items
        .iter()
        .any(|i| i["transitionOut"]["kind"] == "crossfade");
    if cross {
        let mut av = vec![];
        for seg in &segments {
            av.extend(args(&["-i", &seg.to_string_lossy()]));
        }
        let mut graph = String::new();
        for i in 0..total {
            graph.push_str(&format!(
                "[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[v{i}];[{i}:a]asetpts=PTS-STARTPTS[a{i}];"
            ));
        }
        let mut v = "v0".to_owned();
        let mut a = "a0".to_owned();
        let mut length = n(&items[0], "durationFrames") as f64 / fps;
        for i in 1..total {
            let nv = format!("xv{i}");
            let na = format!("xa{i}");
            let overlap = n(&items[i - 1]["transitionOut"], "durationFrames") as f64 / fps;
            if overlap > 0.0 {
                graph.push_str(&format!("[{v}][v{i}]xfade=transition=fade:duration={overlap}:offset={}[{nv}];[{a}][a{i}]acrossfade=d={overlap}[{na}];",length-overlap));
            } else {
                graph.push_str(&format!(
                    "[{v}][{a}][v{i}][a{i}]concat=n=2:v=1:a=1[{nv}][{na}];"
                ));
            }
            v = nv;
            a = na;
            length += n(&items[i], "durationFrames") as f64 / fps - overlap;
        }
        av.extend(args(&[
            "-filter_complex_threads",
            "1",
            "-filter_complex",
            graph.trim_end_matches(';'),
            "-map",
            &format!("[{v}]"),
            "-map",
            &format!("[{a}]"),
            "-r",
            &rate,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-t",
            &total_seconds.to_string(),
        ]));
        av.push(base.to_string_lossy().into());
        execute(&av, &temp, || checkpoint(total, total))?;
    } else {
        let list = (0..total)
            .map(|i| format!("file 'segment-{i}.mp4'\n"))
            .collect::<String>();
        fs::write(temp.join("concat.txt"), list)?;
        execute(
            &args(&[
                "-f",
                "concat",
                "-safe",
                "1",
                "-i",
                "concat.txt",
                "-c",
                "copy",
                "-t",
                &total_seconds.to_string(),
                &base.to_string_lossy(),
            ]),
            &temp,
            || checkpoint(total, total),
        )?;
    }
    let cues = domain::array(&p["timeline"], "subtitles");
    let subtitle = temp.join("subtitles.srt");
    fn timestamp(fr: u64, fps: f64) -> String {
        let ms = (fr as f64 / fps * 1000.0).round() as u64;
        format!(
            "{:02}:{:02}:{:02},{:03}",
            ms / 3600000,
            ms / 60000 % 60,
            ms / 1000 % 60,
            ms % 1000
        )
    }
    let srt = cues
        .iter()
        .enumerate()
        .map(|(i, c)| {
            format!(
                "{}\n{} --> {}\n{}\n\n",
                i + 1,
                timestamp(n(c, "startFrame"), fps),
                timestamp(n(c, "endFrame"), fps),
                s(c, "text")
            )
        })
        .collect::<String>();
    fs::write(&subtitle, &srt)?;
    fs::create_dir_all(temp.join("fonts"))?;
    fs::write(
        temp.join("fonts/NotoSans-Regular.ttf"),
        include_bytes!("../../frontend/public/fonts/NotoSans-Regular.ttf"),
    )?;
    let mut av = args(&["-i", &base.to_string_lossy()]);
    let tracks = domain::array(&p["timeline"], "audioTracks");
    for t in tracks {
        let a = domain::array(p, "assets")
            .iter()
            .find(|a| a["id"] == t["assetId"])
            .ok_or_else(|| invalid("Missing audio"))?;
        if t["loop"] == true {
            av.extend(args(&["-stream_loop", "-1"]));
        }
        av.extend(args(&["-i", &verify_asset(dir, a)?.to_string_lossy()]));
    }
    let mut graph = String::from("[0:a]aresample=48000[base];");
    let mut mix = String::from("[base]");
    for (i, t) in tracks.iter().enumerate() {
        let d = n(t, "durationFrames") as f64 / fps;
        let fadeout = n(t, "fadeOutFrames") as f64 / fps;
        graph.push_str(&format!("[{}:a]atrim=start={}:duration={d},asetpts=PTS-STARTPTS,volume={}dB,afade=t=in:d={},afade=t=out:st={}:d={},adelay={}:all=1[t{i}];",i+1,n(t,"inFrame") as f64/fps,t["gainDb"].as_f64().unwrap_or(0.0),n(t,"fadeInFrames") as f64/fps,(d-fadeout).max(0.0),fadeout,n(t,"startFrame") as f64/fps*1000.0));
        mix.push_str(&format!("[t{i}]"));
    }
    let voice_labels = tracks
        .iter()
        .enumerate()
        .filter(|(_, t)| t["kind"] == "voice")
        .map(|(i, _)| format!("[t{i}]"))
        .collect::<Vec<_>>();
    let music_labels = tracks
        .iter()
        .enumerate()
        .filter(|(_, t)| t["kind"] == "music")
        .map(|(i, _)| format!("[t{i}]"))
        .collect::<Vec<_>>();
    if !voice_labels.is_empty() && !music_labels.is_empty() {
        graph.push_str(&format!("{}amix=inputs={}:normalize=0,apad,atrim=duration={total_seconds},asplit=2[voices][side];{}amix=inputs={}:normalize=0,apad,atrim=duration={total_seconds}[music];[music][side]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=250[duck];[base][voices][duck]amix=inputs=3:duration=first:normalize=0,apad,atrim=duration={total_seconds}[outa]",voice_labels.join(""),voice_labels.len(),music_labels.join(""),music_labels.len()));
    } else {
        graph.push_str(&format!("{mix}amix=inputs={}:duration=first:normalize=0,apad,atrim=duration={total_seconds}[outa]",tracks.len()+1));
    }
    av.extend(args(&[
        "-filter_complex",
        &graph,
        "-map",
        "[outa]",
        "-c:a",
        "pcm_f32le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "mix.wav",
    ]));
    execute(&av, &temp, || checkpoint(total, total))?;
    // Measure the actual final mix. Silence has -inf loudness and must bypass loudnorm.
    let analysis = execute(
        &args(&[
            "-v",
            "info",
            "-nostats",
            "-i",
            "mix.wav",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
            "-f",
            "null",
            "-",
        ]),
        &temp,
        || checkpoint(total, total),
    )?;
    let measured: Value = analysis
        .rfind('{')
        .and_then(|start| {
            analysis
                .rfind('}')
                .and_then(|end| serde_json::from_str(&analysis[start..=end]).ok())
        })
        .ok_or_else(|| Error::new("RENDER_FAILED", "Không đọc được kết quả loudness"))?;
    let values = [
        "input_i",
        "input_tp",
        "input_lra",
        "input_thresh",
        "target_offset",
    ]
    .iter()
    .map(|key| measured[*key].as_str().and_then(|s| s.parse::<f64>().ok()))
    .collect::<Vec<_>>();
    let normalization = if values.iter().all(|v| v.is_some_and(f64::is_finite)) {
        format!("loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={}:measured_TP={}:measured_LRA={}:measured_thresh={}:offset={}:linear=true",values[0].unwrap(),values[1].unwrap(),values[2].unwrap(),values[3].unwrap(),values[4].unwrap())
    } else {
        "anull".to_owned()
    };
    let mut av = args(&[
        "-i",
        &base.to_string_lossy(),
        "-i",
        "mix.wav",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-af",
        &normalization,
    ]);
    if p["timeline"]["subtitleMode"] == "burn_in" && !cues.is_empty() {
        av.extend(args(&[
            "-vf",
            "subtitles=subtitles.srt:fontsdir=fonts:force_style='FontName=Noto Sans'",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
        ]));
    } else {
        av.extend(args(&["-c:v", "copy"]));
    }
    av.extend(args(&[
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-t",
        &total_seconds.to_string(),
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
    ]));
    if output.exists() {
        return Err(invalid("File đích đã tồn tại. Chọn tên khác."));
    }
    let parent = output
        .parent()
        .ok_or_else(|| invalid("Missing destination"))?;
    fs::create_dir_all(parent)?;
    let staged = tempfile::Builder::new()
        .suffix(".mp4")
        .tempfile_in(parent)?;
    av.push(staged.path().to_string_lossy().into());
    execute(&av, &temp, || checkpoint(total, total))?;
    let result = probe(staged.path())?;
    if duration(&result).abs_diff((total_seconds * 1000.0).round() as u64)
        > 100_u64.max((1000.0 / fps).ceil() as u64)
    {
        return Err(Error::new(
            "DURATION_MISMATCH",
            "Output duration sai kế hoạch",
        ));
    }
    staged.as_file().sync_all()?;
    let receipt = json!({"path":output.to_string_lossy(),"durationMs":duration(&result),"sha256":storage::sha_file(staged.path())?});
    storage::atomic(&receipt_path, &receipt)?;
    staged
        .persist_noclobber(output)
        .map_err(|e| Error::from(e.error))?;
    if p["timeline"]["subtitleMode"] == "sidecar" {
        let side = output.with_extension("srt");
        if !side.exists() {
            storage::atomic_bytes(&side, srt.as_bytes())?;
        }
    }
    let _ = fs::remove_dir_all(&temp);
    Ok(
        json!({"path":output.to_string_lossy(),"durationMs":duration(&result),"sha256":storage::sha_file(output)?}),
    )
}

pub fn stale_selected(p: &Value, dir: &Path) -> Result<Vec<String>> {
    let mut used = std::collections::HashSet::new();
    for i in domain::array(&p["timeline"], "items") {
        used.insert(s(i, "assetId"));
    }
    for i in domain::array(&p["timeline"], "audioTracks") {
        used.insert(s(i, "assetId"));
    }
    Ok(domain::array(p, "assets")
        .iter()
        .filter(|a| {
            used.contains(s(a, "id")) && crate::dependencies::stale(p, dir, a).unwrap_or(true)
        })
        .map(|a| s(a, "id").to_owned())
        .collect())
}
