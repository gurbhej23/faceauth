import { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

type CaptureStatus = "idle" | "checking" | "good" | "bad";
type FaceStatus = "waiting" | "detected" | "none";

function Register() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const faceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const [webcamReady, setWebcamReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [qualityMessage, setQualityMessage] = useState("");
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("waiting");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    image: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ── Live face detection (skin tone heuristic, no ML library needed) ───
  // Every 800ms, samples the centre oval region of the video frame.
  // Counts pixels that match a skin-tone heuristic:
  //   R > G > B, R dominant, mid-range luminance.
  // If >12% of sampled pixels are skin-like → face is present.

  const detectFaceInFrame = (): boolean => {
    const video = webcamRef.current?.video;
    if (!video || video.readyState !== 4) return false;

    const canvas = document.createElement("canvas");
    const W = 160;
    const H = 160;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Crop to the centre oval area where the face should be
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    ctx.drawImage(
      video,
      srcW * 0.25,
      srcH * 0.1,
      srcW * 0.5,
      srcH * 0.7,
      0,
      0,
      W,
      H,
    );

    const { data } = ctx.getImageData(0, 0, W, H);
    let skinPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (
        r > 60 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        g > b &&
        r - g > 15 &&
        lum > 40 &&
        lum < 220
      ) {
        skinPixels++;
      }
    }

    return skinPixels / (W * H) > 0.12;
  };

  // Start interval when camera is ready; stop when photo is taken
  useEffect(() => {
    if (!webcamReady || capturedImage) return;

    faceCheckRef.current = setInterval(() => {
      setFaceStatus(detectFaceInFrame() ? "waiting" : "none");
    }, 800);

    return () => {
      if (faceCheckRef.current) clearInterval(faceCheckRef.current);
    };
  }, [webcamReady, capturedImage]);

  // ── Image quality checks ───────────────────────────────────────────────

  const checkImageQuality = (
    imageSrc: string,
  ): Promise<{ passed: boolean; reason: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Brightness
        let lum = 0;
        for (let i = 0; i < data.length; i += 4) {
          lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avg = lum / (data.length / 4);
        if (avg < 28)
          return resolve({
            passed: false,
            reason: "Too dark — find better lighting",
          });
        if (avg > 220)
          return resolve({
            passed: false,
            reason: "Too bright — reduce glare",
          });

        // Blur (Laplacian)
        let blur = 0;
        const w = canvas.width,
          h = canvas.height;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            blur += Math.abs(
              -4 * data[idx] +
                data[((y - 1) * w + x) * 4] +
                data[((y + 1) * w + x) * 4] +
                data[(y * w + (x - 1)) * 4] +
                data[(y * w + (x + 1)) * 4],
            );
          }
        }
        if (blur / (w * h) < 4.5)
          return resolve({ passed: false, reason: "Too blurry — hold steady" });

        resolve({ passed: true, reason: "Image looks clear ✅" });
      };
      img.src = imageSrc;
    });
  };

  // ── Canvas overlay ─────────────────────────────────────────────────────

  const drawOverlay = (
    status: CaptureStatus,
    face: FaceStatus,
    scanOffset: number,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const ovalX = W / 2,
      ovalY = H * 0.45;
    const ovalRX = W * 0.38,
      ovalRY = H * 0.42;

    // Dark vignette with oval cutout
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Color: captured status takes priority, then live face status
    const borderColor =
      status === "good"
        ? "#22c55e"
        : status === "bad"
          ? "#ef4444"
          : status === "checking"
            ? "#facc15"
            : face === "detected"
              ? "#22c55e"
              : face === "none"
                ? "#ef4444"
                : "#ffffff";

    const glowColor =
      status === "good"
        ? "rgba(34,197,94,0.4)"
        : status === "bad"
          ? "rgba(239,68,68,0.4)"
          : status === "checking"
            ? "rgba(250,204,21,0.3)"
            : face === "detected"
              ? "rgba(34,197,94,0.3)"
              : face === "none"
                ? "rgba(239,68,68,0.3)"
                : "rgba(255,255,255,0.2)";

    // Oval border with glow
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Scan line while quality-checking
    if (status === "checking") {
      const lineY = ovalY - ovalRY + scanOffset * (ovalRY * 2);
      const halfW = Math.sqrt(
        Math.max(0, 1 - Math.pow((lineY - ovalY) / ovalRY, 2)) *
          ovalRX *
          ovalRX,
      );
      ctx.save();
      const grad = ctx.createLinearGradient(
        ovalX - halfW,
        lineY,
        ovalX + halfW,
        lineY,
      );
      grad.addColorStop(0, "rgba(250,204,21,0)");
      grad.addColorStop(0.5, "rgba(250,204,21,0.8)");
      grad.addColorStop(1, "rgba(250,204,21,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ovalX - halfW, lineY);
      ctx.lineTo(ovalX + halfW, lineY);
      ctx.stroke();
      ctx.restore();
    }

    // Ghost face icon when no face detected (idle state only)
    if (status === "idle" && face === "none") {
      ctx.save();
      ctx.font = "40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.7;
      ctx.fillText("👤", ovalX, ovalY - 8);
      ctx.restore();
    }

    // Corner tick marks
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      const cx = ovalX + ovalRX * Math.cos(angle);
      const cy = ovalY + ovalRY * Math.sin(angle);
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(angle) * 18, cy - Math.cos(angle) * 18);
      ctx.lineTo(cx - Math.sin(angle) * 18, cy + Math.cos(angle) * 18);
      ctx.stroke();
      ctx.restore();
    });
  };

  useEffect(() => {
    let scanOffset = 0,
      direction = 1;
    const loop = () => {
      if (captureStatus === "checking") {
        scanOffset += 0.008 * direction;
        if (scanOffset >= 1) direction = -1;
        if (scanOffset <= 0) direction = 1;
      }
      drawOverlay(captureStatus, faceStatus, scanOffset);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [captureStatus, faceStatus]);

  // ── Capture ────────────────────────────────────────────────────────────

  const captureFace = async () => {
    if (!webcamReady) {
      setQualityMessage("Camera is still loading...");
      return;
    }

    // Backend face detection is the source of truth; only guard a missing video.
    if (faceStatus !== "detected" && !webcamRef.current?.video) {
      setQualityMessage("No face detected — look directly at the camera");
      setCaptureStatus("bad");
      setTimeout(() => {
        setCaptureStatus("idle");
        setQualityMessage("");
      }, 1800);
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot({
      width: 640,
      height: 360,
    });
    if (!imageSrc) {
      setQualityMessage("Failed to capture image");
      setCaptureStatus("bad");
      return;
    }

    if (faceCheckRef.current) clearInterval(faceCheckRef.current);

    setCapturedImage(imageSrc);
    setCaptureStatus("checking");
    setQualityMessage("Checking image quality...");

    const { passed, reason } = await checkImageQuality(imageSrc);

    if (passed) {
      setCaptureStatus("good");
      setQualityMessage("Image captured. Register to verify your face.");
      setFormData((prev) => ({ ...prev, image: imageSrc }));
    } else {
      // Quality failed — go back to live camera
      setCaptureStatus("bad");
      setQualityMessage(reason);
      setCapturedImage(null);
      setFormData((prev) => ({ ...prev, image: "" }));
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setCaptureStatus("idle");
    setQualityMessage("");
    setFaceStatus("waiting");
    setFormData((prev) => ({ ...prev, image: "" }));
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!formData.image) {
      setQualityMessage("Please capture a clear face photo first");
      return;
    }
    if (!formData.username || !formData.email || !formData.password) {
      setQualityMessage("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("register/", formData);
      alert(response.data.message || "Registration successful");
      navigate("/");
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      setCaptureStatus("bad");
      setCapturedImage(null);
      setFaceStatus("waiting");
      setFormData((prev) => ({ ...prev, image: "" }));
      setQualityMessage(
        axiosError?.response?.data?.error || "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Derived UI values ──────────────────────────────────────────────────

  const borderRingColor =
    captureStatus === "good"
      ? "ring-yellow-400 shadow-yellow-400/30"
      : captureStatus === "bad"
        ? "ring-red-500 shadow-red-500/40"
        : captureStatus === "checking"
          ? "ring-yellow-400 shadow-yellow-400/30"
          : faceStatus === "none"
            ? "ring-red-500 shadow-red-500/30"
            : "ring-white/30";

  const liveMessage =
    captureStatus !== "idle"
      ? null
      : !webcamReady
        ? "Initializing camera..."
        : faceStatus === "none"
          ? "No face in the frame"
          : "Position your face in the oval";

  const liveMessageColor =
    faceStatus === "none"
      ? "text-red-400"
      : "text-yellow-300";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-5">
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-4xl">
            🤖
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white text-center">
          Create Account
        </h1>
        <p className="text-gray-300 text-center mt-2 mb-8">
          AI Face Authentication Registration
        </p>

        <div className="mb-4">
          <label className="text-white text-sm mb-2 block">Username</label>
          <input
            type="text"
            name="username"
            placeholder="Enter username"
            value={formData.username}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        <div className="mb-4">
          <label className="text-white text-sm mb-2 block">Email Address</label>
          <input
            type="email"
            name="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        <div className="mb-6">
          <label className="text-white text-sm mb-2 block">Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter password"
            value={formData.password}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 outline-none focus:border-white transition"
          />
        </div>

        {/* Face capture section */}
        <div className="mb-5">
          <label className="text-white text-sm mb-3 block">
            Face Registration
          </label>

          <div className="flex justify-center">
            <div
              className={`relative w-64 h-72 rounded-full overflow-hidden ring-4 shadow-lg transition-all duration-500 ${borderRingColor}`}
            >
              {!capturedImage ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored={true}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.95}
                  videoConstraints={{
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }}
                  onUserMedia={() => setWebcamReady(true)}
                  onUserMediaError={() => setWebcamReady(false)}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scale(1.25)",
                    transformOrigin: "center",
                  }}
                />
              ) : (
                <img
                  src={capturedImage}
                  alt="Captured"
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scale(1.25)",
                    transformOrigin: "center",
                  }}
                />
              )}
            </div>
          </div>

          {/* Live face status message */}
          {liveMessage && (
            <p
              className={`mt-3 text-sm text-center font-medium ${liveMessageColor}`}
            >
              {liveMessage}
            </p>
          )}

          {/* Quality / error message */}
          {qualityMessage && (
            <p
              className={`mt-2 text-sm text-center font-medium ${
                captureStatus === "good"
                  ? "text-yellow-300"
                  : captureStatus === "bad"
                    ? "text-red-400"
                    : "text-yellow-300"
              }`}
            >
              {qualityMessage}
            </p>
          )}
        </div>

        {/* Capture / Retake */}
        {captureStatus !== "good" ? (
          <button
            type="button"
            onClick={captureFace}
            disabled={!webcamReady || captureStatus === "checking"}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:scale-105 transition duration-300 disabled:opacity-50"
          >
            {captureStatus === "checking"
              ? "Checking quality..."
              : "Capture Face"}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retakePhoto}
              className="flex-1 border border-white/30 text-white py-3 rounded-xl hover:bg-white/10 transition"
            >
              Retake
            </button>
            <div className="flex-1 bg-yellow-400/20 border border-yellow-400/30 rounded-xl py-3 text-center">
              <p className="text-yellow-200 font-medium">Ready to verify</p>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || captureStatus !== "good"}
          className="w-full mt-5 bg-gradient-to-r from-white to-gray-300 text-black font-bold py-3 rounded-xl hover:scale-105 transition duration-300 disabled:opacity-50"
        >
          {loading ? "Creating Account..." : "Register"}
        </button>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?
          <span
            onClick={() => navigate("/")}
            className="text-white ml-2 cursor-pointer hover:underline"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

export default Register;
