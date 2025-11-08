import requests
import json
import base64
from typing import List, Dict


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


class MistralAI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "mistralai/mistral-small-3.2-24b-instruct:free"
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"

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

    def _build_chat_messages(self, prompt: str, personality: str, history: List[Dict] = None) -> List[Dict]:
        """Build messages array untuk chat history"""
        messages = []

        # System instruction sebagai message pertama
        system_instruction = self._build_system_instruction(personality)
        messages.append({
            "role": "system",
            "content": system_instruction
        })

        # Add history (5 terakhir)
        if history:
            for msg in history[-5:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                
                # Skip messages dengan tag khusus
                if "[PENCARIAN]" in content or "[GAMBAR]" in content:
                    continue
                    
                messages.append({
                    "role": role,
                    "content": content
                })

        # Add current prompt
        messages.append({
            "role": "user",
            "content": prompt
        })
        
        return messages

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
        """Generate text response from Mistral"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://calavera-class.com",
                "X-Title": "Calavera AI"
            }
            
            messages = self._build_chat_messages(prompt, personality, history)
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2048
            }

            response = requests.post(
                self.base_url, 
                headers=headers, 
                json=payload, 
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
        """Analyze image with Mistral Vision"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://calavera-class.com",
                "X-Title": "Calavera AI"
            }

            # ✅ Encode image ke base64
            image_b64 = base64.b64encode(image_data).decode('utf-8')
            
            # ✅ Build data URL (format yang Mistral butuhkan)
            image_data_url = f"data:image/jpeg;base64,{image_b64}"
            
            # System instruction
            system_instruction = self._build_system_instruction(personality)
            
            # ✅ Build messages dengan format Mistral Vision
            messages = [
                {
                    "role": "system",
                    "content": system_instruction
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt if prompt else "Jelaskan apa yang ada di gambar ini"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_url
                            }
                        }
                    ]
                }
            ]
            
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": 2048
            }

            response = requests.post(
                self.base_url, 
                headers=headers, 
                json=payload, 
                timeout=45
            )
            response.raise_for_status()

            result = response.json()

            if 'choices' in result and len(result['choices']) > 0:
                return result['choices'][0]['message']['content']
            else:
                return "⚠️ Maaf, saya tidak bisa menganalisis gambar ini. Coba gambar lain ya!"

        except Exception as e:
            return self._handle_request_error(e)