import requests
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


class GroqAI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.text_model = "llama-3.3-70b-versatile"
        self.vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"

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

    def _build_chat_messages(self, prompt: str, personality: str, history: List[Dict] = None) -> List[Dict]:
        """Build messages array untuk chat history"""
        system_instruction = self._build_system_instruction(personality)
        messages = [{"role": "system", "content": system_instruction}]

        if history:
            for msg in history[-5:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                if "[PENCARIAN]" in content or "[GAMBAR]" in content:
                    continue
                    
                messages.append({
                    "role": role,
                    "content": content
                })

        messages.append({
            "role": "user",
            "content": prompt
        })
        
        return messages

    def _get_headers(self) -> Dict:
        """Get request headers dengan authorization"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

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
        """Generate text response from Groq"""
        try:
            messages = self._build_chat_messages(prompt, personality, history)
            
            payload = {
                "model": self.text_model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048,
                "top_p": 1,
                "stream": False
            }

            response = requests.post(
                self.base_url,
                json=payload,
                headers=self._get_headers(),
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()

            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content']
            else:
                return "⚠️ Maaf, saya tidak bisa memproses permintaan kamu saat ini. Coba lagi ya!"

        except Exception as e:
            return self._handle_request_error(e)

    def analyze_image(self, image_data: bytes, prompt: str, personality: str = "") -> str:
        """Analyze image with Groq Vision (Llama 4 Scout)"""
        try:
            image_b64 = base64.b64encode(image_data).decode('utf-8')
            system_instruction = self._build_vision_system_instruction(personality)
            
            payload = {
                "model": self.vision_model,
                "messages": [
                    {
                        "role": "system",
                        "content": system_instruction
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}"
                                }
                            }
                        ]
                    }
                ],
                "temperature": 0.4,
                "max_tokens": 2048,
                "top_p": 1,
                "stream": False
            }

            response = requests.post(
                self.base_url,
                json=payload,
                headers=self._get_headers(),
                timeout=60
            )
            response.raise_for_status()

            result = response.json()

            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content']
            else:
                return "⚠️ Maaf, saya tidak bisa menganalisis gambar ini. Coba gambar lain ya!"

        except Exception as e:
            return self._handle_request_error(e)