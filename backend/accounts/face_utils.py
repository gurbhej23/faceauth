from unittest import result

from deepface import DeepFace
import base64
import numpy as np
import cv2
from PIL import Image
from io import BytesIO


def extract_face_embedding(base64_image):
    try:
        print("📸 Processing image...")

        # remove base64 header
        if "," in base64_image:
            base64_image = base64_image.split(",")[1]

        # decode image
        image_data = base64.b64decode(base64_image)

        image = Image.open(BytesIO(image_data)).convert("RGB")
        image_np = np.array(image)

        # convert RGB → BGR (DeepFace requirement)
        image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        print("🔍 Running DeepFace...")

        try:
            result = DeepFace.represent(
                img_path=image_np,
                model_name="Facenet",
                enforce_detection=True,
                detector_backend="retinaface"
            )
        except ValueError:
            return None, "No face detected in image"

        if not result:
            return None, "No face detected"

        embedding = result[0]["embedding"]

        return embedding, None

    except Exception as e:
        print("❌ Error:", str(e))
        return None, str(e)


# ===========================
# FACE MATCH FUNCTION
# ===========================


def find_user_by_face(input_embedding, users, threshold=0.45):
    """
    returns: matched_user, distance
    """

    best_user = None
    min_distance = float("inf")

    input_embedding = np.array(input_embedding)

    for user in users:
        if not user.face_encoding:
            continue

        stored_embedding = np.array(user.face_encoding)

        distance = np.linalg.norm(input_embedding - stored_embedding)

        if distance < min_distance:
            min_distance = distance
            best_user = user

    print("📏 Best distance:", min_distance)

    if min_distance < threshold:
        return best_user, min_distance

    return None, min_distance
