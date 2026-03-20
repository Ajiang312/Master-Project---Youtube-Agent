// ANALYTICS.JS - VERSION FINALE
console.log('📂 analytics.js CHARGÉ');

let currentChannel = null;
let currentPeriod = '7';
let viewsChart = null;
let subscribersChart = null;

// DÉMARRAGE
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 === ANALYTICS DÉMARRAGE ===');

    const channelData = localStorage.getItem('selectedChannel');
    if (!channelData) {
        alert('Sélectionnez une chaîne');
        window.location.href = 'index.html';
        return;
    }

    currentChannel = JSON.parse(channelData);
    console.log('✅ Channel ID:', currentChannel.channel_id);

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', async function () {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.dataset.period;
            await loadData();
        });
    });

    await loadData();
});

// CHARGER DONNÉES
async function loadData() {
    console.log('📊 CHARGEMENT...');

    try {
        const { data: allVideos, error } = await supabase
            .from('videos')
            .select('*')
            .eq('channel_id', currentChannel.channel_id)
            .order('published_at', { ascending: false });

        if (error) throw error;

        console.log('✅ Vidéos totales:', allVideos.length);

        if (!allVideos || allVideos.length === 0) {
            const topVideos = document.getElementById('topVideosList');
            const topComments = document.getElementById('topCommentsContainer');
            const categories = document.getElementById('categoriesContainer');
            const sentiments = document.getElementById('sentimentsContainer');
            const topSubscribers = document.getElementById('topSubscribersContainer');

            if (topVideos) topVideos.innerHTML = '<div class="loading-placeholder"><i class="fas fa-video"></i><p>Aucune vidéo</p></div>';
            if (topComments) topComments.innerHTML = '<div class="loading-placeholder"><i class="fas fa-comment-slash"></i><p>Aucun commentaire</p></div>';
            if (categories) categories.innerHTML = '<div class="loading-placeholder"><i class="fas fa-tag"></i><p>Aucune catégorie</p></div>';
            if (sentiments) sentiments.innerHTML = '<div class="loading-placeholder"><i class="fas fa-comment"></i><p>Aucun commentaire analysé</p></div>';
            if (topSubscribers) topSubscribers.innerHTML = '<div class="loading-placeholder"><i class="fas fa-users"></i><p>Aucun abonné trouvé</p></div>';
            return;
        }

        let data = [];
        let periodLabel = '';

        if (currentPeriod === 'all') {
            data = [...allVideos];
            periodLabel = 'toute la chaîne';
        } else {
            const periodDays = parseInt(currentPeriod, 10);

            const cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0);
            cutoffDate.setDate(cutoffDate.getDate() - periodDays);

            data = allVideos.filter(video => {
                if (!video.published_at) return false;
                return new Date(video.published_at) >= cutoffDate;
            });

            periodLabel = `${periodDays} jours`;
        }

        console.log(`📅 Période sélectionnée: ${periodLabel}`);
        console.log('✅ Vidéos filtrées:', data.length);

        if (!data || data.length === 0) {
            document.getElementById('totalViews').textContent = '0';
            document.getElementById('totalSubscribers').textContent = '0';
            document.getElementById('watchTime').textContent = '0 h';
            document.getElementById('engagementRate').textContent = '0%';

            const topVideos = document.getElementById('topVideosList');
            const topComments = document.getElementById('topCommentsContainer');
            const categories = document.getElementById('categoriesContainer');
            const sentiments = document.getElementById('sentimentsContainer');
            const topSubscribers = document.getElementById('topSubscribersContainer');

            if (topVideos) topVideos.innerHTML = `<div class="loading-placeholder"><i class="fas fa-calendar-times"></i><p>Aucune vidéo publiée sur ${periodLabel}</p></div>`;
            if (topComments) topComments.innerHTML = `<div class="loading-placeholder"><i class="fas fa-comment-slash"></i><p>Aucun commentaire sur ${periodLabel}</p></div>`;
            if (categories) categories.innerHTML = `<div class="loading-placeholder"><i class="fas fa-tag"></i><p>Aucune catégorie sur ${periodLabel}</p></div>`;
            if (sentiments) sentiments.innerHTML = `<div class="loading-placeholder"><i class="fas fa-comment"></i><p>Aucun commentaire analysé sur ${periodLabel}</p></div>`;
            if (topSubscribers) topSubscribers.innerHTML = `<div class="loading-placeholder"><i class="fas fa-users"></i><p>Aucun abonné visible sur ${periodLabel}</p></div>`;

            drawCharts(data);
            return;
        }

        console.log('📹 Exemple:', data[0].title);

        const { data: channelData, error: channelError } = await supabase
            .from('channels')
            .select('subscriber_count')
            .eq('channel_id', currentChannel.channel_id)
            .single();

        if (channelError) {
            console.error('❌ Erreur channel:', channelError);
        }

        const subscriberCount = channelData?.subscriber_count || 0;
        console.log('👥 Abonnés:', subscriberCount);

        let vues = 0;
        let likes = 0;
        let comments = 0;

        data.forEach(v => {
            vues += v.view_count || 0;
            likes += v.like_count || 0;
            comments += v.comment_count || 0;
        });

        const engagement = vues > 0 ? ((likes + comments) / vues * 100) : 0;

        console.log('  Vues:', vues);
        console.log('  Abonnés:', subscriberCount);
        console.log('  Engagement:', engagement.toFixed(1) + '%');

        document.getElementById('totalViews').textContent = fmt(vues);
        document.getElementById('totalSubscribers').textContent = fmt(subscriberCount);
        document.getElementById('watchTime').textContent = fmt(Math.round(vues * 5 / 60)) + ' h';
        document.getElementById('engagementRate').textContent = engagement.toFixed(1) + '%';

        const top = data
            .filter(v => (v.view_count || 0) > 0)
            .map(v => ({
                ...v,
                rate: (v.view_count || 0) > 0 ? (((v.like_count || 0) / v.view_count) * 100) : 0,
                score: (v.view_count || 0) * (1 + ((((v.like_count || 0) / (v.view_count || 1)) * 100) / 10))
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        console.log('🏆 Top 1:', top[0]?.title);

        const container = document.getElementById('topVideosList');
        if (container) {
            container.innerHTML = '';

            top.forEach((v, i) => {
                const div = document.createElement('div');
                div.className = 'video-item';
                div.innerHTML = `
                    <div class="video-rank">#${i + 1}</div>
                    <div class="video-info">
                        <div class="video-title">${escapeHtml(v.title || 'Vidéo sans titre')}</div>
                        <div class="video-stats">
                            <span class="stat-highlight"><i class="fas fa-thumbs-up"></i> ${fmt(v.like_count || 0)} likes</span>
                            <span class="stat-separator">•</span>
                            <span><i class="fas fa-eye"></i> ${fmt(v.view_count || 0)} vues</span>
                            <span class="stat-separator">•</span>
                            <span style="color: #10B981; font-weight: 600;">${v.rate.toFixed(1)}% engagement</span>
                        </div>
                    </div>
                    <div class="engagement-badge"><i class="fas fa-fire"></i> Top ${i + 1}</div>
                `;
                container.appendChild(div);
            });
        }

        drawCharts(data);

        await analyzeTopComments(data);
        await analyzeCategories(data);
        await analyzeSentiments(data);
        await analyzeTopSubscribers(data);

        console.log('✅ TERMINÉ');

    } catch (err) {
        console.error('❌ ERREUR:', err);

        const topVideos = document.getElementById('topVideosList');
        const topComments = document.getElementById('topCommentsContainer');
        const categories = document.getElementById('categoriesContainer');
        const sentiments = document.getElementById('sentimentsContainer');
        const topSubscribers = document.getElementById('topSubscribersContainer');

        if (topVideos) topVideos.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur</p></div>';
        if (topComments) topComments.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
        if (categories) categories.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
        if (sentiments) sentiments.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
        if (topSubscribers) topSubscribers.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
    }
}

// GRAPHIQUES
function drawCharts(data) {
    // Graphique 1 - Évolution réelle des vues par date de publication
    const ctx1 = document.getElementById('viewsChart');
    if (ctx1) {
        if (viewsChart) viewsChart.destroy();

        const sortedVideos = [...data]
            .filter(v => v.published_at && v.view_count !== null && v.view_count !== undefined)
            .sort((a, b) => new Date(a.published_at) - new Date(b.published_at));

        const labels = sortedVideos.map(video =>
            new Date(video.published_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            })
        );

        const viewsData = sortedVideos.map(video => video.view_count || 0);
        const titles = sortedVideos.map(video => video.title || 'Sans titre');

        viewsChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vues par vidéo',
                    data: viewsData,
                    borderColor: '#00BCD4',
                    backgroundColor: 'rgba(0,188,212,0.1)',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `📅 ${context[0].label}`;
                            },
                            label: function(context) {
                                const index = context.dataIndex;
                                const title = titles[index];
                                const shortTitle = title.length > 60
                                    ? title.substring(0, 60) + '...'
                                    : title;

                                return [
                                    `🎬 ${shortTitle}`,
                                    `👁️ ${fmt(context.parsed.y)} vues`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        },
                        title: {
                            display: true,
                            text: 'Date de publication'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return fmt(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Nombre de vues'
                        }
                    }
                }
            }
        });
    }

    // Graphique 2 - Shorts vs Vidéos longues
    const ctx2 = document.getElementById('subscribersChart');
    if (ctx2) {
        if (subscribersChart) subscribersChart.destroy();

        const shorts = data.filter(v => v.is_short === true);
        const longs = data.filter(v => v.is_short === false);

        const shortsVues = shorts.reduce((sum, v) => sum + (v.view_count || 0), 0);
        const longsVues = longs.reduce((sum, v) => sum + (v.view_count || 0), 0);

        const shortsLikes = shorts.reduce((sum, v) => sum + (v.like_count || 0), 0);
        const longsLikes = longs.reduce((sum, v) => sum + (v.like_count || 0), 0);

        const shortsEngagement = shortsVues > 0 ? (shortsLikes / shortsVues * 100) : 0;
        const longsEngagement = longsVues > 0 ? (longsLikes / longsVues * 100) : 0;

        console.log('📊 SHORTS vs LONGS:');
        console.log('  Shorts:', shorts.length, 'vidéos -', fmt(shortsVues), 'vues -', shortsEngagement.toFixed(2) + '% engagement');
        console.log('  Longs:', longs.length, 'vidéos -', fmt(longsVues), 'vues -', longsEngagement.toFixed(2) + '% engagement');

        subscribersChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Shorts', 'Vidéos longues'],
                datasets: [
                    {
                        label: 'Nombre de vidéos',
                        data: [shorts.length, longs.length],
                        backgroundColor: ['rgba(255, 0, 0, 0.2)', 'rgba(0, 188, 212, 0.2)'],
                        borderColor: ['#FF0000', '#00BCD4'],
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Vues totales',
                        data: [shortsVues, longsVues],
                        backgroundColor: ['rgba(255, 0, 0, 0.5)', 'rgba(0, 188, 212, 0.5)'],
                        borderColor: ['#FF0000', '#00BCD4'],
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += context.datasetIndex === 0 ? context.parsed.y : fmt(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Nombre de vidéos'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Vues'
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: function (value) {
                                return fmt(value);
                            }
                        }
                    }
                }
            }
        });
    }
}

