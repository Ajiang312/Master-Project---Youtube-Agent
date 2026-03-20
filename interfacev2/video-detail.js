let currentChannel = null;
let selectedVideoId = null;
let comparisonChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const channelData = localStorage.getItem('selectedChannel');
    const savedVideoId = localStorage.getItem('selectedVideoId');

    if (!channelData) {
        window.location.href = 'login.html';
        return;
    }

    if (!savedVideoId) {
        showMissingVideoState();
        return;
    }

    currentChannel = JSON.parse(channelData);
    selectedVideoId = savedVideoId;

    await loadVideoDetail();
});

async function loadVideoDetail() {
    const container = document.getElementById('videoDetailContent');

    try {
        const { data: video, error: videoError } = await supabase
            .from('videos')
            .select('*')
            .eq('video_id', selectedVideoId)
            .eq('channel_id', currentChannel.channel_id)
            .single();

        if (videoError) throw videoError;

        const { data: channelVideos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('channel_id', currentChannel.channel_id);

        if (videosError) throw videosError;

        const { data: comments, error: commentsError } = await supabase
            .from('comments')
            .select('*')
            .eq('video_id', selectedVideoId)
            .order('like_count', { ascending: false });

        if (commentsError) {
            console.warn('⚠️ Impossible de charger les commentaires :', commentsError);
        }

        renderVideoDetail(video, channelVideos || [], comments || []);
        createComparisonChart(video, channelVideos || []);
        renderSentimentAnalysis(comments || []);
    } catch (error) {
        console.error('❌ Erreur détail vidéo :', error);
        container.innerHTML = `
            <div class="error-state-detail">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Erreur de chargement</h3>
                <p>Impossible de charger cette vidéo.</p>
            </div>
        `;
    }
}

function renderVideoDetail(video, allVideos, comments) {
    const container = document.getElementById('videoDetailContent');

    if (!video) {
        showMissingVideoState();
        return;
    }

    const thumbnail =
        video.thumbnails?.maxres?.url ||
        video.thumbnails?.high?.url ||
        video.thumbnails?.medium?.url ||
        video.thumbnails?.default?.url ||
        'https://via.placeholder.com/1280x720/FF0000/FFFFFF?text=Video';

    const views = video.view_count || 0;
    const likes = video.like_count || 0;
    const commentCount = video.comment_count || comments.length || 0;
    const engagementRate = views > 0 ? ((likes + commentCount) / views) * 100 : 0;
    const likeRate = views > 0 ? (likes / views) * 100 : 0;
    const channelAvgViews = average(allVideos, 'view_count');
    const shareOfViews = getChannelViewsShare(video, allVideos);
    const performanceScore = Math.round((views * 0.6) + (likes * 8) + (commentCount * 12));

    const viewsRank = getRank(video.video_id, allVideos, 'view_count');
    const likesRank = getRank(video.video_id, allVideos, 'like_count');
    const commentsRank = getRank(video.video_id, allVideos, 'comment_count');

    const topComments = [...comments]
        .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
        .slice(0, 5);

    const tags = normalizeTags(video.tags);
    const topics = normalizeTags(video.topic_categories);
    const allTagChips = [...tags, ...topics].slice(0, 16);

    container.innerHTML = `
        <div class="video-hero-card">
            <div class="video-hero-grid">
                <div class="video-hero-thumbnail">
                    <img src="${thumbnail}" alt="${escapeHtml(video.title || 'Vidéo')}">
                    <div class="video-type-badge">${video.is_short ? 'Short' : 'Vidéo longue'}</div>
                    <div class="video-duration-badge">${formatDuration(video.duration_seconds)}</div>
                </div>

                <div class="video-hero-content">
                    <h1 class="video-hero-title">${escapeHtml(video.title || 'Sans titre')}</h1>

                    <div class="video-meta">
                        <div class="meta-pill">
                            <i class="fas fa-calendar"></i>
                            ${formatDate(video.published_at)}
                        </div>
                        <div class="meta-pill">
                            <i class="fas fa-eye"></i>
                            ${formatNumber(views)} vues
                        </div>
                        <div class="meta-pill">
                            <i class="fas fa-users"></i>
                            ${formatNumber(video.subscriber_count || 0)} abonnés au moment du snapshot
                        </div>
                        <div class="meta-pill">
                            <i class="fas fa-chart-line"></i>
                            ${channelAvgViews > 0 ? percentDiff(views, channelAvgViews) : '0%'} vs moyenne chaîne
                        </div>
                    </div>

                    <div class="video-description-box">
                        <h3>Description</h3>
                        <p>${video.description ? escapeHtml(video.description) : 'Aucune description disponible.'}</p>
                    </div>

                    <div class="tags-block">
                        <div class="tags-title">Tags & catégories</div>
                        <div class="tags-list">
                            ${
                                allTagChips.length > 0
                                    ? allTagChips.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')
                                    : `<span class="tag-chip">Aucun tag</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="stats-grid-detail">
            <div class="detail-stat-card">
                <div class="detail-stat-header">
                    <span class="detail-stat-label">Vues</span>
                    <div class="detail-stat-icon red"><i class="fas fa-eye"></i></div>
                </div>
                <div class="detail-stat-value">${formatNumber(views)}</div>
                <div class="detail-stat-subtext">Part des vues de la chaîne : ${shareOfViews.toFixed(1)}%</div>
            </div>

            <div class="detail-stat-card">
                <div class="detail-stat-header">
                    <span class="detail-stat-label">Likes</span>
                    <div class="detail-stat-icon green"><i class="fas fa-thumbs-up"></i></div>
                </div>
                <div class="detail-stat-value">${formatNumber(likes)}</div>
                <div class="detail-stat-subtext">Like rate : ${likeRate.toFixed(2)}%</div>
            </div>

            <div class="detail-stat-card">
                <div class="detail-stat-header">
                    <span class="detail-stat-label">Commentaires</span>
                    <div class="detail-stat-icon cyan"><i class="fas fa-comment"></i></div>
                </div>
                <div class="detail-stat-value">${formatNumber(commentCount)}</div>
                <div class="detail-stat-subtext">Top commentaires affichés en bas</div>
            </div>

            <div class="detail-stat-card">
                <div class="detail-stat-header">
                    <span class="detail-stat-label">Engagement</span>
                    <div class="detail-stat-icon purple"><i class="fas fa-bolt"></i></div>
                </div>
                <div class="detail-stat-value">${engagementRate.toFixed(2)}%</div>
                <div class="detail-stat-subtext">(likes + commentaires) / vues</div>
            </div>

            <div class="detail-stat-card">
                <div class="detail-stat-header">
                    <span class="detail-stat-label">Score performance</span>
                    <div class="detail-stat-icon orange"><i class="fas fa-trophy"></i></div>
                </div>
                <div class="detail-stat-value">${formatNumber(performanceScore)}</div>
                <div class="detail-stat-subtext">Score simple pour comparer les vidéos</div>
            </div>
        </div>

        <div class="detail-grid">
            <div>
                <div class="detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-chart-bar"></i>
                        <h3>Comparaison avec la moyenne de la chaîne</h3>
                    </div>
                    <div class="chart-container-detail">
                        <canvas id="comparisonChart"></canvas>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-comments"></i>
                        <h3>Top 5 commentaires de la vidéo</h3>
                    </div>
                    <div class="comments-list">
                        ${
                            topComments.length > 0
                                ? topComments.map(comment => `
                                    <div class="comment-item">
                                        <div class="comment-top">
                                            <div>
                                                <div class="comment-author">${escapeHtml(comment.author_display_name || 'Utilisateur')}</div>
                                                <div class="comment-date">${formatDate(comment.published_at)}</div>
                                            </div>
                                        </div>
                                        <div class="comment-text">${escapeHtml(comment.text || 'Commentaire indisponible')}</div>
                                        <div class="comment-stats">
                                            <span><i class="fas fa-thumbs-up"></i> ${formatNumber(comment.like_count || 0)} likes</span>
                                            <span><i class="fas fa-hashtag"></i> ${escapeHtml(comment.sentiment_label || 'sentiment non défini')}</span>
                                        </div>
                                    </div>
                                `).join('')
                                : `
                                    <div class="empty-state-detail" style="padding: 30px 10px;">
                                        <i class="fas fa-comment-slash"></i>
                                        <p>Aucun commentaire disponible pour cette vidéo.</p>
                                    </div>
                                `
                        }
                    </div>
                </div>
            </div>

            <div>
                <div class="detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-ranking-star"></i>
                        <h3>Classement dans la chaîne</h3>
                    </div>
                    <div class="ranking-list">
                        <div class="ranking-item">
                            <div class="ranking-item-left">
                                <div class="ranking-icon"><i class="fas fa-eye"></i></div>
                                <div>
                                    <div class="ranking-label">Classement en vues</div>
                                    <div class="ranking-sub">Parmi ${allVideos.length} vidéos</div>
                                </div>
                            </div>
                            <div class="ranking-value">#${viewsRank}</div>
                        </div>

                        <div class="ranking-item">
                            <div class="ranking-item-left">
                                <div class="ranking-icon"><i class="fas fa-thumbs-up"></i></div>
                                <div>
                                    <div class="ranking-label">Classement en likes</div>
                                    <div class="ranking-sub">Parmi ${allVideos.length} vidéos</div>
                                </div>
                            </div>
                            <div class="ranking-value">#${likesRank}</div>
                        </div>

                        <div class="ranking-item">
                            <div class="ranking-item-left">
                                <div class="ranking-icon"><i class="fas fa-comment"></i></div>
                                <div>
                                    <div class="ranking-label">Classement en commentaires</div>
                                    <div class="ranking-sub">Parmi ${allVideos.length} vidéos</div>
                                </div>
                            </div>
                            <div class="ranking-value">#${commentsRank}</div>
                        </div>

                        <div class="ranking-item">
                            <div class="ranking-item-left">
                                <div class="ranking-icon"><i class="fas fa-percent"></i></div>
                                <div>
                                    <div class="ranking-label">Écart à la moyenne</div>
                                    <div class="ranking-sub">Basé sur les vues</div>
                                </div>
                            </div>
                            <div class="ranking-value">${channelAvgViews > 0 ? percentDiff(views, channelAvgViews) : '0%'}</div>
                        </div>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-face-smile"></i>
                        <h3>Analyse des sentiments</h3>
                    </div>
                    <div id="videoSentimentContainer" class="video-sentiments-container">
                        <div class="loading-state" style="padding: 20px 10px;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Analyse des sentiments en cours...</p>
                        </div>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-card-header">
                        <i class="fas fa-lightbulb"></i>
                        <h3>Résumé rapide</h3>
                    </div>
                    <div class="ranking-list">
                        <div class="ranking-item">
                            <div>
                                <div class="ranking-label">Format</div>
                                <div class="ranking-sub">${video.is_short ? 'Short' : 'Vidéo longue'}</div>
                            </div>
                            <div class="ranking-value">${formatDuration(video.duration_seconds)}</div>
                        </div>

                        <div class="ranking-item">
                            <div>
                                <div class="ranking-label">Publication</div>
                                <div class="ranking-sub">${formatDate(video.published_at)}</div>
                            </div>
                            <div class="ranking-value">${timeAgo(video.published_at)}</div>
                        </div>

                        <div class="ranking-item">
                            <div>
                                <div class="ranking-label">Commentaires réels</div>
                                <div class="ranking-sub">Depuis la table comments</div>
                            </div>
                            <div class="ranking-value">${formatNumber(comments.length)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createComparisonChart(video, allVideos) {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;

    const avgViews = average(allVideos, 'view_count');
    const avgLikes = average(allVideos, 'like_count');
    const avgComments = average(allVideos, 'comment_count');

    const selectedViews = video.view_count || 0;
    const selectedLikes = video.like_count || 0;
    const selectedComments = video.comment_count || 0;

    const selectedEngagement = selectedViews > 0
        ? ((selectedLikes + selectedComments) / selectedViews) * 100
        : 0;

    const avgEngagement = avgViews > 0
        ? ((avgLikes + avgComments) / avgViews) * 100
        : 0;

    if (comparisonChart) comparisonChart.destroy();

    comparisonChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['Vues', 'Likes', 'Commentaires', 'Engagement %'],
            datasets: [
                {
                    label: 'Cette vidéo',
                    data: [selectedViews, selectedLikes, selectedComments, selectedEngagement]
                },
                {
                    label: 'Moyenne chaîne',
                    data: [avgViews, avgLikes, avgComments, avgEngagement]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            borderRadius: 8,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            if (context.dataIndex === 3) {
                                return `${label}: ${Number(value).toFixed(2)}%`;
                            }
                            return `${label}: ${formatNumber(value)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

function renderSentimentAnalysis(comments) {
    const container = document.getElementById('videoSentimentContainer');
    if (!container) return;

    if (!comments || comments.length === 0) {
        container.innerHTML = `
            <div class="empty-state-detail" style="padding: 20px 10px;">
                <i class="fas fa-comment-slash"></i>
                <p>Aucun commentaire disponible pour analyser le sentiment.</p>
            </div>
        `;
        return;
    }

    let positif = 0;
    let neutre = 0;
    let negatif = 0;
    let inconnu = 0;
    let totalScore = 0;
    let totalConfidence = 0;
    let scoredComments = 0;
    let confidenceComments = 0;

    comments.forEach(comment => {
        const label = (comment.sentiment_label || '').toLowerCase();

        if (label === 'positive' || label === 'positif') {
            positif++;
        } else if (label === 'neutral' || label === 'neutre') {
            neutre++;
        } else if (label === 'negative' || label === 'negatif' || label === 'négatif') {
            negatif++;
        } else {
            inconnu++;
        }

        if (comment.sentiment_score !== null && comment.sentiment_score !== undefined) {
            totalScore += Number(comment.sentiment_score) || 0;
            scoredComments++;
        }

        if (comment.sentiment_confidence !== null && comment.sentiment_confidence !== undefined) {
            totalConfidence += Number(comment.sentiment_confidence) || 0;
            confidenceComments++;
        }
    });

    const totalKnown = positif + neutre + negatif;
    const totalComments = comments.length;

    const avgScore = scoredComments > 0 ? totalScore / scoredComments : 0;
    const avgConfidence = confidenceComments > 0 ? totalConfidence / confidenceComments : 0;

    const positivePct = totalKnown > 0 ? (positif / totalKnown) * 100 : 0;
    const neutralPct = totalKnown > 0 ? (neutre / totalKnown) * 100 : 0;
    const negativePct = totalKnown > 0 ? (negatif / totalKnown) * 100 : 0;

    let scoreClass = 'negative';
    let scoreIcon = 'frown';
    let scoreLabel = 'Plutôt négatif';

    if (avgScore > 0.5) {
        scoreClass = 'positive';
        scoreIcon = 'smile';
        scoreLabel = 'Plutôt positif';
    } else if (avgScore > 0) {
        scoreClass = 'neutral';
        scoreIcon = 'meh';
        scoreLabel = 'Plutôt neutre';
    }

    container.innerHTML = `
        <div class="sentiment-summary">
            <div class="sentiment-score-card">
                <div class="score-icon ${scoreClass}">
                    <i class="fas fa-${scoreIcon}"></i>
                </div>
                <div class="score-info">
                    <div class="score-label">Tonalité générale</div>
                    <div class="score-value">${avgScore.toFixed(2)}</div>
                    <div class="score-confidence">Confiance moyenne : ${(avgConfidence * 100).toFixed(0)}%</div>
                    <div class="score-explanation">${scoreLabel}</div>
                </div>
            </div>
        </div>

        <div class="sentiment-breakdown">
            <div class="sentiment-item">
                <div class="sentiment-header">
                    <i class="fas fa-smile" style="color: #10B981;"></i>
                    <span>Positif</span>
                    <span class="sentiment-percentage">${positivePct.toFixed(1)}%</span>
                </div>
                <div class="sentiment-bar">
                    <div class="sentiment-bar-fill" style="width: ${positivePct}%; background: #10B981;"></div>
                </div>
                <div class="sentiment-count">${positif.toLocaleString()} commentaires</div>
            </div>

            <div class="sentiment-item">
                <div class="sentiment-header">
                    <i class="fas fa-meh" style="color: #F59E0B;"></i>
                    <span>Neutre</span>
                    <span class="sentiment-percentage">${neutralPct.toFixed(1)}%</span>
                </div>
                <div class="sentiment-bar">
                    <div class="sentiment-bar-fill" style="width: ${neutralPct}%; background: #F59E0B;"></div>
                </div>
                <div class="sentiment-count">${neutre.toLocaleString()} commentaires</div>
            </div>

            <div class="sentiment-item">
                <div class="sentiment-header">
                    <i class="fas fa-frown" style="color: #EF4444;"></i>
                    <span>Négatif</span>
                    <span class="sentiment-percentage">${negativePct.toFixed(1)}%</span>
                </div>
                <div class="sentiment-bar">
                    <div class="sentiment-bar-fill" style="width: ${negativePct}%; background: #EF4444;"></div>
                </div>
                <div class="sentiment-count">${negatif.toLocaleString()} commentaires</div>
            </div>
        </div>

        <div class="sentiment-mini-stats">
            <div class="sentiment-mini-stat">
                <div class="sentiment-mini-stat-label">Commentaires analysés</div>
                <div class="sentiment-mini-stat-value">${totalComments.toLocaleString()}</div>
            </div>

            <div class="sentiment-mini-stat">
                <div class="sentiment-mini-stat-label">Commentaires sans sentiment reconnu</div>
                <div class="sentiment-mini-stat-value">${inconnu.toLocaleString()}</div>
            </div>
        </div>
    `;
}

function goBackToVideos() {
    window.location.href = 'videos.html';
}

function showMissingVideoState() {
    const container = document.getElementById('videoDetailContent');
    container.innerHTML = `
        <div class="empty-state-detail">
            <i class="fas fa-video-slash"></i>
            <h3>Aucune vidéo sélectionnée</h3>
            <p>Retournez sur la page vidéos puis cliquez sur une vidéo.</p>
        </div>
    `;
}

function average(items, key) {
    if (!items || items.length === 0) return 0;
    const total = items.reduce((sum, item) => sum + (item[key] || 0), 0);
    return total / items.length;
}

function getRank(videoId, videos, key) {
    const sorted = [...videos].sort((a, b) => (b[key] || 0) - (a[key] || 0));
    const index = sorted.findIndex(v => v.video_id === videoId);
    return index >= 0 ? index + 1 : '-';
}

function getChannelViewsShare(video, videos) {
    const totalViews = videos.reduce((sum, v) => sum + (v.view_count || 0), 0);
    if (!totalViews) return 0;
    return ((video.view_count || 0) / totalViews) * 100;
}

function normalizeTags(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        return value
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
    }
    return [];
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
}

function formatDate(dateString) {
    if (!dateString) return 'Date inconnue';
    return new Date(dateString).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function timeAgo(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return "Aujourd'hui";
    if (days === 1) return 'Il y a 1 jour';
    if (days < 30) return `Il y a ${days} jours`;
    if (days < 365) return `Il y a ${Math.floor(days / 30)} mois`;
    return `Il y a ${Math.floor(days / 365)} an(s)`;
}

function percentDiff(value, averageValue) {
    if (!averageValue) return '0%';
    const diff = ((value - averageValue) / averageValue) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}%`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}