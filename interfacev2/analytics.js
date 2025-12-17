// analytics.js - Gestion de la page Analytics

let currentPeriod = 7; // Par défaut 7 jours
let currentChannel = null;
let viewsChart = null;
let subscribersChart = null;

// Charger les données au démarrage
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier qu'une chaîne est sélectionnée
    const channelData = localStorage.getItem('selectedChannel');
    
    if (!channelData) {
        window.location.href = 'login.html';
        return;
    }
    
    currentChannel = JSON.parse(channelData);
    
    setupPeriodSelector();
    await loadAnalyticsData();
});

// Configuration du sélecteur de période
function setupPeriodSelector() {
    const periodButtons = document.querySelectorAll('.period-btn');
    
    periodButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            periodButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            currentPeriod = parseInt(this.dataset.period);
            await loadAnalyticsData();
        });
    });
}

// Charger toutes les données analytics
async function loadAnalyticsData() {
    try {
        // Charger les stats principales
        await loadMainStats();
        
        // Charger les top vidéos
        await loadTopVideos();
        
        // Créer les graphiques
        createCharts();
        
    } catch (error) {
        console.error('Erreur lors du chargement des analytics:', error);
    }
}

// Charger les statistiques principales
async function loadMainStats() {
    try {
        const stats = await calculateDashboardStats(currentChannel.channel_id);
        
        if (stats) {
            document.getElementById('totalViews').textContent = stats.viewCount;
            document.getElementById('totalSubscribers').textContent = stats.subscriberCount;
            document.getElementById('watchTime').textContent = calculateWatchTime(stats.rawData.views);
            document.getElementById('engagementRate').textContent = calculateEngagementRate(stats.rawData);
        }
    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

// Charger les top vidéos
async function loadTopVideos() {
    const topVideosList = document.getElementById('topVideosList');
    
    try {
        const videos = await getVideosByChannel(currentChannel.channel_id);
        
        if (!videos || videos.length === 0) {
            topVideosList.innerHTML = `
                <div class="loading-placeholder">
                    <i class="fas fa-video"></i>
                    <p>Aucune vidéo trouvée</p>
                </div>
            `;
            return;
        }
        
        // Trier par vues et prendre les 5 premiers
        const topVideos = videos
            .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
            .slice(0, 5);
        
        topVideosList.innerHTML = '';
        
        topVideos.forEach((video, index) => {
            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            
            videoItem.innerHTML = `
                <div class="video-rank">#${index + 1}</div>
                <div class="video-info">
                    <div class="video-title">${video.title || 'Sans titre'}</div>
                    <div class="video-stats">
                        ${formatNumber(video.like_count || 0)} likes • 
                        ${formatNumber(video.comment_count || 0)} commentaires
                    </div>
                </div>
                <div class="video-views">${formatNumber(video.view_count || 0)} vues</div>
            `;
            
            topVideosList.appendChild(videoItem);
        });
        
    } catch (error) {
        console.error('Erreur top videos:', error);
        topVideosList.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erreur de chargement</p>
            </div>
        `;
    }
}

// Créer les graphiques avec Chart.js
function createCharts() {
    createViewsChart();
    createSubscribersChart();
}

// Graphique d'évolution des vues
function createViewsChart() {
    const ctx = document.getElementById('viewsChart');
    
    if (!ctx) return;
    
    // Détruire le graphique existant
    if (viewsChart) {
        viewsChart.destroy();
    }
    
    // Générer des données simulées (à remplacer par vos vraies données)
    const labels = generateDateLabels(currentPeriod);
    const data = generateViewsData(currentPeriod);
    
    viewsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vues',
                data: data,
                borderColor: '#00BCD4',
                backgroundColor: 'rgba(0, 188, 212, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#00BCD4',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Graphique de croissance des abonnés
function createSubscribersChart() {
    const ctx = document.getElementById('subscribersChart');
    
    if (!ctx) return;
    
    if (subscribersChart) {
        subscribersChart.destroy();
    }
    
    const labels = generateDateLabels(currentPeriod);
    const data = generateSubscribersData(currentPeriod);
    
    subscribersChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Abonnés',
                data: data,
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#EF4444',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Générer les labels de dates
function generateDateLabels(days) {
    const labels = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        if (days <= 7) {
            // Format court pour 7 jours
            labels.push(date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
        } else if (days <= 30) {
            // Format moyen pour 30 jours
            labels.push(date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        } else {
            // Format avec mois pour 90+ jours
            labels.push(date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
        }
    }
    
    return labels;
}

// Générer des données de vues (simulées - à remplacer par vos vraies données)
function generateViewsData(days) {
    const data = [];
    let baseValue = 1000;
    
    for (let i = 0; i < days; i++) {
        // Simulation avec variation aléatoire
        const variation = (Math.random() - 0.3) * 200;
        baseValue += variation;
        data.push(Math.max(0, Math.round(baseValue)));
    }
    
    return data;
}

// Générer des données d'abonnés (simulées)
function generateSubscribersData(days) {
    const data = [];
    let baseValue = 48000;
    
    for (let i = 0; i < days; i++) {
        const variation = Math.random() * 50;
        baseValue += variation;
        data.push(Math.round(baseValue));
    }
    
    return data;
}

// Calculer le temps de visionnage (estimation)
function calculateWatchTime(views) {
    // Estimation: moyenne de 5 minutes par vue
    const totalMinutes = views * 5;
    const hours = Math.round(totalMinutes / 60);
    return formatNumber(hours) + ' h';
}

// Calculer le taux d'engagement
function calculateEngagementRate(data) {
    if (!data.views || data.views === 0) return '0%';
    
    const engagements = (data.likes || 0) + (data.comments || 0);
    const rate = (engagements / data.views) * 100;
    
    return rate.toFixed(1) + '%';
}

// Formater les nombres
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}