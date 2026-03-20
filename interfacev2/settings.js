// settings.js - Page Paramètres

let currentAuth = null;
let currentChannel = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentAuth = await getAuthData();

    if (!currentAuth) {
        window.location.href = 'login.html';
        return;
    }

    currentChannel = currentAuth.channel || null;

    fillAccountSummary(currentAuth);
    fillProfileInfo(currentAuth);
    updateConnectionStatus(currentChannel);

    loadSavedSettings();
    setupEventListeners();
});

// ==============================
// AUTH / SESSION
// ==============================
async function getAuthData() {
    try {
        if (typeof requireAuth === 'function') {
            const auth = await requireAuth('login.html');
            if (auth) {
                return normalizeAuthData(auth);
            }
        }
    } catch (error) {
        console.warn('requireAuth indisponible ou a échoué :', error);
    }

    const selectedChannelRaw = localStorage.getItem('selectedChannel');
    const savedProfileRaw = localStorage.getItem('userProfile');

    let channel = null;
    let profile = null;

    try {
        channel = selectedChannelRaw ? JSON.parse(selectedChannelRaw) : null;
    } catch (e) {
        channel = null;
    }

    try {
        profile = savedProfileRaw ? JSON.parse(savedProfileRaw) : null;
    } catch (e) {
        profile = null;
    }

    if (!channel && !profile) {
        return null;
    }

    return normalizeAuthData({
        user: profile
            ? {
                email: profile.email || '',
                user_metadata: {
                    full_name: profile.fullName || '',
                    username: profile.username || ''
                }
            }
            : null,
        channel
    });
}

function normalizeAuthData(auth) {
    return {
        user: auth?.user || null,
        channel: auth?.channel || null
    };
}

// ==============================
// REMPLISSAGE UI
// ==============================
function fillAccountSummary(auth) {
    const user = auth?.user || null;
    const channel = auth?.channel || null;

    const displayName = resolveDisplayName(user, channel);
    const email = resolveEmail(user);
    const username = resolveUsername(user, channel);
    const channelTitle = resolveChannelTitle(channel);

    const nameEl = document.getElementById('accountDisplayName');
    const emailEl = document.getElementById('accountDisplayEmail');
    const usernameEl = document.getElementById('accountDisplayUsername');
    const channelEl = document.getElementById('accountDisplayChannel');
    const avatarEl = document.getElementById('accountAvatar');

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = email || 'Aucune adresse email disponible';
    if (usernameEl) usernameEl.textContent = username || '@utilisateur';
    if (channelEl) channelEl.textContent = channelTitle ? `Chaîne : ${channelTitle}` : 'Chaîne : Non connectée';

    renderChannelThumbnail(avatarEl, channel, displayName);
}

function fillProfileInfo(auth) {
    const user = auth?.user || null;
    const channel = auth?.channel || null;

    const fullNameInput = document.getElementById('fullNameInput');
    const emailInput = document.getElementById('emailInput');
    const usernameInput = document.getElementById('usernameInput');
    const channelIdInput = document.getElementById('channelIdInput');
    const profilePhoto = document.getElementById('profilePhoto');

    const displayName = resolveDisplayName(user, channel);
    const email = resolveEmail(user);
    const username = resolveUsername(user, channel);
    const channelId = resolveChannelId(channel);

    if (fullNameInput) fullNameInput.value = displayName;
    if (emailInput) emailInput.value = email || '';
    if (usernameInput) usernameInput.value = username || '@utilisateur';
    if (channelIdInput) channelIdInput.value = channelId || 'Non disponible';

    renderChannelThumbnail(profilePhoto, channel, displayName);
}

function updateConnectionStatus(channel) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    if (channel) {
        const title = resolveChannelTitle(channel);
        const channelId = resolveChannelId(channel);

        statusElement.innerHTML = `
            <span class="connected-channel-line">
                <i class="fas fa-check-circle"></i>
                Connecté à "${escapeHtml(title || 'Chaîne')}"${channelId ? ` (${escapeHtml(channelId)})` : ''}
            </span>
        `;
    } else {
        statusElement.innerHTML = `
            <span class="disconnected-channel-line">
                <i class="fas fa-circle-minus"></i>
                Aucune chaîne connectée
            </span>
        `;
    }
}

