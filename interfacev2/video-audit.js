let currentChannel = null;
let currentVideoId = null;
let currentVideo = null;
let allChannelVideos = [];

document.addEventListener('DOMContentLoaded', async () => {
    const channelData = localStorage.getItem('selectedChannel');

    if (!channelData) {
        window.location.href = 'login.html';
        return;
    }

    currentChannel = JSON.parse(channelData);

    const params = new URLSearchParams(window.location.search);
    currentVideoId = params.get('video_id');

    if (!currentVideoId) {
        showAuditError("Aucune vidéo sélectionnée.");
        return;
    }

    setupDetailButton();

    await loadAuditPage();
});

function setupDetailButton() {
    const detailsButton = document.getElementById('detailsButton');
    if (!detailsButton) return;

    detailsButton.addEventListener('click', () => {
        window.location.href = `video-detail.html?video_id=${encodeURIComponent(currentVideoId)}`;
    });
}

async function loadAuditPage() {
    try {
        const { data: video, error: videoError } = await supabase
            .from('videos')
            .select('*')
            .eq('video_id', currentVideoId)
            .single();

        if (videoError || !video) {
            throw new Error('Vidéo introuvable');
        }

        currentVideo = video;

        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('*')
            .eq('channel_id', currentChannel.channel_id);

        if (videosError) {
            throw videosError;
        }

        allChannelVideos = videos || [];

        renderAudit(video, allChannelVideos);
    } catch (error) {
        console.error('Erreur audit vidéo:', error);
        showAuditError("Impossible de charger l'audit de cette vidéo.");
    }
}

