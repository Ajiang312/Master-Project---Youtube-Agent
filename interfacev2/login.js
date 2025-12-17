// login.js - Gestion de la page de connexion

let allChannels = [];
let selectedChannel = null;

// Charger les chaînes au démarrage
document.addEventListener('DOMContentLoaded', async () => {
    await loadChannels();
    setupSearchListener();
});

// Charger toutes les chaînes depuis Supabase
async function loadChannels() {
    const channelsList = document.getElementById('channelsList');
    
    try {
        console.log('🔍 Tentative de chargement des chaînes...');
        console.log('📡 Supabase URL:', SUPABASE_URL);
        console.log('🔑 Supabase Key présente:', SUPABASE_ANON_KEY ? 'Oui ✅' : 'Non ❌');
        
        // Vérifier que Supabase est bien initialisé
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase n\'est pas initialisé. Vérifiez que supabase-config.js est bien chargé.');
        }
        
        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .order('title', { ascending: true });
        
        console.log('📊 Réponse Supabase:', { data, error });
        
        if (error) {
            console.error('❌ Erreur Supabase:', error);
            throw error;
        }
        
        allChannels = data || [];
        console.log('✅ Chaînes chargées:', allChannels.length);
        
        if (allChannels.length === 0) {
            showEmptyState();
        } else {
            displayChannels(allChannels);
        }
        
    } catch (error) {
        console.error('💥 Erreur complète:', error);
        showError(`Erreur: ${error.message || 'Impossible de charger les chaînes'}`);
        
        // Afficher des infos de debug dans la liste
        channelsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i>
                <p style="color: #EF4444; font-weight: 600;">Erreur de connexion</p>
                <p style="font-size: 13px; margin-top: 10px; opacity: 0.7;">
                    ${error.message}
                </p>
                <p style="font-size: 12px; margin-top: 10px; opacity: 0.5;">
                    Vérifiez la console (F12) pour plus de détails
                </p>
            </div>
        `;
    }
}

// Afficher les chaînes
function displayChannels(channels) {
    const channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = '';
    
    if (channels.length === 0) {
        channelsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>Aucune chaîne trouvée</p>
            </div>
        `;
        return;
    }
    
    channels.forEach(channel => {
        const channelCard = createChannelCard(channel);
        channelsList.appendChild(channelCard);
    });
}

// Créer une carte de chaîne
function createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.dataset.channelId = channel.id;
    
    // Récupérer les initiales pour l'avatar
    const initials = getInitials(channel.title);
    
    // Calculer les stats (si disponibles)
    const subscriberCount = channel.subscriber_count 
        ? formatNumber(channel.subscriber_count) + ' abonnés'
        : 'Pas de données';
    
    const videoCount = channel.video_count
        ? formatNumber(channel.video_count) + ' vidéos'
        : '';
    
    card.innerHTML = `
        <div class="channel-info">
            <div class="channel-avatar">
                ${channel.thumbnail_url 
                    ? `<img src="${channel.thumbnail_url}" alt="${channel.title}">` 
                    : initials
                }
            </div>
            <div class="channel-details">
                <div class="channel-name">${channel.title}</div>
                <div class="channel-stats">${subscriberCount}${videoCount ? ' • ' + videoCount : ''}</div>
            </div>
        </div>
        <i class="fas fa-arrow-right channel-arrow"></i>
    `;
    
    // Ajouter l'événement de clic
    card.addEventListener('click', () => selectChannel(channel, card));
    
    return card;
}

// Sélectionner une chaîne
function selectChannel(channel, cardElement) {
    selectedChannel = channel;
    
    // Retirer la sélection des autres cartes
    document.querySelectorAll('.channel-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Marquer la carte sélectionnée
    cardElement.classList.add('selected');
    
    // Sauvegarder dans le localStorage
    localStorage.setItem('selectedChannel', JSON.stringify(channel));
    
    // Animation et redirection
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 300);
}

// Configuration de la recherche
function setupSearchListener() {
    const searchInput = document.getElementById('channelSearch');
    const searchResults = document.getElementById('searchResults');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            searchResults.classList.remove('active');
            displayChannels(allChannels);
            return;
        }
        
        // Filtrer les chaînes
        const filtered = allChannels.filter(channel => 
            channel.title.toLowerCase().includes(query) ||
            (channel.description && channel.description.toLowerCase().includes(query))
        );
        
        displayChannels(filtered);
        
        // Afficher les résultats dans la dropdown aussi
        if (filtered.length > 0) {
            displaySearchResults(filtered);
        } else {
            searchResults.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <i class="fas fa-search"></i>
                    <p>Aucune chaîne trouvée pour "${query}"</p>
                </div>
            `;
            searchResults.classList.add('active');
        }
    });
    
    // Fermer les résultats en cliquant en dehors
    document.addEventListener('click', (e) => {
        if (!searchResults.contains(e.target) && e.target !== searchInput) {
            searchResults.classList.remove('active');
        }
    });
}

// Afficher les résultats de recherche
function displaySearchResults(channels) {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '';
    
    channels.slice(0, 5).forEach(channel => {
        const resultCard = createChannelCard(channel);
        resultCard.style.animation = 'none';
        searchResults.appendChild(resultCard);
    });
    
    searchResults.classList.add('active');
}

// Obtenir les initiales d'un nom
function getInitials(name) {
    if (!name) return '?';
    
    const words = name.trim().split(' ');
    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

// Formater les nombres
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Afficher l'état vide
function showEmptyState() {
    const channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-youtube"></i>
            <p>Aucune chaîne disponible</p>
            <p style="font-size: 13px; margin-top: 10px; opacity: 0.7;">
                Ajoutez des chaînes dans votre base de données Supabase
            </p>
        </div>
    `;
}

// Afficher une erreur
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorSpan = errorDiv.querySelector('span');
    
    errorSpan.textContent = message;
    errorDiv.style.display = 'flex';
    
    // Masquer après 5 secondes
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}