import Webcam from "react-webcam";
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

type BorderStatus = "idle" | "scanning" | "success" | "error";

function FaceLogin() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const navigate = useNavigate();

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Initializing camera...");
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");

  // ── Quality check (fast — runs on small 160×120 thumbnail) ────────────
  const checkImageQuality = (
    imageSrc: string,
  ): Promise<{ passed: boolean; reason: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Downscale to 160×120 for speed — quality metrics don't need full res
        const W = 160,
          H = 120;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

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

        // Blur (Laplacian on small image — fast)
        let blur = 0;
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const idx = (y * W + x) * 4;
            blur += Math.abs(
              -4 * data[idx] +
                data[((y - 1) * W + x) * 4] +
                data[((y + 1) * W + x) * 4] +
                data[(y * W + (x - 1)) * 4] +
                data[(y * W + (x + 1)) * 4],
            );
          }
        }
        if (blur / (W * H) < 4.5)
          return resolve({ passed: false, reason: "Too blurry — hold still" });

        resolve({ passed: true, reason: "" });
      };
      img.src = imageSrc;
    });
  };

  // ── Canvas overlay ────────────────────────────────────────────────────
  const drawOverlay = (status: BorderStatus, scanOffset: number) => {
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

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const borderColor =
      status === "success"
        ? "#22c55e"
        : status === "error"
          ? "#ef4444"
          : status === "scanning"
            ? "#facc15"
            : "#ffffff";
    const glowColor =
      status === "success"
        ? "rgba(34,197,94,0.4)"
        : status === "error"
          ? "rgba(239,68,68,0.4)"
          : status === "scanning"
            ? "rgba(250,204,21,0.3)"
            : "rgba(255,255,255,0.2)";

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (status === "scanning") {
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

    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      const cx = ovalX + ovalRX * Math.cos(angle);
      const cy = ovalY + ovalRY * Math.sin(angle);
      const tx = -Math.sin(angle) * 18,
        ty = Math.cos(angle) * 18;
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - tx, cy - ty);
      ctx.lineTo(cx + tx, cy + ty);
      ctx.stroke();
      ctx.restore();
    });
  };

  useEffect(() => {
    let scanOffset = 0,
      direction = 1;
    const loop = () => {
      if (borderStatus === "scanning") {
        scanOffset += 0.008 * direction;
        if (scanOffset >= 1) direction = -1;
        if (scanOffset <= 0) direction = 1;
      }
      drawOverlay(borderStatus, scanOffset);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [borderStatus]);

  // ── Face login ────────────────────────────────────────────────────────
  const handleFaceLogin = async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const imageSrc = webcamRef.current?.getScreenshot({
        width: 640,
        height: 480,
      });
      if (!imageSrc) {
        setMessage("Failed to capture image");
        setBorderStatus("error");
        return;
      }

      const { passed, reason } = await checkImageQuality(imageSrc);

      if (!passed) {
        setBorderStatus("error");
        setMessage(reason);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000)); // short pause then retry
          setBorderStatus("scanning");
          setMessage("Retrying...");
          continue;
        }
        return;
      }

      setCapturedImage(imageSrc);
      setLoading(true);
      setBorderStatus("scanning");
      setMessage("Verifying face...");

      const email = localStorage.getItem("pending_email");
      try {
        const response = await api.post("face-login/", {
          email,
          image: imageSrc,
        });

        if (!response.data.match || !response.data.token) {
          setLoading(false);
          setBorderStatus("error");
          setMessage(response.data.error || "Face not recognized");
          return;
        }

        setBorderStatus("success");
        setMessage("Face detected successfully");
        localStorage.setItem("token", response.data.token);
        localStorage.removeItem("pending_email");
        setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
      } catch (error: unknown) {
        setLoading(false);
        setBorderStatus("error");
        setMessage(
          (error as any)?.response?.data?.error || "Face verification failed",
        );
      }
      return;
    }
  };

  useEffect(() => {
    if (cameraReady) {
      setBorderStatus("scanning");
      setMessage("Scanning face...");
      const timer = setTimeout(() => handleFaceLogin(), 700);
      return () => clearTimeout(timer);
    }
  }, [cameraReady]);

  const borderRingColor =
    borderStatus === "success"
      ? "ring-green-500 shadow-green-500/40"
      : borderStatus === "error"
        ? "ring-red-500 shadow-red-500/40"
        : borderStatus === "scanning"
          ? "ring-yellow-400 shadow-yellow-400/30"
          : "ring-white/30";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
      <h1 className="text-3xl text-white mb-2 font-semibold">
        AI Face Verification
      </h1>
      <p className="text-gray-400 mb-6 text-sm">
        Position your face inside the oval
      </p>

      <div
        className={`relative w-90 h-90 rounded-full overflow-hidden ring-3 shadow-lg transition-all duration-500 ${borderRingColor}`}
      >
        {!capturedImage ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored={true}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            onUserMedia={() => setCameraReady(true)}
            videoConstraints={{
              facingMode: "user", 
            }}
            style={{
              position: "absolute",
              width: "150%",
              height: "130%",
              top: "-30%",
              left: "0%",
              objectFit: "cover",
            }}
          />
        ) : (
          <img
            src={capturedImage}
            alt="Captured"
            style={{
              position: "absolute",
              width: "150%",
              height: "130%",
              top: "-30%",
              left: "0%",
              objectFit: "cover",
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      <div className="flex gap-2 mt-6">
        {["idle", "scanning", "success", "error"].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              borderStatus === s
                ? s === "success"
                  ? "bg-green-500 scale-125"
                  : s === "error"
                    ? "bg-red-500 scale-125"
                    : s === "scanning"
                      ? "bg-yellow-400 scale-125"
                      : "bg-white scale-125"
                : "bg-white/20"
            }`}
          />
        ))}
      </div>

      <p
        className={`mt-4 text-center text-lg font-medium transition-colors duration-300 ${
          borderStatus === "success"
            ? "text-green-400"
            : borderStatus === "error"
              ? "text-red-400"
              : borderStatus === "scanning"
                ? "text-yellow-300"
                : "text-white"
        }`}
      >
        {message}
      </p>

      {borderStatus === "error" && (
        <button
          onClick={() => window.location.reload()}
          disabled={loading}
          className="mt-4 px-6 py-2 border border-white/30 text-white rounded-xl hover:bg-white/10 transition"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export default FaceLogin;
