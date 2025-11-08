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
                console.log(`Toast skipped: "${message}" dalam cooldown (${Math.round((this.cooldownDuration - timeSinceLastShown) / 1000)}s tersisa)`);
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
        
        const savedAutoClear = localStorage.getItem('calavera_auto_clear');
        
        if (savedAutoClear === null) {
            this.autoClearEnabled = true;
            localStorage.setItem('calavera_auto_clear', 'true');
            console.log('New user detected - Auto-clear enabled by default');
        } else {
            this.autoClearEnabled = savedAutoClear === 'true';
            console.log(`Existing user - Auto-clear: ${this.autoClearEnabled ? 'ON' : 'OFF'}`);
        }
        
        this.autoClearTimeout = null;
        
        if (!window.toastManager) {
            window.toastManager = new ToastManager();
        }
    }

    updateModelCapabilities() {
        const previousSupportsImages = this.supportsImages;
        
        this.supportsImages = this.currentModel !== 'deepseek';
        
        if (previousSupportsImages && !this.supportsImages) {
            const hasActiveImagePreview = this.elements.imagePreviewContainer.classList.contains('active');
            
            if (hasActiveImagePreview) {
                this.removeImagePreview();
                
                this.showToast('DeepSeek tidak mendukung analisis gambar. Preview dihapus.', 'warning');
                
                console.log('Image preview removed due to model switch to DeepSeek');
            }
        }
        
        this.updateUploadModalState();
    }

    updateUploadModalState() {
        const optionPhoto = document.getElementById('optionPhoto');
        const optionCamera = document.getElementById('optionCamera');
        
        if (!this.supportsImages) {
            optionPhoto.classList.add('disabled');
            optionCamera.classList.add('disabled');
            optionPhoto.style.pointerEvents = 'none';
            optionCamera.style.pointerEvents = 'none';
            optionPhoto.style.opacity = '0.4';
            optionCamera.style.opacity = '0.4';
        } else {
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
            filePreviewContainer: document.getElementById('filePreviewContainer'),
            filePreviewIcon: document.getElementById('filePreviewIcon'),
            filePreviewName: document.getElementById('filePreviewName'),
            filePreviewSize: document.getElementById('filePreviewSize'),
            removeFileBtn: document.getElementById('removeFileBtn'),
            settingsDropdown: document.getElementById('settingsDropdown'),
            customPersonality: document.getElementById('customPersonality'),
            currentModelLabel: document.getElementById('currentModelLabel')
        };
        
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
        
        const uploadModalOverlay = document.getElementById('uploadModalOverlay');
        const uploadModalClose = document.getElementById('uploadModalClose');
        const optionCamera = document.getElementById('optionCamera');
        const optionPhoto = document.getElementById('optionPhoto');
        const optionFile = document.getElementById('optionFile');
        
        uploadModalClose.addEventListener('click', () => {
            this.closeUploadModal();
        });
        
        uploadModalOverlay.addEventListener('click', (e) => {
            if (e.target === uploadModalOverlay) {
                this.closeUploadModal();
            }
        });
        
        optionCamera.addEventListener('click', () => {
            if (!this.supportsImages) {
                this.showToast('DeepSeek tidak mendukung analisis gambar', 'warning');
                return;
            }
            this.openCamera();
        });
        
        optionPhoto.addEventListener('click', () => {
            if (!this.supportsImages) {
                this.showToast('DeepSeek tidak mendukung analisis gambar', 'warning');
                return;
            }
            this.openPhotoGallery();
        });
        
        optionFile.addEventListener('click', () => {
            this.openFileExplorer();
        });
        
        this.elements.imageFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleImageSelect(e.target.files[0]);
                this.closeUploadModal();
                e.target.value = '';
            }
        });
        
        const cameraInput = document.getElementById('cameraInput');
        cameraInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleImageSelect(e.target.files[0]);
                this.closeUploadModal();
                e.target.value = '';
            }
        });
        
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
                this.closeUploadModal();
                e.target.value = '';
            }
        });
        
        this.elements.removeImageBtn.addEventListener('click', () => {
            this.removeImagePreview();
        });
        
        this.elements.removeFileBtn.addEventListener('click', () => {
            this.removeFilePreview();
        });
        
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
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsDropdown = document.getElementById('settingsDropdown');
        const personalityOption = document.getElementById('personalityOption');
        const modelOption = document.getElementById('modelOption');
        const modalOverlay = document.getElementById('personalityModalOverlay');
        const modalCloseBtn = document.getElementById('modalCloseBtn');
        const personalityOptions = document.querySelectorAll('.personality-option');
        const customPersonality = document.getElementById('customPersonality');
        
        if (settingsBtn && settingsDropdown) {
            const newSettingsBtn = settingsBtn.cloneNode(true);
            settingsBtn.parentNode.replaceChild(newSettingsBtn, settingsBtn);
            
            newSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const isActive = settingsDropdown.classList.contains('active');
                
                if (isActive) {
                    settingsDropdown.classList.remove('active');
                } else {
                    settingsDropdown.classList.add('active');
                }
            });
        } else {
            console.error('❌ settingsBtn or settingsDropdown not found!');
        }
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.personality-settings') && 
                !e.target.closest('#settingsBtn') &&
                settingsDropdown) {
                settingsDropdown.classList.remove('active');
            }
        });
        
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
        
        modelOption.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (settingsDropdown) {
                settingsDropdown.classList.remove('active');
            }
            
            modalOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
        
        modalCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeModelModal();
        });
        
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                this.closeModelModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
                this.closeModelModal();
            }
        });
        
        modelOptions.forEach(option => {
            option.addEventListener('click', () => {
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
                
                modelOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                
                this.currentModel = model;
                this.currentModelLabel = label;
                
                this.saveModelSettings(model, label);
                this.updateModelLabel(label);
                
                this.updateModelCapabilities();
                
                this.showToast(`Model diubah ke ${label}!`, 'success');
                
                console.log(`Model switched to: ${label} (${model})`);
                
                setTimeout(() => {
                    this.closeModelModal();
                }, 300);
            });
        });
    }

    scheduleAutoClear() {
        if (this.autoClearTimeout) {
            clearTimeout(this.autoClearTimeout);
        }
        
        if (!this.autoClearEnabled) {
            console.log('Auto-clear is disabled');
            return;
        }
        
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        const minutesUntilMidnight = Math.round(msUntilMidnight / 1000 / 60);
        
        console.log(`Auto-clear scheduled in ${minutesUntilMidnight} minutes (at 00:00)`);
        console.log(`Current time: ${now.toLocaleString()}`);
        console.log(`Next clear time: ${tomorrow.toLocaleString()}`);
        
        this.autoClearTimeout = setTimeout(() => {
            this.executeAutoClear();
        }, msUntilMidnight);
    }

    async executeAutoClear() {
        if (!this.autoClearEnabled) {
            console.log('Auto-clear disabled, skipping execution');
            return;
        }
        
        console.log('Auto-clearing chat history at midnight...');
        console.log(`Current time: ${new Date().toLocaleString()}`);
        
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
                
                console.log('Auto-clear completed successfully');
                
                this.showToast('Riwayat chat berhasil dihapus otomatis', 'success');
            } else {
                console.error('❌ Auto-clear API failed:', response.status);
            }
        } catch (error) {
            console.error('❌ Auto-clear error:', error);
        }
        
        console.log('Scheduling next auto-clear...');
        this.scheduleAutoClear();
    }

    initializeLightbox() {
        if (!this.lightboxInstance) {
            this.lightboxInstance = new GalleryLightbox();
        }
    }

    updateLightboxImages() {
        this.lightboxImages = [];
        const allImages = this.elements.chatMessages.querySelectorAll('.message-bubble img');
        
        allImages.forEach((img, index) => {
            this.lightboxImages.push({
                src: img.src,
                caption: img.alt || `Gambar ${index + 1}`
            });
        });
        
        if (this.lightboxInstance) {
            this.lightboxInstance.images = this.lightboxImages;
        }
    }

    attachLightboxToImage(imgElement, index) {
        imgElement.style.cursor = 'pointer';
        
        const newImg = imgElement.cloneNode(true);
        imgElement.parentNode.replaceChild(newImg, imgElement);
        
        newImg.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const singleImage = [{
                src: newImg.src,
                caption: newImg.alt || 'Gambar yang dikirim'
            }];
            
            const originalImages = this.lightboxInstance.images;
            
            this.lightboxInstance.images = singleImage;
            this.lightboxInstance.open(0);
            
            const checkLightboxClosed = setInterval(() => {
                if (!this.lightboxInstance.lightbox.classList.contains('active')) {
                    this.lightboxInstance.images = originalImages;
                    clearInterval(checkLightboxClosed);
                }
            }, 100);
        });
    }

    attachLightboxToPreviewImage(imgElement) {
        imgElement.style.cursor = 'pointer';
        
        const newImg = imgElement.cloneNode(true);
        imgElement.parentNode.replaceChild(newImg, imgElement);
        this.elements.imagePreview = newImg;
        
        newImg.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const tempImages = [{
                src: newImg.src,
                caption: 'Preview gambar'
            }];
            
            const originalImages = this.lightboxInstance.images;
            
            this.lightboxInstance.images = tempImages;
            this.lightboxInstance.open(0);
            
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
      
      this.selectedImageFile = file;
      
      const reader = new FileReader();
      
      reader.onerror = () => {
        this.showToast('Gagal membaca gambar. File mungkin rusak.', 'error');
        this.removeImagePreview();
      };
      
      reader.onload = (e) => {
        if (!e.target.result) {
          this.showToast('Gambar tidak valid!', 'error');
          this.removeImagePreview();
          return;
        }
        
        this.selectedImageUrl = e.target.result;
        this.elements.imagePreview.src = e.target.result;
        this.elements.imagePreviewContainer.classList.add('active');
        this.updateSendButtonVisibility();
        this.updateSearchButtonState();
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
        this.updateSearchButtonState();
    }

    showFilePreview(file) {
        const fileName = file.name;
        const fileSize = this.formatFileSize(file.size);
        const fileExt = fileName.split('.').pop().toLowerCase();
        
        this.elements.filePreviewName.textContent = fileName;
        this.elements.filePreviewSize.textContent = fileSize;
        
        const iconElement = this.elements.filePreviewIcon;
        iconElement.className = 'file-preview-icon ' + fileExt;
        
        const icons = {
            'pdf': '<i class="fas fa-file-pdf"></i>',
            'doc': '<i class="fas fa-file-word"></i>',
            'docx': '<i class="fas fa-file-word"></i>',
            'txt': '<i class="fas fa-file-alt"></i>'
        };
        
        iconElement.innerHTML = icons[fileExt] || '<i class="fas fa-file"></i>';
        
        this.elements.filePreviewContainer.classList.add('active');
    }

    removeFilePreview() {
        this.selectedDocumentFile = null;
        this.elements.filePreviewContainer.classList.remove('active');
        this.updateSendButtonVisibility();
        this.updateSearchButtonState();
        
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
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      this.showToast(`File terlalu besar (${sizeMB}MB)! Maksimal 10MB`, 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      this.showToast(`File lumayan besar (${sizeMB}MB), processing mungkin lama...`, 'info');
    }
    
    this.selectedDocumentFile = file;
    this.showFilePreview(file);
    this.updateSendButtonVisibility();
    this.updateSearchButtonState();
    }
    
    updateSendButtonVisibility() {
        const inputValue = this.elements.chatInput.value.trim();
        const hasImage = this.selectedImageFile !== null;
        const hasFile = this.selectedDocumentFile !== null;
        const isStopMode = this.elements.sendMessageBtn.classList.contains('stop-mode');
        
        if (isStopMode) {
            this.elements.sendMessageBtn.disabled = false;
            return;
        }
        
        if (inputValue || hasImage || hasFile) {
            this.elements.sendMessageBtn.disabled = false;
        } else {
            this.elements.sendMessageBtn.disabled = true;
        }
    }
    
    updateSearchButtonState() {
      const hasImage = this.selectedImageFile !== null;
      const hasFile = this.selectedDocumentFile !== null;
      
      if (hasImage || hasFile) {
        this.elements.searchToggleBtn.disabled = true;
        this.elements.searchToggleBtn.style.opacity = '0.4';
        this.elements.searchToggleBtn.style.cursor = 'not-allowed';
        this.elements.searchToggleBtn.style.pointerEvents = 'none';
        
        if (this.isSearchMode) {
          this.toggleSearchMode();
        }
      } else {
        this.elements.searchToggleBtn.disabled = false;
        this.elements.searchToggleBtn.style.opacity = '1';
        this.elements.searchToggleBtn.style.cursor = 'pointer';
        this.elements.searchToggleBtn.style.pointerEvents = 'all';
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
        this.elements.sendMessageBtn.disabled = false;
    }
    
    transformToSendButton() {
        const icon = this.elements.sendMessageBtn.querySelector('i');
        icon.className = 'fas fa-arrow-up';
        this.elements.sendMessageBtn.classList.remove('stop-mode');
        this.elements.sendMessageBtn.title = 'Kirim Pesan';
        
        this.updateSendButtonVisibility();
    }
    
    handleStopResponse() {
        console.log('Stop button clicked!');
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
            
            console.log('Stop completed');
        } else {
            console.log('Nothing to stop');
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
        const hasFile = this.selectedDocumentFile !== null;
        
        if (!message && !hasImage && !hasFile) {
            return;
        }
        
        if (this.isTyping || this.isAnimatingTyping) {
            this.showToast('Tunggu respons sebelumnya selesai!', 'error');
            return;
        }
        
        this.isStopRequested = false;
        this.elements.emptyState.classList.add('hidden');
        
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
        this.updateSearchButtonState();
        
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
        
        this.addFileBubble(file.name, fileSize, fileExt);
        
        if (message && message.trim()) {
            this.addMessage(message, 'user', null, false);
        }
        
        this.removeFilePreview();
        this.updateSearchButtonState();
        
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
        
        if (imageUrl && sender === 'user') {
            const imageBubble = document.createElement('div');
            imageBubble.className = 'message-bubble message-bubble-image';
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Gambar yang dikirim';
            imageBubble.appendChild(img);
            
            contentWrapper.appendChild(imageBubble);
            
            setTimeout(() => {
                this.attachLightboxToImage(img, 0);
            }, 100);
        }
        
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
                
                setTimeout(() => {
                    this.typeMessage(textDiv, content, messageId, textBubble, actions);
                }, 300);
                
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
        
        if (imageUrl && sender === 'user') {
            const imageBubble = document.createElement('div');
            imageBubble.className = 'message-bubble message-bubble-image';
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Gambar yang dikirim';
            imageBubble.appendChild(img);
            
            contentWrapper.appendChild(imageBubble);
            
            setTimeout(() => {
                this.attachLightboxToImage(img, 0);
            }, 100);
        }
        
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
            const imageBubble = document.createElement('div');
            imageBubble.className = 'message-bubble message-bubble-image';
            
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Gambar yang dikirim';
            imageBubble.appendChild(img);
            
            contentWrapper.appendChild(imageBubble);
            
            setTimeout(() => {
                this.attachLightboxToImage(img, 0);
            }, 100);
            
        } else if (type === 'text' && htmlContent) {
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

    addFileBubble(fileName, fileSize, fileExt) {
        const messageId = 'msg-' + Date.now() + '-' + Math.random();
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper user';
        wrapper.dataset.messageId = messageId;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = '<i class="fas fa-user"></i>';
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content-wrapper';
        
        const fileBubble = document.createElement('div');
        fileBubble.className = 'message-bubble message-bubble-file';
        
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
        this.isAnimatingTyping = true;
        this.isTyping = true;
        
        const formattedHTML = this.formatText(fullText);
        const words = fullText.split(/(\s+)/);
        
        let currentIndex = 0;
        let displayedText = '';
        
        const typingSpeed = 20;
        
        const typeNextWord = () => {
            if (this.isStopRequested || this.currentTypingMessageId !== messageId) {
                console.log('️Typing stopped by user');
                
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
        
        chatMessages.addEventListener('scroll', () => {
            const scrollTop = chatMessages.scrollTop;
            const scrollHeight = chatMessages.scrollHeight;
            const clientHeight = chatMessages.clientHeight;
            
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            
            if (distanceFromBottom > 200) {
                scrollBtn.classList.add('show');
            } else {
                scrollBtn.classList.remove('show');
            }
        });
        
        scrollBtn.addEventListener('click', () => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
            
            scrollBtn.classList.remove('show');
        });
    }
    
    savePersonalitySettings(value, label) {
        try {
            localStorage.setItem('calavera_personality', value);
            localStorage.setItem('calavera_personality_label', label);
            console.log('Personality saved:', label);
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
            
            console.log('Personality loaded:', savedLabel);
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
            console.log('Model saved:', label);
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
            
            console.log('Model loaded from localStorage:', savedLabel);
        } else {
            modelOptions.forEach(option => {
                option.classList.remove('selected');
            });
            
            const defaultOption = document.querySelector('.model-option[data-model="gemini"]');
            if (defaultOption) {
                defaultOption.classList.add('selected');
                console.log('Default model (Gemini) selected');
            }
            
            this.updateModelLabel('Gemini 2.5 Flash');
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
                        if (msg.isFileOnly && msg.fileInfo) {
                            const fileExt = msg.fileInfo.name.split('.').pop().toLowerCase();
                            this.addFileBubble(
                                msg.fileInfo.name, 
                                msg.fileInfo.size, 
                                fileExt
                            );
                        } else if (msg.isImageOnly) {
                            this.addSingleBubble('image', msg.sender, msg.imageUrl, null);
                        } else if (msg.isTextOnly) {
                            this.addSingleBubble('text', msg.sender, null, msg.content);
                        } else {
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
                    const fileBubble = contentWrapper.querySelector('.message-bubble-file');
                    const imageBubble = contentWrapper.querySelector('.message-bubble-image');
                    const textBubble = contentWrapper.querySelector('.message-bubble-text');
                    
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
            console.log('Chat history saved:', messages.length, 'messages');
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