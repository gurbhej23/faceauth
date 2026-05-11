from deepface import DeepFace
import base64
import numpy as np
import cv2
from PIL import Image
from io import BytesIO


MAX_IMAGE_SIZE = 800
DETECTOR_BACKENDS = ("opencv", "ssd", "mtcnn", "retinaface")


def _resize_for_detection(image_np):
    height, width = image_np.shape[:2]
    longest_side = max(width, height)

    if longest_side <= MAX_IMAGE_SIZE:
        return image_np

    scale = MAX_IMAGE_SIZE / longest_side
    new_size = (int(width * scale), int(height * scale))
    return cv2.resize(image_np, new_size, interpolation=cv2.INTER_AREA)


def extract_face_embedding(base64_image):
    try:
        print("Processing image...")

        # remove base64 header
        if "," in base64_image:
            base64_image = base64_image.split(",")[1]

        # decode image
        image_data = base64.b64decode(base64_image)

        image = Image.open(BytesIO(image_data)).convert("RGB")
        image_np = np.array(image)

        # convert RGB to BGR (DeepFace requirement)
        image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        image_np = _resize_for_detection(image_np)

        print("Running DeepFace...")

        for detector_backend in DETECTOR_BACKENDS:
            try:
                result = DeepFace.represent(
                    img_path=image_np,
                    model_name="Facenet",
                    enforce_detection=True,
                    detector_backend=detector_backend,
                    align=True,
                )
            except ValueError as e:
                print(f"{detector_backend} detector did not find a face:", e)
                continue
            except Exception as e:
                print(f"{detector_backend} detector failed:", e)
                continue

            if result:
                return result[0]["embedding"], None

        return None, "No face detected in image"

    except Exception as e:
        print("Error:", str(e))
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

    print("Best distance:", min_distance)

    if min_distance < threshold:
        return best_user, min_distance

    return None, min_distance