function renderAudit(video, videos) {
    const container = document.getElementById('auditContent');
    if (!container) return;

    const score = calculateVideoScore(video, videos);
    const channelAverages = calculateChannelAverages(videos);
    const strengths = buildStrengths(video, channelAverages);
    const weaknesses = buildWeaknesses(video, channelAverages);
    const actions = buildActions(video, channelAverages);
    const comparisons = buildComparisons(video, channelAverages);

    const thumbnail = getVideoThumbnail(video);
    const duration = formatDuration(video.duration_seconds || 0);
    const publishedDate = video.published_at
        ? new Date(video.published_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
        : 'Date inconnue';

    const typeLabel = video.is_short ? 'Short' : 'Vidéo longue';
    const typeClass = video.is_short ? 'short' : 'long';

    container.innerHTML = `
        <section class="audit-hero">
            <div class="audit-hero-content">
                <div class="audit-thumbnail">
                    <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(video.title || 'Vidéo')}">
                    <div class="audit-type-badge ${typeClass}">${typeLabel}</div>
                    ${duration !== '0:00' ? `<div class="audit-duration">${duration}</div>` : ''}
                </div>

                <div class="audit-hero-info">
                    <div class="audit-label">
                        <i class="fas fa-wand-magic-sparkles"></i>
                        Audit IA de la vidéo
                    </div>

                    <h1 class="audit-title">${escapeHtml(video.title || 'Sans titre')}</h1>

                    <div class="audit-meta">
                        <span><i class="fas fa-calendar"></i> ${publishedDate}</span>
                        <span><i class="fas fa-video"></i> ${typeLabel}</span>
                        <span><i class="fas fa-eye"></i> ${formatNumber(video.view_count || 0)} vues</span>
                        <span><i class="fas fa-thumbs-up"></i> ${formatNumber(video.like_count || 0)} likes</span>
                        <span><i class="fas fa-comment"></i> ${formatNumber(video.comment_count || 0)} commentaires</span>
                    </div>

                    <p class="audit-description">
                        ${escapeHtml((video.description || 'Aucune description disponible.').slice(0, 350))}
                        ${video.description && video.description.length > 350 ? '...' : ''}
                    </p>
                </div>
            </div>
        </section>

        <section class="audit-grid metrics">
            <div class="audit-card metric-card">
                <div class="metric-label">Vues</div>
                <div class="metric-value">${formatNumber(video.view_count || 0)}</div>
                <div class="metric-subtext">Performance brute de la vidéo</div>
            </div>

            <div class="audit-card metric-card">
                <div class="metric-label">Likes</div>
                <div class="metric-value">${formatNumber(video.like_count || 0)}</div>
                <div class="metric-subtext">Réaction positive du public</div>
            </div>

            <div class="audit-card metric-card">
                <div class="metric-label">Commentaires</div>
                <div class="metric-value">${formatNumber(video.comment_count || 0)}</div>
                <div class="metric-subtext">Niveau de conversation généré</div>
            </div>

            <div class="audit-card metric-card">
                <div class="metric-label">Engagement estimé</div>
                <div class="metric-value">${score.engagementRate}%</div>
                <div class="metric-subtext">Likes + commentaires / vues</div>
            </div>
        </section>

        <section class="audit-grid cards-2">
            <div class="audit-card">
                <div class="audit-card-header">
                    <i class="fas fa-star"></i>
                    <h3>Score global</h3>
                </div>

                <div class="score-card">
                    <div class="score-circle" style="background:${score.color};">
                        ${score.value}
                    </div>

                    <div class="score-info">
                        <h2>${score.label}</h2>
                        <p>${score.description}</p>

                        <div class="score-badges">
                            <span class="score-badge ${score.engagementBadgeClass}">
                                Engagement ${score.engagementBadgeText}
                            </span>
                            <span class="score-badge ${score.potentialBadgeClass}">
                                Potentiel ${score.potentialBadgeText}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="audit-card">
                <div class="audit-card-header">
                    <i class="fas fa-scale-balanced"></i>
                    <h3>Comparaison avec la chaîne</h3>
                </div>

                <div class="compare-list">
                    ${comparisons.map(item => `
                        <div class="compare-item">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.text)}</p>
                            <div class="compare-value">${escapeHtml(item.value)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <section class="audit-grid cards-2">
            <div class="audit-card">
                <div class="audit-card-header">
                    <i class="fas fa-circle-check"></i>
                    <h3>Ce qui marche bien</h3>
                </div>

                <div class="insight-list">
                    ${strengths.map(item => `
                        <div class="insight-item">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.text)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="audit-card">
                <div class="audit-card-header">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h3>À améliorer</h3>
                </div>

                <div class="insight-list">
                    ${weaknesses.map(item => `
                        <div class="insight-item">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.text)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>

        <section class="audit-grid cards-1-2">
            <div class="audit-card">
                <div class="audit-card-header">
                    <i class="fas fa-list-check"></i>
                    <h3>Actions recommandées</h3>
                </div>

                <div class="action-list">
                    ${actions.map(item => `
                        <div class="action-item">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.text)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="audit-card">
                <div class="audit-card-header">
                    <i class="fas fa-lightbulb"></i>
                    <h3>Pistes de relance</h3>
                </div>

                <div class="action-list">
                    ${buildRelaunchIdeas(video).map(item => `
                        <div class="action-item">
                            <strong>${escapeHtml(item.title)}</strong>
                            <p>${escapeHtml(item.text)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>
    `;
}

function calculateChannelAverages(videos) {
    if (!videos || videos.length === 0) {
        return {
            avgViews: 0,
            avgLikes: 0,
            avgComments: 0,
            avgEngagement: 0
        };
    }

    const totals = videos.reduce((acc, video) => {
        const views = video.view_count || 0;
        const likes = video.like_count || 0;
        const comments = video.comment_count || 0;
        const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;

        acc.views += views;
        acc.likes += likes;
        acc.comments += comments;
        acc.engagement += engagement;
        return acc;
    }, { views: 0, likes: 0, comments: 0, engagement: 0 });

    return {
        avgViews: totals.views / videos.length,
        avgLikes: totals.likes / videos.length,
        avgComments: totals.comments / videos.length,
        avgEngagement: totals.engagement / videos.length
    };
}

function calculateVideoScore(video, videos) {
    const averages = calculateChannelAverages(videos);

    const views = video.view_count || 0;
    const likes = video.like_count || 0;
    const comments = video.comment_count || 0;
    const engagement = views > 0 ? (((likes + comments) / views) * 100) : 0;

    const viewsScore = averages.avgViews > 0 ? Math.min(100, (views / averages.avgViews) * 40) : 20;
    const likesScore = averages.avgLikes > 0 ? Math.min(100, (likes / averages.avgLikes) * 30) : 15;
    const commentsScore = averages.avgComments > 0 ? Math.min(100, (comments / averages.avgComments) * 20) : 10;
    const engagementScore = averages.avgEngagement > 0 ? Math.min(100, (engagement / averages.avgEngagement) * 10) : 5;

    const value = Math.round(
        (viewsScore * 0.4) +
        (likesScore * 0.25) +
        (commentsScore * 0.15) +
        (engagementScore * 0.2)
    );

    let label = 'À surveiller';
    let description = "Cette vidéo a un potentiel correct, mais elle peut être mieux exploitée ou optimisée.";
    let color = '#F59E0B';

    if (value >= 85) {
        label = 'Excellente performance';
        description = "Cette vidéo fait partie des contenus forts de la chaîne. Elle mérite d’être réutilisée ou prolongée.";
        color = '#10B981';
    } else if (value >= 70) {
        label = 'Bonne performance';
        description = "Cette vidéo fonctionne bien. Quelques optimisations peuvent encore améliorer ses résultats.";
        color = '#22C55E';
    } else if (value >= 50) {
        label = 'Performance moyenne';
        description = "La vidéo est correcte, mais elle ne se démarque pas encore assez du reste de la chaîne.";
        color = '#F59E0B';
    } else {
        label = 'Performance faible';
        description = "La vidéo semble sous-performer. Il faut envisager des ajustements ou une relance sous un autre angle.";
        color = '#EF4444';
    }

    return {
        value,
        label,
        description,
        color,
        engagementRate: engagement.toFixed(2),
        engagementBadgeClass: engagement >= averages.avgEngagement ? 'good' : 'medium',
        engagementBadgeText: engagement >= averages.avgEngagement ? 'bon' : 'à travailler',
        potentialBadgeClass: value >= 70 ? 'good' : value >= 50 ? 'medium' : 'low',
        potentialBadgeText: value >= 70 ? 'élevé' : value >= 50 ? 'moyen' : 'faible'
    };
}

function buildStrengths(video, averages) {
    const items = [];
    const views = video.view_count || 0;
    const likes = video.like_count || 0;
    const comments = video.comment_count || 0;
    const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;

    if (views >= averages.avgViews) {
        items.push({
            title: 'Volume de vues solide',
            text: "Cette vidéo dépasse ou atteint la moyenne de vues de la chaîne, ce qui indique un sujet ou un angle intéressant."
        });
    }

    if (engagement >= averages.avgEngagement) {
        items.push({
            title: 'Engagement au-dessus de la moyenne',
            text: "Le ratio likes + commentaires / vues est bon, ce qui veut dire que le public réagit bien à ce contenu."
        });
    }

    if (comments >= averages.avgComments) {
        items.push({
            title: 'Capacité à créer de la discussion',
            text: "Le nombre de commentaires montre que la vidéo suscite des réactions ou donne envie de répondre."
        });
    }

    if (video.is_short) {
        items.push({
            title: 'Format court facilement réexploitable',
            text: "Comme c’est un Short, tu peux plus facilement en décliner une suite, une version 2 ou une variation du même concept."
        });
    } else {
        items.push({
            title: 'Sujet exploitable en contenu complémentaire',
            text: "Comme c’est une vidéo longue, elle peut servir de base pour des Shorts, extraits, résumés ou suites."
        });
    }

    if (items.length === 0) {
        items.push({
            title: 'Base exploitable',
            text: "Même si la vidéo ne surperforme pas, elle fournit déjà des données utiles pour tester un autre titre, angle ou format."
        });
    }

    return items.slice(0, 4);
}

function buildWeaknesses(video, averages) {
    const items = [];
    const views = video.view_count || 0;
    const likes = video.like_count || 0;
    const comments = video.comment_count || 0;
    const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;
    const titleLength = (video.title || '').length;

    if (views < averages.avgViews) {
        items.push({
            title: 'Portée plus faible que la moyenne',
            text: "Cette vidéo attire moins de vues que la moyenne de la chaîne. Le sujet, le titre ou la miniature peuvent freiner le clic."
        });
    }

    if (engagement < averages.avgEngagement) {
        items.push({
            title: 'Engagement perfectible',
            text: "Les interactions sont en dessous de la moyenne. Le contenu plaît peut-être moins ou n’incite pas assez à réagir."
        });
    }

    if (comments < averages.avgComments) {
        items.push({
            title: 'Peu de conversation générée',
            text: "La vidéo ne déclenche pas beaucoup de commentaires. Ajouter une question claire ou un appel à l’action pourrait aider."
        });
    }

    if (titleLength < 25) {
        items.push({
            title: 'Titre possiblement trop court',
            text: "Le titre semble assez court. Il peut manquer d’accroche, de précision ou de promesse claire pour donner envie de cliquer."
        });
    } else if (titleLength > 75) {
        items.push({
            title: 'Titre possiblement trop long',
            text: "Le titre est assez long. Il peut perdre en impact visuel ou en lisibilité, surtout sur mobile."
        });
    }

    if (items.length === 0) {
        items.push({
            title: 'Pas de faiblesse majeure détectée',
            text: "La vidéo est globalement équilibrée. L’enjeu principal est surtout de capitaliser davantage sur ce qui fonctionne déjà."
        });
    }

    return items.slice(0, 4);
}

function buildActions(video, averages) {
    const items = [];
    const views = video.view_count || 0;
    const likes = video.like_count || 0;
    const comments = video.comment_count || 0;
    const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;

    if (views < averages.avgViews) {
        items.push({
            title: 'Tester un nouveau titre',
            text: "Essaie une version plus directe, plus intrigante ou plus orientée bénéfice pour augmenter le taux de clic."
        });
    }

    items.push({
        title: 'Retravailler la miniature',
        text: "Une miniature plus contrastée, plus lisible et avec un point focal fort peut améliorer l’attractivité de la vidéo."
    });

    if (engagement < averages.avgEngagement) {
        items.push({
            title: 'Renforcer le call-to-action',
            text: "Ajoute une question en fin de vidéo ou en commentaire épinglé pour inciter davantage aux réponses et aux likes."
        });
    }

    if (!video.is_short) {
        items.push({
            title: 'Extraire 1 à 3 Shorts',
            text: "Transforme les meilleurs passages en extraits courts pour relancer le sujet et ramener du trafic vers la vidéo longue."
        });
    } else {
        items.push({
            title: 'Créer une version longue ou une suite',
            text: "Si le sujet est intéressant, développe-le dans une vidéo plus complète ou une série de Shorts liés."
        });
    }

    items.push({
        title: 'Réutiliser le thème',
        text: "Si le sujet est proche d’un thème déjà performant, refais-le sous un autre angle : erreurs à éviter, astuces, version mise à jour, comparatif."
    });

    return items.slice(0, 5);
}

function buildComparisons(video, averages) {
    const views = video.view_count || 0;
    const likes = video.like_count || 0;
    const comments = video.comment_count || 0;
    const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0;

    return [
        {
            title: 'Vues vs moyenne chaîne',
            text: 'Positionnement de cette vidéo face à la moyenne de la chaîne.',
            value: formatComparisonPercent(views, averages.avgViews)
        },
        {
            title: 'Likes vs moyenne chaîne',
            text: 'Mesure de la réaction positive par rapport au reste des contenus.',
            value: formatComparisonPercent(likes, averages.avgLikes)
        },
        {
            title: 'Commentaires vs moyenne chaîne',
            text: 'Capacité de la vidéo à déclencher des échanges.',
            value: formatComparisonPercent(comments, averages.avgComments)
        },
        {
            title: 'Engagement vs moyenne chaîne',
            text: 'Comparaison du ratio interactions / vues.',
            value: formatComparisonPercent(engagement, averages.avgEngagement)
        }
    ];
}

function buildRelaunchIdeas(video) {
    const title = video.title || 'cette vidéo';

    const ideas = [
        {
            title: 'Refaire le sujet sous un autre angle',
            text: `Tu peux reprendre "${title}" avec une promesse différente, un format plus direct ou une meilleure accroche.`
        },
        {
            title: 'Créer une suite',
            text: "Transforme la vidéo en série : partie 2, erreurs fréquentes, version avancée, mise à jour, ou FAQ."
        },
        {
            title: 'Publier un extrait sur un autre format',
            text: "Découpe les meilleurs moments pour faire un Short, un teaser ou une vidéo d’appel."
        },
        {
            title: 'Relancer via le commentaire épinglé',
            text: "Ajoute un commentaire épinglé qui pose une question ou renvoie vers une autre vidéo liée."
        }
    ];

    return ideas;
}

function formatComparisonPercent(value, average) {
    if (!average || average <= 0) return 'Donnée insuffisante';

    const ratio = ((value - average) / average) * 100;
    const prefix = ratio >= 0 ? '+' : '';
    return `${prefix}${ratio.toFixed(1)}%`;
}

function getVideoThumbnail(video) {
    const thumbs = video?.thumbnails;

    if (!thumbs) {
        return 'https://via.placeholder.com/640x360/FF0000/FFFFFF?text=Video';
    }

    if (typeof thumbs === 'string') return thumbs;
    if (thumbs.maxres?.url) return thumbs.maxres.url;
    if (thumbs.high?.url) return thumbs.high.url;
    if (thumbs.medium?.url) return thumbs.medium.url;
    if (thumbs.default?.url) return thumbs.default.url;
    if (thumbs.url) return thumbs.url;

    return 'https://via.placeholder.com/640x360/FF0000/FFFFFF?text=Video';
}

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return new Intl.NumberFormat('fr-FR').format(num);
}

function showAuditError(message) {
    const container = document.getElementById('auditContent');
    if (!container) return;

    container.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
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