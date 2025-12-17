// supabase-config.js - Configuration Supabase

// Remplacez ces valeurs par vos clés Supabase
// Vous les trouveez dans : Settings > API de votre projet Supabase
const SUPABASE_URL = 'https://rtztgwuqzaoytkyencei.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0enRnd3VxemFveXRreWVuY2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzEwODQsImV4cCI6MjA3ODM0NzA4NH0.bwFTvxRYJGGJag4SI1TVk8i0bjb-xiA4rhcmM6SR3PY'; // À récupérer depuis Supabase

// Vérification de la configuration
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'VOTRE_CLE_ANON_KEY_ICI') {
    console.error('⚠️ ATTENTION: La clé Supabase n\'est pas configurée !');
    console.error('📝 Veuillez éditer supabase-config.js et remplacer SUPABASE_ANON_KEY par votre vraie clé');
    console.error('🔗 Trouvez votre clé ici: https://supabase.com/dashboard/project/rtztgwuqzaoytkyencei/settings/api');
}

// Vérifier que la bibliothèque Supabase est chargée
if (typeof window.supabase === 'undefined') {
    console.error('❌ La bibliothèque Supabase n\'est pas chargée !');
    console.error('Vérifiez que cette ligne est présente dans votre HTML:');
    console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
} else {
    console.log('✅ Bibliothèque Supabase chargée avec succès');
}

// Initialisation du client Supabase
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Client Supabase initialisé');
} catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de Supabase:', error);
}

// Fonctions pour récupérer les données

// Récupérer les statistiques des chaînes
async function getChannelStats() {
    try {
        const { data, error } = await supabase
            .from('channels')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur lors de la récupération des channels:', error);
        return null;
    }
}

// Récupérer toutes les vidéos
async function getVideos() {
    try {
        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur lors de la récupération des vidéos:', error);
        return null;
    }
}

// Récupérer les vidéos d'une chaîne spécifique
async function getVideosByChannel(channelId) {
    try {
        const { data, error } = await supabase
            .from('videos')
            .select('*')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur:', error);
        return null;
    }
}

// Récupérer les commentaires d'une vidéo
async function getCommentsByVideo(videoId) {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('video_id', videoId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur:', error);
        return null;
    }
}

// Récupérer les transcriptions
async function getTranscripts() {
    try {
        const { data, error } = await supabase
            .from('transcripts')
            .select('*');
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur:', error);
        return null;
    }
}

// Récupérer les jobs de transcription
async function getTranscriptJobs() {
    try {
        const { data, error } = await supabase
            .from('transcript_jobs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur:', error);
        return null;
    }
}

// Calculer les statistiques pour le dashboard d'une chaîne spécifique
async function calculateDashboardStats(channelId) {
    try {
        // 1. Récupérer les infos de la chaîne (subscriber_count, view_count, video_count)
        const { data: channel, error: channelError } = await supabase
            .from('channels')
            .select('subscriber_count, view_count, video_count, channel_id')
            .eq('channel_id', channelId)
            .single();
        
        if (channelError) {
            console.error('❌ Erreur channel:', channelError);
            throw channelError;
        }
        
        console.log('📊 Données channel:', channel);
        
        // 2. Récupérer toutes les vidéos de cette chaîne pour calculer le total de likes
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('like_count')
            .eq('channel_id', channelId);
        
        if (videosError) {
            console.error('❌ Erreur videos:', videosError);
            throw videosError;
        }
        
        console.log('📹 Vidéos trouvées:', videos.length);
        
        // 3. Calculer le total des likes de toutes les vidéos
        const totalLikes = videos.reduce((sum, video) => sum + (video.like_count || 0), 0);
        
        // Formater les nombres
        const formatNumber = (num) => {
            if (!num) return '0';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        };
        
        return {
            subscriberCount: formatNumber(channel.subscriber_count || 0),
            videoCount: formatNumber(channel.video_count || 0),
            viewCount: formatNumber(channel.view_count || 0),
            totalLikes: formatNumber(totalLikes),
            rawData: {
                subscribers: channel.subscriber_count || 0,
                videos: channel.video_count || 0,
                views: channel.view_count || 0,
                likes: totalLikes
            }
        };
    } catch (error) {
        console.error('Erreur lors du calcul des statistiques:', error);
        return null;
    }
}

// Ajouter un nouvel enregistrement (exemple)
async function addVideo(videoData) {
    try {
        const { data, error } = await supabase
            .from('videos')
            .insert([videoData])
            .select();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la vidéo:', error);
        return null;
    }
}

// Mettre à jour un enregistrement (exemple)
async function updateVideo(videoId, updates) {
    try {
        const { data, error } = await supabase
            .from('videos')
            .update(updates)
            .eq('id', videoId)
            .select();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
        return null;
    }
}

// Supprimer un enregistrement (exemple)
async function deleteVideo(videoId) {
    try {
        const { error } = await supabase
            .from('videos')
            .delete()
            .eq('id', videoId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        return false;
    }
}

// Écouter les changements en temps réel (optionnel)
function subscribeToVideoChanges(callback) {
    const subscription = supabase
        .channel('videos-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'videos' }, 
            callback
        )
        .subscribe();
    
    return subscription;
}