function fmt(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ======================================
// TOP 5 COMMENTAIRES
// ======================================
async function analyzeTopComments(videos) {
    console.log('💬 Analyse top commentaires...');

    const container = document.getElementById('topCommentsContainer');
    if (!container) return;

    try {
        const videoIds = videos.map(v => v.video_id).filter(Boolean);

        if (!videoIds.length) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-comment-slash"></i><p>Aucun commentaire</p></div>';
            return;
        }

        const videoMap = {};
        videos.forEach(v => {
            videoMap[v.video_id] = v.title || 'Vidéo sans titre';
        });

        const { data: comments, error } = await supabase
            .from('comments')
            .select(`
                video_id,
                text,
                like_count,
                published_at,
                author_display_name
            `)
            .in('video_id', videoIds)
            .order('like_count', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-comment"></i><p>Aucun commentaire trouvé</p></div>';
            return;
        }

        container.innerHTML = '';

        comments.forEach((comment, index) => {
            const div = document.createElement('div');
            div.className = 'comment-item';

            const date = comment.published_at
                ? new Date(comment.published_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                })
                : 'Date inconnue';

            div.innerHTML = `
                <div class="comment-top">
                    <div class="comment-rank">#${index + 1}</div>
                    <div class="comment-video-title">${escapeHtml(videoMap[comment.video_id] || 'Vidéo inconnue')}</div>
                    <div class="comment-like-badge">
                        <i class="fas fa-thumbs-up"></i> ${fmt(comment.like_count || 0)}
                    </div>
                </div>

                <div class="comment-meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(comment.author_display_name || 'Auteur inconnu')}</span>
                    <span><i class="fas fa-calendar"></i> ${date}</span>
                </div>

                <div class="comment-text">
                    ${escapeHtml(comment.text || 'Commentaire indisponible')}
                </div>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.error('❌ Erreur top commentaires:', err);
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
    }
}

// ======================================
// TOP CATÉGORIES
// ======================================
async function analyzeCategories(videos) {
    console.log('🏷️ Analyse catégories...');

    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    try {
        if (!videos || videos.length === 0) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-tag"></i><p>Aucune catégorie</p></div>';
            return;
        }

        const categories = {};

        videos.forEach(video => {
            let rawCategories = video.topic_categories;

            if (!rawCategories) return;

            let categoryList = [];

            // Cas 1 : déjà un tableau
            if (Array.isArray(rawCategories)) {
                categoryList = rawCategories;
            }
            // Cas 2 : string JSON
            else if (typeof rawCategories === 'string') {
                try {
                    const parsed = JSON.parse(rawCategories);
                    if (Array.isArray(parsed)) {
                        categoryList = parsed;
                    } else {
                        categoryList = [rawCategories];
                    }
                } catch {
                    categoryList = [rawCategories];
                }
            }

            categoryList.forEach(rawCategory => {
                if (!rawCategory || typeof rawCategory !== 'string') return;

                let category = rawCategory;

                // Si c'est une URL Wikipedia, on récupère juste la fin
                if (rawCategory.includes('/wiki/')) {
                    const parts = rawCategory.split('/wiki/');
                    category = parts[parts.length - 1] || rawCategory;
                }

                // Nettoyage
                category = category.replace(/_/g, ' ');
                category = category.replace(/\(.+\)/, '').trim();

                if (!category) category = 'Non renseignée';

                if (!categories[category]) {
                    categories[category] = 0;
                }

                categories[category] += 1;
            });
        });

        const entries = Object.entries(categories)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (!entries.length) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-tag"></i><p>Aucune catégorie</p></div>';
            return;
        }

        const maxCount = entries[0].count || 1;
        container.innerHTML = '';

        entries.forEach(item => {
            const percentage = (item.count / maxCount) * 100;

            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerHTML = `
                <div class="category-top">
                    <div class="category-name">${escapeHtml(item.name)}</div>
                    <div class="category-count">${fmt(item.count)} vidéo${item.count > 1 ? 's' : ''}</div>
                </div>
                <div class="category-bar">
                    <div class="category-bar-fill" style="width: ${percentage}%;"></div>
                </div>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.error('❌ Erreur catégories:', err);
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
    }
}

// ======================================
// ANALYSE DES SENTIMENTS
// ======================================
async function analyzeSentiments(videos) {
    console.log('💬 Analyse des sentiments...');

    const container = document.getElementById('sentimentsContainer');
    if (!container) return;

    try {
        const videoIds = videos.map(v => v.video_id).filter(Boolean);

        const { data: comments, error } = await supabase
            .from('comments')
            .select('video_id, sentiment_label, sentiment_score, sentiment_confidence')
            .in('video_id', videoIds);

        if (error) throw error;

        console.log('💬 Commentaires récupérés:', comments?.length || 0);

        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-comment"></i><p>Aucun commentaire analysé</p></div>';
            return;
        }

        let positif = 0;
        let neutre = 0;
        let negatif = 0;
        let inconnu = 0;
        let totalScore = 0;
        let totalConfidence = 0;
        let scoreCount = 0;
        let confidenceCount = 0;

        comments.forEach(c => {
            const label = c.sentiment_label?.toLowerCase();

            if (label === 'positive' || label === 'positif') positif++;
            else if (label === 'neutral' || label === 'neutre') neutre++;
            else if (label === 'negative' || label === 'negatif' || label === 'négatif') negatif++;
            else inconnu++;

            if (c.sentiment_score !== null && c.sentiment_score !== undefined) {
                totalScore += c.sentiment_score;
                scoreCount++;
            }

            if (c.sentiment_confidence !== null && c.sentiment_confidence !== undefined) {
                totalConfidence += c.sentiment_confidence;
                confidenceCount++;
            }
        });

        const total = positif + neutre + negatif;
        const avgScore = scoreCount > 0 ? (totalScore / scoreCount) : 0;
        const avgConfidence = confidenceCount > 0 ? (totalConfidence / confidenceCount) : 0;

        const positivePercent = total > 0 ? (positif / total) * 100 : 0;
        const neutralPercent = total > 0 ? (neutre / total) * 100 : 0;
        const negativePercent = total > 0 ? (negatif / total) * 100 : 0;

        let sentimentLabel = 'Globalement neutre';
        let sentimentIcon = 'meh';
        let sentimentClass = 'neutral';

        if (positivePercent >= 60) {
            sentimentLabel = 'Majoritairement positif';
            sentimentIcon = 'smile';
            sentimentClass = 'positive';
        } else if (negativePercent >= 40) {
            sentimentLabel = 'Plutôt négatif';
            sentimentIcon = 'frown';
            sentimentClass = 'negative';
        }

        container.innerHTML = `
            <div class="sentiment-summary">
                <div class="sentiment-score-card">
                    <div class="score-icon ${sentimentClass}">
                        <i class="fas fa-${sentimentIcon}"></i>
                    </div>
                    <div class="score-info">
                        <div class="score-label">Commentaires positifs</div>
                        <div class="score-value">${positivePercent.toFixed(1)}%</div>
                        <div class="score-confidence">${sentimentLabel}</div>
                    </div>
                </div>
            </div>

            <div class="insight-item" style="margin-top: -5px;">
                <i class="fas fa-circle-info insight-icon info"></i>
                <div class="insight-content">
                    <h4>Comment lire cette donnée ?</h4>
                    <p>
                        Ce pourcentage correspond à la part exacte des commentaires classés comme positifs parmi tous les commentaires analysés.
                    </p>
                </div>
            </div>

            <div class="insight-item">
                <i class="fas fa-brain insight-icon primary"></i>
                <div class="insight-content">
                    <h4>Fiabilité de l'analyse</h4>
                    <p>
                        Confiance moyenne du modèle : <strong>${(avgConfidence * 100).toFixed(0)}%</strong><br>
                        Commentaires analysés : <strong>${comments.length.toLocaleString()}</strong><br>
                        Score moyen brut : <strong>${avgScore.toFixed(2)}</strong>
                    </p>
                </div>
            </div>

            <div class="sentiment-breakdown">
                <div class="sentiment-item">
                    <div class="sentiment-header">
                        <i class="fas fa-smile" style="color: #10B981;"></i>
                        <span>Positif</span>
                        <span class="sentiment-percentage">${positivePercent.toFixed(1)}%</span>
                    </div>
                    <div class="sentiment-bar">
                        <div class="sentiment-bar-fill" style="width: ${positivePercent}%; background: #10B981;"></div>
                    </div>
                    <div class="sentiment-count">${positif.toLocaleString()} commentaires</div>
                </div>

                <div class="sentiment-item">
                    <div class="sentiment-header">
                        <i class="fas fa-meh" style="color: #F59E0B;"></i>
                        <span>Neutre</span>
                        <span class="sentiment-percentage">${neutralPercent.toFixed(1)}%</span>
                    </div>
                    <div class="sentiment-bar">
                        <div class="sentiment-bar-fill" style="width: ${neutralPercent}%; background: #F59E0B;"></div>
                    </div>
                    <div class="sentiment-count">${neutre.toLocaleString()} commentaires</div>
                </div>

                <div class="sentiment-item">
                    <div class="sentiment-header">
                        <i class="fas fa-frown" style="color: #EF4444;"></i>
                        <span>Négatif</span>
                        <span class="sentiment-percentage">${negativePercent.toFixed(1)}%</span>
                    </div>
                    <div class="sentiment-bar">
                        <div class="sentiment-bar-fill" style="width: ${negativePercent}%; background: #EF4444;"></div>
                    </div>
                    <div class="sentiment-count">${negatif.toLocaleString()} commentaires</div>
                </div>
            </div>
        `;

    } catch (err) {
        console.error('❌ Erreur sentiments:', err);
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
    }
}

