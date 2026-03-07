from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    PERSONA_CHOICES = [
        ('guest', 'Guest / Prefer not to say'),
        ('student', 'Student'),
        ('homemaker', 'Homemaker'),
        ('professional', 'Professional'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    persona = models.CharField(max_length=30, choices=PERSONA_CHOICES, default='guest')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.get_persona_display()}"


class DailyReflection(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reflections')
    content = models.TextField()
    ai_insight = models.TextField(blank=True, null=True)
    mood = models.CharField(max_length=20, blank=True, null=True) # e.g., 'calm', 'thinking'
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at'] # Always show newest first

    def __str__(self):
        return f"Reflection by {self.user.username} on {self.created_at.strftime('%Y-%m-%d')}"