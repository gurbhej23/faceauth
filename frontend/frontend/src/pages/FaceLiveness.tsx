import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";

function FaceLiveness() {
  const webcamRef = useRef<Webcam>(null);

  const [message, setMessage] =
    useState("Loading AI...");

  const [blinked, setBlinked] =
    useState(false);

  const [turned, setTurned] =
    useState(false);

  const [smiled, setSmiled] =
    useState(false);

  const [verified, setVerified] =
    useState(false);

  // LOAD MODELS

  useEffect(() => {

    const loadModels = async () => {

      await Promise.all([

        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),

        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),

        faceapi.nets.faceExpressionNet.loadFromUri("/models"),

      ]);

      startDetection();
    };

    loadModels();

  }, []);

  // DETECTION LOOP

  const startDetection = () => {

    setInterval(async () => {

      if (!webcamRef.current?.video) return;

      const video = webcamRef.current.video;

      const detection =
        await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceExpressions();

      if (!detection) {

        setMessage("No face detected");

        return;
      }

      // ======================
      // BLINK DETECTION
      // ======================

      const leftEye =
        detection.landmarks.getLeftEye();

      const eyeHeight =
        Math.abs(leftEye[1].y - leftEye[5].y);

      if (eyeHeight < 3 && !blinked) {

        setBlinked(true);

        setMessage("Blink detected ✅");
      }

      // ======================
      // HEAD TURN
      // ======================

      const nose =
        detection.landmarks.getNose();

      const noseX = nose[3].x;

      if (noseX < 140 && !turned) {

        setTurned(true);

        setMessage("Head movement detected ✅");
      }

      // ======================
      // SMILE
      // ======================

      if (
        detection.expressions.happy > 0.7 &&
        !smiled
      ) {

        setSmiled(true);

        setMessage("Smile detected ✅");
      }

      // ======================
      // VERIFIED
      // ======================

      if (
        blinked &&
        turned &&
        smiled &&
        !verified
      ) {

        setVerified(true);

        setMessage(
          "Liveness Verified Successfully ✅"
        );

        // CALL LOGIN API HERE
      }

    }, 500);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">

      <h1 className="text-white text-3xl mb-5">
        AI Liveness Detection
      </h1>

      <Webcam
        ref={webcamRef}
        mirrored
        audio={false}
        className="rounded-2xl w-[350px]"
      />

      <p className="text-white mt-5 text-xl">
        {message}
      </p>

      <div className="text-white mt-4">

        <p>
          Blink:
          {blinked ? "✅" : "❌"}
        </p>

        <p>
          Head Turn:
          {turned ? "✅" : "❌"}
        </p>

        <p>
          Smile:
          {smiled ? "✅" : "❌"}
        </p>

      </div>
    </div>
  );
}

export default FaceLiveness;