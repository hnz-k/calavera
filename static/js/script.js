document.body.classList.add('loading-active');

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    document.body.classList.remove('loading-active');
    
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}

function formatLocalDateTime(isoString) {
    if (!isoString) return 'Tanpa tanggal';
    
    try {
        const date = new Date(isoString);
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day} ${month} ${year}, ${hours}:${minutes}`;
    } catch (e) {
        return isoString;
    }
}

function adjustLayoutForSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  const footer = document.querySelector('.footer');
  
  if (window.innerWidth >= 768 && sidebar) {
    if (footer) {
      footer.style.marginLeft = 'var(--sidebar-width)';
      footer.style.width = 'calc(100% - var(--sidebar-width))';
    }
  } else {
    if (footer) {
      footer.style.marginLeft = '0';
      footer.style.width = '100%';
    }
  }
}

class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('themeToggle');
        this.currentTheme = localStorage.getItem('theme') || 
                   (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        this.init();
    }

    init() {
        this.setTheme(this.currentTheme);
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.updateToggleIcon();
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    updateToggleIcon() {
        const icon = this.themeToggle.querySelector('i');
        if (this.currentTheme === 'dark') {
            icon.className = 'bi bi-brightness-high-fill';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebarOverlay = document.getElementById('sidebarOverlay');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.menuIcon = this.menuToggle.querySelector('i');
        
        this.init();
    }

    init() {
        this.menuToggle.addEventListener('click', () => this.toggleSidebar());
        this.sidebarOverlay.addEventListener('click', () => this.closeSidebar());
        
        this.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 768) {
                    this.closeSidebar();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
            }
        });
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('active');
        this.sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = this.sidebar.classList.contains('active') ? 'hidden' : '';
        this.updateMenuIcon();
    }

    closeSidebar() {
        this.sidebar.classList.remove('active');
        this.sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
        this.updateMenuIcon();
    }
    
    updateMenuIcon() {
        const isActive = this.sidebar.classList.contains('active');
        this.menuIcon.style.transform = 'rotate(90deg)';
        this.menuIcon.style.opacity = '0';
        
        setTimeout(() => {
            if (isActive) {
                this.menuIcon.className = 'fas fa-times';
            } else {
                this.menuIcon.className = 'fas fa-bars';
            }
            
            this.menuIcon.style.transform = 'rotate(0deg)';
            this.menuIcon.style.opacity = '1';
        }, 150);
    }
}

class GalleryLightbox {
    constructor() {
        this.lightbox = document.createElement('div');
        this.lightbox.className = 'lightbox';
        this.lightbox.innerHTML = `
    <div class="lightbox-overlay"></div>
    
    <button class="lightbox-close" aria-label="Close lightbox">
        <i class="fas fa-times"></i>
    </button>
    
    <div class="lightbox-counter-bar">
        <div class="lightbox-counter">
            <span class="current-index">1</span>
            <span class="separator">/</span>
            <span class="total-images">1</span>
        </div>
    </div>
    
    <div class="lightbox-container">
        <button class="lightbox-nav lightbox-prev" aria-label="Previous image">
            <i class="fas fa-chevron-left"></i>
        </button>
        
        <div class="lightbox-image-wrapper">
            <img class="lightbox-content" alt="">
        </div>
        
        <button class="lightbox-nav lightbox-next" aria-label="Next image">
            <i class="fas fa-chevron-right"></i>
        </button>
    </div>
    
    <div class="lightbox-caption-wrapper">
        <div class="lightbox-caption"></div>
    </div>
    
    <div class="lightbox-controls">
        <button class="lightbox-zoom-btn" data-action="zoom-out" aria-label="Zoom out">
            <i class="fas fa-search-minus"></i>
        </button>
        <span class="zoom-level">100%</span>
        <button class="lightbox-zoom-btn" data-action="zoom-in" aria-label="Zoom in">
            <i class="fas fa-search-plus"></i>
        </button>
        <div class="lightbox-divider"></div>
        <button class="lightbox-zoom-btn lightbox-reset" data-action="reset" aria-label="Reset zoom">
            <i class="fas fa-expand"></i>
        </button>
    </div>
`;
        
        document.body.appendChild(this.lightbox);
        
        this.currentIndex = 0;
        this.images = [];
        this.scale = 1;
        this.minScale = 1;
        this.maxScale = 4;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.translateX = 0;
        this.translateY = 0;
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.initialDistance = 0;
        
        this.lastScale = 1;
        this.lastTapTime = 0;
        this.tapTimeout = null;
        this.doubleTapDelay = 200;
        
        this.init();
    }

    init() {
        const closeBtn = this.lightbox.querySelector('.lightbox-close');
        const prevBtn = this.lightbox.querySelector('.lightbox-prev');
        const nextBtn = this.lightbox.querySelector('.lightbox-next');
        const overlay = this.lightbox.querySelector('.lightbox-overlay');
        
        closeBtn.addEventListener('click', () => this.close());
        prevBtn.addEventListener('click', () => this.prev());
        nextBtn.addEventListener('click', () => this.next());
        overlay.addEventListener('click', () => this.close());
        
        const zoomControls = this.lightbox.querySelectorAll('.lightbox-zoom-btn');
        zoomControls.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                if (action === 'zoom-in') this.zoomIn();
                else if (action === 'zoom-out') this.zoomOut();
                else if (action === 'reset') this.resetZoom();
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if (!this.lightbox.classList.contains('active')) return;
            
            switch(e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.prev();
                    break;
                case 'ArrowRight':
                    this.next();
                    break;
                case '+':
                case '=':
                    this.zoomIn();
                    break;
                case '-':
                case '_':
                    this.zoomOut();
                    break;
                case '0':
                    this.resetZoom();
                    break;
            }
        });
        
        const imgWrapper = this.lightbox.querySelector('.lightbox-image-wrapper');
        imgWrapper.addEventListener('wheel', (e) => {
            if (!this.lightbox.classList.contains('active')) return;
            e.preventDefault();
            
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        }, { passive: false });
        
        const imgElement = this.lightbox.querySelector('.lightbox-content');
        
        imgElement.addEventListener('mousedown', (e) => {
    if (this.scale > 1) {
        this.isDragging = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
        imgElement.style.cursor = 'grabbing';
        e.preventDefault();
    }
});

imgElement.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (this.scale === 1) {
        this.zoomToPoint(e.clientX, e.clientY, 2);
    } else {
        this.resetZoom();
    }
});

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.translateX = e.clientX - this.startX;
                this.translateY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const imgElement = this.lightbox.querySelector('.lightbox-content');
                imgElement.style.cursor = this.scale > 1 ? 'grab' : 'default';
            }
        });
        
        imgWrapper.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
        this.handleDoubleTap(e);
          }
          this.handleTouchStart(e);
        }, { passive: false });

        imgWrapper.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: false });

        imgWrapper.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });

        this.initializeGalleryItems();
    }

    handleTouchStart(e) {
    if (e.touches.length === 2) {
        e.preventDefault();
        this.initialDistance = this.getDistance(e.touches[0], e.touches[1]);
        this.lastScale = this.scale;
    } else if (e.touches.length === 1) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        
        if (this.scale > 1) {
            this.isDragging = true;
            this.startX = e.touches[0].clientX - this.translateX;
            this.startY = e.touches[0].clientY - this.translateY;
        }
    }
}

    handleTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
            const scaleChange = currentDistance / this.initialDistance;
            this.scale = Math.min(Math.max(this.lastScale * scaleChange, this.minScale), this.maxScale);
            this.updateTransform();
        } else if (e.touches.length === 1 && this.isDragging && this.scale > 1) {
            e.preventDefault();
            this.translateX = e.touches[0].clientX - this.startX;
            this.translateY = e.touches[0].clientY - this.startY;
            this.updateTransform();
        }
    }

    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.isDragging = false;
            
            if (this.scale <= 1) {
                this.touchEndX = e.changedTouches[0].clientX;
                this.touchEndY = e.changedTouches[0].clientY;
                this.handleSwipe();
            }
        }
    }

    handleSwipe() {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        const minSwipeDistance = 50;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                this.prev();
            } else {
                this.next();
            }
        }
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    handleDoubleTap(e) {
    const currentTime = new Date().getTime();
    const tapInterval = currentTime - this.lastTapTime;
    
    if (tapInterval < this.doubleTapDelay && tapInterval > 0) {
        e.preventDefault();
        if (this.scale === 1) {
            this.zoomToPoint(e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY, 2);
        } else {
            this.resetZoom();
        }
        this.lastTapTime = 0;
    } else {
        this.lastTapTime = currentTime;
    }
}

zoomToPoint(clientX, clientY, targetScale) {
    const imgElement = this.lightbox.querySelector('.lightbox-content');
    const rect = imgElement.getBoundingClientRect();
    const offsetX = clientX - rect.left - rect.width / 2;
    const offsetY = clientY - rect.top - rect.height / 2;
    
    this.scale = targetScale;
    this.translateX = -offsetX * (this.scale - 1);
    this.translateY = -offsetY * (this.scale - 1);
    
    this.updateTransform();
}
    
    initializeGalleryItems() {
        const galleryItems = document.querySelectorAll('.gallery-item');
        this.images = Array.from(galleryItems).map(item => ({
            src: item.querySelector('img').src,
            caption: item.querySelector('img').alt || ''
        }));

        galleryItems.forEach((item, index) => {
            item.addEventListener('click', () => this.open(index));
        });
    }

    open(index) {
        this.currentIndex = index;
        this.updateImage();
        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        setTimeout(() => {
            this.lightbox.querySelector('.lightbox-container').classList.add('show');
        }, 10);
    }

    close() {
        const container = this.lightbox.querySelector('.lightbox-container');
        container.classList.remove('show');
        
        setTimeout(() => {
            this.lightbox.classList.remove('active');
            document.body.style.overflow = '';
            this.resetZoom();
        }, 300);
    }

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.resetZoom();
        this.updateImage();
        this.animateTransition('prev');
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.resetZoom();
        this.updateImage();
        this.animateTransition('next');
    }

    animateTransition(direction) {
        const imgElement = this.lightbox.querySelector('.lightbox-content');
        imgElement.style.animation = 'none';
        
        setTimeout(() => {
            imgElement.style.animation = direction === 'next' ? 'slideInRight 0.3s ease' : 'slideInLeft 0.3s ease';
        }, 10);
    }

    updateImage() {
        const image = this.images[this.currentIndex];
        const imgElement = this.lightbox.querySelector('.lightbox-content');
        const captionElement = this.lightbox.querySelector('.lightbox-caption');
        const currentIndexElement = this.lightbox.querySelector('.current-index');
        const totalImagesElement = this.lightbox.querySelector('.total-images');
        
        imgElement.src = image.src;
        imgElement.alt = image.caption;
        captionElement.textContent = image.caption;
        
        currentIndexElement.textContent = this.currentIndex + 1;
        totalImagesElement.textContent = this.images.length;
        
        const prevBtn = this.lightbox.querySelector('.lightbox-prev');
        const nextBtn = this.lightbox.querySelector('.lightbox-next');
        
        if (this.images.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        }
    }
    
    zoomIn() {
        this.scale = Math.min(this.scale + 0.25, this.maxScale);
        this.updateTransform();
    }

    zoomOut() {
        this.scale = Math.max(this.scale - 0.25, this.minScale);
        if (this.scale === 1) {
            this.translateX = 0;
            this.translateY = 0;
        }
        this.updateTransform();
    }

    resetZoom() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
    }

    updateTransform() {
        const imgElement = this.lightbox.querySelector('.lightbox-content');
        imgElement.style.transform = `scale(${this.scale}) translate(${this.translateX / this.scale}px, ${this.translateY / this.scale}px)`;
        imgElement.style.cursor = this.scale > 1 ? 'grab' : 'default';
        
        const zoomInBtn = this.lightbox.querySelector('[data-action="zoom-in"]');
        const zoomOutBtn = this.lightbox.querySelector('[data-action="zoom-out"]');
        const zoomLevel = this.lightbox.querySelector('.zoom-level');
        
        if (zoomInBtn) zoomInBtn.disabled = this.scale >= this.maxScale;
        if (zoomOutBtn) zoomOutBtn.disabled = this.scale <= this.minScale;
        if (zoomLevel) zoomLevel.textContent = Math.round(this.scale * 100) + '%';
    }
}

class FormValidator {
    static initForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                }
            });
        });
    }

    static validateForm(form) {
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showError(field, 'Field ini wajib diisi');
                isValid = false;
            } else {
                this.clearError(field);
            }
        });

        const emailFields = form.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            if (field.value && !this.isValidEmail(field.value)) {
                this.showError(field, 'Format email tidak valid');
                isValid = false;
            }
        });

        return isValid;
    }

    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static showError(field, message) {
        this.clearError(field);
        
        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.style.color = '#EF4444';
        errorElement.style.fontSize = '0.875rem';
        errorElement.style.marginTop = '0.25rem';
        errorElement.textContent = message;
        
        field.parentNode.appendChild(errorElement);
        field.style.borderColor = '#EF4444';
    }

    static clearError(field) {
        const existingError = field.parentNode.querySelector('.form-error');
        if (existingError) {
            existingError.remove();
        }
        field.style.borderColor = '';
    }
}

class FileUploadPreview {
    static init() {
        if (window.location.pathname.includes('/admin')) {
            return;
        }
        
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.showPreview(input, file);
                }
            });
        });
    }

    static showPreview(input, file) {
        const existingPreview = input.parentNode.querySelector('.upload-preview');
        if (existingPreview) {
            existingPreview.remove();
        }

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.createElement('img');
                preview.className = 'upload-preview active';
                preview.src = e.target.result;
                preview.alt = 'Preview';
                input.parentNode.appendChild(preview);
            };
            reader.readAsDataURL(file);
        }
    }
}

class AdminTabs {
    constructor() {
        this.tabs = document.querySelectorAll('.admin-tab');
        this.sections = document.querySelectorAll('.admin-section');
        this.init();
    }

    init() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });

        if (this.tabs.length > 0) {
            this.switchTab(this.tabs[0]);
        }
    }

    switchTab(selectedTab) {
        this.tabs.forEach(tab => tab.classList.remove('active'));
        selectedTab.classList.add('active');

        const targetSection = selectedTab.dataset.tab;
        this.sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetSection) {
                section.classList.add('active');
            }
        });
    }
}

class FlashMessages {
    static init() {
        const flashMessages = document.querySelectorAll('.flash-message');
        flashMessages.forEach(message => {
            setTimeout(() => {
                message.style.opacity = '0';
                setTimeout(() => message.remove(), 300);
            }, 5000);
        });
    }
}

class ScrollToTop {
    constructor() {
        this.button = null;
        this.init();
    }

    init() {
        this.createButton();
        this.attachEvents();
        this.checkScroll();
    }

    createButton() {
        let scrollBtn = document.getElementById('scrollToTop');
        
        if (!scrollBtn) {
            scrollBtn = document.createElement('button');
            scrollBtn.id = 'scrollToTop';
            scrollBtn.className = 'scroll-to-top';
            scrollBtn.setAttribute('aria-label', 'Kembali ke atas');
            scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
            document.body.appendChild(scrollBtn);
        }
        
        this.button = scrollBtn;
    }

    attachEvents() {
        window.addEventListener('scroll', () => this.checkScroll());
        
        this.button.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    checkScroll() {
        if (window.pageYOffset > 300) {
            this.button.classList.add('show');
        } else {
            this.button.classList.remove('show');
        }
    }
}

const Utils = {
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    formatDate: function(dateString) {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    },

    confirmAction: function(message) {
        return confirm(message);
    }
};

window.addEventListener('load', function() {
    setTimeout(hideLoadingScreen, 800);
    adjustLayoutForSidebar();
});

window.addEventListener('resize', adjustLayoutForSidebar);

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
            hideLoadingScreen();
        }
    }, 5000);

    adjustLayoutForSidebar();
    
    new ThemeManager();
    new SidebarManager();
    new GalleryLightbox();
    new ScrollToTop();
    
    FormValidator.initForms();
    FileUploadPreview.init();
    
    if (document.querySelector('.admin-tabs')) {
        new AdminTabs();
    }
    
    FlashMessages.init();

    document.addEventListener('submit', function(e) {
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
            submitButton.disabled = true;
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    setTimeout(function() {
        const timeElements = document.querySelectorAll('.uploaded-time');
        
        timeElements.forEach(element => {
            const timestamp = element.dataset.timestamp;
            if (timestamp) {
                element.textContent = formatLocalDateTime(timestamp);
            }
        });
    }, 100);
});