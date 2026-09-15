import express from "express";
import path from "path";
import fs from "fs";
import { execSync, spawn } from "child_process";
import multer from "multer";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = "123456789"; // كلمة السر من 1 إلى 9

// Directories setup
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const CHUNKS_TEMP_DIR = path.join(process.cwd(), "temp_chunks");
const DB_FILE = path.join(DATA_DIR, "videos.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CHUNKS_TEMP_DIR)) {
  fs.mkdirSync(CHUNKS_TEMP_DIR, { recursive: true });
}

export interface VideoRecord {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  dayName: string;
  formattedDate: string;
  formattedTime: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  codec?: string;
  bitrateMbps?: number;
  hasPreview?: boolean;
  previewSizeBytes?: number;
  hasPoster?: boolean;
  isProcessing?: boolean;
}

// Move moov atom to the front of MP4 file (takes 1-2s, 0% quality loss, enables instant web playback)
function applyFaststart(filePath: string): void {
  const tempFast = `${filePath}.faststart.mp4`;
  try {
    execSync(`ffmpeg -y -i "${filePath}" -c copy -movflags +faststart "${tempFast}"`, {
      timeout: 30000,
    });
    if (fs.existsSync(tempFast) && fs.statSync(tempFast).size > 0) {
      fs.renameSync(tempFast, filePath);
    }
  } catch (err) {
    console.warn("Could not apply faststart:", err);
    if (fs.existsSync(tempFast)) {
      try {
        fs.unlinkSync(tempFast);
      } catch (_) {}
    }
  }
}

// Track background preview generation jobs to prevent duplicate runs
const webTranscodingJobs = new Set<string>();

// Generate lightweight, ultra-smooth web preview (540p H.264 standard 8-bit yuv420p)
// Compatible with 100% of mobile browsers, low data consumption, instant start
function generateWebPreview(filePath: string): void {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const previewPath = path.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const tmpPreview = path.join(UPLOADS_DIR, `${base}_tmp_web.mp4`);

  if (fs.existsSync(previewPath) || webTranscodingJobs.has(base)) {
    return;
  }

  webTranscodingJobs.add(base);
  console.log(`[Preview] Starting web-friendly encoding for ${base}...`);

  const child = spawn(
    "ffmpeg",
    [
      "-y",
      "-i", filePath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-vf", "scale=-2:540",
      "-r", "30",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-preset", "ultrafast",
      "-crf", "26",
      "-c:a", "aac",
      "-b:a", "96k",
      "-movflags", "+faststart",
      tmpPreview,
    ],
    { stdio: "ignore" }
  );

  child.on("close", (code) => {
    webTranscodingJobs.delete(base);
    if (code === 0 && fs.existsSync(tmpPreview) && fs.statSync(tmpPreview).size > 1000) {
      try {
        fs.renameSync(tmpPreview, previewPath);
        console.log(`[Preview] Successfully created web preview for ${base}`);
      } catch (e) {
        console.error("Error renaming web preview:", e);
      }
    } else {
      try {
        if (fs.existsSync(tmpPreview)) fs.unlinkSync(tmpPreview);
      } catch (_) {}
    }
  });

  child.on("error", (err) => {
    webTranscodingJobs.delete(base);
    console.error("FFmpeg spawn error:", err);
  });
}

// Clean helper: probe basic video specs without blocking
function probeVideoMeta(filePath: string): {
  width?: number;
  height?: number;
  durationSeconds?: number;
  codec?: string;
  bitrateMbps?: number;
} {
  try {
    const jsonStr = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
      { encoding: "utf-8", timeout: 8000 }
    );
    const data = JSON.parse(jsonStr);
    const vStream = data.streams?.find((s: any) => s.codec_type === "video");
    const dur = parseFloat(data.format?.duration || vStream?.duration || "0");
    const br = parseInt(data.format?.bit_rate || vStream?.bit_rate || "0", 10);
    return {
      width: vStream?.width,
      height: vStream?.height,
      durationSeconds: Math.round(dur),
      codec: vStream?.codec_name,
      bitrateMbps: br > 0 ? parseFloat((br / 1000000).toFixed(1)) : undefined,
    };
  } catch (err) {
    return {};
  }
}

