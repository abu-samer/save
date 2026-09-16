var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_child_process = require("child_process");
var import_multer = __toESM(require("multer"), 1);
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
var ADMIN_PASSWORD = "123456789";
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var UPLOADS_DIR = import_path.default.join(process.cwd(), "uploads");
var CHUNKS_TEMP_DIR = import_path.default.join(process.cwd(), "temp_chunks");
var DB_FILE = import_path.default.join(DATA_DIR, "videos.json");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!import_fs.default.existsSync(CHUNKS_TEMP_DIR)) {
  import_fs.default.mkdirSync(CHUNKS_TEMP_DIR, { recursive: true });
}
function applyFaststart(filePath) {
  const tempFast = `${filePath}.faststart.mp4`;
  try {
    (0, import_child_process.execSync)(`ffmpeg -y -i "${filePath}" -c copy -movflags +faststart "${tempFast}"`, {
      timeout: 3e4
    });
    if (import_fs.default.existsSync(tempFast) && import_fs.default.statSync(tempFast).size > 0) {
      import_fs.default.renameSync(tempFast, filePath);
    }
  } catch (err) {
    console.warn("Could not apply faststart:", err);
    if (import_fs.default.existsSync(tempFast)) {
      try {
        import_fs.default.unlinkSync(tempFast);
      } catch (_) {
      }
    }
  }
}
var webTranscodingJobs = /* @__PURE__ */ new Set();
function generateWebPreview(filePath) {
  const ext = import_path.default.extname(filePath);
  const base = import_path.default.basename(filePath, ext);
  const previewPath = import_path.default.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const tmpPreview = import_path.default.join(UPLOADS_DIR, `${base}_tmp_web.mp4`);
  if (import_fs.default.existsSync(previewPath) || webTranscodingJobs.has(base)) {
    return;
  }
  webTranscodingJobs.add(base);
  console.log(`[Preview] Starting web-friendly encoding for ${base}...`);
  const child = (0, import_child_process.spawn)(
    "ffmpeg",
    [
      "-y",
      "-i",
      filePath,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      "scale=-2:540",
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "ultrafast",
      "-crf",
      "26",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      tmpPreview
    ],
    { stdio: "ignore" }
  );
  child.on("close", (code) => {
    webTranscodingJobs.delete(base);
    if (code === 0 && import_fs.default.existsSync(tmpPreview) && import_fs.default.statSync(tmpPreview).size > 1e3) {
      try {
        import_fs.default.renameSync(tmpPreview, previewPath);
        console.log(`[Preview] Successfully created web preview for ${base}`);
      } catch (e) {
        console.error("Error renaming web preview:", e);
      }
    } else {
      try {
        if (import_fs.default.existsSync(tmpPreview)) import_fs.default.unlinkSync(tmpPreview);
      } catch (_) {
      }
    }
  });
  child.on("error", (err) => {
    webTranscodingJobs.delete(base);
    console.error("FFmpeg spawn error:", err);
  });
}
function probeVideoMeta(filePath) {
  try {
    const jsonStr = (0, import_child_process.execSync)(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
      { encoding: "utf-8", timeout: 8e3 }
    );
    const data = JSON.parse(jsonStr);
    const vStream = data.streams?.find((s) => s.codec_type === "video");
    const dur = parseFloat(data.format?.duration || vStream?.duration || "0");
    const br = parseInt(data.format?.bit_rate || vStream?.bit_rate || "0", 10);
    return {
      width: vStream?.width,
      height: vStream?.height,
      durationSeconds: Math.round(dur),
      codec: vStream?.codec_name,
      bitrateMbps: br > 0 ? parseFloat((br / 1e6).toFixed(1)) : void 0
    };
  } catch (err) {
    return {};
  }
}
function getVideos() {
  try {
    if (!import_fs.default.existsSync(DB_FILE)) {
      const initialVideos = [];
      import_fs.default.writeFileSync(DB_FILE, JSON.stringify(initialVideos, null, 2), "utf-8");
      return initialVideos;
    }
    const data = import_fs.default.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading videos database:", err);
    return [];
  }
}
function saveVideos(videos) {
  try {
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(videos, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving videos database:", err);
  }
}
function formatArabicDateTime(date) {
  const dayNames = [
    "\u0627\u0644\u0623\u062D\u062F",
    "\u0627\u0644\u0625\u062B\u0646\u064A\u0646",
    "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621",
    "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621",
    "\u0627\u0644\u062E\u0645\u064A\u0633",
    "\u0627\u0644\u062C\u0645\u0639\u0629",
    "\u0627\u0644\u0633\u0628\u062A"
  ];
  const monthsArabic = [
    "\u064A\u0646\u0627\u064A\u0631",
    "\u0641\u0628\u0631\u0627\u064A\u0631",
    "\u0645\u0627\u0631\u0633",
    "\u0623\u0628\u0631\u064A\u0644",
    "\u0645\u0627\u064A\u0648",
    "\u064A\u0648\u0646\u064A\u0648",
    "\u064A\u0648\u0644\u064A\u0648",
    "\u0623\u063A\u0633\u0637\u0633",
    "\u0633\u0628\u062A\u0645\u0628\u0631",
    "\u0623\u0643\u062A\u0648\u0628\u0631",
    "\u0646\u0648\u0641\u0645\u0628\u0631",
    "\u062F\u064A\u0633\u0645\u0628\u0631"
  ];
  const dayName = dayNames[date.getDay()];
  const formattedDate = `${date.getDate()} ${monthsArabic[date.getMonth()]} ${date.getFullYear()}`;
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "\u0645\u0633\u0627\u0621\u064B" : "\u0635\u0628\u0627\u062D\u0627\u064B";
  hours = hours % 12 || 12;
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes} ${period}`;
  return { dayName, formattedDate, formattedTime };
}
var storage = import_multer.default.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = import_path.default.extname(file.originalname) || ".mp4";
    const uniqueName = `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});
