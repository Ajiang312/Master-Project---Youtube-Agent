// supabase-config.js

window.SUPABASE_URL = 'https://rtztgwuqzaoytkyencei.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0enRnd3VxemFveXRreWVuY2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzEwODQsImV4cCI6MjA3ODM0NzA4NH0.bwFTvxRYJGGJag4SI1TVk8i0bjb-xiA4rhcmM6SR3PY';

if (typeof window.supabase === 'undefined') {
    console.error('❌ Supabase JS non chargé');
} else {
    const { createClient } = window.supabase;
    window.sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    window.supabase = window.sb;
    console.log('✅ Supabase initialisé');
}

// ===============================
// AUTH HELPERS
// ===============================
async function getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Erreur getCurrentSession:', error);
        return null;
    }
    return data.session;
}

async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Erreur getCurrentUser:', error);
        return null;
    }
    return data.user || null;
}

async function getCurrentUserChannel() {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('channels')
            .select('*')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            localStorage.setItem('selectedChannel', JSON.stringify(data));
        }

        return data || null;
    } catch (err) {
        console.error('Erreur getCurrentUserChannel:', err);
        return null;
    }
}

async function requireAuth(redirectTo = 'login.html') {
    const session = await getCurrentSession();

    if (!session) {
        localStorage.removeItem('selectedChannel');
        window.location.href = redirectTo;
        return null;
    }

    let channel = null;

    try {
        const cached = localStorage.getItem('selectedChannel');
        if (cached) {
            channel = JSON.parse(cached);
        }
    } catch (e) {
        console.warn('Impossible de lire selectedChannel depuis localStorage');
    }

    if (!channel) {
        channel = await getCurrentUserChannel();
    }

    if (!channel) {
        console.warn('Aucune chaîne liée à cet utilisateur');
    }

    return {
        session,
        user: session.user,
        channel
    };
}

async function logoutUser() {
    const { error } = await supabase.auth.signOut();
    localStorage.removeItem('selectedChannel');

    if (error) {
        console.error('Erreur logoutUser:', error);
        return false;
    }
    return true;
}

// ===============================
// CHANNELS
// ===============================
async function getChannels() {
    try {
        const { data, error } = await supabase
            .from('channels')
            .select('*');

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur getChannels:', err);
        return null;
    }
}

// ===============================
// VIDEOS
// ===============================
async function getVideos() {
    try {
        const { data, error } = await supabase
            .from('videos')
            .select(`
                video_id,
                channel_id,
                published_at,
                title,
                description,
                duration_seconds,
                is_short,
                view_count,
                like_count,
                comment_count,
                category_id,
                tags,
                topic_categories,
                thumbnails,
                subscriber_count
            `)
            .order('published_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur getVideos:', err);
        return null;
    }
}

async function getVideosByChannel(channelId) {
    try {
        const { data, error } = await supabase
            .from('videos')
            .select(`
                video_id,
                channel_id,
                published_at,
                title,
                description,
                duration_seconds,
                is_short,
                view_count,
                like_count,
                comment_count,
                category_id,
                tags,
                topic_categories,
                thumbnails,
                subscriber_count
            `)
            .eq('channel_id', channelId)
            .order('published_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur getVideosByChannel:', err);
        return null;
    }
}

// ===============================
// DASHBOARD STATS
// ===============================
async function calculateDashboardStats(channelId) {
    try {
        const { data: channel, error: channelError } = await supabase
            .from('channels')
            .select('subscriber_count, view_count, video_count, channel_id, title')
            .eq('channel_id', channelId)
            .single();

        if (channelError) throw channelError;

        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select('like_count, comment_count')
            .eq('channel_id', channelId);

        if (videosError) throw videosError;

        const totalLikes = (videos || []).reduce((sum, v) => sum + (v.like_count || 0), 0);
        const totalComments = (videos || []).reduce((sum, v) => sum + (v.comment_count || 0), 0);

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
                likes: totalLikes,
                comments: totalComments
            }
        };
    } catch (err) {
        console.error('Erreur calculateDashboardStats:', err);
        return null;
    }
}

// ===============================
// COMMENTS
// ===============================
async function getCommentsByVideo(videoId) {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('video_id', videoId);

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur getCommentsByVideo:', err);
        return null;
    }
}

// ===============================
// TRANSCRIPTS
// ===============================
async function getTranscripts() {
    try {
        const { data, error } = await supabase
            .from('transcripts')
            .select('*');

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur getTranscripts:', err);
        return null;
    }
}

async function getTranscriptJobs() {
    try {
        const { data, error } = await supabase
            .from('transcript_jobs')
            .select('*');

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur getTranscriptJobs:', err);
        return null;
    }
}

// ===============================
// INSERT / UPDATE / DELETE
// ===============================
async function addVideo(videoData) {
    try {
        const { data, error } = await supabase
            .from('videos')
            .insert([videoData])
            .select();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur addVideo:', err);
        return null;
    }
}

async function updateVideo(videoId, updates) {
    try {
        const { data, error } = await supabase
            .from('videos')
            .update(updates)
            .eq('video_id', videoId)
            .select();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Erreur updateVideo:', err);
        return null;
    }
}

async function deleteVideo(videoId) {
    try {
        const { error } = await supabase
            .from('videos')
            .delete()
            .eq('video_id', videoId);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Erreur deleteVideo:', err);
        return false;
    }
}

// ===============================
// REALTIME
// ===============================
function subscribeToVideoChanges(callback) {
    return supabase
        .channel('videos-realtime')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'videos' },
            callback
        )
        .subscribe();
}