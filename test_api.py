import requests
import os
from dotenv import load_dotenv

load_dotenv()

MISTRAL_API_KEY="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"

print("=" * 60)
print("🧪 TESTING MISTRAL API KEY")
print("=" * 60)
print(f"API Key (first 15 chars): {MISTRAL_API_KEY[:15] if MISTRAL_API_KEY else 'MISSING'}...")
print(f"API Key length: {len(MISTRAL_API_KEY) if MISTRAL_API_KEY else 0}")
print()

if not MISTRAL_API_KEY:
    print("❌ ERROR: MISTRAL_API_KEY not found in .env!")
    exit(1)

# Test request
url = "https://openrouter.ai/api/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {MISTRAL_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://calavera-class.com",
    "X-Title": "Calavera AI Test"
}

payload = {
    "model": "mistralai/mistral-small-3.2-24b-instruct:free",
    "messages": [
        {
            "role": "user",
            "content": "Say hello in one word"
        }
    ],
    "max_tokens": 10
}

print("🔵 Sending test request...")
print(f"🔵 URL: {url}")
print()

try:
    response = requests.post(url, headers=headers, json=payload, timeout=30)
    
    print(f"✅ Status Code: {response.status_code}")
    print(f"✅ Response Headers:")
    for key, value in response.headers.items():
        print(f"   {key}: {value}")
    print()
    print(f"✅ Response Body:")
    print(response.text)
    print()
    
    if response.status_code == 200:
        result = response.json()
        if 'choices' in result:
            print("🎉 SUCCESS! API Key is valid!")
            print(f"🎉 Response: {result['choices'][0]['message']['content']}")
        else:
            print("⚠️ WARNING: Unexpected response format")
    elif response.status_code == 401:
        print("❌ ERROR: Invalid API Key (401 Unauthorized)")
        print("   → Check if API key is correct")
        print("   → Check if API key is expired")
    elif response.status_code == 402:
        print("❌ ERROR: Payment Required (402)")
        print("   → OpenRouter credit habis")
        print("   → Top up di: https://openrouter.ai/credits")
    elif response.status_code == 429:
        print("❌ ERROR: Rate Limit (429)")
        print("   → Terlalu banyak request")
        print("   → Tunggu beberapa menit")
    else:
        print(f"❌ ERROR: HTTP {response.status_code}")
        print(f"   {response.text}")
    
except requests.exceptions.Timeout:
    print("❌ ERROR: Request timeout (>30s)")
except requests.exceptions.ConnectionError as e:
    print(f"❌ ERROR: Connection failed")
    print(f"   {e}")
except Exception as e:
    print(f"❌ ERROR: {type(e).__name__}: {e}")

print("=" * 60)