// ======================================
// TOP 5 ABONNÉS / COMMENTATEURS LES PLUS ENGAGÉS
// ======================================
async function analyzeTopSubscribers(videos) {
    console.log('👑 Analyse top abonnés/commentateurs...');

    const container = document.getElementById('topSubscribersContainer');
    if (!container) return;

    try {
        const videoIds = videos.map(v => v.video_id).filter(Boolean);

        if (!videoIds.length) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-users-slash"></i><p>Aucun abonné trouvé</p></div>';
            return;
        }

        const { data: comments, error } = await supabase
            .from('comments')
            .select(`
                video_id,
                author_display_name,
                like_count,
                published_at
            `)
            .in('video_id', videoIds);

        if (error) throw error;

        if (!comments || comments.length === 0) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-users"></i><p>Aucun commentaire trouvé</p></div>';
            return;
        }

        const authors = {};

        comments.forEach(comment => {
            const name = comment.author_display_name?.trim() || 'Anonyme';

            if (!authors[name]) {
                authors[name] = {
                    name,
                    totalLikes: 0,
                    commentCount: 0,
                    lastCommentDate: comment.published_at || null
                };
            }

            authors[name].totalLikes += comment.like_count || 0;
            authors[name].commentCount += 1;

            if (
                comment.published_at &&
                (!authors[name].lastCommentDate || new Date(comment.published_at) > new Date(authors[name].lastCommentDate))
            ) {
                authors[name].lastCommentDate = comment.published_at;
            }
        });

        const topSubscribers = Object.values(authors)
            .map(author => ({
                ...author,
                avgLikes: author.commentCount > 0 ? author.totalLikes / author.commentCount : 0
            }))
            .sort((a, b) => {
                if (b.totalLikes !== a.totalLikes) return b.totalLikes - a.totalLikes;
                return b.commentCount - a.commentCount;
            })
            .slice(0, 5);

        if (!topSubscribers.length) {
            container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-users"></i><p>Aucune donnée</p></div>';
            return;
        }

        container.innerHTML = '';

        topSubscribers.forEach((author, index) => {
            const lastDate = author.lastCommentDate
                ? new Date(author.lastCommentDate).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                })
                : 'Date inconnue';

            const div = document.createElement('div');
            div.className = 'subscriber-item';

            div.innerHTML = `
                <div class="subscriber-top">
                    <div class="subscriber-rank">#${index + 1}</div>
                    <div class="subscriber-name">${escapeHtml(author.name)}</div>
                    <div class="subscriber-like-badge">
                        <i class="fas fa-heart"></i> ${fmt(author.totalLikes)} likes reçus
                    </div>
                </div>

                <div class="subscriber-meta">
                    <span><i class="fas fa-calendar"></i> Dernier commentaire : ${lastDate}</span>
                </div>

                <div class="subscriber-stats">
                    <div class="subscriber-stat">
                        <span class="subscriber-stat-label">Commentaires</span>
                        <span class="subscriber-stat-value">${fmt(author.commentCount)}</span>
                    </div>
                    <div class="subscriber-stat">
                        <span class="subscriber-stat-label">Likes reçus</span>
                        <span class="subscriber-stat-value">${fmt(author.totalLikes)}</span>
                    </div>
                    <div class="subscriber-stat">
                        <span class="subscriber-stat-label">Moy. / commentaire</span>
                        <span class="subscriber-stat-value">${author.avgLikes.toFixed(1)}</span>
                    </div>
                </div>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.error('❌ Erreur top abonnés:', err);
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><p>Erreur de chargement</p></div>';
    }
}

console.log('✅ analytics.js PRÊT');