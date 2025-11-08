from flask import render_template, request, jsonify, session
from . import chatbot_bp
from .ai_utils import GeminiAI, LangSearchAPI
from .ai_groq import GroqAI
from .ai_mistral import MistralAI
from .ai_deepseek import DeepSeekAI
from .file_parser import FileParser
import os
import shutil
from datetime import datetime
from werkzeug.utils import secure_filename
from dotenv import load_dotenv


BASE_DIR = os.path.dirname(__file__)
ENV_PATH = os.path.join(BASE_DIR, '.env')

if os.path.exists(ENV_PATH);
load_dotenv(ENV_PATH)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
LANGSEARCH_API_KEY = os.getenv('LANGSEARCH_API_KEY')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

gemini = GeminiAI(GEMINI_API_KEY)
groq = GroqAI(GROQ_API_KEY)
mistral = MistralAI(MISTRAL_API_KEY)
deepseek = DeepSeekAI(DEEPSEEK_API_KEY)
langsearch = LangSearchAPI(LANGSEARCH_API_KEY)

print("=" * 50)
print("🚀 AI ENGINES INITIALIZED:")
print(f"✅ Gemini API Key: {'SET' if GEMINI_API_KEY else 'MISSING'}")
print(f"✅ Groq API Key: {'SET' if GROQ_API_KEY else 'MISSING'}")
print(f"✅ Mistral API Key: {'SET' if MISTRAL_API_KEY else 'MISSING'}")
print(f"✅ DeepSeek API Key: {'SET' if DEEPSEEK_API_KEY else 'MISSING'}")
print(f"✅ LangSearch API Key: {'SET' if LANGSEARCH_API_KEY else 'MISSING'}")
print("=" * 50)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'img', 'chat_uploads')

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_FILE_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_image_file(filename):
    """Check if file extension is allowed for images"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def allowed_document_file(filename):
    """Check if file extension is allowed for documents"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_FILE_EXTENSIONS


def sanitize_error(error_message: str) -> str:
    """
    Mengubah error teknis menjadi pesan ramah untuk user.
    Mencegah bocornya informasi sensitif seperti API key, endpoint, dll.
    """
    error_lower = str(error_message).lower()
    
    if any(keyword in error_lower for keyword in ['timeout', 'connection', 'network', 'unreachable']):
        return "⏱️ Koneksi terputus atau timeout. Coba lagi dalam beberapa saat ya!"
    
    if any(keyword in error_lower for keyword in ['api key', 'unauthorized', '401', '403', 'authentication', 'forbidden']):
        return "🔑 Ada masalah dengan autentikasi sistem. Silakan hubungi admin kelas."
    
    if any(keyword in error_lower for keyword in ['rate limit', 'too many requests', '429']):
        return "⚠️ Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi ya!"
    
    if any(keyword in error_lower for keyword in ['500', '502', '503', 'internal server', 'bad gateway', 'service unavailable']):
        return "🔧 Server sedang bermasalah. Tim sudah diberitahu dan akan segera memperbaikinya!"
    
    if any(keyword in error_lower for keyword in ['image', 'file', 'upload']):
        return "🖼️ Gagal memproses gambar. Pastikan file berupa gambar valid (JPG/PNG) dan ukurannya tidak lebih dari 5MB."
    
    return "⚠️ Terjadi kesalahan saat memproses permintaan kamu. Coba lagi ya!"

def get_ai_engine(model: str):
    """Get AI engine based on model selection"""
    if model == "groq":
        return groq
    elif model == "deepseek":  # ✅ TAMBAHKAN INI
        return deepseek
    elif model == "mistral":  # ✅ TAMBAHKAN INI
        return mistral
    else:
        return gemini

def get_chat_history():
    """Get or initialize chat history from session"""
    if 'chat_history' not in session:
        session['chat_history'] = []
    return session['chat_history']


def update_chat_history(history):
    """Update and limit chat history in session"""
    session['chat_history'] = history[-10:]
    session.modified = True


