// videos.js - Gestion de la page Mes Vidéos

let currentChannel = null;
let allVideos = [];
let filteredVideos = [];

// ==============================
// Chargement initial
// ==============================
document.addEventListener('DOMContentLoaded', async () => {
    const channelData = localStorage.getItem('selectedChannel');

    if (!channelData) {
        window.location.href = 'login.html';
        return;
    }

    currentChannel = JSON.parse(channelData);
    console.log('📺 Channel chargé:', currentChannel);

    await loadVideosData();
    setupFilters();
    setupSearch();
});

// ==============================
// Charger les vidéos depuis Supabase
// ==============================
async function loadVideosData() {
    try {
        console.log('📹 Chargement des vidéos pour channel_id:', currentChannel.channel_id);

        const { data: videos, error } = await supabase
            .from('videos')
            .select('*')
            .eq('channel_id', currentChannel.channel_id)
            .order('published_at', { ascending: false });

        if (error) {
            console.error('❌ Erreur Supabase:', error);
            throw error;
        }

        if (!videos || videos.length === 0) {
            showEmptyState();
            return;
        }

        allVideos = videos;
        filteredVideos = videos;

        updateQuickStats(videos);
        displayVideos(videos);

    } catch (error) {
        console.error('❌ Erreur chargement vidéos:', error);
        showErrorState();
    }
}

// ==============================
// Statistiques rapides
// ==============================
function updateQuickStats(videos) {
    const publishedVideos = videos.filter(v => v.published_at);

    const totalVideos = publishedVideos.length;
    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    const totalLikes = videos.reduce((sum, v) => sum + (v.like_count || 0), 0);

    const watchTimeMinutes = totalViews * 5;
    const watchTimeHours = Math.round(watchTimeMinutes / 60);

    document.getElementById('totalVideos').textContent = totalVideos;
    document.getElementById('totalViews').textContent = formatNumber(totalViews);
    document.getElementById('totalLikes').textContent = formatNumber(totalLikes);
    document.getElementById('totalWatchTime').textContent = watchTimeHours + 'h';
}

// ==============================
// Affichage des vidéos
// ==============================
function displayVideos(videos) {
    const videosList = document.getElementById('videosList');
    videosList.innerHTML = '';

    if (videos.length === 0) {
        showEmptyState();
        return;
    }

    videos.forEach(video => {
        videosList.appendChild(createVideoCard(video));
    });
}

// ==============================
// Carte vidéo
// ==============================
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    const status = video.published_at ? 'published' : 'draft';

    // Miniature
    const thumbnail =
        video.thumbnails?.medium?.url ||
        video.thumbnails?.default?.url ||
        'https://via.placeholder.com/280x158/FF0000/FFFFFF?text=Video';

    // Durée
    const duration = formatDuration(video.duration_seconds);

    // Date
    const publishedDate = video.published_at
        ? new Date(video.published_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
        : 'Brouillon';

    const trend = calculateTrend(video);

    card.innerHTML = `
        <div class="video-card-content">
            <div class="video-thumbnail">
                <img src="${thumbnail}" alt="${video.title || 'Vidéo'}">
                <div class="video-thumbnail-overlay">
                    <i class="fas fa-play play-icon"></i>
                </div>
                ${duration !== '0:00' ? `<div class="video-duration">${duration}</div>` : ''}
                ${status === 'draft' ? `<div class="video-badge draft">Brouillon</div>` : ''}
            </div>

            <div class="video-info">
                <div class="video-header">
                    <div>
                        <h3 class="video-title">${video.title || 'Sans titre'}</h3>
                        <div class="video-date">
                            <i class="fas fa-calendar"></i>
                            <span>${publishedDate}</span>
                        </div>
                    </div>
                    <button class="video-menu-btn" onclick="showVideoMenu(event, '${video.video_id}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>

                ${status === 'published' ? `
                    <div class="video-stats">
                        <div class="video-stat">
                            <i class="fas fa-eye"></i>
                            <span class="video-stat-value">${formatNumber(video.view_count || 0)}</span>
                        </div>
                        <div class="video-stat">
                            <i class="fas fa-thumbs-up"></i>
                            <span class="video-stat-value">${formatNumber(video.like_count || 0)}</span>
                        </div>
                        <div class="video-stat">
                            <i class="fas fa-comment"></i>
                            <span class="video-stat-value">${formatNumber(video.comment_count || 0)}</span>
                        </div>
                        ${trend.show ? `
                            <div class="trend-badge ${trend.type}">
                                <i class="fas fa-arrow-${trend.type}"></i>
                                ${trend.value}%
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="draft-actions">
                        <button class="btn-edit-draft" onclick="editDraft('${video.video_id}')">
                            Continuer l'édition
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;

    return card;
}

// ==============================
// Utilitaires
// ==============================
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
}

// ==============================
// Filtres & recherche
// ==============================
function setupFilters() {
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortFilter').addEventListener('change', applyFilters);
}

function setupSearch() {
    document.getElementById('videoSearch').addEventListener('input', applyFilters);
}

function applyFilters() {
    const search = document.getElementById('videoSearch').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;
    const sort = document.getElementById('sortFilter').value;

    let filtered = allVideos.filter(video => {
        const matchesSearch = !search || video.title?.toLowerCase().includes(search);
        const matchesStatus =
            status === 'all' ||
            (status === 'published' && video.published_at) ||
            (status === 'draft' && !video.published_at);

        return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
        if (sort === 'views') return (b.view_count || 0) - (a.view_count || 0);
        if (sort === 'likes') return (b.like_count || 0) - (a.like_count || 0);
        if (sort === 'comments') return (b.comment_count || 0) - (a.comment_count || 0);
        return new Date(b.published_at || 0) - new Date(a.published_at || 0);
    });

    displayVideos(filtered);
}

// ==============================
// Actions
// ==============================
function showVideoMenu(event, videoId) {
    event.stopPropagation();
    console.log('Menu vidéo:', videoId);
}

function editDraft(videoId) {
    showNotification('Édition du brouillon bientôt disponible', 'info');
}

// ==============================
// États UI
// ==============================
function showEmptyState() {
    document.getElementById('videosList').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-video"></i>
            <h3>Aucune vidéo</h3>
            <p>Vos vidéos apparaîtront ici</p>
        </div>
    `;
}

function showErrorState() {
    document.getElementById('videosList').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Erreur</h3>
            <p>Impossible de charger les vidéos</p>
        </div>
    `;
}

// ==============================
// Notifications
// ==============================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 14px 18px;
        background: ${type === 'error' ? '#EF4444' : '#00BCD4'};
        color: white;
        border-radius: 8px;
        z-index: 9999;
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ==============================
// Simulation de tendance
// ==============================
function calculateTrend(video) {
    if (!video.view_count) return { show: false };
    const r = Math.random();
    if (r > 0.7) return { show: true, type: 'up', value: Math.floor(Math.random() * 15 + 5) };
    if (r < 0.3) return { show: true, type: 'down', value: Math.floor(Math.random() * 8 + 1) };
    return { show: false };
}
