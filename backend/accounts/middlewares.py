# accounts/middleware.py
import jwt, os
from django.http import JsonResponse


class JWTAuthMiddleware:
    PROTECTED = ["/api/dashboard/", "/api/profile/"]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.PROTECTED):
            token = request.headers.get("Authorization", "").replace("Bearer ", "")
            try:
                payload = jwt.decode(
                    token, os.getenv("SECRET_KEY"), algorithms=["HS256"]
                )
                request.user_payload = payload
            except jwt.ExpiredSignatureError:
                return JsonResponse({"error": "Token expired"}, status=401)
            except jwt.InvalidTokenError:
                return JsonResponse({"error": "Invalid token"}, status=401)
        return self.get_response(request)
