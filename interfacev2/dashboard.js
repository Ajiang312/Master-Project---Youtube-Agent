// dashboard.js - Logique du dashboard avec données Supabase

// Vérifier si une chaîne est sélectionnée
let currentChannel = null;

// Charger les statistiques au démarrage
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier qu'une chaîne est sélectionnée
    const channelData = localStorage.getItem('selectedChannel');
    
    if (!channelData) {
        // Rediriger vers la page de connexion si pas de chaîne sélectionnée
        window.location.href = 'login.html';
        return;
    }
    
    currentChannel = JSON.parse(channelData);
    displayChannelInfo();
    
    await loadDashboardData();
    setupEventListeners();
});

// Afficher les infos de la chaîne sélectionnée
function displayChannelInfo() {
    const dashboardHeader = document.querySelector('.dashboard-header');
    
    // Ajouter le nom de la chaîne et un bouton de déconnexion
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
    `;
    
    channelBanner.innerHTML = `
        <div>
            <h3 style="font-size: 18px; margin-bottom: 5px;">
                <i class="fas fa-youtube" style="margin-right: 8px;"></i>
                ${currentChannel.title}
            </h3>
            <p style="font-size: 14px; opacity: 0.9;">
                Chaîne YouTube connectée
            </p>
        </div>
        <button onclick="logout()" style="
            background: rgba(255,255,255,0.2);
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            <i class="fas fa-sign-out-alt" style="margin-right: 5px;"></i>
            Changer de chaîne
        </button>
    `;
    
    dashboardHeader.insertBefore(channelBanner, dashboardHeader.firstChild);
}

// Fonction de déconnexion
function logout() {
    localStorage.removeItem('selectedChannel');
    window.location.href = 'login.html';
}

// Charger toutes les données du dashboard
async function loadDashboardData() {
    showLoadingState();
    
    try {
        console.log('📊 Chargement des données pour channel_id:', currentChannel.channel_id);
        
        // Récupérer les stats UNIQUEMENT pour la chaîne sélectionnée
        const stats = await calculateDashboardStats(currentChannel.channel_id);
        
        console.log('📈 Stats calculées:', stats);
        
        if (stats) {
            updateStatsCards(stats);
        } else {
            // Afficher des données par défaut si erreur
            showDefaultStats();
        }
        
        // Charger les vidéos récentes de cette chaîne
        await loadRecentVideos(currentChannel.channel_id);
        
    } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
        showErrorMessage('Erreur lors du chargement des données');
    } finally {
        hideLoadingState();
    }
}

// Mettre à jour les cartes de statistiques
function updateStatsCards(stats) {
    const statCards = {
        subscribers: document.querySelector('.stat-card:nth-child(1) .stat-value'),
        videos: document.querySelector('.stat-card:nth-child(2) .stat-value'),
        views: document.querySelector('.stat-card:nth-child(3) .stat-value'),
        likes: document.querySelector('.stat-card:nth-child(4) .stat-value')
    };
    
    if (statCards.subscribers) {
        statCards.subscribers.textContent = stats.subscriberCount;
    }
    
    if (statCards.videos) {
        statCards.videos.textContent = stats.videoCount;
    }
    
    if (statCards.views) {
        statCards.views.textContent = stats.viewCount;
    }
    
    if (statCards.likes) {
        statCards.likes.textContent = stats.totalLikes;
    }
    
    // Animer les valeurs
    animateStatValues();
}

// Afficher les stats par défaut
function showDefaultStats() {
    const defaultStats = {
        subscriberCount: '0',
        videoCount: '0',
        viewCount: '0',
        totalLikes: '0'
    };
    updateStatsCards(defaultStats);
}

// Charger les vidéos récentes de la chaîne sélectionnée
async function loadRecentVideos(channelId) {
    try {
        const videos = await getRecentVideos(channelId);

        if (!videos || videos.length === 0) {
            showNoVideosMessage();
            return;
        }

        displayRecentVideos(videos);

    } catch (error) {
        console.error('Erreur lors du chargement des vidéos récentes:', error);
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
        console.error('Erreur Supabase (recent videos):', error);
        return [];
    }

    return data;
}

function displayRecentVideos(videos) {
    const container = document.querySelector('.suggestions-box');
    if (!container) return;

    // Garder le header
    const header = container.querySelector('.box-header');
    container.innerHTML = '';
    container.appendChild(header);

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'suggestion-card';

        card.innerHTML = `
            <div class="suggestion-content">
                <h3>${video.title}</h3>

                <div class="suggestion-tags">
                    <span class="tag">
                        <i class="fas fa-eye"></i> ${formatNumber(video.view_count)} vues
                    </span>
                    <span class="tag">
                        <i class="fas fa-thumbs-up"></i> ${formatNumber(video.like_count)}
                    </span>
                    <span class="tag">
                        <i class="fas fa-comment"></i> ${formatNumber(video.comment_count)}
                    </span>
                </div>
            </div>

            <button class="btn-create" data-video-id="${video.id}">
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


// Afficher un message si pas de vidéos
function showNoVideosMessage() {
    const suggestionsContainer = document.querySelector('.suggestions-box');
    const header = suggestionsContainer.querySelector('.box-header');
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.appendChild(header);
    
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-light);';
    emptyDiv.innerHTML = `
        <i class="fas fa-video" style="font-size: 48px; opacity: 0.3; margin-bottom: 15px;"></i>
        <p>Aucune vidéo trouvée pour cette chaîne</p>
    `;
    suggestionsContainer.appendChild(emptyDiv);
}