// Helper to read database
function getVideos(): VideoRecord[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      // Seed with initial starter video if empty so visitors see the site in action immediately
      const initialVideos: VideoRecord[] = [];
      fs.writeFileSync(DB_FILE, JSON.stringify(initialVideos, null, 2), "utf-8");
      return initialVideos;
    }
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data) as VideoRecord[];
  } catch (err) {
    console.error("Error reading videos database:", err);
    return [];
  }
}

// Helper to save database
function saveVideos(videos: VideoRecord[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(videos, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving videos database:", err);
  }
}

// Format date in Arabic: Day, Date, Time
function formatArabicDateTime(date: Date) {
  const dayNames = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت"
  ];
  const monthsArabic = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر"
  ];

  const dayName = dayNames[date.getDay()];
  const formattedDate = `${date.getDate()} ${monthsArabic[date.getMonth()]} ${date.getFullYear()}`;

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const period = hours >= 12 ? "مساءً" : "صباحاً";
  hours = hours % 12 || 12;
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes} ${period}`;

  return { dayName, formattedDate, formattedTime };
}

// Multer storage setup for original uncompressed videos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    // Preserve safe extension
    const ext = path.extname(file.originalname) || ".mp4";
    const uniqueName = `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

// Up to 2GB upload limit to allow 4K / full quality videos
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB
  },
});

// Storage for chunked uploads (10MB chunks, bypasses any proxy or Cloud Run payload limits)
const chunkStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const uploadId = (req.headers["x-upload-id"] as string) || "unknown";
    const dir = path.join(CHUNKS_TEMP_DIR, uploadId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    const chunkIndex = (req.headers["x-chunk-index"] as string) || "0";
    cb(null, `part_${chunkIndex}`);
  },
});
const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max per chunk
});

// Helper to stitch chunk parts sequentially into the final full-quality video file
async function stitchChunks(
  uploadId: string,
  totalChunks: number,
  outputPath: string
): Promise<void> {
  const uploadTempDir = path.join(CHUNKS_TEMP_DIR, uploadId);
  const writeStream = fs.createWriteStream(outputPath);

  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(uploadTempDir, `part_${i}`);
    if (!fs.existsSync(chunkPath)) {
      writeStream.close();
      throw new Error(`الجزء رقم ${i} مفقود`);
    }

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(chunkPath);
      readStream.on("error", reject);
      readStream.on("end", () => resolve());
      readStream.pipe(writeStream, { end: false });
    });
  }

  await new Promise<void>((resolve, reject) => {
    writeStream.end();
    writeStream.on("finish", () => resolve());
    writeStream.on("error", reject);
  });

  // Clean up temp parts directory
  try {
    fs.rmSync(uploadTempDir, { recursive: true, force: true });
  } catch (err) {
    console.warn("Could not remove temp chunks dir:", err);
  }
}

app.use(express.json());

// API: Verify Admin Password
app.post("/api/auth/verify", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: "تم التحقق بنجاح" });
  }
  return res.status(401).json({ success: false, message: "كلمة السر غير صحيحة" });
});

// Middleware to protect admin routes
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["x-admin-password"];
  if (authHeader === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(403).json({ error: "غير مصرح، يتطلب صلاحية المشرف" });
}