// ==============================
// AVATAR / THUMBNAIL
// ==============================
function renderChannelThumbnail(element, channel, displayName) {
    if (!element) return;

    const thumbnailUrl = resolveChannelThumbnail(channel);
    const initials = getInitials(displayName);

    if (thumbnailUrl) {
        element.innerHTML = '';
        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = displayName || 'Profil';
        img.className = 'avatar-image';

        img.onerror = () => {
            element.innerHTML = `<span>${escapeHtml(initials)}</span>`;
        };

        element.appendChild(img);
        return;
    }

    element.innerHTML = `<span>${escapeHtml(initials)}</span>`;
}

function resolveChannelThumbnail(channel) {
    if (!channel) return '';

    const direct =
        channel.thumbnail_url ||
        channel.thumbnail ||
        channel.avatar_url ||
        channel.profile_image_url ||
        '';

    if (direct) return direct;

    // Compat: la plupart des pages stockent l’avatar dans `thumbnails`
    // (objet YouTube, JSON string, tableau, ou URL directe).
    const thumbs = channel.thumbnails;
    if (!thumbs) return '';

    // Si string: peut être une URL directe OU un JSON string (comme dans generation-ia.js)
    if (typeof thumbs === 'string') {
        const trimmed = thumbs.trim();
        if (!trimmed) return '';

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                return resolveThumbnailFromAny(parsed);
            } catch {
                return trimmed;
            }
        }

        return trimmed;
    }

    return resolveThumbnailFromAny(thumbs);
}

function resolveThumbnailFromAny(thumbs) {
    if (!thumbs) return '';

    if (Array.isArray(thumbs)) {
        const firstValid = thumbs.find(item => {
            if (typeof item === 'string' && item.trim()) return true;
            if (item && typeof item.url === 'string' && item.url.trim()) return true;
            return false;
        });

        if (!firstValid) return '';
        return typeof firstValid === 'string' ? firstValid.trim() : (firstValid.url || '').trim();
    }

    if (typeof thumbs === 'object') {
        // Format simple: { url: "..." }
        if (typeof thumbs.url === 'string' && thumbs.url.trim()) return thumbs.url.trim();

        // Format YouTube standard: { high: { url }, medium: { url }, default: { url } }
        const url =
            thumbs?.high?.url ||
            thumbs?.medium?.url ||
            thumbs?.default?.url ||
            '';
        if (typeof url === 'string' && url.trim()) return url.trim();

        // Dernier recours: parcourir les valeurs
        for (const value of Object.values(thumbs)) {
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (value && typeof value.url === 'string' && value.url.trim()) return value.url.trim();
        }
    }

    return '';
}

// ==============================
// HELPERS
// ==============================
function resolveDisplayName(user, channel) {
    const metadata = user?.user_metadata || {};

    return (
        metadata.full_name ||
        metadata.name ||
        metadata.display_name ||
        channel?.title ||
        extractNameFromEmail(user?.email) ||
        'Utilisateur'
    );
}

function resolveEmail(user) {
    return user?.email || '';
}

function resolveUsername(user, channel) {
    const metadata = user?.user_metadata || {};

    let rawUsername =
        metadata.username ||
        metadata.user_name ||
        metadata.preferred_username ||
        '';

    if (!rawUsername && user?.email) {
        rawUsername = user.email.split('@')[0];
    }

    if (!rawUsername && channel?.title) {
        rawUsername = slugify(channel.title);
    }

    if (!rawUsername) {
        rawUsername = 'utilisateur';
    }

    rawUsername = rawUsername.replace(/^@+/, '');
    return `@${rawUsername}`;
}

function resolveChannelTitle(channel) {
    return channel?.title || channel?.name || '';
}

function resolveChannelId(channel) {
    return channel?.channel_id || channel?.id || '';
}