def save_uploaded_image(image_file):
    """Save uploaded image and return filepath and URL"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    original_filename = secure_filename(image_file.filename)
    filename = f"chat_{timestamp}_{original_filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    image_file.save(filepath)
    image_url = f"/static/img/chat_uploads/{filename}"
    
    return filepath, image_url


def handle_search_mode(message, history):
    """Handle internet search mode"""
    search_results = langsearch.search(message)
    formatted_results = langsearch.format_results(search_results)
    
    history.append({"role": "user", "content": f"[PENCARIAN] {message}"})
    history.append({"role": "assistant", "content": formatted_results})
    update_chat_history(history)
    
    return {
        "response": formatted_results,
        "mode": "search"
    }


def handle_image_mode(message, personality, model, history):
    """Handle image analysis mode"""
    if model == "deepseek":
        raise ValueError("⚠️ DeepSeek tidak mendukung analisis gambar. Silakan gunakan model Gemini atau Llama.")
    
    if 'image' not in request.files:
        raise ValueError("🖼️ Tidak ada gambar yang diupload")
    
    image_file = request.files['image']
    
    if image_file.filename == '':
        raise ValueError("🖼️ File gambar kosong")
    
    if not allowed_image_file(image_file.filename):  # ✅ UPDATE INI
        raise ValueError("🖼️ Format gambar tidak didukung. Gunakan JPG, PNG, atau GIF")
    
    filepath, image_url = save_uploaded_image(image_file)
    
    with open(filepath, 'rb') as f:
        image_data = f.read()
    
    ai_engine = get_ai_engine(model)
    prompt = message if message else "Jelaskan apa yang ada di gambar ini"
    response = ai_engine.analyze_image(image_data, prompt, personality)
    
    history.append({"role": "user", "content": f"[GAMBAR] {prompt}", "image_url": image_url})
    history.append({"role": "assistant", "content": response})
    update_chat_history(history)
    
    return {
        "response": response,
        "mode": "image",
        "image_url": image_url,
        "model": model
    }

def handle_file_mode(message, personality, model, history):
    """Handle document file upload and analysis"""
    if 'file' not in request.files:
        raise ValueError("📄 Tidak ada file yang diupload")
    
    file = request.files['file']
    
    if file.filename == '':
        raise ValueError("📄 File kosong")
    
    if not allowed_document_file(file.filename):
        raise ValueError("📄 Format file tidak didukung. Gunakan PDF, DOCX, atau TXT")
    
    # Save file temporarily
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    original_filename = secure_filename(file.filename)
    filename = f"doc_{timestamp}_{original_filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    file.save(filepath)
    
    # Extract file extension
    file_extension = original_filename.rsplit('.', 1)[1].lower()
    
    # Parse file to extract text
    extracted_text = FileParser.parse_file(filepath, file_extension)
    
    # Delete file after extraction (optional, untuk hemat storage)
    try:
        os.remove(filepath)
    except:
        pass
    
    # Check if extraction failed
    if extracted_text.startswith("⚠️"):
        raise ValueError(extracted_text)
    
    # Limit text length (max 8000 chars untuk prevent token overflow)
    if len(extracted_text) > 8000:
        extracted_text = extracted_text[:8000] + "\n\n... (teks dipotong karena terlalu panjang)"
    
    # ❌ HAPUS BAGIAN INI
    # Get file info
    # file_info = FileParser.get_file_info(extracted_text, original_filename)
    
    # Build prompt untuk AI
    if message:
        ai_prompt = f"""File: {original_filename}

Isi File:
{extracted_text}

---

Pertanyaan User: {message}

Jawab pertanyaan user berdasarkan isi file di atas."""
    else:
        ai_prompt = f"""File: {original_filename}

Isi File:
{extracted_text}

---

