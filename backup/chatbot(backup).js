class ToastManager {
    constructor() {
        this.currentToast = null;
        this.cooldownMap = new Map();
        this.cooldownDuration = 3000;
        this.setupContainer();
    }
    
    setupContainer() {
        const oldContainer = document.querySelector('.flash-messages');
        if (oldContainer) oldContainer.remove();
        
        this.container = document.createElement('div');
        this.container.className = 'flash-messages';
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 4000) {
        const now = Date.now();
        const messageKey = `${type}:${message}`;
        
        if (this.cooldownMap.has(messageKey)) {
            const lastShown = this.cooldownMap.get(messageKey);
            const timeSinceLastShown = now - lastShown;
            
            if (timeSinceLastShown < this.cooldownDuration) {
                console.log(`⏳ Toast skipped: "${message}" dalam cooldown (${Math.round((this.cooldownDuration - timeSinceLastShown) / 1000)}s tersisa)`);
                return;
            }
        }
        
        this.cooldownMap.set(messageKey, now);
        
        if (this.currentToast) {
            this.closeToast(this.currentToast, true);
        }
        
        this.createToast(message, type, duration);
        
        setTimeout(() => {
            this.cooldownMap.delete(messageKey);
        }, this.cooldownDuration);
    }
    
    createToast(message, type, duration) {
        const toast = document.createElement('div');
        toast.className = `flash-message ${type}`;
        
        const icon = this.getIcon(type);
        const title = this.getTitle(type);
        
        toast.innerHTML = `
            <div class="flash-icon">${icon}</div>
            <div class="flash-content">
                <div class="flash-title">${title}</div>
                <div class="flash-text">${message}</div>
            </div>
            <button class="flash-close">
                <i class="fas fa-times"></i>
            </button>
            <div class="flash-progress">
                <div class="flash-progress-bar"></div>
            </div>
        `;
        
        this.container.appendChild(toast);
        this.currentToast = toast;
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        const closeBtn = toast.querySelector('.flash-close');
        closeBtn.addEventListener('click', () => {
            this.closeToast(toast);
        });
        
        const autoCloseTimeout = setTimeout(() => {
            if (this.currentToast === toast) {
                this.closeToast(toast);
            }
        }, duration);
    }
    
    closeToast(toast, instant = false) {
        if (!toast || !toast.parentElement) return;
        
        toast.classList.remove('show');
        toast.style.transform = '';
        toast.style.animation = 'none';
        
        void toast.offsetWidth;
        
        toast.classList.add('hiding');
        
        const delay = instant ? 0 : 500;
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
            
            if (this.currentToast === toast) {
                this.currentToast = null;
            }
        }, delay);
    }
    
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || 'ℹ';
    }
    
    getTitle(type) {
        const titles = {
            success: 'Berhasil',
            error: 'Error',
            warning: 'Perhatian',
            info: 'Info'
        };
        return titles[type] || 'Notifikasi';
    }
}

window.toastManager = new ToastManager();

class SimpleChatbot {
    constructor() {
        this.initializeProperties();
        this.initializeElements();
        this.init();
    }
    
    initializeProperties() {
    this.selectedImageFile = null;
    this.selectedImageUrl = null;
    this.selectedDocumentFile = null;
    this.isSearchMode = false;
    this.isTyping = false;
    this.isStopRequested = false;
    this.currentTypingMessageId = null;
    this.isAnimatingTyping = false;
    
    this.lightboxImages = [];
    this.lightboxInstance = null;

    const savedModel = localStorage.getItem('calavera_model');
    const savedModelLabel = localStorage.getItem('calavera_model_label');
    
    this.currentModel = savedModel || "gemini";
    this.currentModelLabel = savedModelLabel || "Gemini 2.5 Flash";
    this.updateModelCapabilities();
    
    const savedPersonality = localStorage.getItem('calavera_personality');
    const savedPersonalityLabel = localStorage.getItem('calavera_personality_label');
    
    this.personality = savedPersonality || "";
    this.personalityLabel = savedPersonalityLabel || "Kepribadian Bot";
    
    // ✅ AUTO CLEAR SETTINGS - DEFAULT ON UNTUK USER BARU
    const savedAutoClear = localStorage.getItem('calavera_auto_clear');
    
    if (savedAutoClear === null) {
        // ✅ User baru (belum ada setting di localStorage)
        this.autoClearEnabled = true; // Default: AKTIF
        localStorage.setItem('calavera_auto_clear', 'true');
        console.log('👤 New user detected - Auto-clear enabled by default');
    } else {
        // ✅ User lama (sudah ada setting di localStorage)
        this.autoClearEnabled = savedAutoClear === 'true';
        console.log(`👤 Existing user - Auto-clear: ${this.autoClearEnabled ? 'ON' : 'OFF'}`);
    }
    
    this.autoClearTimeout = null;
    
    if (!window.toastManager) {
        window.toastManager = new ToastManager();
    }
}

updateModelCapabilities() {
    // ✅ Check if current model supports images
    const previousSupportsImages = this.supportsImages;
    
    // ✅ UPDATE: Mistral support images, DeepSeek tidak
    this.supportsImages = this.currentModel !== 'deepseek';
    
    // ✅ TAMBAHKAN: Jika switch dari model yang support image ke DeepSeek
    // dan ada preview gambar aktif, langsung hapus preview
    if (previousSupportsImages && !this.supportsImages) {
        // Cek apakah ada image preview yang aktif
        const hasActiveImagePreview = this.elements.imagePreviewContainer.classList.contains('active');
        
        if (hasActiveImagePreview) {
            // Hapus preview gambar
            this.removeImagePreview();
            
            // Tampilkan toast warning
            this.showToast('DeepSeek tidak mendukung analisis gambar. Preview dihapus.', 'warning');
            
            console.log('⚠️ Image preview removed due to model switch to DeepSeek');
        }
    }
    
    // ✅ Update UI state
    this.updateUploadModalState();
}

updateUploadModalState() {
    const optionPhoto = document.getElementById('optionPhoto');
    const optionCamera = document.getElementById('optionCamera');
    
    if (!this.supportsImages) {
        // ✅ Disable photo & camera options
        optionPhoto.classList.add('disabled');
        optionCamera.classList.add('disabled');
        optionPhoto.style.pointerEvents = 'none';
        optionCamera.style.pointerEvents = 'none';
        optionPhoto.style.opacity = '0.4';
        optionCamera.style.opacity = '0.4';
    } else {
        // ✅ Enable photo & camera options
        optionPhoto.classList.remove('disabled');
        optionCamera.classList.remove('disabled');
        optionPhoto.style.pointerEvents = 'all';
        optionCamera.style.pointerEvents = 'all';
        optionPhoto.style.opacity = '1';
        optionCamera.style.opacity = '1';
    }
}
  