function extractNameFromEmail(email) {
    if (!email || !email.includes('@')) return '';

    const base = email.split('@')[0];
    return base
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function slugify(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim() || 'utilisateur';
}

function getInitials(name) {
    if (!name) return 'U';

    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==============================
// EVENTS
// ==============================
function setupEventListeners() {
    const uploadBtn = document.getElementById('profilePhotoBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            showNotification('La photo affichée vient de la chaîne connectée et n’est pas modifiable ici.', 'info');
        });
    }

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', handleProfileSaveAttempt);
    }

    const channelIdInput = document.getElementById('channelIdInput');
    if (channelIdInput) {
        channelIdInput.addEventListener('keydown', (e) => e.preventDefault());
        channelIdInput.addEventListener('paste', (e) => e.preventDefault());
        channelIdInput.addEventListener('drop', (e) => e.preventDefault());
        channelIdInput.addEventListener('beforeinput', (e) => e.preventDefault());
    }

    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
        option.addEventListener('click', function () {
            const theme = this.querySelector('span')?.textContent?.toLowerCase() || '';

            if (typeof setTheme === 'function') {
                setTheme(theme);
            } else {
                saveTheme(theme);
            }
        });
    });

    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function () {
            const settingName = this.closest('.toggle-item')?.querySelector('h3')?.textContent || 'Paramètre';
            saveSetting(settingName, this.checked);
            showNotification(`Paramètre "${settingName}" ${this.checked ? 'activé' : 'désactivé'}`, 'success');
        });
    });

    const aiToneSelect = document.getElementById('aiToneSelect');
    if (aiToneSelect) {
        aiToneSelect.addEventListener('change', () => {
            saveSetting('Ton des réponses', aiToneSelect.value);
            showNotification('Ton des réponses mis à jour', 'success');
        });
    }

    const aiLanguageSelect = document.getElementById('aiLanguageSelect');
    if (aiLanguageSelect) {
        aiLanguageSelect.addEventListener('change', () => {
            saveSetting('Langue principale', aiLanguageSelect.value);
            showNotification('Langue principale mise à jour', 'success');
        });
    }

    const modifyPasswordBtn = document.getElementById('modifyPasswordBtn');
    if (modifyPasswordBtn) {
        modifyPasswordBtn.addEventListener('click', () => {
            showNotification('Modification du mot de passe à faire depuis Supabase Auth pour l’instant.', 'info');
        });
    }

    const enable2FABtn = document.getElementById('enable2FABtn');
    if (enable2FABtn) {
        enable2FABtn.addEventListener('click', () => {
            showNotification('Fonctionnalité bientôt disponible', 'info');
        });
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', handleDeleteAccount);
    }
}

function handleProfileSaveAttempt() {
    if (currentAuth) {
        fillAccountSummary(currentAuth);
        fillProfileInfo(currentAuth);
    }

    showNotification('Le profil est en lecture seule : aucune modification n’a été enregistrée.', 'info');
}

// ==============================
// SETTINGS LOCAUX
// ==============================
function saveSetting(name, value) {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    settings[name] = value;
    localStorage.setItem('appSettings', JSON.stringify(settings));
}

function saveTheme(theme) {
    localStorage.setItem('appTheme', theme);
    showNotification(`Thème "${theme}" sélectionné`, 'success');
}

function loadSavedSettings() {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');

    const toggleMap = {
        'Notifications par email': 0,
        'Notifications push': 1,
        'Rapport hebdomadaire': 2,
        'Suggestions de contenu': 3,
        'Suggestions automatiques': 4
    };

    const toggleInputs = document.querySelectorAll('.toggle-switch input');

    Object.entries(toggleMap).forEach(([name, index]) => {
        if (toggleInputs[index] && typeof settings[name] === 'boolean') {
            toggleInputs[index].checked = settings[name];
        }
    });

    const aiToneSelect = document.getElementById('aiToneSelect');
    const aiLanguageSelect = document.getElementById('aiLanguageSelect');

    if (aiToneSelect && settings['Ton des réponses']) {
        aiToneSelect.value = settings['Ton des réponses'];
    }

    if (aiLanguageSelect && settings['Langue principale']) {
        aiLanguageSelect.value = settings['Langue principale'];
    }

    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
        if (typeof updateThemeButtons === 'function') {
            updateThemeButtons(savedTheme);
        } else {
            const themeOptions = document.querySelectorAll('.theme-option');
            themeOptions.forEach(option => {
                const themeName = option.querySelector('span')?.textContent?.toLowerCase();
                option.classList.toggle('active', themeName === savedTheme);
            });
        }
    }
}

// ==============================
// ACTIONS SENSIBLES
// ==============================
function handleDeleteAccount() {
    showNotification('Suppression complète du compte non branchée côté Supabase pour l’instant.', 'info');
}

async function logout() {
    const confirmed = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
    if (!confirmed) return;

    try {
        if (typeof logoutUser === 'function') {
            const ok = await logoutUser();

            if (ok) {
                showNotification('Déconnexion réussie', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 700);
                return;
            }
        }

        localStorage.removeItem('selectedChannel');

        showNotification('Déconnexion réussie', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 700);
    } catch (error) {
        console.error('Erreur logout:', error);
        showNotification('Erreur lors de la déconnexion', 'error');
    }
}

// ==============================
// NOTIFICATIONS
// ==============================
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
        max-width: 420px;
        line-height: 1.4;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}