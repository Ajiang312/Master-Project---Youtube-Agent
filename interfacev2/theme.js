// theme.js - Système de gestion des thèmes (Sombre, Clair, Système)

// Initialiser le thème au chargement de la page
(function() {
    console.log('🎨 Initialisation du système de thèmes...');
    
    // Charger le thème sauvegardé ou utiliser "sombre" par défaut
    const savedTheme = localStorage.getItem('appTheme') || 'sombre';
    console.log('📦 Thème sauvegardé:', savedTheme);
    
    applyTheme(savedTheme);
})();

// Appliquer un thème
function applyTheme(theme) {
    console.log('🎨 Application du thème:', theme);
    const root = document.documentElement;
    
    switch(theme) {
        case 'clair':
            console.log('☀️ Mode CLAIR activé');
            root.setAttribute('data-theme', 'light');
            document.body.setAttribute('data-theme', 'light');
            break;
        case 'sombre':
            console.log('🌙 Mode SOMBRE activé');
            root.setAttribute('data-theme', 'dark');
            document.body.setAttribute('data-theme', 'dark');
            break;
        case 'système':
            // Détecter le thème du système
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            console.log('💻 Mode SYSTÈME - Préfère sombre?', prefersDark);
            const systemTheme = prefersDark ? 'dark' : 'light';
            root.setAttribute('data-theme', systemTheme);
            document.body.setAttribute('data-theme', systemTheme);
            break;
    }
    
    // Sauvegarder la préférence
    localStorage.setItem('appTheme', theme);
    console.log('✅ Thème appliqué et sauvegardé:', theme);
    console.log('📊 Attribut data-theme sur <html>:', root.getAttribute('data-theme'));
}

// Écouter les changements de thème système
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const currentTheme = localStorage.getItem('appTheme');
    console.log('🔄 Changement détecté du thème système');
    
    // Réappliquer seulement si le mode est "système"
    if (currentTheme === 'système') {
        const root = document.documentElement;
        const newTheme = e.matches ? 'dark' : 'light';
        root.setAttribute('data-theme', newTheme);
        document.body.setAttribute('data-theme', newTheme);
        console.log('✅ Nouveau thème système appliqué:', newTheme);
    }
});

// Fonction pour changer de thème (appelée depuis les boutons)
function setTheme(theme) {
    console.log('🖱️ Clic sur le thème:', theme);
    applyTheme(theme);
    
    // Mettre à jour l'interface si on est sur la page settings
    updateThemeButtons(theme);
    
    // Notification
    if (typeof showNotification === 'function') {
        showNotification(`Thème "${theme}" appliqué`, 'success');
    } else {
        console.log('📢 Notification:', `Thème "${theme}" appliqué`);
    }
}

// Mettre à jour les boutons de thème sur la page settings
function updateThemeButtons(activeTheme) {
    const themeOptions = document.querySelectorAll('.theme-option');
    console.log('🔘 Mise à jour des boutons, nombre trouvé:', themeOptions.length);
    
    themeOptions.forEach(option => {
        const themeName = option.querySelector('span').textContent.toLowerCase();
        
        if (themeName === activeTheme) {
            option.classList.add('active');
            console.log('✅ Bouton activé:', themeName);
        } else {
            option.classList.remove('active');
        }
    });
}