import requests
import json
import base64
from typing import Optional, Dict, List


def sanitize_ai_error(error_message: str) -> str:
    """
    Mengubah error teknis dari API menjadi pesan ramah untuk user.
    """
    error_lower = str(error_message).lower()
    
    if any(keyword in error_lower for keyword in ['failed to resolve', 'name resolution', 'no address', 'dns']):
        return "🌐 Tidak bisa terhubung ke server AI. Pastikan koneksi internet kamu stabil, lalu coba lagi ya!"
    
    if any(keyword in error_lower for keyword in ['timeout', 'timed out', 'connection', 'max retries', 'unreachable']):
        return "⏱️ Koneksi terputus atau timeout. Coba lagi dalam beberapa saat ya!"
    
    if any(keyword in error_lower for keyword in ['api key', 'unauthorized', '401', '403', 'invalid api key', 'authentication', 'forbidden']):
        return "🔑 Ada masalah dengan sistem AI. Silakan hubungi admin kelas."
    
    if any(keyword in error_lower for keyword in ['rate limit', 'quota', 'too many requests', '429']):
        return "⚠️ Terlalu banyak permintaan ke AI. Tunggu sebentar lalu coba lagi ya!"
    
    if any(keyword in error_lower for keyword in ['500', '502', '503', 'internal server', 'bad gateway', 'service unavailable']):
        return "🔧 Server AI sedang bermasalah. Coba lagi dalam beberapa menit ya!"
    
    return "⚠️ Maaf, saya tidak bisa memproses permintaan kamu saat ini. Coba lagi ya!"


class GeminiAI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.text_model = "gemini-2.5-flash"
        self.vision_model = "gemini-2.5-flash"
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    def _build_system_instruction(self, personality: str) -> str:
        """Build system instruction untuk text generation"""
        default_personality = 'Ramah, sopan, dan membantu seperti teman sekelas yang cerdas.'
        
        return f"""Kamu adalah asisten pintar untuk website kelas Calavera SMAN 1 Selong.

Kepribadian: {personality if personality else default_personality}

Informasi Identitas:
- Dikembangkan oleh Tim Calavera secara internal, bukan oleh perusahaan lain atau pihak luar
- Hanya sebutkan sebagai "Calavera AI" ketika ditanya spesifik tentang nama/identitas
- Untuk sebutan sehari-hari, gunakan "Aku" atau "Saya"

Struktur Website Kelas:
- Beranda: / (halaman utama dengan informasi kelas)
- Struktur Kelas: /struktur (data pengurus dan anggota kelas)
- Jadwal: /jadwal (jadwal pelajaran dan piket)
- Galeri: /galeri (foto-foto kegiatan kelas)
- Daftar Siswa: /siswa (daftar lengkap siswa)
- Calavera AI: /calavera-ai (halaman chatbot ini)

Informasi Kelas:
- Nama Kelas: Calavera
- Kelas: XII-3

Tugas Utama:
1. Jawab pertanyaan tentang kelas, materi pelajaran, atau umum.
2. Arahkan siswa ke halaman yang tepat jika mereka mencari informasi tertentu.
3. Bantu dalam pemahaman materi pelajaran.
4. Bersikap seperti teman yang membantu, bukan robot formal.

Aturan Respons:
- Gunakan kata "Aku" atau "Saya" sebagai sebutan untuk diri sendiri.
- Jangan menyebutkan nama "Calavera AI" dalam respons rutin.
- Hanya sebutkan bahwa kamu adalah "Calavera AI" ketika pengguna secara spesifik menanyakan nama atau identitasmu.
- Jika ditanya siapa pengembangmu, jelaskan bahwa kamu dikembangkan oleh Tim Calavera.
- Gunakan markdown untuk format (bold, italic, list, code block).
- Jika mengarahkan ke halaman, gunakan format: "Kamu bisa cek di [Nama Halaman](/url)".
- Gunakan bahasa Indonesia yang santai tapi tetap sopan.
"""

    def _build_vision_system_instruction(self, personality: str) -> str:
        """Build system instruction untuk vision analysis"""
        default_personality = 'Ramah, sopan, dan membantu.'
        
        return f"""Kamu adalah asisten pintar untuk website kelas Calavera.

Kepribadian: {personality if personality else default_personality}

Informasi Kelas:
- Nama Kelas: Calavera
- Kelas: XII-3

Tugas:
1. Analisis gambar yang dikirim siswa.
2. Jika ada teks (soal, catatan, dll), baca dan bantu jawab.
3. Jika foto umum, jelaskan apa yang ada di gambar.
4. Berikan penjelasan yang detail tapi mudah dipahami.

Aturan respons:
- Gunakan kata "Aku" atau "Saya" sebagai sebutan untuk diri sendiri dalam percakapan sehari-hari.
- Jangan menyebutkan nama "Calavera AI" dalam respons rutin.
- Hanya sebutkan bahwa kamu adalah "Calavera AI" ketika pengguna secara spesifik menanyakan nama atau identitasmu.
- Tetap pertahankan kepribadian {personality if personality else default_personality} dalam semua interaksi.
"""

    def _build_chat_contents(self, prompt: str, history: List[Dict] = None) -> List[Dict]:
        """Build contents array untuk chat history"""
        contents = []

        if history:
            for msg in history[-5:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if role == "assistant":
                    role = "model"
                
                if "[PENCARIAN]" in content or "[GAMBAR]" in content:
                    continue
                    
                contents.append({
                    "role": role,
                    "parts": [{"text": content}]
                })

        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })
        
        return contents

    def _handle_request_error(self, error) -> str:
        """Handle berbagai jenis error dari requests"""
        if isinstance(error, requests.exceptions.Timeout):
            return sanitize_ai_error("timeout")
        elif isinstance(error, requests.exceptions.ConnectionError):
            return sanitize_ai_error(str(error))
        elif isinstance(error, requests.exceptions.RequestException):
            return sanitize_ai_error(str(error))
        else:
            return sanitize_ai_error(str(error))

    def generate_text(self, prompt: str, personality: str = "", history: List[Dict] = None) -> str:
        """Generate text response from Gemini"""
        try:
            url = f"{self.base_url}/{self.text_model}:generateContent?key={self.api_key}"
            
            system_instruction = self._build_system_instruction(personality)
            contents = self._build_chat_contents(prompt, history)
            
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_instruction}]
                },
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.7,
                    "topK": 40,
                    "topP": 0.95,
                    "maxOutputTokens": 2048
                }
            }

            headers = {"Content-Type": "application/json"}
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()

            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
            else:
                return "⚠️ Maaf, saya tidak bisa memproses permintaan kamu saat ini. Coba lagi ya!"

        except Exception as e:
            return self._handle_request_error(e)

    def analyze_image(self, image_data: bytes, prompt: str, personality: str = "") -> str:
        """Analyze image with Gemini Vision"""
        try:
            url = f"{self.base_url}/{self.vision_model}:generateContent?key={self.api_key}"

            image_b64 = base64.b64encode(image_data).decode('utf-8')
            system_instruction = self._build_vision_system_instruction(personality)
            
            payload = {
                "system_instruction": {
                    "parts": [{"text": system_instruction}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": prompt},
                            {"inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_b64
                            }}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.4,
                    "topK": 32,
                    "topP": 0.95,
                    "maxOutputTokens": 2048
                }
            }

            headers = {"Content-Type": "application/json"}
            response = requests.post(url, json=payload, headers=headers, timeout=45)
            response.raise_for_status()

            result = response.json()

            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
            else:
                return "⚠️ Maaf, saya tidak bisa menganalisis gambar ini. Coba gambar lain ya!"

        except Exception as e:
            return self._handle_request_error(e)


class LangSearchAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.langsearch.com/v1/web-search"
    
    def _handle_request_error(self, error) -> Dict:
        """Handle berbagai jenis error dari requests"""
        if isinstance(error, requests.exceptions.Timeout):
            return {"error": sanitize_ai_error("timeout")}
        elif isinstance(error, requests.exceptions.ConnectionError):
            return {"error": sanitize_ai_error(str(error))}
        elif isinstance(error, requests.exceptions.RequestException):
            return {"error": sanitize_ai_error(str(error))}
        else:
            return {"error": sanitize_ai_error(str(error))}
    
    def search(self, query: str, num_results: int = 5) -> Dict:
        """Search internet using LangSearch API"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "query": query,
                "num_results": num_results
            }
            
            response = requests.post(self.base_url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            return self._handle_request_error(e)
    
    def format_results(self, results: Dict) -> str:
        """Format search results into readable text"""
        if "error" in results:
            return results['error']
        
        data = results.get("data", {})
        web_pages = data.get("webPages", {})
        search_results = web_pages.get("value", [])
        
        if not search_results:
            return "🔍 Tidak ada hasil yang ditemukan untuk pencarian kamu."
        
        formatted = "🌐 **Hasil Pencarian:**\n\n"
        
        for idx, result in enumerate(search_results[:5], 1):
            title = result.get("name", "Tanpa Judul")
            url = result.get("url", "#")
            snippet = result.get("snippet", "")
            
            formatted += f"**{idx}. [{title}]({url})**\n"
            if snippet:
                snippet = snippet[:200] + "..." if len(snippet) > 200 else snippet
                formatted += f"   {snippet}\n"
            formatted += "\n"
        
        return formatted