// settings.js - Gestion de la page des paramètres

document.addEventListener('DOMContentLoaded', () => {
    loadUserSettings();
    setupEventListeners();
});

// Charger les paramètres de l'utilisateur
function loadUserSettings() {
    // Charger la chaîne connectée
    const channelData = localStorage.getItem('selectedChannel');
    
    if (channelData) {
        const channel = JSON.parse(channelData);
        updateConnectionStatus(channel);
    }
    
    // Charger les autres paramètres depuis localStorage
    loadSavedSettings();
}

// Mettre à jour le statut de connexion YouTube
function updateConnectionStatus(channel) {
    const statusElement = document.getElementById('connectionStatus');
    
    if (statusElement && channel) {
        statusElement.innerHTML = `
            <span style="color: var(--success-color); font-weight: 600;">
                <i class="fas fa-check-circle"></i> 
                Connecté à "${channel.title}"
            </span>
        `;
    }
}

// Configuration des événements
function setupEventListeners() {
    // Upload de photo
    const uploadBtn = document.querySelector('.btn-upload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', handlePhotoUpload);
    }
    
    // Sélection du thème
    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.addEventListener('click', function() {
            themeOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            
            const theme = this.querySelector('span').textContent.toLowerCase();
            saveTheme(theme);
        });
    });
    
    // Toggle switches
    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const settingName = this.closest('.toggle-item').querySelector('h3').textContent;
            saveSetting(settingName, this.checked);
            showNotification(`Paramètre "${settingName}" ${this.checked ? 'activé' : 'désactivé'}`, 'success');
        });
    });
    
    // Bouton enregistrer le profil
    const saveProfileBtn = document.querySelector('.btn-primary');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfile);
    }
    
    // Boutons de sécurité
    const modifyPasswordBtn = document.querySelector('.security-item:nth-child(1) .btn-secondary-small');
    if (modifyPasswordBtn) {
        modifyPasswordBtn.addEventListener('click', () => {
            showNotification('Fonctionnalité bientôt disponible', 'info');
        });
    }
    
    const enable2FABtn = document.querySelector('.security-item:nth-child(2) .btn-secondary-small');
    if (enable2FABtn) {
        enable2FABtn.addEventListener('click', () => {
            showNotification('Fonctionnalité bientôt disponible', 'info');
        });
    }
    
    const deleteAccountBtn = document.querySelector('.btn-danger-small');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDeleteAccount);
    }
}

// Gestion de l'upload de photo
function handlePhotoUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        
        if (file) {
            // Vérifier la taille (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showNotification('L\'image ne doit pas dépasser 2MB', 'error');
                return;
            }
            
            // Prévisualiser l'image
            const reader = new FileReader();
            reader.onload = (event) => {
                const photoPlaceholder = document.getElementById('profilePhoto');
                photoPlaceholder.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                
                // Sauvegarder dans localStorage
                localStorage.setItem('profilePhoto', event.target.result);
                showNotification('Photo de profil mise à jour', 'success');
            };
            reader.readAsDataURL(file);
        }
    };
    
    input.click();
}

// Sauvegarder le profil
function saveProfile() {
    const profile = {
        fullName: document.querySelector('.form-grid .form-group:nth-child(1) input').value,
        email: document.querySelector('.form-grid .form-group:nth-child(2) input').value,
        username: document.querySelector('.form-grid .form-group:nth-child(3) input').value,
        timezone: document.querySelector('.form-grid .form-group:nth-child(4) select').value
    };
    
    // Validation simple
    if (!profile.fullName || !profile.email) {
        showNotification('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }
    
    // Sauvegarder dans localStorage
    localStorage.setItem('userProfile', JSON.stringify(profile));
    
    showNotification('Profil enregistré avec succès', 'success');
}

// Sauvegarder un paramètre
function saveSetting(name, value) {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    settings[name] = value;
    localStorage.setItem('appSettings', JSON.stringify(settings));
}

// Sauvegarder le thème
function saveTheme(theme) {
    localStorage.setItem('appTheme', theme);
    showNotification(`Thème "${theme}" sélectionné`, 'success');
}

// Charger les paramètres sauvegardés
function loadSavedSettings() {
    // Charger le profil
    const profileData = localStorage.getItem('userProfile');
    if (profileData) {
        const profile = JSON.parse(profileData);
        
        const inputs = document.querySelectorAll('.form-grid input, .form-grid select');
        if (inputs[0]) inputs[0].value = profile.fullName || '';
        if (inputs[1]) inputs[1].value = profile.email || '';
        if (inputs[2]) inputs[2].value = profile.username || '';
        if (inputs[3]) inputs[3].value = profile.timezone || '';
    }
    
    // Charger la photo de profil
    const savedPhoto = localStorage.getItem('profilePhoto');
    if (savedPhoto) {
        const photoPlaceholder = document.getElementById('profilePhoto');
        photoPlaceholder.innerHTML = `<img src="${savedPhoto}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }
    
    // Charger le thème
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            const themeName = option.querySelector('span').textContent.toLowerCase();
            if (themeName === savedTheme) {
                option.classList.add('active');
            }
        });
    }
}

// Gérer la suppression du compte
function handleDeleteAccount() {
    const confirmed = confirm(
        '⚠️ ATTENTION ⚠️\n\n' +
        'Êtes-vous sûr de vouloir supprimer votre compte ?\n\n' +
        'Cette action est IRRÉVERSIBLE et supprimera :\n' +
        '• Toutes vos données\n' +
        '• Vos statistiques\n' +
        '• Vos connexions YouTube\n' +
        '• Vos préférences\n\n' +
        'Tapez "SUPPRIMER" pour confirmer.'
    );
    
    if (confirmed) {
        const doubleConfirm = prompt('Tapez "SUPPRIMER" pour confirmer définitivement :');
        
        if (doubleConfirm === 'SUPPRIMER') {
            // Supprimer toutes les données
            localStorage.clear();
            showNotification('Compte supprimé. Redirection...', 'success');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showNotification('Suppression annulée', 'info');
        }
    }
}

// Fonction de déconnexion
function logout() {
    const confirmed = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
    
    if (confirmed) {
        localStorage.removeItem('selectedChannel');
        showNotification('Déconnexion réussie', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

// Afficher une notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#00BCD4'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}