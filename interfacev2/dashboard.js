const AI_API_URL = 'http://127.0.0.1:5001/api/chat';

let currentChannel = null;

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await requireAuth('login.html');
    if (!auth) return;

    currentChannel = auth.channel;

    if (!currentChannel) {
        showErrorMessage('Aucune chaîne liée à ce compte.');
        return;
    }

    displayChannelInfo();
    displayWelcomeMessage();

    await loadDashboardData();
    setupEventListeners();
});

function displayWelcomeMessage() {
    const messageContainer = document.querySelector('.assistant-message');
    if (!messageContainer) return;

    messageContainer.innerHTML = `
        <div class="ai-response">
            <p><strong>Assistant :</strong> Bonjour ! Je suis votre assistant IA pour la création de contenu YouTube. Comment puis-je vous aider aujourd'hui ?</p>
        </div>
    `;

    scrollChatToBottom();
}

function displayChannelInfo() {
    const dashboardHeader = document.querySelector('.dashboard-header');
    if (!dashboardHeader || !currentChannel) return;

    const existing = document.querySelector('.channel-banner');
    if (existing) existing.remove();

    const channelBanner = document.createElement('div');
    channelBanner.className = 'channel-banner';
    channelBanner.style.cssText = `
        background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
        gap: 16px;
        flex-wrap: wrap;
    `;

    const thumbnailUrl = getChannelThumbnailUrl(currentChannel);

    channelBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            ${
                thumbnailUrl
                    ? `
                        <img
                            src="${escapeHtml(thumbnailUrl)}"
                            alt="${escapeHtml(currentChannel.title || 'Chaîne YouTube')}"
                            style="
                                width: 44px;
                                height: 44px;
                                border-radius: 50%;
                                object-fit: cover;
                                flex-shrink: 0;
                                border: 2px solid rgba(255,255,255,0.35);
                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                                background: rgba(255,255,255,0.15);
                            "
                        >
                    `
                    : `
                        <div style="
                            width: 44px;
                            height: 44px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                            border: 2px solid rgba(255,255,255,0.35);
                            background: rgba(255,255,255,0.15);
                            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        ">
                            <i class="fas fa-user-circle" style="font-size: 22px; color: white;"></i>
                        </div>
                    `
            }

            <div style="min-width: 0;">
                <h3 style="
                    font-size: 18px;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                ">
                    <i class="fas fa-youtube" style="color: #ff0000; flex-shrink: 0;"></i>
                    <span style="
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: inline-block;
                        max-width: 100%;
                    ">
                        ${escapeHtml(currentChannel.title || 'Chaîne YouTube')}
                    </span>
                </h3>
                <p style="font-size: 14px; opacity: 0.9;">
                    Channel ID : ${escapeHtml(currentChannel.channel_id || 'Non défini')}
                </p>
            </div>
        </div>
        <button onclick="logout()" style="
            background: rgba(255,255,255,0.2);
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 14px;
        ">
            <i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>
            Se déconnecter
        </button>
    `;

    dashboardHeader.insertBefore(channelBanner, dashboardHeader.firstChild);
}

function getChannelThumbnailUrl(channel) {
    if (!channel) return '';

    const thumbs = channel.thumbnails;

    if (!thumbs) return '';

    if (typeof thumbs === 'string') {
        try {
            const parsed = JSON.parse(thumbs);
            if (parsed?.high?.url) return parsed.high.url;
            if (parsed?.medium?.url) return parsed.medium.url;
            if (parsed?.default?.url) return parsed.default.url;
            if (parsed?.url) return parsed.url;
        } catch {
            if (thumbs.trim()) return thumbs;
        }
    }

    if (Array.isArray(thumbs)) {
        const firstValid = thumbs.find(item => {
            if (typeof item === 'string' && item.trim()) return true;
            if (item && typeof item.url === 'string' && item.url.trim()) return true;
            return false;
        });

        if (!firstValid) return '';
        return typeof firstValid === 'string' ? firstValid : firstValid.url || '';
    }

    if (typeof thumbs === 'object') {
        if (typeof thumbs.url === 'string' && thumbs.url.trim()) return thumbs.url;
        if (thumbs.high && typeof thumbs.high.url === 'string' && thumbs.high.url.trim()) return thumbs.high.url;
        if (thumbs.medium && typeof thumbs.medium.url === 'string' && thumbs.medium.url.trim()) return thumbs.medium.url;
        if (thumbs.default && typeof thumbs.default.url === 'string' && thumbs.default.url.trim()) return thumbs.default.url;

        for (const value of Object.values(thumbs)) {
            if (typeof value === 'string' && value.trim()) return value;
            if (value && typeof value.url === 'string' && value.url.trim()) return value.url;
        }
    }

    return '';
}

async function logout() {
    await logoutUser();
    window.location.href = 'login.html';
}

async function loadDashboardData() {
    showLoadingState();

    try {
        const stats = await calculateDashboardStats(currentChannel.channel_id);

        if (stats) {
            updateStatsCards(stats);
        } else {
            showDefaultStats();
        }

        await loadRecentVideos(currentChannel.channel_id);
    } catch (error) {
        console.error('Erreur dashboard:', error);
        showErrorMessage('Erreur lors du chargement des données');
        showDefaultStats();
    }
}

function updateStatsCards(stats) {
    const statCards = {
        subscribers: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        videos: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        views: document.querySelector('.stat-card:nth-child(3) .stat-value'),
        likes: document.querySelector('.stat-card:nth-child(4) .stat-value')
    };

    if (statCards.subscribers) statCards.subscribers.textContent = stats.subscriberCount;
    if (statCards.videos) statCards.videos.textContent = stats.videoCount;
    if (statCards.views) statCards.views.textContent = stats.viewCount;
    if (statCards.likes) statCards.likes.textContent = stats.totalLikes;

    animateStatValues();
}

function showDefaultStats() {
    updateStatsCards({
        subscriberCount: '0',
        videoCount: '0',
        viewCount: '0',
        totalLikes: '0'
    });
}

async function loadRecentVideos(channelId) {
    try {
        const videos = await getRecentVideos(channelId);

        if (!videos || videos.length === 0) {
            showNoVideosMessage();
            return;
        }

        displayRecentVideos(videos);
    } catch (error) {
        console.error('Erreur vidéos récentes:', error);
        showNoVideosMessage();
    }
}

async function getRecentVideos(channelId) {
    const { data, error } = await supabase
        .from('videos')
        .select(`
            video_id,
            title,
            view_count,
            like_count,
            comment_count,
            published_at
        `)
        .eq('channel_id', channelId)
        .order('published_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('Erreur Supabase recent videos:', error);
        return [];
    }

    return data || [];
}

function displayRecentVideos(videos) {
    const container = document.querySelector('.suggestions-box');
    if (!container) return;

    const header = container.querySelector('.box-header');
    container.innerHTML = '';
    if (header) container.appendChild(header);

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'suggestion-card';

        card.innerHTML = `
            <div class="suggestion-content">
                <h3>${escapeHtml(video.title || 'Sans titre')}</h3>
                <div class="suggestion-tags">
                    <span class="tag"><i class="fas fa-eye"></i> ${formatNumber(video.view_count)} vues</span>
                    <span class="tag"><i class="fas fa-thumbs-up"></i> ${formatNumber(video.like_count)}</span>
                    <span class="tag"><i class="fas fa-comment"></i> ${formatNumber(video.comment_count)}</span>
                </div>
            </div>
            <button class="btn-create" data-video-id="${escapeHtml(video.video_id)}">
                Analyser
            </button>
        `;

        container.appendChild(card);
    });
}

function formatNumber(number) {
    if (!number) return '0';
    return new Intl.NumberFormat('fr-FR').format(number);
}

function showNoVideosMessage() {
    const suggestionsContainer = document.querySelector('.suggestions-box');
    if (!suggestionsContainer) return;

    const header = suggestionsContainer.querySelector('.box-header');
    suggestionsContainer.innerHTML = '';
    if (header) suggestionsContainer.appendChild(header);

    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'text-align:center; padding:40px 20px; color:var(--text-light);';
    emptyDiv.innerHTML = `
        <i class="fas fa-video" style="font-size:48px; opacity:0.3; margin-bottom:15px;"></i>
        <p>Aucune vidéo trouvée pour cette chaîne</p>
    `;
    suggestionsContainer.appendChild(emptyDiv);
}

function setupEventListeners() {
    const sendButton = document.querySelector('.btn-send');
    const assistantInput = document.querySelector('.assistant-input input');

    if (sendButton && assistantInput) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            sendAIMessage(assistantInput.value);
        });

        assistantInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendAIMessage(assistantInput.value);
            }
        });
    }

    document.addEventListener('click', async (e) => {
        const button = e.target.closest('.btn-create');
        if (!button) return;

        const videoId = button.dataset.videoId;
        if (videoId) {
            window.location.href = `video-audit.html?video_id=${encodeURIComponent(videoId)}`;
        }
    });
}

async function sendAIMessage(message) {
    const input = document.querySelector('.assistant-input input');
    const messageContainer = document.querySelector('.assistant-message');

    if (!messageContainer || !message || !message.trim()) return;

    const cleanMessage = message.trim();

    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'user-message';
    userMessageDiv.innerHTML = `
        <p><strong>Vous :</strong> ${escapeHtml(cleanMessage)}</p>
    `;
    messageContainer.appendChild(userMessageDiv);
    scrollChatToBottom();

    if (input) {
        input.value = '';
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ai-response';
    loadingDiv.innerHTML = `
        <p><strong>Assistant :</strong> ⏳ Analyse en cours...</p>
    `;
    messageContainer.appendChild(loadingDiv);
    scrollChatToBottom();

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            throw new Error(`Erreur session Supabase : ${sessionError.message}`);
        }

        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
            throw new Error('Aucun token de session trouvé. Veuillez vous reconnecter.');
        }

        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                message: cleanMessage,
                session_id: currentChannel?.channel_id || 'default_session'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.detail || `HTTP ${response.status}`);
        }

        const aiText = data.response || data.reply || 'Aucune réponse';

        loadingDiv.innerHTML = `
            <p><strong>Assistant :</strong> ${escapeHtml(aiText)}</p>
        `;
    } catch (error) {
        console.error('Erreur IA:', error);
        loadingDiv.innerHTML = `
            <p><strong>Assistant :</strong> ❌ Erreur : ${escapeHtml(error.message)}.</p>
        `;
    }

    scrollChatToBottom();
}

async function analyzeVideo(videoId) {
    try {
        showNotification('Analyse en cours...', 'info');

        const { data: video, error } = await supabase
            .from('videos')
            .select('*')
            .eq('video_id', videoId)
            .single();

        if (error) throw error;

        showNotification(`Vidéo analysée : ${video.title}`, 'success');
    } catch (error) {
        console.error('Erreur analyse vidéo:', error);
        showNotification('Erreur lors de l’analyse', 'error');
    }
}

function showLoadingState() {
    document.querySelectorAll('.stat-value').forEach(stat => {
        stat.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
}

function animateStatValues() {
    const statValues = document.querySelectorAll('.stat-value');

    statValues.forEach((stat, index) => {
        stat.style.opacity = '0';
        stat.style.transform = 'translateY(10px)';

        setTimeout(() => {
            stat.style.transition = 'all 0.6s ease';
            stat.style.opacity = '1';
            stat.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
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
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showErrorMessage(message) {
    showNotification(message, 'error');
}

function scrollChatToBottom() {
    const messageContainer = document.querySelector('.assistant-message');
    if (!messageContainer) return;

    messageContainer.scrollTop = messageContainer.scrollHeight;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
}