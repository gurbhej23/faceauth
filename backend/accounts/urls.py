from django.urls import path
from  .views import RegisterView, LoginView, FaceRegisterView, FaceLoginView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('face-register/', FaceRegisterView.as_view(), name='face-register'),
    path('face-login/', FaceLoginView.as_view(), name='face-login'),
]