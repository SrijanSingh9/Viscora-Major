from rest_framework import serializers
from .models import UserProfile
from .models import DailyReflection

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'first_name', 'last_name', 'persona', 'created_at']



class DailyReflectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyReflection
        fields = ['id', 'content', 'ai_insight', 'mood', 'created_at']