    initializeElements() {
    this.elements = {
        emptyState: document.getElementById('emptyState'),
        chatMessages: document.getElementById('chatMessages'),
        chatInput: document.getElementById('chatInput'),
        imageFileInput: document.getElementById('imageFileInput'),
        uploadImageBtn: document.getElementById('uploadImageBtn'),
        sendMessageBtn: document.getElementById('sendMessageBtn'),
        searchToggleBtn: document.getElementById('searchToggleBtn'),
        imagePreviewContainer: document.getElementById('imagePreviewContainer'),
        imagePreview: document.getElementById('imagePreview'),
        removeImageBtn: document.getElementById('removeImageBtn'),
        // File preview elements
        filePreviewContainer: document.getElementById('filePreviewContainer'),
        filePreviewIcon: document.getElementById('filePreviewIcon'),
        filePreviewName: document.getElementById('filePreviewName'),
        filePreviewSize: document.getElementById('filePreviewSize'),
        removeFileBtn: document.getElementById('removeFileBtn'),
        // ❌ HAPUS INI: clearChatBtn: document.getElementById('clearChatBtn'),
        settingsDropdown: document.getElementById('settingsDropdown'),
        customPersonality: document.getElementById('customPersonality'),
        currentModelLabel: document.getElementById('currentModelLabel')
    };
    
    // ✅ Validasi elemen penting
    const requiredElements = [
        'emptyState', 'chatMessages', 'chatInput', 
        'sendMessageBtn', 'searchToggleBtn'
    ];
    
    requiredElements.forEach(key => {
        if (!this.elements[key]) {
            console.error(`❌ Required element missing: ${key}`);
        }
    });
}
    
    init() {
        this.setupEventListeners();
        this.loadChatHistory();
        this.updateSendButtonVisibility();
        this.loadPersonalitySettings();
        this.loadModelSettings();
        this.initializeLightbox();
        this.setupScrollToBottom();
        
        if (this.autoClearEnabled) {
          this.scheduleAutoClear();
        }
    }
    
    setupEventListeners() {
        this.setupImageListeners();
        this.setupMessageListeners();
        this.setupInputListeners();
        this.setupUIListeners();
        this.setupSettingsListeners();
        this.setupModelListeners();
    }
    
    setupImageListeners() {
    this.elements.uploadImageBtn.addEventListener('click', () => {
        this.openUploadModal();
    });
    
    // Modal controls
    const uploadModalOverlay = document.getElementById('uploadModalOverlay');
    const uploadModalClose = document.getElementById('uploadModalClose');
    const optionCamera = document.getElementById('optionCamera');
    const optionPhoto = document.getElementById('optionPhoto');
    const optionFile = document.getElementById('optionFile');
    
    // Close modal listeners
    uploadModalClose.addEventListener('click', () => {
        this.closeUploadModal();
    });
    
    uploadModalOverlay.addEventListener('click', (e) => {
        if (e.target === uploadModalOverlay) {
            this.closeUploadModal();
        }
    });
    
    // Option listeners
    optionCamera.addEventListener('click', () => {
    // ✅ TAMBAHKAN VALIDASI INI
    if (!this.supportsImages) {
        this.showToast('DeepSeek tidak mendukung analisis gambar', 'warning');
        return;
    }
    this.openCamera();
});
    
    optionPhoto.addEventListener('click', () => {
    // ✅ TAMBAHKAN VALIDASI INI
    if (!this.supportsImages) {
        this.showToast('DeepSeek tidak mendukung analisis gambar', 'warning');
        return;
    }
    this.openPhotoGallery();
});
    
    optionFile.addEventListener('click', () => {
        this.openFileExplorer();
    });
    
    // ✅ PERBAIKAN: Pisahkan handler untuk setiap input
    // Handler untuk photo gallery (input biasa)
    this.elements.imageFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            this.handleImageSelect(e.target.files[0]);
            this.closeUploadModal();
            e.target.value = ''; // Reset input
        }
    });
    
    // Handler untuk camera input (terpisah)
    const cameraInput = document.getElementById('cameraInput');
    cameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            this.handleImageSelect(e.target.files[0]);
            this.closeUploadModal();
            e.target.value = ''; // Reset input
        }
    });
    
    // Handler untuk file upload
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            this.handleFileSelect(e.target.files[0]);
            this.closeUploadModal();
            e.target.value = ''; // Reset input
        }
    });
    
    this.elements.removeImageBtn.addEventListener('click', () => {
        this.removeImagePreview();
    });
    
    this.elements.removeFileBtn.addEventListener('click', () => {
        this.removeFilePreview();
    });
    
    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const uploadModalOverlay = document.getElementById('uploadModalOverlay');
            if (uploadModalOverlay.classList.contains('active')) {
                this.closeUploadModal();
            }
        }
    });
}
    
    setupMessageListeners() {
        this.elements.sendMessageBtn.addEventListener('click', () => {
            if (this.isTyping || this.isAnimatingTyping) {
                this.handleStopResponse();
            } else {
                this.sendMessage();
            }
        });
    }
    
    setupInputListeners() {
        this.elements.chatInput.addEventListener('input', () => {
            this.autoResize();
            this.updateSendButtonVisibility();
        });
        
        this.elements.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    setupUIListeners() {
        this.elements.searchToggleBtn.addEventListener('click', () => {
            this.toggleSearchMode();
        });
    }
    
    setupSettingsListeners() {
    // ✅ Settings button (fa-cog) to toggle dropdown
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const personalityOption = document.getElementById('personalityOption');
    const modelOption = document.getElementById('modelOption');
    const modalOverlay = document.getElementById('personalityModalOverlay');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const personalityOptions = document.querySelectorAll('.personality-option');
    const customPersonality = document.getElementById('customPersonality');
    
    // ✅ PERBAIKAN: Pastikan settingsBtn bisa diklik
    if (settingsBtn && settingsDropdown) {
        // Hapus semua event listener lama
        const newSettingsBtn = settingsBtn.cloneNode(true);
        settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);
        
        newSettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = settingsDropdown.classList.contains('active');
            
            console.log('🔧 Settings button clicked!');
            console.log('Current state:', isActive ? 'OPEN' : 'CLOSED');
            
            if (isActive) {
                settingsDropdown.classList.remove('active');
                console.log('✅ Dropdown closed');
            } else {
                settingsDropdown.classList.add('active');
                console.log('✅ Dropdown opened');
            }
        });
    } else {
        console.error('❌ settingsBtn or settingsDropdown not found!');
    }
    
    // ✅ Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.personality-settings') && 
            !e.target.closest('#settingsBtn') &&
            settingsDropdown) {
            settingsDropdown.classList.remove('active');
        }
    });
    
    // ✅ Open Personality Modal
    if (personalityOption) {
        personalityOption.addEventListener('click', (e) => {
            e.stopPropagation();
            if (settingsDropdown) settingsDropdown.classList.remove('active');
            if (modalOverlay) {
                modalOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    }
    
    // ✅ Close Personality Modal
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            this.closePersonalityModal();
        });
    }
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closePersonalityModal();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
            this.closePersonalityModal();
        }
    });
    
    // ✅ Personality options click handlers
    personalityOptions.forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value');
            const label = option.querySelector('.option-title').textContent;
            
            personalityOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            if (value === 'custom') {
                customPersonality.style.display = 'block';
                customPersonality.focus();
                this.personality = customPersonality.value.trim();
                this.personalityLabel = 'Custom';
            } else {
                customPersonality.style.display = 'none';
                this.personality = value;
                this.personalityLabel = label;
                
                this.savePersonalitySettings(value, label);
                this.updatePersonalityLabel(label);
                
                setTimeout(() => {
                    this.closePersonalityModal();
                }, 300);
            }
            
            if (value && value !== 'custom') {
                this.showToast('Kepribadian bot diubah!', 'success');
            }
        });
    });
    
    if (customPersonality) {
        customPersonality.addEventListener('input', () => {
            this.personality = customPersonality.value.trim();
            this.personalityLabel = 'Custom';
        });
        
        customPersonality.addEventListener('blur', () => {
            if (this.personality.trim()) {
                this.savePersonalitySettings(this.personality, 'Custom');
                this.updatePersonalityLabel('Custom');
                this.showToast('Kepribadian custom disimpan!', 'success');
            }
        });
    }
    
    // ✅ Auto Clear Toggle
    const autoClearCheckbox = document.getElementById('autoClearCheckbox');
    const autoClearStatus = document.getElementById('autoClearStatus');
    
    if (autoClearCheckbox) {
        if (this.autoClearEnabled) {
            autoClearCheckbox.checked = true;
            autoClearStatus.textContent = 'Aktif';
        } else {
            autoClearCheckbox.checked = false;
            autoClearStatus.textContent = 'Nonaktif';
        }
        
        autoClearCheckbox.addEventListener('change', (e) => {
            this.autoClearEnabled = e.target.checked;
            localStorage.setItem('calavera_auto_clear', this.autoClearEnabled);
            
            if (this.autoClearEnabled) {
                autoClearStatus.textContent = 'Aktif';
                this.showToast('Auto-clear riwayat diaktifkan! Chat akan dihapus setiap pukul 00:00', 'success');
                this.scheduleAutoClear();
            } else {
                autoClearStatus.textContent = 'Nonaktif';
                this.showToast('Auto-clear riwayat dinonaktifkan', 'info');
            }
        });
    }
    
    // ✅ Clear Chat Option
    const clearChatOption = document.getElementById('clearChatOption');
    if (clearChatOption && settingsDropdown) {
        clearChatOption.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.remove('active');
            this.clearAllChat();
        });
    }
}