Buatkan ringkasan singkat dari isi file ini."""
    
    # Send to AI
    ai_engine = get_ai_engine(model)
    response = ai_engine.generate_text(ai_prompt, personality, history)
    
    # ✅ GANTI BAGIAN INI - Langsung response AI tanpa file info
    final_response = response  # Langsung response, tanpa statistik
    
    # Save to history
    history.append({"role": "user", "content": f"[FILE: {original_filename}] {message if message else 'Analisis file'}"})
    history.append({"role": "assistant", "content": final_response})
    update_chat_history(history)
    
    return {
        "response": final_response,
        "mode": "file",
        "filename": original_filename,
        "model": model
    }

def handle_text_mode(message, personality, model, history):
    """Handle normal text chat mode"""
    print(f"📊 [USAGE] Model: {model} | User message length: {len(message)} chars")
    ai_engine = get_ai_engine(model)
    response = ai_engine.generate_text(message, personality, history)
    print(f"📊 [USAGE] Model: {model} | Response length: {len(response)} chars")
    
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": response})
    update_chat_history(history)
    
    return {
        "response": response,
        "mode": "text",
        "model": model
    }


def clear_upload_folder():
    """Delete all uploaded images in folder"""
    if os.path.exists(UPLOAD_FOLDER):
        for filename in os.listdir(UPLOAD_FOLDER):
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")


@chatbot_bp.route("/")
def calavera_ai():
    """Main chatbot page"""
    return render_template("chatbot.html")

@chatbot_bp.route("/api/chat", methods=["POST"])
def chat_api():
    """Handle chat requests"""
    try:
        message = request.form.get("message", "").strip()
        personality = request.form.get("personality", "")
        mode = request.form.get("mode", "text")
        model = request.form.get("model", "gemini")
        
        # ✅ VALIDASI: Cegah image mode dengan DeepSeek
        if mode == "image" and model == "deepseek":
            return jsonify({
                "error": "⚠️ DeepSeek tidak mendukung analisis gambar. Silakan gunakan model Gemini, Llama, atau Mistral."
            }), 400
        
        # ✅ VALIDASI: Model harus valid (4 model yang tersedia)
        if model not in ["gemini", "groq", "deepseek", "mistral"]:
            return jsonify({
                "error": "⚠️ Model tidak valid."
            }), 400
        
        # ✅ VALIDASI: Message tidak boleh kosong untuk text mode
        if not message and mode not in ["image", "file"]:
            return jsonify({"error": "Pesan tidak boleh kosong"}), 400
        
        # ✅ VALIDASI: Message length (max 5000 chars)
        if len(message) > 5000:
            return jsonify({
                "error": "⚠️ Pesan terlalu panjang! Maksimal 5000 karakter."
            }), 400
        
        history = get_chat_history()
        
        # ✅ SEARCH MODE
        if mode == "search":
            result = handle_search_mode(message, history)
            return jsonify(result)
        
        # ✅ IMAGE MODE
        elif mode == "image":
            result = handle_image_mode(message, personality, model, history)
            return jsonify(result)
        
        # ✅ FILE MODE
        elif mode == "file":
            result = handle_file_mode(message, personality, model, history)
            return jsonify(result)
        
        # ✅ TEXT MODE (default)
        else:
            result = handle_text_mode(message, personality, model, history)
            return jsonify(result)
    
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        error_msg = sanitize_error(str(e))
        return jsonify({"error": error_msg}), 500

@chatbot_bp.route("/api/regenerate", methods=["POST"])
def regenerate_response():
    """Regenerate last response"""
    try:
        personality = request.json.get("personality", "")
        model = request.json.get("model", "gemini")
        
        history = get_chat_history()
        
        if len(history) < 2:
            return jsonify({"error": "Tidak ada pesan untuk di-regenerate"}), 400
        
        last_user_msg = None
        for msg in reversed(history):
            if msg.get("role") == "user":
                last_user_msg = msg.get("content")
                break
        
        if not last_user_msg:
            return jsonify({"error": "Tidak ditemukan pesan terakhir"}), 400
        
        if history[-1].get("role") == "assistant":
            history.pop()
        
        ai_engine = get_ai_engine(model)
        response = ai_engine.generate_text(last_user_msg, personality, history[:-1])
        
        history.append({"role": "assistant", "content": response})
        session['chat_history'] = history
        session.modified = True
        
        return jsonify({
            "response": response,
            "model": model
        })
    
    except Exception as e:
        error_msg = sanitize_error(str(e))
        return jsonify({"error": error_msg}), 500

@chatbot_bp.route("/api/clear", methods=["POST"])
def clear_chat():
    """Clear chat history and delete all uploaded images/files"""
    try:
        # ✅ Clear upload folder (images + files)
        clear_upload_folder()
        
        # ✅ Clear session history
        session['chat_history'] = []
        session.modified = True
        
        return jsonify({
            "message": "Chat dan file berhasil dihapus",
            "cleared_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    
    except Exception as e:
        error_msg = sanitize_error(str(e))
        return jsonify({"error": error_msg}), 500


@chatbot_bp.route("/api/delete-message", methods=["POST"])
def delete_message():
    """Delete specific message pair"""
    try:
        index = request.json.get("index", -1)
        history = get_chat_history()
        
        if index < 0 or index >= len(history):
            return jsonify({"error": "Index tidak valid"}), 400
        
        if index < len(history):
            history.pop(index)
        if index < len(history) and history[index].get("role") == "assistant":
            history.pop(index)
        
        session['chat_history'] = history
        session.modified = True
        
        return jsonify({"message": "Pesan berhasil dihapus"})
    
    except Exception as e:
        error_msg = sanitize_error(str(e))
        return jsonify({"error": error_msg}), 500
