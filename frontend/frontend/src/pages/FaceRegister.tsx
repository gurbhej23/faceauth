import Webcam from "react-webcam";
import { useRef, useState } from "react";
import api from "../api/api";

function FaceRegister() {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const captureFace = async () => {
    // 1. Check email exists before even touching the camera
    const email = localStorage.getItem("email");
    if (!email) {
      setMessage("No email found. Please log in again.");
      return;
    }

    if (!webcamRef.current) {
      setMessage("Camera not ready");
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setMessage("Failed to capture image. Please try again.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await api.post("face-register/", {
        email,
        image: imageSrc,
      });

      setSuccess(true);
      setMessage(response.data.message || "Face registered successfully ✅");
    } catch (error) {
      console.log(error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      setMessage(axiosError?.response?.data?.error || "Capture failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 bg-black">
      <h1 className="text-3xl text-white mb-6">Face Registration</h1>

      <div className="w-full max-w-md">
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored={true}
          screenshotFormat="image/jpeg"
          screenshotQuality={1}
          videoConstraints={{
            facingMode: "user",
            width: 720,
            height: 1280,
          }}
          className="w-full rounded-2xl"
        />
      </div>

      <button
        onClick={captureFace}
        disabled={loading || success}
        className="mt-6 bg-white text-black px-6 py-3 rounded-xl w-full max-w-md disabled:opacity-50"
      >
        {loading ? "Processing..." : success ? "Registered ✅" : "Capture Face"}
      </button>

      {message && (
        <p className={`mt-4 text-center text-lg ${success ? "text-green-400" : "text-red-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export default FaceRegister;