setupModelListeners() {
    const modelOption = document.getElementById('modelOption');
    const modalOverlay = document.getElementById('modelModalOverlay');
    const modalCloseBtn = document.getElementById('modelCloseBtn');
    const modelOptions = document.querySelectorAll('.model-option');
    const settingsDropdown = document.getElementById('settingsDropdown');
    
    // ✅ VALIDASI: Pastikan semua elemen ada
    if (!modelOption) {
        console.error('❌ modelOption tidak ditemukan!');
        return;
    }
    
    if (!modalOverlay) {
        console.error('❌ modelModalOverlay tidak ditemukan!');
        return;
    }
    
    if (!modalCloseBtn) {
        console.error('❌ modelCloseBtn tidak ditemukan!');
        return;
    }
    
    // ✅ Open Model Modal - Pakai event delegation untuk memastikan klik terdeteksi
    modelOption.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Tutup dropdown settings
        if (settingsDropdown) {
            settingsDropdown.classList.remove('active');
        }
        
        // Buka modal
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    // ✅ Close Model Modal - Tombol close
    modalCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModelModal();
    });
    
    // ✅ Close Model Modal - Klik overlay
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            this.closeModelModal();
        }
    });
    
    // ✅ Close Model Modal - Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            this.closeModelModal();
        }
    });
    
    // ✅ Model options click handlers
    modelOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Cegah switch saat typing
            if (this.isTyping || this.isAnimatingTyping) {
                this.showToast('Tunggu respons selesai sebelum ganti model!', 'warning');
                return;
            }
            
            const model = option.getAttribute('data-model');
            const label = option.querySelector('.option-title').textContent;
            const currentInput = this.elements.chatInput.value.trim();
            
            if (currentInput.length > 0) {
                this.showToast('Pesan yang belum dikirim akan tetap tersimpan', 'info');
            }
            
            // Update selected state
            modelOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            // Save settings
            this.currentModel = model;
            this.currentModelLabel = label;
            
            this.saveModelSettings(model, label);
            this.updateModelLabel(label);
            
            // Update capabilities
            this.updateModelCapabilities();
            
            this.showToast(`Model diubah ke ${label}!`, 'success');
            
            console.log(`✅ Model switched to: ${label} (${model})`);
            
            // Tutup modal setelah delay
            setTimeout(() => {
                this.closeModelModal();
            }, 300);
        });
    });
}

scheduleAutoClear() {
    // Clear existing timeout if any
    if (this.autoClearTimeout) {
        clearTimeout(this.autoClearTimeout);
    }
    
    if (!this.autoClearEnabled) {
        console.log('⏸️ Auto-clear is disabled');
        return;
    }
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to 00:00:00
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const minutesUntilMidnight = Math.round(msUntilMidnight / 1000 / 60);
    
    console.log(`⏰ Auto-clear scheduled in ${minutesUntilMidnight} minutes (at 00:00)`);
    console.log(`📅 Current time: ${now.toLocaleString()}`);
    console.log(`📅 Next clear time: ${tomorrow.toLocaleString()}`);
    
    this.autoClearTimeout = setTimeout(() => {
        this.executeAutoClear();
    }, msUntilMidnight);
}

async executeAutoClear() {
    if (!this.autoClearEnabled) {
        console.log('⏸️ Auto-clear disabled, skipping execution');
        return;
    }
    
    console.log('🗑️ Auto-clearing chat history at midnight...');
    console.log(`🕐 Current time: ${new Date().toLocaleString()}`);
    
    try {
        // Call backend API to clear everything
        const response = await fetch('/calavera-ai/api/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            // Clear UI
            this.elements.chatMessages.innerHTML = '';
            this.elements.emptyState.classList.remove('hidden');
            
            // Clear localStorage
            localStorage.removeItem('calavera_chat_history');
            
            console.log('✅ Auto-clear completed successfully');
            
            this.showToast('Riwayat chat berhasil dihapus otomatis', 'success');
        } else {
            console.error('❌ Auto-clear API failed:', response.status);
        }
    } catch (error) {
        console.error('❌ Auto-clear error:', error);
    }
    
    // Schedule next clear for tomorrow midnight
    console.log('📅 Scheduling next auto-clear...');
    this.scheduleAutoClear();
}

    initializeLightbox() {
    // Inisialisasi lightbox hanya jika belum ada
    if (!this.lightboxInstance) {
        this.lightboxInstance = new GalleryLightbox();
    }
}

updateLightboxImages() {
    // ✅ PERBAIKAN: Hanya ambil gambar dari chat messages, bukan dari preview
    this.lightboxImages = [];
    const allImages = this.elements.chatMessages.querySelectorAll('.message-bubble img');
    
    allImages.forEach((img, index) => {
        this.lightboxImages.push({
            src: img.src,
            caption: img.alt || `Gambar ${index + 1}`
        });
    });
    
    // Update array gambar di lightbox
    if (this.lightboxInstance) {
        this.lightboxInstance.images = this.lightboxImages;
    }
}

