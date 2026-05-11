from django.urls import path
from .views import HealthView, RegisterView, LoginView, FaceRegisterView, FaceLoginView

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('face-register/', FaceRegisterView.as_view(), name='face-register'),
    path('face-login/', FaceLoginView.as_view(), name='face-login'),
]
