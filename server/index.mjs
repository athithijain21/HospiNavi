import "dotenv/config";
import express from "express";
import multer from "multer";

const app = express();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});
const supportedLocales = new Set(["en-IN", "kn-IN", "hi-IN", "ml-IN"]);
const port = Number(process.env.PORT ?? 8787);

app.use((request, response, next) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN;
  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/speech-to-text", upload.single("audio"), async (request, response) => {
  const locale = request.body.locale;
  if (!supportedLocales.has(locale)) {
    response.status(400).json({ error: "Unsupported speech locale." });
    return;
  }
  if (!request.file || request.file.mimetype !== "audio/wav") {
    response.status(400).json({ error: "A WAV audio recording is required." });
    return;
  }
  const { SPEECH_KEY: key, SPEECH_REGION: region } = process.env;
  if (!key || !region) {
    response.status(503).json({ error: "Speech service is not configured on the server." });
    return;
  }

  try {
    const endpoint = new URL(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
    );
    endpoint.searchParams.set("language", locale);
    endpoint.searchParams.set("format", "simple");
    const speechResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Ocp-Apim-Subscription-Key": key,
      },
      body: request.file.buffer,
    });
    const result = await speechResponse.json();
    if (!speechResponse.ok || result.RecognitionStatus !== "Success") {
      response.status(502).json({ error: "Speech service could not recognize the recording." });
      return;
    }
    response.json({ locale, text: result.DisplayText ?? "" });
  } catch {
    response.status(502).json({ error: "Speech service is unavailable." });
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({ error: "The recording is too large." });
    return;
  }
  response.status(400).json({ error: "Invalid speech request." });
});

app.listen(port, () => {
  console.log(`HospiNav speech server listening on port ${port}`);
});
