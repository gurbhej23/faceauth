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

  // Draw the animated face oval border on the canvas overlay
  const drawOverlay = (status: BorderStatus, scanOffset: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Darken everything outside the oval
    const ovalX = W / 2;
    const ovalY = H * 0.45;
    const ovalRX = W * 0.38;
    const ovalRY = H * 0.42;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    // Cut out the oval (clear it)
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Border color based on status
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

    // Glow
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Scanning line (only while scanning)
    if (status === "scanning") {
      const lineY = ovalY - ovalRY + scanOffset * (ovalRY * 2);
      const halfW = Math.sqrt(
        Math.max(0, 1 - Math.pow((lineY - ovalY) / ovalRY, 2)) * ovalRX * ovalRX
      );

      ctx.save();
      const grad = ctx.createLinearGradient(
        ovalX - halfW, lineY,
        ovalX + halfW, lineY
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

    // Corner tick marks
    const corners = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    corners.forEach((angle) => {
      const cx = ovalX + ovalRX * Math.cos(angle);
      const cy = ovalY + ovalRY * Math.sin(angle);
      const tx = -Math.sin(angle) * 18;
      const ty = Math.cos(angle) * 18;
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

  // Animation loop
  useEffect(() => {
    let scanOffset = 0;
    let direction = 1;

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

  const handleFaceLogin = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();

    if (!imageSrc) {
      setMessage("Failed to capture image");
      setBorderStatus("error");
      return;
    }

    setCapturedImage(imageSrc);
    setLoading(true);
    setBorderStatus("scanning");
    setMessage("Scanning face...");

    const email = localStorage.getItem("pending_email");

    try {
      const response = await api.post("face-login/", { email, image: imageSrc });

      if (!response.data.match || !response.data.token) {
        setLoading(false);
        setBorderStatus("error");
        setMessage(response.data.error || "Face not recognized");
        return;
      }

      setBorderStatus("success");
      setMessage("Face detected successfully ✅");
      localStorage.setItem("token", response.data.token);
      localStorage.removeItem("pending_email");

      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: unknown) {
      setLoading(false);
      setBorderStatus("error");
      setMessage(
        (error as any)?.response?.data?.error || "Face verification failed"
      );
    }
  };

  useEffect(() => {
    if (cameraReady) {
      setBorderStatus("scanning");
      setMessage("Scanning face...");
      const timer = setTimeout(() => handleFaceLogin(), 2000);
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

      {/* Camera container */}
      <div
        className={`relative w-90 h-90 rounded-full overflow-hidden ring-3 shadow-lg transition-all duration-500 ${borderRingColor}`}
      >
        {/* Zoomed-in webcam */}
        {!capturedImage ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored={true}
            screenshotFormat="image/jpeg"
            onUserMedia={() => setCameraReady(true)}
            videoConstraints={{ facingMode: "user" }}
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

        {/* Canvas overlay for oval + scan line */}
        {/* <canvas
          ref={canvasRef}
          width={630}
          height={320}
          className="absolute inset-0 w-full h-full pointer-events-none"
        /> */}
      </div>

      {/* Status indicator dots */}
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

      {/* Spinner */}
      {loading && (
        <div className="mt-5">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
        </div>
      )}

      {/* Message */}
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

      {/* Retry button on error */}
      {borderStatus === "error" && (
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 border border-white/30 text-white rounded-xl hover:bg-white/10 transition"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export default FaceLogin;