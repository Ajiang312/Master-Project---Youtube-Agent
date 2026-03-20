// login.js

checkAuthState();

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUserData();
    } else if (event === 'SIGNED_OUT') {
        showAuthForm();
    }
});

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    if (!message) {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
        statusEl.className = '';
        return;
    }

    statusEl.textContent = message;
    statusEl.className = `status-${type}`;
    statusEl.style.display = 'block';
}

function setLoading(isLoading) {
    const form = document.getElementById('auth-form');
    const signupBtn = document.getElementById('signup-btn');
    const loginBtn = document.getElementById('login-btn');

    if (isLoading) {
        form.classList.add('loading');
        signupBtn.disabled = true;
        loginBtn.disabled = true;
    } else {
        form.classList.remove('loading');
        signupBtn.disabled = false;
        loginBtn.disabled = false;
    }
}

async function checkAuthState() {
    const session = await getCurrentSession();
    if (session) {
        await loadUserData();
    } else {
        showAuthForm();
    }
}

function showAuthForm() {
    document.getElementById('auth-form').style.display = 'flex';
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('password').value = '';
    showStatus('');
    setLoading(false);
}

async function loadUserData() {
    const user = await getCurrentUser();

    if (!user) {
        showAuthForm();
        return;
    }

    document.getElementById('auth-form').style.display = 'none';
    document.getElementById('user-info').classList.remove('hidden');

    document.getElementById('user-email').textContent = user.email || '';
    document.getElementById('user-id').textContent = user.id || '';

    const channel = await getCurrentUserChannel();

    if (!channel) {
        document.getElementById('channel-id').textContent = 'Aucune chaîne trouvée';
        showStatus('Connecté, mais aucune chaîne liée à cet utilisateur.', 'error');
        setLoading(false);
        return;
    }

    document.getElementById('channel-id').textContent = channel.channel_id || 'Non défini';
    showStatus('Connexion réussie. Redirection...', 'success');

    setLoading(false);

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 700);
}

async function handleSignUp() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const channelId = document.getElementById('channel_id').value.trim();

    if (!email || !password || !channelId) {
        showStatus('Veuillez remplir l’email, le mot de passe et le Channel ID.', 'error');
        return;
    }

    setLoading(true);
    showStatus('Création du compte en cours...', 'info');

    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError) {
            showStatus('Erreur Auth: ' + authError.message, 'error');
            setLoading(false);
            return;
        }

        if (!authData.user) {
            showStatus('Utilisateur non créé.', 'error');
            setLoading(false);
            return;
        }

        const { error: dbError } = await supabase
            .from('channels')
            .insert([{
                user_id: authData.user.id,
                channel_id: channelId,
                title: `Chaîne de ${email}`
            }]);

        if (dbError) {
            showStatus('Compte créé mais erreur DB: ' + dbError.message, 'error');
            setLoading(false);
            return;
        }

        if (authData.session) {
            localStorage.removeItem('selectedChannel');
            showStatus('Compte créé et connecté.', 'success');
            await loadUserData();
        } else {
            showStatus('Compte créé avec succès. Vérifiez votre email pour confirmer votre compte.', 'success');
            setLoading(false);
        }
    } catch (error) {
        showStatus('Erreur inattendue: ' + error.message, 'error');
        setLoading(false);
    }
}

async function handleLogin() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showStatus('Veuillez remplir l’email et le mot de passe.', 'error');
        return;
    }

    setLoading(true);
    showStatus('Connexion en cours...', 'info');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showStatus('Erreur de connexion: ' + error.message, 'error');
            setLoading(false);
            return;
        }

        if (data.session) {
            localStorage.removeItem('selectedChannel');
            showStatus('Connexion réussie.', 'success');
            await loadUserData();
        } else {
            showStatus('Connexion impossible.', 'error');
            setLoading(false);
        }
    } catch (error) {
        showStatus('Erreur inattendue: ' + error.message, 'error');
        setLoading(false);
    }
}

async function handleLogout() {
    setLoading(true);

    const ok = await logoutUser();

    if (!ok) {
        showStatus('Erreur lors de la déconnexion.', 'error');
        setLoading(false);
        return;
    }

    showStatus('Déconnexion réussie.', 'info');
    showAuthForm();
}