attachLightboxToImage(imgElement, index) {
    imgElement.style.cursor = 'pointer';
    
    // Hapus event listener lama
    const newImg = imgElement.cloneNode(true);
    imgElement.parentNode.replaceChild(newImg, imgElement);
    
    newImg.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // ✅ PERBAIKAN: Buat array gambar hanya untuk gambar ini saja
        const singleImage = [{
            src: newImg.src,
            caption: newImg.alt || 'Gambar yang dikirim'
        }];
        
        // Simpan images asli
        const originalImages = this.lightboxInstance.images;
        
        // Set hanya gambar ini ke lightbox
        this.lightboxInstance.images = singleImage;
        this.lightboxInstance.open(0);
        
        // Restore images asli setelah lightbox ditutup
        const checkLightboxClosed = setInterval(() => {
            if (!this.lightboxInstance.lightbox.classList.contains('active')) {
                this.lightboxInstance.images = originalImages;
                clearInterval(checkLightboxClosed);
            }
        }, 100);
    });
}

// ✅ TAMBAHKAN FUNGSI BARU INI
attachLightboxToPreviewImage(imgElement) {
    imgElement.style.cursor = 'pointer';
    
    // Hapus event listener lama jika ada
    const newImg = imgElement.cloneNode(true);
    imgElement.parentNode.replaceChild(newImg, imgElement);
    this.elements.imagePreview = newImg; // Update reference
    
    newImg.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Buat array gambar temporary hanya untuk preview
        const tempImages = [{
            src: newImg.src,
            caption: 'Preview gambar'
        }];
        
        // Simpan images asli
        const originalImages = this.lightboxInstance.images;
        
        // Set temporary images ke lightbox
        this.lightboxInstance.images = tempImages;
        this.lightboxInstance.open(0);
        
        // Restore images asli setelah lightbox ditutup
        const checkLightboxClosed = setInterval(() => {
            if (!this.lightboxInstance.lightbox.classList.contains('active')) {
                this.lightboxInstance.images = originalImages;
                clearInterval(checkLightboxClosed);
            }
        }, 100);
    });
}

    handleImageSelect(file) {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        this.showToast('File harus berupa gambar!', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        this.showToast('Ukuran gambar maksimal 5MB!', 'error');
        return;
    }
    
    // ✅ TAMBAHKAN INI - Validasi gambar bisa dibaca
    this.selectedImageFile = file;
    
    const reader = new FileReader();
    
    // ✅ Error handler
    reader.onerror = () => {
        this.showToast('Gagal membaca gambar. File mungkin rusak.', 'error');
        this.removeImagePreview();
    };
    
    reader.onload = (e) => {
        // ✅ Validasi URL hasil
        if (!e.target.result) {
            this.showToast('Gambar tidak valid!', 'error');
            this.removeImagePreview();
            return;
        }
        
        this.selectedImageUrl = e.target.result;
        this.elements.imagePreview.src = e.target.result;
        this.elements.imagePreviewContainer.classList.add('active');
        this.updateSendButtonVisibility();
        
        this.attachLightboxToPreviewImage(this.elements.imagePreview);
    };
    
    reader.readAsDataURL(file);
    
    this.elements.imageFileInput.value = '';
}
    
    removeImagePreview() {
        this.selectedImageFile = null;
        this.selectedImageUrl = null;
        this.elements.imagePreview.src = '';
        this.elements.imagePreviewContainer.classList.remove('active');
        this.updateSendButtonVisibility();
    }
   
showFilePreview(file) {
    const fileName = file.name;
    const fileSize = this.formatFileSize(file.size);
    const fileExt = fileName.split('.').pop().toLowerCase();
    
    // Update file info
    this.elements.filePreviewName.textContent = fileName;
    this.elements.filePreviewSize.textContent = fileSize;
    
    // Update icon berdasarkan tipe file
    const iconElement = this.elements.filePreviewIcon;
    iconElement.className = 'file-preview-icon ' + fileExt;
    
    const icons = {
        'pdf': '<i class="fas fa-file-pdf"></i>',
        'doc': '<i class="fas fa-file-word"></i>',
        'docx': '<i class="fas fa-file-word"></i>',
        'txt': '<i class="fas fa-file-alt"></i>'
    };
    
    iconElement.innerHTML = icons[fileExt] || '<i class="fas fa-file"></i>';
    
    // Tampilkan preview
    this.elements.filePreviewContainer.classList.add('active');
}

removeFilePreview() {
    this.selectedDocumentFile = null;
    this.elements.filePreviewContainer.classList.remove('active');
    this.updateSendButtonVisibility();
    
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
}

formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}   
    
    openUploadModal() {
    const uploadModal = document.getElementById('uploadModal');
    const uploadModalOverlay = document.getElementById('uploadModalOverlay');
    
    uploadModalOverlay.classList.add('active');
    uploadModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

closeUploadModal() {
    const uploadModal = document.getElementById('uploadModal');
    const uploadModalOverlay = document.getElementById('uploadModalOverlay');
    
    uploadModal.classList.remove('active');
    uploadModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

openCamera() {
    const cameraInput = document.getElementById('cameraInput');
    cameraInput.click();
}

openPhotoGallery() {
    this.elements.imageFileInput.click();
}

openFileExplorer() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();
}

handleFileSelect(file) {
    if (!file) return;
    
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        this.showToast('Format file tidak didukung! Gunakan PDF, DOCX, atau TXT', 'error');
        return;
    }
    
    // ✅ TAMBAHKAN INI - Cek ukuran file lebih detail
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        this.showToast(`File terlalu besar (${sizeMB}MB)! Maksimal 10MB`, 'error');
        return;
    }
    
    // ✅ TAMBAHKAN INI - Warning kalau file besar (>5MB)
    if (file.size > 5 * 1024 * 1024) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        this.showToast(`File lumayan besar (${sizeMB}MB), processing mungkin lama...`, 'info');
    }
    
    this.selectedDocumentFile = file;
    this.showFilePreview(file);
    this.updateSendButtonVisibility();
}
    
    updateSendButtonVisibility() {
    const inputValue = this.elements.chatInput.value.trim();
    const hasImage = this.selectedImageFile !== null;
    const hasFile = this.selectedDocumentFile !== null;
    const isStopMode = this.elements.sendMessageBtn.classList.contains('stop-mode');
    
    // ✅ Stop mode always enabled
    if (isStopMode) {
        this.elements.sendMessageBtn.disabled = false;
        return;
    }
    
    // ✅ Enable/disable based on content
    if (inputValue || hasImage || hasFile) {
        this.elements.sendMessageBtn.disabled = false;
    } else {
        this.elements.sendMessageBtn.disabled = true;
    }
}
    
    autoResize() {
        this.elements.chatInput.style.height = 'auto';
        this.elements.chatInput.style.height = Math.min(this.elements.chatInput.scrollHeight, 150) + 'px';
    }
    
    toggleSearchMode() {
        this.isSearchMode = !this.isSearchMode;
        this.elements.searchToggleBtn.classList.toggle('active', this.isSearchMode);
        
        const placeholder = this.isSearchMode ? 
            'Cari di internet...' : 
            'Tanyakan apa saja';
        
        this.elements.chatInput.placeholder = placeholder;
    }
    

    transformToStopButton() {
    const icon = this.elements.sendMessageBtn.querySelector('i');
    icon.className = 'fas fa-stop';
    this.elements.sendMessageBtn.classList.add('stop-mode');
    this.elements.sendMessageBtn.title = 'Hentikan Respons';
    this.elements.sendMessageBtn.disabled = false; // ✅ Always enabled in stop mode
}
    
    transformToSendButton() {
    const icon = this.elements.sendMessageBtn.querySelector('i');
    icon.className = 'fas fa-arrow-up';
    this.elements.sendMessageBtn.classList.remove('stop-mode');
    this.elements.sendMessageBtn.title = 'Kirim Pesan';
    
    // ✅ Update disabled state based on content
    this.updateSendButtonVisibility();
}
    
    handleStopResponse() {
        console.log('🛑 Stop button clicked!');
        console.log('isTyping:', this.isTyping, 'isAnimatingTyping:', this.isAnimatingTyping);
        
        if (this.isTyping || this.isAnimatingTyping) {
            this.isStopRequested = true;
            
            if (this.currentTypingMessageId) {
                const currentMessage = document.querySelector(`[data-message-id="${this.currentTypingMessageId}"]`);
                if (currentMessage) {
                    const bubble = currentMessage.querySelector('.message-bubble');
                    const textContent = currentMessage.querySelector('.message-text-content');
                    
                    if (textContent && textContent.innerHTML) {
                        const partialText = textContent.innerHTML;
                        console.log('📄 Partial text saved:', partialText.substring(0, 50) + '...');
                        
                        textContent.innerHTML = partialText + ' <em style="color: var(--muted); font-size: 0.9em;">[dihentikan]</em>';
                    }
                    
                    if (bubble) {
                        bubble.classList.remove('typing-animation');
                        console.log('✅ Typing animation removed');
                    }
                    
                    const actions = currentMessage.querySelector('.message-actions');
                    if (actions) {
                        actions.style.opacity = '1';
                    }
                }
                
                this.currentTypingMessageId = null;
            }
            
            this.isTyping = false;
            this.isAnimatingTyping = false;
            
            this.removeTypingIndicator();
            this.transformToSendButton();
            
            this.showToast('Respons dihentikan!', 'info');
            
            this.saveChatHistory();
            
            console.log('✅ Stop completed');
        } else {
            console.log('⚠️ Nothing to stop');
        }
    }
    

    showTypingIndicator() {
        this.isTyping = true;
        this.isAnimatingTyping = false;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper bot';
        wrapper.id = 'typingIndicator';
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<span class="typing-dot-modern"></span>';
        
        bubble.appendChild(indicator);
        contentWrapper.appendChild(bubble);
        wrapper.appendChild(avatar);
        wrapper.appendChild(contentWrapper);
        
        this.elements.chatMessages.appendChild(wrapper);
        this.scrollToBottom();
    }
    
    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }
    
    async sendMessage() {
    const message = this.elements.chatInput.value.trim();
    const hasImage = this.selectedImageFile !== null;
    const hasFile = this.selectedDocumentFile !== null;  // ✅ TAMBAHKAN INI
    
    // ✅ UPDATE: Allow send if ada message, image, atau file
    if (!message && !hasImage && !hasFile) {
        return;
    }
    
    if (this.isTyping || this.isAnimatingTyping) {
        this.showToast('Tunggu respons sebelumnya selesai!', 'error');
        return;
    }
    
    this.isStopRequested = false;
    this.elements.emptyState.classList.add('hidden');
    
    // ✅ Priority: File > Image > Text
    if (hasFile) {
        await this.sendFileMessage(message);
        return;
    }
    
    if (hasImage) {
        await this.sendImageMessage(message);
        return;
    }
    
    await this.sendTextMessage(message);
}

async sendTextMessage(message) {
    this.addMessage(message, 'user');
    this.elements.chatInput.value = '';
    this.elements.chatInput.style.height = 'auto';
    
    this.showTypingIndicator();
    this.transformToStopButton();
    
    try {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('personality', this.getPersonality());
        formData.append('model', this.currentModel);
        
        let mode = 'text';
        if (this.isSearchMode) {
            mode = 'search';
            this.toggleSearchMode();
        }
        
        formData.append('mode', mode);
        
        const response = await fetch('/calavera-ai/api/chat', {
            method: 'POST',
            body: formData
        });
        
        if (this.isStopRequested) {
            this.removeTypingIndicator();
            this.transformToSendButton();
            this.saveChatHistory();
            return;
        }
        
        const data = await response.json();
        this.removeTypingIndicator();
        
        if (response.ok) {
            this.addMessage(data.response, 'bot', null, true);
        } else {
            const errorMsg = data.error || '⚠️ Terjadi kesalahan saat memproses permintaan kamu. Coba lagi ya!';
            this.addMessage(errorMsg, 'bot', null, false);
        }
    } catch (error) {
        this.removeTypingIndicator();
        
        if (!this.isStopRequested) {
            const userFriendlyError = '⚠️ Tidak bisa terhubung ke server. Pastikan koneksi internet kamu stabil, lalu coba lagi.';
            this.addMessage(userFriendlyError, 'bot', null, false);
        }
        
        this.transformToSendButton();
    }
}

async sendImageMessage(message) {
    const imageUrlForBubble = this.selectedImageUrl;
    const imageFileForUpload = this.selectedImageFile;
    
    this.addMessage(message, 'user', imageUrlForBubble);
    this.removeImagePreview();
    
    this.elements.chatInput.value = '';
    this.elements.chatInput.style.height = 'auto';
    
    this.showTypingIndicator();
    this.transformToStopButton();
    
    try {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('personality', this.getPersonality());
        formData.append('model', this.currentModel);
        formData.append('image', imageFileForUpload);
        formData.append('mode', 'image');
        
        const response = await fetch('/calavera-ai/api/chat', {
            method: 'POST',
            body: formData
        });
        
        if (this.isStopRequested) {
            this.removeTypingIndicator();
            this.transformToSendButton();
            this.saveChatHistory();
            return;
        }
        
        const data = await response.json();
        this.removeTypingIndicator();
        
        if (response.ok) {
            if (data.image_url) {
                this.lastUploadedImageUrl = data.image_url;
            }
            
            this.addMessage(data.response, 'bot', null, true);
        } else {
            const errorMsg = data.error || '⚠️ Terjadi kesalahan saat memproses permintaan kamu. Coba lagi ya!';
            this.addMessage(errorMsg, 'bot', null, false);
        }
    } catch (error) {
        this.removeTypingIndicator();
        
        if (!this.isStopRequested) {
            const userFriendlyError = '⚠️ Tidak bisa terhubung ke server. Pastikan koneksi internet kamu stabil, lalu coba lagi.';
            this.addMessage(userFriendlyError, 'bot', null, false);
        }
        
        this.transformToSendButton();
    }
}

