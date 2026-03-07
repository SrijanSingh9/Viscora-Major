from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
import requests
import json
import re

from .models import UserProfile, DailyReflection
from .serializers import UserProfileSerializer, DailyReflectionSerializer

# ==========================================
# AUTHENTICATION & PROFILE VIEWS
# ==========================================

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    email = request.data.get('email')
    password = request.data.get('password')
    persona = request.data.get('persona', 'guest')

    if not email or not password:
        return Response({"error": "Email and password are required."}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({"error": "A user with this email already exists."}, status=400)

    try:
        user = User.objects.create_user(
            username=email, email=email, password=password,
            first_name=first_name, last_name=last_name
        )
        profile = UserProfile.objects.create(user=user, persona=persona)
        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "User created successfully!",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "name": f"{first_name} {last_name}".strip(),
                "email": email, "persona": persona
            }
        }, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    profile = UserProfile.objects.get(user=request.user)
    if request.method == 'PATCH':
        new_persona = request.data.get('persona')
        if new_persona:
            profile.persona = new_persona
            profile.save()
            
    serializer = UserProfileSerializer(profile)
    return Response(serializer.data)


# ==========================================
# REFLECTION ENGINE VIEWS (WITH OLLAMA)
# ==========================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def reflections_view(request):
    if request.method == 'GET':
        reflections = DailyReflection.objects.filter(user=request.user)
        serializer = DailyReflectionSerializer(reflections, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        content = request.data.get('content')
        mood = request.data.get('mood')
        
        if not content:
            return Response({"error": "Reflection content is required."}, status=400)

        past_reflections = DailyReflection.objects.filter(user=request.user).order_by('-created_at')[:3]
        history_text = "\n".join([f"Past Entry: {r.content}" for r in reversed(past_reflections)])
        
        try:
            persona = request.user.userprofile.persona
        except UserProfile.DoesNotExist:
            persona = 'guest'

        if persona == 'student':
            persona_context = "They are a student. Focus your insight on learning, growth, managing academic stress, and fueling curiosity."
        elif persona == 'professional':
            persona_context = "They are a professional. Focus your insight on career growth, work-life balance, leadership, and resilience."
        elif persona == 'homemaker':
            persona_context = "They are a homemaker. Focus your insight on self-care, finding peace in daily rhythms, and validating their vital emotional labor."
        else:
            persona_context = "They are exploring their path. Provide a philosophical, empathetic, and grounding perspective."

        system_prompt = f"""You are Viscora Nexus, an empathetic, highly intelligent AI journal companion. 
{persona_context}
Read their past entries (if any) and their current entry. 
Provide a very short, poetic, and motivating insight (maximum 2 sentences) that connects the dots of their thoughts.
At the very end, on a new line, provide exactly 3 single-word themes or tags starting with a hashtag (e.g., #Growth #Clarity #Patience)."""

        full_prompt = f"{system_prompt}\n\n{history_text}\n\nCurrent Entry: {content}\n\nYour Insight:"

        ai_insight = "The Nexus is quiet right now. (Make sure Ollama is running locally!)"
        try:
            ollama_payload = { "model": "gemma:2b", "prompt": full_prompt, "stream": False }
            ollama_response = requests.post('http://127.0.0.1:11434/api/generate', json=ollama_payload, timeout=45)
            if ollama_response.status_code == 200:
                ai_insight = ollama_response.json().get('response', '').strip()
        except requests.exceptions.RequestException as e:
            print(f"Failed to connect to local LLM: {e}")

        reflection = DailyReflection.objects.create(user=request.user, content=content, mood=mood, ai_insight=ai_insight)
        serializer = DailyReflectionSerializer(reflection)
        return Response(serializer.data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def reflection_detail_view(request, pk):
    try:
        reflection = DailyReflection.objects.get(pk=pk, user=request.user)
    except DailyReflection.DoesNotExist:
        return Response({"error": "Reflection not found."}, status=404)
    
    if request.method == 'DELETE':
        reflection.delete()
        return Response(status=204)
        
    elif request.method == 'PATCH':
        reflection.content = request.data.get('content', reflection.content)
        
        past_reflections = DailyReflection.objects.filter(
            user=request.user, created_at__lt=reflection.created_at
        ).order_by('-created_at')[:3]
        history_text = "\n".join([f"Past Entry: {r.content}" for r in reversed(past_reflections)])
        
        try:
            persona = request.user.userprofile.persona
        except UserProfile.DoesNotExist:
            persona = 'guest'

        system_prompt = f"""You are Viscora Nexus, an empathetic AI journal companion speaking to a {persona}. 
Read their past entries (if any) and their current entry. 
Provide a very short, poetic, and motivating insight (maximum 2 sentences) that connects the dots of their thoughts.
At the very end, on a new line, provide exactly 3 single-word themes or tags starting with a hashtag."""

        full_prompt = f"{system_prompt}\n\n{history_text}\n\nCurrent Entry: {reflection.content}\n\nYour Insight:"

        try:
            ollama_payload = { "model": "gemma:2b", "prompt": full_prompt, "stream": False }
            ollama_response = requests.post('http://127.0.0.1:11434/api/generate', json=ollama_payload, timeout=45)
            if ollama_response.status_code == 200:
                reflection.ai_insight = ollama_response.json().get('response', '').strip()
        except requests.exceptions.RequestException:
            pass

        reflection.save()
        serializer = DailyReflectionSerializer(reflection)
        return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_view(request):
    messages = request.data.get('messages', [])
    if not messages:
        return Response({"error": "No messages provided."}, status=400)

    recent_messages = messages[-6:]
    chat_history = ""
    for msg in recent_messages:
        role = "User" if msg.get('role') == 'user' else "Nexus"
        chat_history += f"{role}: {msg.get('text')}\n"

    past_reflections = DailyReflection.objects.filter(user=request.user).order_by('-created_at')[:3]
    reflections_context = "\n".join([f"Past Entry ({r.created_at.strftime('%b %d')}): {r.content}" for r in reversed(past_reflections)])

    try:
        persona = request.user.userprofile.persona
    except UserProfile.DoesNotExist:
        persona = 'guest'

    system_prompt = f"""You are Viscora Nexus. You act as a very close, trusted friend and a wise mentor to the user, who is a {persona}.
Your tone is warm, highly empathetic, deeply supportive, and conversational. Do not sound like a generic AI; sound like a human who deeply cares about their well-being and growth.
Keep your responses relatively brief (1-3 sentences max) so it feels like a real-time text chat. Ask gentle, thoughtful follow-up questions to help them explore their feelings.Not just surface-level questions, but deep ones that show you are really trying to understand and connect the dots of their inner world.And keep the language simple and accessible, like a close friend would. Avoid being too philosophical or abstract in this context.
Here are the user's most recent journal entries for background context:
{reflections_context}"""

    full_prompt = f"{system_prompt}\n\nHere is the ongoing conversation:\n{chat_history}\nNexus:"

    try:
        ollama_payload = { "model": "gemma:2b", "prompt": full_prompt, "stream": False }
        ollama_response = requests.post('http://127.0.0.1:11434/api/generate', json=ollama_payload, timeout=45)
        if ollama_response.status_code == 200:
            ai_reply = ollama_response.json().get('response', '').strip()
            return Response({"reply": ai_reply}, status=200)
        else:
            return Response({"reply": "My thoughts are a bit scattered right now. (Ollama Error)"}, status=500)
    except requests.exceptions.RequestException as e:
        print(f"Failed to connect to local LLM: {e}")
        return Response({"reply": "I feel a bit disconnected. (Make sure Ollama is running!)"}, status=500)


# --- UPGRADED: DEEP ANALYSIS (SWOT + WWW + 5 Whys + Quote) ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deep_analysis_view(request):
    reflections = DailyReflection.objects.filter(user=request.user).order_by('-created_at')[:5]
    
    if reflections.count() < 2:
        return Response({"error": "Nexus needs at least 2 entries to generate a thorough analysis."}, status=400)
        
    entries_text = "\n".join([f"- {r.content}" for r in reflections])
    
    system_prompt = """You are Viscora Nexus. Perform a deep, intuitive psychological analysis based on the provided journal entries.
You MUST output your response EXACTLY as a JSON object matching this structure. Do not include any extra text.
{
  "swot": {
    "strengths": "One sentence strength.",
    "weaknesses": "One sentence weakness.",
    "opportunities": "One sentence opportunity.",
    "threats": "One sentence threat."
  },
  "www_ebi": {
    "what_went_well": "One sentence on what went well.",
    "even_better_if": "One sentence on what could be improved."
  },
  "five_whys": [
    "1. Why [state a core challenge from the text]? Because [reason].",
    "2. Why [reason]? Because...",
    "3. Why [previous answer]? Because...",
    "4. Why [previous answer]? Because...",
    "5. Why [previous answer]? [Root Cause]."
  ],
  "quote": "A relevant, inspiring famous quote."
}"""

    full_prompt = f"{system_prompt}\n\nRecent Entries:\n{entries_text}\n\nOutput JSON:"
    
    try:
        ollama_payload = {
            "model": "gemma:2b", 
            "prompt": full_prompt,
            "stream": False
        }
        # Deep analysis takes more processing power, timeout increased to 630s
        ollama_response = requests.post('http://127.0.0.1:11434/api/generate', json=ollama_payload, timeout=630)
        
        if ollama_response.status_code == 200:
            ai_reply = ollama_response.json().get('response', '').strip()
            # Extremely robust JSON extraction pattern
            json_match = re.search(r'(\{.*\})', ai_reply, re.DOTALL)
            if json_match:
                analysis_data = json.loads(json_match.group(1))
                return Response(analysis_data, status=200)
            else:
                return Response({"error": "Failed to parse Nexus analysis format."}, status=500)
    except Exception as e:
        print(f"Deep Analysis generation failed: {e}")
        return Response({"error": "Nexus connection interrupted or timed out."}, status=500)