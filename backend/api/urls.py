from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import signup, get_user_profile, reflections_view, reflection_detail_view, chat_view, deep_analysis_view

urlpatterns = [
    # Authentication Endpoints
    path('signup/', signup, name='signup'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Protected Data Endpoints
    path('profile/', get_user_profile, name='user_profile'),
    
    # Reflection Engine, Chatbot, and Analysis Endpoints
    path('reflections/', reflections_view, name='reflections'),
    path('reflections/<int:pk>/', reflection_detail_view, name='reflection_detail'),
    path('chat/', chat_view, name='chat'),
    path('analysis/', deep_analysis_view, name='deep_analysis'), # <-- Upgraded Endpoint
]