// Afficher les suggestions de vidéos
function displayVideoSuggestions(videos) {
    const suggestionsContainer = document.querySelector('.suggestions-box');
    
    if (!suggestionsContainer) return;
    
    // Garder le header
    const header = suggestionsContainer.querySelector('.box-header');
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.appendChild(header);
    
    videos.forEach((video, index) => {
        const suggestionCard = createVideoSuggestionCard(video, index);
        suggestionsContainer.appendChild(suggestionCard);
    });
}

// Créer une carte de suggestion à partir d'une vidéo
function createVideoSuggestionCard(video, index) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    
    const difficulty = index % 3 === 0 ? 'Haut' : index % 3 === 1 ? 'Moyen' : 'Facile';
    const tagType = index % 2 === 0 ? 'trending' : 'popular';
    const tagIcon = index % 2 === 0 ? 'fa-chart-line' : 'fa-fire';
    const tagText = index % 2 === 0 ? 'Tendance' : 'Populaire';
    
    card.innerHTML = `
        <div class="suggestion-content">
            <h3>${video.title || 'Vidéo sans titre'}</h3>
            <div class="suggestion-tags">
                <span class="tag ${tagType}">
                    <i class="fas ${tagIcon}"></i> ${tagText}
                </span>
                <span class="tag difficulty">${difficulty}</span>
            </div>
        </div>
        <button class="btn-create" data-video-id="${video.id}">Analyser</button>
    `;
    
    return card;
}

// Configuration des événements
function setupEventListeners() {
    // Bouton d'envoi de message
    const sendButton = document.querySelector('.btn-send');
    const assistantInput = document.querySelector('.assistant-input input');
    
    if (sendButton && assistantInput) {
        sendButton.addEventListener('click', () => sendAIMessage(assistantInput.value));
        assistantInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendAIMessage(assistantInput.value);
            }
        });
    }
    
    // Boutons de création/analyse
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-create')) {
            const videoId = e.target.dataset.videoId;
            if (videoId) {
                await analyzeVideo(videoId);
            }
        }
    });
}

// Envoyer un message à l'assistant IA
async function sendAIMessage(message) {
    const input = document.querySelector('.assistant-input input');
    const messageContainer = document.querySelector('.assistant-messages');
    
    if (!message.trim()) return;
    
    // Afficher le message de l'utilisateur
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'user-message';
    userMessageDiv.innerHTML = `<p><strong>Vous:</strong> ${message}</p>`;
    messageContainer.appendChild(userMessageDiv);
    
    messageContainer.scrollTop = messageContainer.scrollHeight;

    // Vider l'input
    input.value = '';
    
    // Simuler une réponse (à remplacer par votre vraie API IA)
    setTimeout(() => {
        const aiResponse = document.createElement('div');
        aiResponse.className = 'ai-response';
        aiResponse.innerHTML = `<p><strong>Assistant:</strong> J'ai bien reçu votre message. Comment puis-je vous aider avec vos vidéos YouTube ?</p>`;
        messageContainer.appendChild(aiResponse);
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }, 1000);
}

// Analyser une vidéo
async function analyzeVideo(videoId) {
    try {
        showNotification('Analyse en cours...', 'info');
        
        // Récupérer les détails de la vidéo
        const { data: video, error } = await supabase
            .from('videos')
            .select('*')
            .eq('id', videoId)
            .single();
        
        if (error) throw error;
        
        // Récupérer les commentaires
        const comments = await getCommentsByVideo(videoId);
        
        // Afficher les résultats
        showNotification(`Vidéo analysée: ${video.title}`, 'success');
        console.log('Vidéo:', video);
        console.log('Commentaires:', comments);
        
    } catch (error) {
        console.error('Erreur lors de l\'analyse:', error);
        showNotification('Erreur lors de l\'analyse', 'error');
    }
}

// États de chargement
function showLoadingState() {
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(stat => {
        stat.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });
}

function hideLoadingState() {
    // La fonction updateStatsCards remplacera les spinners
}

// Animation des valeurs
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

// Notifications
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

function showErrorMessage(message) {
    showNotification(message, 'error');
}

// Rafraîchir les données toutes les 5 minutes
setInterval(async () => {
    await loadDashboardData();
}, 5 * 60 * 1000);

// Ajouter les animations CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .user-message, .ai-response {
        padding: 10px;
        margin: 10px 0;
        border-radius: 8px;
    }
    
    .user-message {
        background: rgba(0, 188, 212, 0.1);
        border-left: 3px solid var(--primary-color);
    }
    
    .ai-response {
        background: rgba(16, 185, 129, 0.1);
        border-left: 3px solid var(--success-color);
    }
`;
document.head.appendChild(style);