// API: Get all videos (public for all visitors, ordered by latest first)
app.get("/api/videos", (_req, res) => {
  const videos = getVideos();
  // Latest first
  videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const enriched = videos.map((v) => {
    const ext = path.extname(v.filename);
    const base = path.basename(v.filename, ext);
    const rawPath = path.join(UPLOADS_DIR, v.filename);
    const previewPath = path.join(UPLOADS_DIR, `${base}_preview.mp4`);
    const posterPath = path.join(UPLOADS_DIR, `${base}_poster.jpg`);
    const hasPreview = fs.existsSync(previewPath);
    const isMissing = !fs.existsSync(rawPath) && !hasPreview;

    if (!hasPreview && fs.existsSync(rawPath)) {
      generateWebPreview(rawPath);
    }

    let previewSizeBytes: number | undefined;
    if (hasPreview) {
      try {
        previewSizeBytes = fs.statSync(previewPath).size;
      } catch (_) {}
    }

    return {
      ...v,
      hasPreview,
      previewSizeBytes,
      hasPoster: fs.existsSync(posterPath),
      isProcessing: !hasPreview && fs.existsSync(rawPath) && webTranscodingJobs.has(base),
      isMissing,
    };
  });

  res.json(enriched);
});

// API: Check single video status
app.get("/api/videos/:id/status", (req, res) => {
  const { id } = req.params;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);

  if (!video) {
    return res.status(404).json({ error: "الفيديو غير موجود" });
  }

  const ext = path.extname(video.filename);
  const base = path.basename(video.filename, ext);
  const rawPath = path.join(UPLOADS_DIR, video.filename);
  const previewPath = path.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const posterPath = path.join(UPLOADS_DIR, `${base}_poster.jpg`);
  const hasPreview = fs.existsSync(previewPath);
  const isMissing = !fs.existsSync(rawPath) && !hasPreview;

  if (!hasPreview && fs.existsSync(rawPath)) {
    generateWebPreview(rawPath);
  }

  let previewSizeBytes: number | undefined;
  if (hasPreview) {
    try {
      previewSizeBytes = fs.statSync(previewPath).size;
    } catch (_) {}
  }

  res.json({
    id: video.id,
    isReady: !isMissing,
    hasPreview,
    previewSizeBytes,
    hasPoster: fs.existsSync(posterPath),
    isProcessing: !hasPreview && fs.existsSync(rawPath) && webTranscodingJobs.has(base),
    isMissing,
  });
});

// API: Get video poster frame
app.get("/api/videos/:id/poster", (req, res) => {
  const { id } = req.params;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);

  if (!video) {
    return res.status(404).send("Video not found");
  }

  const ext = path.extname(video.filename);
  const base = path.basename(video.filename, ext);
  const posterPath = path.join(UPLOADS_DIR, `${base}_poster.jpg`);

  if (fs.existsSync(posterPath)) {
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return fs.createReadStream(posterPath).pipe(res);
  }

  const rawPath = path.join(UPLOADS_DIR, video.filename);
  if (fs.existsSync(rawPath)) {
    try {
      execSync(
        `ffmpeg -y -ss 00:00:01 -i "${rawPath}" -frames:v 1 -q:v 2 "${posterPath}"`,
        { timeout: 8000, stdio: "ignore" }
      );
      if (fs.existsSync(posterPath)) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return fs.createReadStream(posterPath).pipe(res);
      }
    } catch (_) {}
  }

  return res.status(404).send("Poster not ready");
});

// API: Init Chunked Upload (for large files like 800MB - 2GB)
app.post("/api/videos/upload/init", requireAdmin, (req, res) => {
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const dir = path.join(CHUNKS_TEMP_DIR, uploadId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  res.json({ uploadId, chunkSize: 10 * 1024 * 1024 });
});

// API: Upload individual chunk (10MB parts)
app.post("/api/videos/upload/chunk", requireAdmin, chunkUpload.single("chunk"), (req, res) => {
  const uploadId = req.headers["x-upload-id"] as string;
  const chunkIndex = req.headers["x-chunk-index"] as string;
  if (!uploadId || chunkIndex === undefined || !req.file) {
    return res.status(400).json({ error: "بيانات الجزء غير مكتملة أو لم يصل الملف" });
  }

  // Verify file was written and size > 0
  const chunkPath = path.join(CHUNKS_TEMP_DIR, uploadId, `part_${chunkIndex}`);
  if (!fs.existsSync(chunkPath) || fs.statSync(chunkPath).size === 0) {
    return res.status(500).json({ error: `فشل تخزين الجزء رقم ${chunkIndex}` });
  }

  res.json({ success: true, chunkIndex: Number(chunkIndex), size: req.file.size });
});

// API: Check missing chunks before complete
app.get("/api/videos/upload/check/:uploadId", requireAdmin, (req, res) => {
  const { uploadId } = req.params;
  const totalChunks = Number(req.query.totalChunks || 0);
  const dir = path.join(CHUNKS_TEMP_DIR, uploadId);

  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: "جلسة الرفع غير موجودة" });
  }

  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = path.join(dir, `part_${i}`);
    if (!fs.existsSync(chunkPath) || fs.statSync(chunkPath).size === 0) {
      missing.push(i);
    }
  }

  res.json({ missing, complete: missing.length === 0 });
});