async sendFileMessage(message) {
    const file = this.selectedDocumentFile;
    const fileSize = this.formatFileSize(file.size);
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    // ✅ PERBAIKAN: Tidak perlu fileIcon lagi
    
    // 1. Bubble untuk file card (tanpa teks)
    this.addFileBubble(file.name, fileSize, fileExt);  // ✅ Hapus parameter fileIcon
    
    // 2. Bubble untuk teks pertanyaan (jika ada)
    if (message && message.trim()) {
        this.addMessage(message, 'user', null, false);
    }
    
    this.removeFilePreview();
    
    this.elements.chatInput.value = '';
    this.elements.chatInput.style.height = 'auto';
    
    this.showTypingIndicator();
    this.transformToStopButton();
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('message', message);
        formData.append('personality', this.getPersonality());
        formData.append('model', this.currentModel);
        formData.append('mode', 'file');
        
        const response = await fetch('/calavera-ai/api/chat', {
            method: 'POST',
            body: formData
        });
        
        if (this.isStopRequested) {
            this.removeTypingIndicator();
            this.transformToSendButton();
            this.saveChatHistory();
            return;
        }
        
        const data = await response.json();
        this.removeTypingIndicator();
        
        if (response.ok) {
            this.addMessage(data.response, 'bot', null, true);
            this.showToast('File berhasil diproses!', 'success');
        } else {
            const errorMsg = data.error || '⚠️ Gagal memproses file. Coba lagi ya!';
            this.addMessage(errorMsg, 'bot', null, false);
        }
    } catch (error) {
        this.removeTypingIndicator();
        
        if (!this.isStopRequested) {
            const userFriendlyError = '⚠️ Tidak bisa terhubung ke server. Pastikan koneksi internet kamu stabil, lalu coba lagi.';
            this.addMessage(userFriendlyError, 'bot', null, false);
        }
        
        this.transformToSendButton();
    }
}

escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

    async regenerateResponse() {
        if (this.isTyping) {
            this.showToast('Tunggu respons sebelumnya selesai!', 'error');
            return;
        }
        
        this.isStopRequested = false;
        this.showTypingIndicator();
        this.transformToStopButton();
        
        try {
            const response = await fetch('/calavera-ai/api/regenerate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    personality: this.getPersonality(),
                    model: this.currentModel
                })
            });
            
            if (this.isStopRequested) {
                this.removeTypingIndicator();
                this.transformToSendButton();
                this.saveChatHistory();
                return;
            }
            
            const data = await response.json();
            this.removeTypingIndicator();
            
            if (response.ok) {
                const botMessages = this.elements.chatMessages.querySelectorAll('.message-wrapper.bot');
                const lastBotMessage = botMessages[botMessages.length - 1];
                if (lastBotMessage) {
                    lastBotMessage.remove();
                }
                
                this.addMessage(data.response, 'bot', null, true);
            } else {
                const errorMsg = data.error || '⚠️ Gagal mengulangi respons. Coba lagi ya!';
                this.addMessage(errorMsg, 'bot', null, false);
            }
        } catch (error) {
            this.removeTypingIndicator();
            
            if (!this.isStopRequested) {
                const userFriendlyError = '⚠️ Tidak bisa terhubung ke server. Pastikan koneksi internet kamu stabil, lalu coba lagi.';
                this.addMessage(userFriendlyError, 'bot', null, false);
            }
            
            this.transformToSendButton();
        }
    }
    

    addMessage(content, sender, imageUrl = null, enableTyping = false) {
    const messageId = 'msg-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    wrapper.dataset.messageId = messageId;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    // ✅ PERBAIKAN: Pisahkan bubble untuk gambar & teks
    
    // Bubble untuk gambar (jika ada)
    if (imageUrl && sender === 'user') {
        const imageBubble = document.createElement('div');
        imageBubble.className = 'message-bubble message-bubble-image';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Gambar yang dikirim';
        imageBubble.appendChild(img);
        
        contentWrapper.appendChild(imageBubble);
        
        // Attach lightbox setelah gambar ditambahkan
        setTimeout(() => {
            this.attachLightboxToImage(img, 0);
        }, 100);
    }
    
    // Bubble untuk teks (jika ada)
    if (content && content.trim()) {
        const textBubble = document.createElement('div');
        textBubble.className = 'message-bubble message-bubble-text';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text-content';
        
        if (sender === 'user') {
            const escaped = content
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            textDiv.innerHTML = escaped.replace(/\n/g, '<br>');
        } else if (enableTyping && sender === 'bot') {
            textBubble.classList.add('typing-animation');
            textDiv.innerHTML = '';
            textBubble.appendChild(textDiv);
            contentWrapper.appendChild(textBubble);
            
            const actions = this.createMessageActions(messageId, content);
            actions.style.opacity = '0';
            contentWrapper.appendChild(actions);
            
            wrapper.appendChild(avatar);
            wrapper.appendChild(contentWrapper);
            
            this.elements.chatMessages.appendChild(wrapper);
            this.scrollToBottom();
            
            this.currentTypingMessageId = messageId;
            this.typeMessage(textDiv, content, messageId, textBubble, actions);
            return;
        } else {
            textDiv.innerHTML = this.formatText(content);
        }
        
        textBubble.appendChild(textDiv);
        contentWrapper.appendChild(textBubble);
        
        if (sender === 'bot') {
            const actions = this.createMessageActions(messageId, content);
            contentWrapper.appendChild(actions);
        }
    }
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrapper);
    
    this.elements.chatMessages.appendChild(wrapper);
    this.scrollToBottom();
}
    
    addFormattedMessage(htmlContent, sender, imageUrl = null) {
    const messageId = 'msg-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    wrapper.dataset.messageId = messageId;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    // ✅ PERBAIKAN: Pisahkan bubble untuk gambar & teks
    
    // Bubble untuk gambar (jika ada)
    if (imageUrl && sender === 'user') {
        const imageBubble = document.createElement('div');
        imageBubble.className = 'message-bubble message-bubble-image';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Gambar yang dikirim';
        imageBubble.appendChild(img);
        
        contentWrapper.appendChild(imageBubble);
        
        // Attach lightbox
        setTimeout(() => {
            this.attachLightboxToImage(img, 0);
        }, 100);
    }
    
    // Bubble untuk teks (jika ada)
    if (htmlContent && htmlContent.trim()) {
        const textBubble = document.createElement('div');
        textBubble.className = 'message-bubble message-bubble-text';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text-content';
        textDiv.innerHTML = htmlContent;
        
        textBubble.appendChild(textDiv);
        contentWrapper.appendChild(textBubble);
        
        if (sender === 'bot') {
            const actions = this.createMessageActions(messageId, htmlContent);
            contentWrapper.appendChild(actions);
        }
    }
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrapper);
    
    this.elements.chatMessages.appendChild(wrapper);
}
    
    addSingleBubble(type, sender, imageUrl = null, htmlContent = null) {
    const messageId = 'msg-' + Date.now() + '-' + Math.random();
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${sender}`;
    wrapper.dataset.messageId = messageId;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'user' ? 
        '<i class="fas fa-user"></i>' : 
        '<i class="fas fa-robot"></i>';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    if (type === 'image' && imageUrl) {
        // Bubble gambar saja
        const imageBubble = document.createElement('div');
        imageBubble.className = 'message-bubble message-bubble-image';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Gambar yang dikirim';
        imageBubble.appendChild(img);
        
        contentWrapper.appendChild(imageBubble);
        
        // Attach lightbox
        setTimeout(() => {
            this.attachLightboxToImage(img, 0);
        }, 100);
        
    } else if (type === 'text' && htmlContent) {
        // Bubble teks saja
        const textBubble = document.createElement('div');
        textBubble.className = 'message-bubble message-bubble-text';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text-content';
        textDiv.innerHTML = htmlContent;
        
        textBubble.appendChild(textDiv);
        contentWrapper.appendChild(textBubble);
        
        if (sender === 'bot') {
            const actions = this.createMessageActions(messageId, htmlContent);
            contentWrapper.appendChild(actions);
        }
    }
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrapper);
    
    this.elements.chatMessages.appendChild(wrapper);
}

addFileBubble(fileName, fileSize, fileExt) {  // ← Hapus fileIcon dari parameter
    const messageId = 'msg-' + Date.now() + '-' + Math.random();
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper user';
    wrapper.dataset.messageId = messageId;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-user"></i>';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    // File bubble card
    const fileBubble = document.createElement('div');
    fileBubble.className = 'message-bubble message-bubble-file';
    
    // File card content
    fileBubble.innerHTML = `
        <div class="file-card">
            <div class="file-card-icon ${fileExt}">
                <i class="${this.getFileIconClass(fileExt)}"></i>
            </div>
            <div class="file-card-info">
                <div class="file-card-name">${fileName}</div>
                <div class="file-card-size">${fileSize}</div>
            </div>
        </div>
    `;
    
    contentWrapper.appendChild(fileBubble);
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(contentWrapper);
    
    this.elements.chatMessages.appendChild(wrapper);
    this.scrollToBottom();
}

getFileIconClass(ext) {
    const icons = {
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'txt': 'fas fa-file-alt'
    };
    
    return icons[ext] || 'fas fa-file';
}

    async typeMessage(element, fullText, messageId, bubble, actionsElement) {
        console.log('⌨️ Start typing animation');
        this.isAnimatingTyping = true;
        this.isTyping = true;
        
        const formattedHTML = this.formatText(fullText);
        const words = fullText.split(/(\s+)/);
        
        let currentIndex = 0;
        let displayedText = '';
        
        const typingSpeed = 20;
        
        const typeNextWord = () => {
            if (this.isStopRequested || this.currentTypingMessageId !== messageId) {
                console.log('⏹️ Typing stopped by user');
                
                if (displayedText.trim()) {
                    element.innerHTML = this.formatText(displayedText);
                }
                
                bubble.classList.remove('typing-animation');
                actionsElement.style.opacity = '1';
                this.scrollToBottom();
                
                this.isAnimatingTyping = false;
                this.isTyping = false;
                this.transformToSendButton();
                
                return;
            }
            
            if (currentIndex < words.length) {
                const word = words[currentIndex];
                displayedText += word;
                
                element.innerHTML = this.formatText(displayedText);
                
                currentIndex++;
                this.scrollToBottom();
                
                setTimeout(typeNextWord, typingSpeed);
            } else {
                console.log('✅ Typing completed');
                element.innerHTML = formattedHTML;
                bubble.classList.remove('typing-animation');
                actionsElement.style.opacity = '1';
                this.scrollToBottom();
                
                this.currentTypingMessageId = null;
                this.isAnimatingTyping = false;
                this.isTyping = false;
                
                this.transformToSendButton();
                this.saveChatHistory();
            }
        };
        
        typeNextWord();
    }
    
    createMessageActions(messageId, content) {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        
        const copyBtn = this.createActionButton('bx bx-copy', 'Salin', () => {
            this.copyMessage(content);
        });
        
        const regenerateBtn = this.createActionButton('fas fa-sync-alt', 'Ulangi', () => {
            this.regenerateResponse();
        });
        
        actions.appendChild(copyBtn);
        actions.appendChild(regenerateBtn);
        
        return actions;
    }
    
    createActionButton(iconClass, tooltip, onClick) {
        const button = document.createElement('button');
        button.className = 'action-btn';
        button.title = tooltip;
        button.innerHTML = `<i class="${iconClass}"></i>`;
        button.addEventListener('click', onClick);
        return button;
    }
    
    copyMessage(content) {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        const plainText = temp.textContent || temp.innerText;
        
        navigator.clipboard.writeText(plainText).then(() => {
            this.showToast('Teks disalin!', 'success');
        }).catch(() => {
            this.showToast('Gagal menyalin', 'error');
        });
    }
    

    formatText(text) {
        text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/_(.*?)_/g, '<em>$1</em>');
        text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');
        text = text.replace(/<u>(.*?)<\/u>/g, '<u>$1</u>');
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        text = text.replace(/^---$/gm, '<hr>');
        text = text.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
        
        text = text.replace(/^\d+\.\s+(.*)$/gm, function(match, p1) {
            return '<li-ordered>' + p1 + '</li-ordered>';
        });
        
        text = text.replace(/^[-*]\s+(.*)$/gm, function(match, p1) {
            return '<li-unordered>' + p1 + '</li-unordered>';
        });
        
        text = text.replace(/(<li-ordered>.*<\/li-ordered>)/s, function(match) {
            return '<ol>' + match.replace(/<li-ordered>/g, '<li>').replace(/<\/li-ordered>/g, '</li>') + '</ol>';
        });
        
        text = text.replace(/(<li-unordered>.*<\/li-unordered>)/s, function(match) {
            return '<ul>' + match.replace(/<li-unordered>/g, '<li>').replace(/<\/li-unordered>/g, '</li>') + '</ul>';
        });
        
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }
    
    setupScrollToBottom() {
    const scrollBtn = document.getElementById('scrollToBottomBtn');
    const chatMessages = this.elements.chatMessages;
    
    if (!scrollBtn || !chatMessages) {
        console.error('❌ Scroll to bottom elements not found');
        return;
    }
    
    // ✅ Show/hide button based on scroll position
    chatMessages.addEventListener('scroll', () => {
        const scrollTop = chatMessages.scrollTop;
        const scrollHeight = chatMessages.scrollHeight;
        const clientHeight = chatMessages.clientHeight;
        
        // ✅ Show button jika user scroll ke atas lebih dari 200px dari bawah
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        
        if (distanceFromBottom > 200) {
            scrollBtn.classList.add('show');
        } else {
            scrollBtn.classList.remove('show');
        }
    });
    
    // ✅ Click handler: Smooth scroll to bottom
    scrollBtn.addEventListener('click', () => {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
        
        // ✅ Hide button immediately after click
        scrollBtn.classList.remove('show');
    });
    
    console.log('✅ Scroll to bottom button initialized');
}
    
    savePersonalitySettings(value, label) {
        try {
            localStorage.setItem('calavera_personality', value);
            localStorage.setItem('calavera_personality_label', label);
            console.log('✅ Personality saved:', label);
        } catch (error) {
            console.error('❌ Failed to save personality:', error);
        }
    }
    
    loadPersonalitySettings() {
        const savedPersonality = localStorage.getItem('calavera_personality');
        const savedLabel = localStorage.getItem('calavera_personality_label');
        
        if (savedPersonality !== null && savedLabel !== null) {
            this.personality = savedPersonality;
            this.personalityLabel = savedLabel;
            
            this.updatePersonalityLabel(savedLabel);
            
            const personalityOptions = document.querySelectorAll('.personality-option');
            personalityOptions.forEach(option => {
                const value = option.getAttribute('data-value');
                
                if (value === savedPersonality) {
                    option.classList.add('selected');
                    
                    if (value === 'custom') {
                        const customPersonality = document.getElementById('customPersonality');
                        customPersonality.style.display = 'block';
                        customPersonality.value = savedPersonality;
                    }
                }
            });
            
            console.log('✅ Personality loaded:', savedLabel);
        } else {
            const defaultOption = document.querySelector('.personality-option[data-value=""]');
            if (defaultOption) {
                defaultOption.classList.add('selected');
            }
            this.updatePersonalityLabel('Default');
        }
    }
    
    updatePersonalityLabel(label) {
    const labelElement = document.getElementById('currentPersonalityLabel');
    if (labelElement) {
        labelElement.textContent = label;
    }
}
    
    closePersonalityModal() {
        const modalOverlay = document.getElementById('personalityModalOverlay');
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    updatePersonality() {
        if (this.elements.personalitySelect.value === 'custom') {
            this.personality = this.elements.customPersonality.value.trim();
        }
    }
    
    getPersonality() {
        return this.personality;
    }
    

    saveModelSettings(model, label) {
        try {
            localStorage.setItem('calavera_model', model);
            localStorage.setItem('calavera_model_label', label);
            console.log('✅ Model saved:', label);
        } catch (error) {
            console.error('❌ Failed to save model:', error);
        }
    }
    
    loadModelSettings() {
    const savedModel = localStorage.getItem('calavera_model');
    const savedLabel = localStorage.getItem('calavera_model_label');
    
    const modelOptions = document.querySelectorAll('.model-option');
    
    if (savedModel !== null && savedLabel !== null) {
        this.currentModel = savedModel;
        this.currentModelLabel = savedLabel;
        
        this.updateModelLabel(savedLabel);
        
        modelOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        modelOptions.forEach(option => {
            const model = option.getAttribute('data-model');
            
            if (model === savedModel) {
                option.classList.add('selected');
            }
        });
        
        console.log('✅ Model loaded from localStorage:', savedLabel);
    } else {
        modelOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        const defaultOption = document.querySelector('.model-option[data-model="gemini"]');
        if (defaultOption) {
            defaultOption.classList.add('selected');
        }
        
        this.currentModel = 'gemini';
        this.currentModelLabel = 'Gemini 2.5 Flash';
        this.updateModelLabel(this.currentModelLabel); // ✅ SUDAH BENAR
        
        console.log('✅ Default model set: Gemini 2.5 Flash');
        this.updateModelCapabilities();
    }
}
    
    updateModelLabel(label) {
    const labelElement = document.getElementById('currentModelLabel');
    if (labelElement) {
        labelElement.textContent = label;
    }
}
    
    closeModelModal() {
        const modalOverlay = document.getElementById('modelModalOverlay');
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

loadChatHistory() {
    try {
        const saved = localStorage.getItem('calavera_chat_history');
        if (saved) {
            const messages = JSON.parse(saved);
            if (messages.length > 0) {
                this.elements.emptyState.classList.add('hidden');
                
                messages.forEach(msg => {
                    // ✅ UPDATE: Hilangkan parameter fileIcon (parameter ke-4)
                    if (msg.isFileOnly && msg.fileInfo) {
                        const fileExt = msg.fileInfo.name.split('.').pop().toLowerCase();
                        this.addFileBubble(
                            msg.fileInfo.name, 
                            msg.fileInfo.size, 
                            fileExt  // ✅ Cukup 3 parameter saja
                        );
                    } else if (msg.isImageOnly) {
                        this.addSingleBubble('image', msg.sender, msg.imageUrl, null);
                    } else if (msg.isTextOnly) {
                        this.addSingleBubble('text', msg.sender, null, msg.content);
                    } else {
                        // Format lama (backward compatibility)
                        const imageUrl = msg.imageUrl || null;
                        
                        if (msg.isFormatted) {
                            this.addFormattedMessage(msg.content, msg.sender, imageUrl);
                        } else {
                            this.addMessage(msg.content, msg.sender, imageUrl, false);
                        }
                    }
                });
                
                this.scrollToBottom();
                
                setTimeout(() => {
                    this.updateLightboxImages();
                }, 500);
            }
        }
    } catch (error) {
        console.error('❌ Load history error:', error);
        localStorage.removeItem('calavera_chat_history');
    }
}

saveChatHistory() {
    try {
        const messages = [];
        const messageElements = this.elements.chatMessages.querySelectorAll('.message-wrapper');
        
        messageElements.forEach(el => {
            if (el.id === 'typingIndicator') return;
            
            const sender = el.classList.contains('user') ? 'user' : 'bot';
            const contentWrapper = el.querySelector('.message-content-wrapper');
            
            if (contentWrapper) {
                // ✅ TAMBAHKAN: Ambil bubble file (jika ada)
                const fileBubble = contentWrapper.querySelector('.message-bubble-file');
                const imageBubble = contentWrapper.querySelector('.message-bubble-image');
                const textBubble = contentWrapper.querySelector('.message-bubble-text');
                
                // Simpan bubble file (jika ada)
                if (fileBubble) {
                    const fileCard = fileBubble.querySelector('.file-card');
                    if (fileCard) {
                        const fileName = fileCard.querySelector('.file-card-name')?.textContent || 'file';
                        const fileSize = fileCard.querySelector('.file-card-size')?.textContent || '';
                        const fileIcon = fileCard.querySelector('.file-card-icon i')?.className || '';
                        
                        messages.push({
                            sender: sender,
                            content: '',
                            fileInfo: {
                                name: fileName,
                                size: fileSize,
                                icon: fileIcon
                            },
                            isFormatted: true,
                            isFileOnly: true,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                
                // Simpan bubble image (jika ada)
                if (imageBubble) {
                    const imageElement = imageBubble.querySelector('img');
                    if (imageElement && imageElement.src) {
                        messages.push({
                            sender: sender,
                            content: '',
                            imageUrl: imageElement.src,
                            isFormatted: true,
                            isImageOnly: true,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                
                // Simpan bubble text (jika ada)
                if (textBubble) {
                    const textElement = textBubble.querySelector('.message-text-content');
                    if (textElement) {
                        const htmlContent = textElement.innerHTML;
                        
                        if (htmlContent.trim()) {
                            messages.push({
                                sender: sender,
                                content: htmlContent.trim(),
                                imageUrl: null,
                                isFormatted: true,
                                isTextOnly: true,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            }
        });
        
        localStorage.setItem('calavera_chat_history', JSON.stringify(messages));
        console.log('✅ Chat history saved:', messages.length, 'messages');
    } catch (error) {
        console.error('❌ Gagal save history:', error);
    }
}
    
    async clearAllChat() {
        if (!confirm('Apakah kamu yakin ingin menghapus semua percakapan?')) return;
        
        try {
            const response = await fetch('/calavera-ai/api/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.elements.chatMessages.innerHTML = '';
                this.elements.emptyState.classList.remove('hidden');
                localStorage.removeItem('calavera_chat_history');
                this.showToast('Percakapan dihapus!', 'success');
            } else {
                throw new Error('Gagal menghapus dari server');
            }
        } catch (error) {
            console.error('Clear chat error:', error);
            this.elements.chatMessages.innerHTML = '';
            this.elements.emptyState.classList.remove('hidden');
            localStorage.removeItem('calavera_chat_history');
            this.showToast('Percakapan dihapus!', 'success');
        }
    }

    showToast(message, type = 'info') {
        window.toastManager.show(message, type, 4000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SimpleChatbot();
});