var upload = (0, import_multer.default)({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024
    // 2GB
  }
});
var chunkStorage = import_multer.default.diskStorage({
  destination: (req, _file, cb) => {
    const uploadId = req.headers["x-upload-id"] || "unknown";
    const dir = import_path.default.join(CHUNKS_TEMP_DIR, uploadId);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    const chunkIndex = req.headers["x-chunk-index"] || "0";
    cb(null, `part_${chunkIndex}`);
  }
});
var chunkUpload = (0, import_multer.default)({
  storage: chunkStorage,
  limits: { fileSize: 30 * 1024 * 1024 }
  // 30MB max per chunk
});
async function stitchChunks(uploadId, totalChunks, outputPath) {
  const uploadTempDir = import_path.default.join(CHUNKS_TEMP_DIR, uploadId);
  const writeStream = import_fs.default.createWriteStream(outputPath);
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = import_path.default.join(uploadTempDir, `part_${i}`);
    if (!import_fs.default.existsSync(chunkPath)) {
      writeStream.close();
      throw new Error(`\u0627\u0644\u062C\u0632\u0621 \u0631\u0642\u0645 ${i} \u0645\u0641\u0642\u0648\u062F`);
    }
    await new Promise((resolve, reject) => {
      const readStream = import_fs.default.createReadStream(chunkPath);
      readStream.on("error", reject);
      readStream.on("end", () => resolve());
      readStream.pipe(writeStream, { end: false });
    });
  }
  await new Promise((resolve, reject) => {
    writeStream.end();
    writeStream.on("finish", () => resolve());
    writeStream.on("error", reject);
  });
  try {
    import_fs.default.rmSync(uploadTempDir, { recursive: true, force: true });
  } catch (err) {
    console.warn("Could not remove temp chunks dir:", err);
  }
}
app.use(import_express.default.json());
app.post("/api/auth/verify", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0628\u0646\u062C\u0627\u062D" });
  }
  return res.status(401).json({ success: false, message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
});
function requireAdmin(req, res, next) {
  const authHeader = req.headers["x-admin-password"];
  if (authHeader === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D\u060C \u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0634\u0631\u0641" });
}
app.get("/api/videos", (_req, res) => {
  const videos = getVideos();
  videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const enriched = videos.map((v) => {
    const ext = import_path.default.extname(v.filename);
    const base = import_path.default.basename(v.filename, ext);
    const rawPath = import_path.default.join(UPLOADS_DIR, v.filename);
    const previewPath = import_path.default.join(UPLOADS_DIR, `${base}_preview.mp4`);
    const posterPath = import_path.default.join(UPLOADS_DIR, `${base}_poster.jpg`);
    const hasPreview = import_fs.default.existsSync(previewPath);
    const isMissing = !import_fs.default.existsSync(rawPath) && !hasPreview;
    if (!hasPreview && import_fs.default.existsSync(rawPath)) {
      generateWebPreview(rawPath);
    }
    let previewSizeBytes;
    if (hasPreview) {
      try {
        previewSizeBytes = import_fs.default.statSync(previewPath).size;
      } catch (_) {
      }
    }
    return {
      ...v,
      hasPreview,
      previewSizeBytes,
      hasPoster: import_fs.default.existsSync(posterPath),
      isProcessing: !hasPreview && import_fs.default.existsSync(rawPath) && webTranscodingJobs.has(base),
      isMissing
    };
  });
  res.json(enriched);
});
app.get("/api/videos/:id/status", (req, res) => {
  const { id } = req.params;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);
  if (!video) {
    return res.status(404).json({ error: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const ext = import_path.default.extname(video.filename);
  const base = import_path.default.basename(video.filename, ext);
  const rawPath = import_path.default.join(UPLOADS_DIR, video.filename);
  const previewPath = import_path.default.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const posterPath = import_path.default.join(UPLOADS_DIR, `${base}_poster.jpg`);
  const hasPreview = import_fs.default.existsSync(previewPath);
  const isMissing = !import_fs.default.existsSync(rawPath) && !hasPreview;
  if (!hasPreview && import_fs.default.existsSync(rawPath)) {
    generateWebPreview(rawPath);
  }
  let previewSizeBytes;
  if (hasPreview) {
    try {
      previewSizeBytes = import_fs.default.statSync(previewPath).size;
    } catch (_) {
    }
  }
  res.json({
    id: video.id,
    isReady: !isMissing,
    hasPreview,
    previewSizeBytes,
    hasPoster: import_fs.default.existsSync(posterPath),
    isProcessing: !hasPreview && import_fs.default.existsSync(rawPath) && webTranscodingJobs.has(base),
    isMissing
  });
});
app.get("/api/videos/:id/poster", (req, res) => {
  const { id } = req.params;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);
  if (!video) {
    return res.status(404).send("Video not found");
  }
  const ext = import_path.default.extname(video.filename);
  const base = import_path.default.basename(video.filename, ext);
  const posterPath = import_path.default.join(UPLOADS_DIR, `${base}_poster.jpg`);
  if (import_fs.default.existsSync(posterPath)) {
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return import_fs.default.createReadStream(posterPath).pipe(res);
  }
  const rawPath = import_path.default.join(UPLOADS_DIR, video.filename);
  if (import_fs.default.existsSync(rawPath)) {
    try {
      (0, import_child_process.execSync)(
        `ffmpeg -y -ss 00:00:01 -i "${rawPath}" -frames:v 1 -q:v 2 "${posterPath}"`,
        { timeout: 8e3, stdio: "ignore" }
      );
      if (import_fs.default.existsSync(posterPath)) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return import_fs.default.createReadStream(posterPath).pipe(res);
      }
    } catch (_) {
    }
  }
  return res.status(404).send("Poster not ready");
});
app.post("/api/videos/upload/init", requireAdmin, (req, res) => {
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const dir = import_path.default.join(CHUNKS_TEMP_DIR, uploadId);
  if (!import_fs.default.existsSync(dir)) {
    import_fs.default.mkdirSync(dir, { recursive: true });
  }
  res.json({ uploadId, chunkSize: 10 * 1024 * 1024 });
});
app.post("/api/videos/upload/chunk", requireAdmin, chunkUpload.single("chunk"), (req, res) => {
  const uploadId = req.headers["x-upload-id"];
  const chunkIndex = req.headers["x-chunk-index"];
  if (!uploadId || chunkIndex === void 0 || !req.file) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062C\u0632\u0621 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0623\u0648 \u0644\u0645 \u064A\u0635\u0644 \u0627\u0644\u0645\u0644\u0641" });
  }
  const chunkPath = import_path.default.join(CHUNKS_TEMP_DIR, uploadId, `part_${chunkIndex}`);
  if (!import_fs.default.existsSync(chunkPath) || import_fs.default.statSync(chunkPath).size === 0) {
    return res.status(500).json({ error: `\u0641\u0634\u0644 \u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u062C\u0632\u0621 \u0631\u0642\u0645 ${chunkIndex}` });
  }
  res.json({ success: true, chunkIndex: Number(chunkIndex), size: req.file.size });
});
app.get("/api/videos/upload/check/:uploadId", requireAdmin, (req, res) => {
  const { uploadId } = req.params;
  const totalChunks = Number(req.query.totalChunks || 0);
  const dir = import_path.default.join(CHUNKS_TEMP_DIR, uploadId);
  if (!import_fs.default.existsSync(dir)) {
    return res.status(404).json({ error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u0631\u0641\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  }
  const missing = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = import_path.default.join(dir, `part_${i}`);
    if (!import_fs.default.existsSync(chunkPath) || import_fs.default.statSync(chunkPath).size === 0) {
      missing.push(i);
    }
  }
  res.json({ missing, complete: missing.length === 0 });
});
app.post("/api/videos/upload/complete", requireAdmin, async (req, res) => {
  const { uploadId, title, originalName, mimeType, totalChunks } = req.body;
  if (!uploadId || !totalChunks) {
    return res.status(400).json({ error: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0644\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0631\u0641\u0639" });
  }
  const ext = import_path.default.extname(originalName || "") || ".mp4";
  const finalFilename = `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
  const finalPath = import_path.default.join(UPLOADS_DIR, finalFilename);
  try {
    await stitchChunks(uploadId, Number(totalChunks), finalPath);
    applyFaststart(finalPath);
    const meta = probeVideoMeta(finalPath);
    const stat = import_fs.default.statSync(finalPath);
    const finalTitle = (title || "").trim() || import_path.default.parse(originalName || "").name || "\u0641\u064A\u062F\u064A\u0648 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646";
    const now = /* @__PURE__ */ new Date();
    const { dayName, formattedDate, formattedTime } = formatArabicDateTime(now);
    const newVideo = {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: finalTitle,
      filename: finalFilename,
      originalName: originalName || finalFilename,
      mimeType: mimeType || "video/mp4",
      sizeBytes: stat.size,
      createdAt: now.toISOString(),
      dayName,
      formattedDate,
      formattedTime,
      width: meta.width,
      height: meta.height,
      durationSeconds: meta.durationSeconds,
      codec: meta.codec,
      bitrateMbps: meta.bitrateMbps,
      hasPreview: true,
      isProcessing: false
    };
    const videos = getVideos();
    videos.push(newVideo);
    saveVideos(videos);
    try {
      const posterPath = import_path.default.join(UPLOADS_DIR, `${import_path.default.parse(finalFilename).name}_poster.jpg`);
      if (!import_fs.default.existsSync(posterPath)) {
        (0, import_child_process.execSync)(`ffmpeg -y -ss 00:00:01 -i "${finalPath}" -frames:v 1 -q:v 2 "${posterPath}"`, {
          timeout: 5e3,
          stdio: "ignore"
        });
      }
    } catch (_) {
    }
    generateWebPreview(finalPath);
    return res.status(201).json(newVideo);
  } catch (err) {
    console.error("Error finalizing video upload:", err);
    return res.status(500).json({ error: `\u0641\u0634\u0644 \u062A\u062C\u0645\u064A\u0639 \u0623\u062C\u0632\u0627\u0621 \u0627\u0644\u0641\u064A\u062F\u064A\u0648: ${err?.message || err}` });
  }
});
app.post("/api/videos", requireAdmin, upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0645\u0644\u0641 \u0641\u064A\u062F\u064A\u0648 \u0644\u0644\u0631\u0641\u0639" });
  }
  const finalPath = import_path.default.join(UPLOADS_DIR, req.file.filename);
  applyFaststart(finalPath);
  const meta = probeVideoMeta(finalPath);
  const stat = import_fs.default.statSync(finalPath);
  const title = (req.body.title || "").trim() || import_path.default.parse(req.file.originalname).name || "\u0641\u064A\u062F\u064A\u0648 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646";
  const now = /* @__PURE__ */ new Date();
  const { dayName, formattedDate, formattedTime } = formatArabicDateTime(now);
  const newVideo = {
    id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype || "video/mp4",
    sizeBytes: stat.size,
    createdAt: now.toISOString(),
    dayName,
    formattedDate,
    formattedTime,
    width: meta.width,
    height: meta.height,
    durationSeconds: meta.durationSeconds,
    codec: meta.codec,
    bitrateMbps: meta.bitrateMbps,
    hasPreview: true,
    isProcessing: false
  };
  const videos = getVideos();
  videos.push(newVideo);
  saveVideos(videos);
  generateWebPreview(finalPath);
  return res.status(201).json(newVideo);
});
app.delete("/api/videos/:id", (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers["x-admin-password"];
  const videos = getVideos();
  const index = videos.findIndex((v) => v.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  }
  const video = videos[index];
  const filePath = import_path.default.join(UPLOADS_DIR, video.filename);
  const ext = import_path.default.extname(video.filename);
  const base = import_path.default.basename(video.filename, ext);
  const previewPath = import_path.default.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const isMissing = !import_fs.default.existsSync(filePath) && !import_fs.default.existsSync(previewPath);
  if (!isMissing && authHeader !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D\u060C \u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0634\u0631\u0641" });
  }
  const posterPath = import_path.default.join(UPLOADS_DIR, `${base}_poster.jpg`);
  const tmpPath = import_path.default.join(UPLOADS_DIR, `${base}_preview_tmp.mp4`);
  const tmpWebPath = import_path.default.join(UPLOADS_DIR, `${base}_tmp_web.mp4`);
  [filePath, previewPath, posterPath, tmpPath, tmpWebPath].forEach((p) => {
    if (import_fs.default.existsSync(p)) {
      try {
        import_fs.default.unlinkSync(p);
      } catch (e) {
        console.warn("Could not delete file:", p, e);
      }
    }
  });
  videos.splice(index, 1);
  saveVideos(videos);
  return res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0628\u0646\u062C\u0627\u062D" });
});
app.get("/api/videos/:id/stream", (req, res) => {
  const { id } = req.params;
  const { raw } = req.query;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);
  if (!video) {
    return res.status(404).send("Video not found");
  }
  const ext = import_path.default.extname(video.filename);
  const base = import_path.default.basename(video.filename, ext);
  const previewPath = import_path.default.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const rawPath = import_path.default.join(UPLOADS_DIR, video.filename);
  let streamPath = null;
  if (raw === "1" && import_fs.default.existsSync(rawPath)) {
    streamPath = rawPath;
  } else if (import_fs.default.existsSync(previewPath)) {
    streamPath = previewPath;
  } else if (import_fs.default.existsSync(rawPath)) {
    streamPath = rawPath;
    generateWebPreview(rawPath);
  }
  if (!streamPath || !import_fs.default.existsSync(streamPath)) {
    return res.status(404).send("File missing on server");
  }
  return res.sendFile(import_path.default.resolve(streamPath), {
    acceptRanges: true,
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=3600"
    }
  });
});
app.get("/api/videos/:id/download", (req, res) => {
  const { id } = req.params;
  const { quality } = req.query;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);
  if (!video) {
    return res.status(404).send("Video not found");
  }
  const ext = import_path.default.extname(video.filename);
  const base = import_path.default.basename(video.filename, ext);
  const previewPath = import_path.default.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const rawPath = import_path.default.join(UPLOADS_DIR, video.filename);
  let targetPath = rawPath;
  let downloadFilename = video.originalName || "video.mp4";
  if (quality === "web" && import_fs.default.existsSync(previewPath)) {
    targetPath = previewPath;
    const nameWithoutExt = import_path.default.parse(downloadFilename).name;
    downloadFilename = `${nameWithoutExt}_web.mp4`;
  } else if (!import_fs.default.existsSync(rawPath) && import_fs.default.existsSync(previewPath)) {
    targetPath = previewPath;
  }
  if (!import_fs.default.existsSync(targetPath)) {
    return res.status(404).send("Video file not found on disk");
  }
  const stat = import_fs.default.statSync(targetPath);
  let safeDownloadName = downloadFilename.replace(/["\r\n]/g, "_");
  if (!safeDownloadName.toLowerCase().endsWith(".mp4")) {
    safeDownloadName += ".mp4";
  }
  const encodedName = encodeURIComponent(safeDownloadName);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeDownloadName}"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-cache");
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    if (start >= stat.size || end >= stat.size) {
      res.status(416).setHeader("Content-Range", `bytes */${stat.size}`);
      return res.end();
    }
    const chunksize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${safeDownloadName}"; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff"
    });
    const fileStream = import_fs.default.createReadStream(targetPath, { start, end });
    fileStream.pipe(res);
  } else {
    res.setHeader("Content-Length", stat.size.toString());
    const fileStream = import_fs.default.createReadStream(targetPath);
    fileStream.pipe(res);
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