// API: Complete and Stitch Chunked Upload into single lossless video file
app.post("/api/videos/upload/complete", requireAdmin, async (req, res) => {
  const { uploadId, title, originalName, mimeType, totalChunks } = req.body;
  if (!uploadId || !totalChunks) {
    return res.status(400).json({ error: "معلومات غير مكتملة لإنهاء الرفع" });
  }

  const ext = path.extname(originalName || "") || ".mp4";
  const finalFilename = `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
  const finalPath = path.join(UPLOADS_DIR, finalFilename);

  try {
    await stitchChunks(uploadId, Number(totalChunks), finalPath);
    
    // Optimize MP4 container with faststart (moves moov atom to front, 0% quality loss)
    applyFaststart(finalPath);
    const meta = probeVideoMeta(finalPath);
    const stat = fs.statSync(finalPath);

    const finalTitle =
      (title || "").trim() || path.parse(originalName || "").name || "فيديو بدون عنوان";
    const now = new Date();
    const { dayName, formattedDate, formattedTime } = formatArabicDateTime(now);

    const newVideo: VideoRecord = {
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
      isProcessing: false,
    };

    const videos = getVideos();
    videos.push(newVideo);
    saveVideos(videos);

    // Fast poster generation only if needed, do NOT block or force ffmpeg transcoding
    try {
      const posterPath = path.join(UPLOADS_DIR, `${path.parse(finalFilename).name}_poster.jpg`);
      if (!fs.existsSync(posterPath)) {
        execSync(`ffmpeg -y -ss 00:00:01 -i "${finalPath}" -frames:v 1 -q:v 2 "${posterPath}"`, {
          timeout: 5000,
          stdio: "ignore",
        });
      }
    } catch (_) {}

    // Trigger background lightweight web preview for smooth in-browser playback
    generateWebPreview(finalPath);

    return res.status(201).json(newVideo);
  } catch (err: any) {
    console.error("Error finalizing video upload:", err);
    return res.status(500).json({ error: `فشل تجميع أجزاء الفيديو: ${err?.message || err}` });
  }
});

// API: Upload video (single request fallback for small files, original quality preserved)
app.post("/api/videos", requireAdmin, upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "لم يتم تحديد ملف فيديو للرفع" });
  }

  const finalPath = path.join(UPLOADS_DIR, req.file.filename);
  applyFaststart(finalPath);
  const meta = probeVideoMeta(finalPath);
  const stat = fs.statSync(finalPath);

  const title = (req.body.title || "").trim() || path.parse(req.file.originalname).name || "فيديو بدون عنوان";
  const now = new Date();
  const { dayName, formattedDate, formattedTime } = formatArabicDateTime(now);

  const newVideo: VideoRecord = {
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
    isProcessing: false,
  };

  const videos = getVideos();
  videos.push(newVideo);
  saveVideos(videos);

  // Trigger background lightweight web preview for smooth in-browser playback
  generateWebPreview(finalPath);

  return res.status(201).json(newVideo);
});

// API: Delete video (Admin only, or public if file is missing/broken so ghost entries can be cleared)
app.delete("/api/videos/:id", (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers["x-admin-password"];
  const videos = getVideos();
  const index = videos.findIndex((v) => v.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "الفيديو غير موجود" });
  }

  const video = videos[index];
  const filePath = path.join(UPLOADS_DIR, video.filename);
  const ext = path.extname(video.filename);
  const base = path.basename(video.filename, ext);
  const previewPath = path.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const isMissing = !fs.existsSync(filePath) && !fs.existsSync(previewPath);

  // If video is intact, require admin password
  if (!isMissing && authHeader !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "غير مصرح، يتطلب صلاحية المشرف" });
  }

  const posterPath = path.join(UPLOADS_DIR, `${base}_poster.jpg`);
  const tmpPath = path.join(UPLOADS_DIR, `${base}_preview_tmp.mp4`);
  const tmpWebPath = path.join(UPLOADS_DIR, `${base}_tmp_web.mp4`);

  // Delete actual file, preview, poster, and temporary files from disk
  [filePath, previewPath, posterPath, tmpPath, tmpWebPath].forEach((p) => {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (e) {
        console.warn("Could not delete file:", p, e);
      }
    }
  });

  videos.splice(index, 1);
  saveVideos(videos);

  return res.json({ success: true, message: "تم حذف الفيديو بنجاح" });
});

// API: Stream video with HTTP 206 Range support (for direct playback in browser/phone)
// Automatically serves optimized 540p H.264 stream for instant, lag-free browser playback
app.get("/api/videos/:id/stream", (req, res) => {
  const { id } = req.params;
  const { raw } = req.query;
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);

  if (!video) {
    return res.status(404).send("Video not found");
  }

  const ext = path.extname(video.filename);
  const base = path.basename(video.filename, ext);
  const previewPath = path.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const rawPath = path.join(UPLOADS_DIR, video.filename);

  let streamPath: string | null = null;

  // If raw requested or no preview yet, try raw, otherwise use lightweight fast web preview
  if (raw === "1" && fs.existsSync(rawPath)) {
    streamPath = rawPath;
  } else if (fs.existsSync(previewPath)) {
    streamPath = previewPath;
  } else if (fs.existsSync(rawPath)) {
    streamPath = rawPath;
    generateWebPreview(rawPath);
  }

  if (!streamPath || !fs.existsSync(streamPath)) {
    return res.status(404).send("File missing on server");
  }

  return res.sendFile(path.resolve(streamPath), {
    acceptRanges: true,
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

// API: Direct Download supporting both high-speed web version and original raw file
// Complete with Range headers for rock-solid resumption on mobile Chrome
app.get("/api/videos/:id/download", (req, res) => {
  const { id } = req.params;
  const { quality } = req.query; // 'web' or 'original'
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);

  if (!video) {
    return res.status(404).send("Video not found");
  }

  const ext = path.extname(video.filename);
  const base = path.basename(video.filename, ext);
  const previewPath = path.join(UPLOADS_DIR, `${base}_preview.mp4`);
  const rawPath = path.join(UPLOADS_DIR, video.filename);

  let targetPath = rawPath;
  let downloadFilename = video.originalName || "video.mp4";

  if (quality === "web" && fs.existsSync(previewPath)) {
    targetPath = previewPath;
    const nameWithoutExt = path.parse(downloadFilename).name;
    downloadFilename = `${nameWithoutExt}_web.mp4`;
  } else if (!fs.existsSync(rawPath) && fs.existsSync(previewPath)) {
    targetPath = previewPath;
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).send("Video file not found on disk");
  }

  const stat = fs.statSync(targetPath);
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

  // Handle Range requests for mobile Chrome resume support
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
      "X-Content-Type-Options": "nosniff",
    });
    const fileStream = fs.createReadStream(targetPath, { start, end });
    fileStream.pipe(res);
  } else {
    res.setHeader("Content-Length", stat.size.toString());
    const fileStream = fs.createReadStream(targetPath);
    fileStream.pipe(res);
  }
});

// Start server with Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
