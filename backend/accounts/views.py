from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .models import User
from .serializers import UserSerializer, LoginSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .face_utils import extract_face_embedding
import numpy as np
from datetime import datetime, timedelta

import bcrypt

import jwt
import os

from dotenv import load_dotenv

load_dotenv()


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class RegisterView(APIView):
    def post(self, request):
        print("Registration request received")
        print("Request data:", request.data)

        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            print("Validated data:", data)

            existing_user = User.objects(email=data["email"]).first()

            if existing_user:
                return Response(
                    {"error": "Email already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            image = data.get("image")
            print("Image data present:", bool(image))
            print("Image data length:", len(image) if image else 0)

            if not image:
                return Response(
                    {"error": "Face image is required for registration."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            embedding, error = extract_face_embedding(image)
            print("Face embedding result:", "success" if embedding else "failed")
            print("Face embedding error:", error)

            if error:
                print("Face embedding extraction failed with error:", error)
                return Response(
                    {
                        "error": f"Face recognition failed: {error}. Please try again with better lighting and ensure your face is clearly visible."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            hashed_password = bcrypt.hashpw(
                data["password"].encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

            user = User(
                username=data["username"],
                email=data["email"],
                password=hashed_password,
                face_encoding=embedding,
            )

            user.save()

            return Response({"message": "User registered successfully"})

        print("Serializer errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):

    def post(self, request):

        serializer = LoginSerializer(data=request.data)

        if serializer.is_valid():

            data = serializer.validated_data

            user = User.objects(email=data["email"]).first()

            if not user:
                return Response(
                    {"error": "Invalid email"}, status=status.HTTP_400_BAD_REQUEST
                )

            password_match = bcrypt.checkpw(
                data["password"].encode("utf-8"), user.password.encode("utf-8")
            )

            if not password_match:
                return Response(
                    {"error": "Invalid password"}, status=status.HTTP_400_BAD_REQUEST
                )

            payload = {
                "user_id": str(user.id),
                "email": user.email,
                "exp": datetime.utcnow() + timedelta(hours=24),
            }

            token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

            return Response(
                {
                    "message": "Login successful",
                    "token": token,
                    "user": {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                    },
                }
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FaceRegisterView(APIView):

    def post(self, request):

        email = request.data.get("email")
        image = request.data.get("image")

        if not email or not image:
            return Response({"error": "Email and image required"})

        user = User.objects(email=email).first()

        if not user:
            return Response({"error": "User not found"})

        embedding, error = extract_face_embedding(image)

        if error:
            return Response({"error": error})

        user.face_encoding = embedding
        user.save()

        return Response({"message": "Face registered successfully"})


class FaceLoginView(APIView):
    def post(self, request):
        email = request.data.get("email")
        image = request.data.get("image")

        print("=== FACE LOGIN ===")
        print("Email received:", email)  # is this "undefined" or a real email?
        print("Image present:", bool(image))

        if not email or email == "undefined":
            return Response({"error": "Email required"}, status=400)

        if not image:
            return Response({"error": "Image required"}, status=400)

        try:
            embedding, error = extract_face_embedding(image)
            print("Embedding error:", error)
            print("Embedding present:", bool(embedding))

            if error or embedding is None:
                return Response({"error": error or "Face not detected"}, status=400)

            user = User.objects(email=email).first()
            print("User found:", bool(user))
            print(
                "User has face encoding:", bool(user.face_encoding) if user else False
            )

            if not user or not user.face_encoding:
                return Response(
                    {"error": "User not found or no face registered"}, status=404
                )

            current_embedding = np.array(embedding, dtype=np.float32)
            current_embedding = current_embedding / np.linalg.norm(current_embedding)

            stored_embedding = np.array(user.face_encoding, dtype=np.float32)
            stored_embedding = stored_embedding / np.linalg.norm(stored_embedding)

            if stored_embedding.shape != current_embedding.shape:
                print(
                    "Shape mismatch:",
                    stored_embedding.shape,
                    "vs",
                    current_embedding.shape,
                )
                return Response({"error": "Embedding shape mismatch"}, status=400)

            distance = np.linalg.norm(stored_embedding - current_embedding)
            print("Distance:", distance)
            print("Match:", distance < 0.45)

            if distance < 0.45:
                payload = {
                    "user_id": str(user.id),
                    "email": user.email,
                    "exp": datetime.utcnow() + timedelta(hours=24),
                }
                token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
                return Response(
                    {
                        "match": True,
                        "message": "Face login successful",
                        "token": token,
                        "user": {"email": user.email, "username": user.username},
                    }
                )

            return Response(
                {"match": False, "error": "Face not recognized"}, status=401
            )

        except Exception as e:
            print("GLOBAL ERROR:", e)
            return Response({"error": str(e)}, status=500)
