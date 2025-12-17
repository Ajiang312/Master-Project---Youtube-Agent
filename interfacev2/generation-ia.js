// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

// Template selection
document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
        const template = card.dataset.template;
        const textarea = document.getElementById('content-description');
        
        const templates = {
            tutoriel: 'Crée un tutoriel détaillé expliquant comment...',
            vlog: 'Crée du contenu pour un vlog lifestyle montrant...',
            review: 'Crée une review complète d\'un produit avec test et avis détaillé...',
            gaming: 'Crée du contenu gaming avec gameplay et astuces pour...'
        };
        
        textarea.value = templates[template];
        textarea.focus();
    });
});

// Form submission
document.getElementById('generation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const description = document.getElementById('content-description').value;
    const tone = document.getElementById('tone-select').value;
    const language = document.getElementById('language-select').value;
    const activeTab = document.querySelector('.tab.active').dataset.tab;
    
    if (!description.trim()) {
        alert('Veuillez entrer une description');
        return;
    }
    
    // Show loading
    document.querySelector('.loading-state').classList.add('active');
    document.querySelector('.generation-result').classList.remove('active');
    
    // Simulate API call
    setTimeout(() => {
        document.querySelector('.loading-state').classList.remove('active');
        document.querySelector('.generation-result').classList.add('active');
        
        const resultContent = document.querySelector('.result-content');
        
        // Example results based on tab
        const results = {
            titres: `🎯 10 ASTUCES INCROYABLES pour Réussir sur YouTube en 2024 !

📱 Comment Gagner 10K Abonnés en 30 Jours (Méthode PROUVÉE)

✨ Le SECRET que les YouTubeurs ne Veulent PAS Révéler`,
            
            descriptions: `Dans cette vidéo, je partage avec vous les techniques les plus efficaces pour développer votre chaîne YouTube en 2024. 

🎥 Ce que vous allez apprendre :
• Stratégie de contenu gagnante
• Optimisation SEO YouTube
• Engagement de la communauté
• Monétisation rapide

⏱️ Timestamps :
0:00 - Introduction
1:30 - Astuce #1
3:45 - Astuce #2
...

🔔 N'oubliez pas de vous abonner et d'activer la cloche pour ne rien manquer !

#YouTube #Astuces #Croissance`,
            
            scripts: `[INTRO - 0:00]
Salut à tous ! Aujourd'hui, je vais vous révéler les techniques que j'utilise pour...

[HOOK - 0:15]
Restez jusqu'à la fin car je vais vous montrer...

[PARTIE 1 - 0:30]
La première chose à comprendre, c'est que...

[TRANSITION - 2:00]
Maintenant, passons à la technique suivante...

[CONCLUSION - 8:30]
Voilà, j'espère que ces astuces vous aideront...`,
            
            miniatures: `Suggestions pour miniature :

📸 Style : Dynamique et accrocheur
🎨 Couleurs : Rouge vif, jaune, contraste élevé
✍️ Texte : "10 ASTUCES" en gros caractères
😮 Expression : Visage surpris/excité
🔍 Éléments : Flèches pointant vers des éléments clés`,
            
            hashtags: `#YouTube #YoutubeFrance #Tutoriel #Astuces #TipsYouTube #CroissanceYouTube #ContentCreator #Vlog #YouTubeur #Monétisation #AlgorithmeYouTube #SEO #Video #Abonnés #Engagement`
        };
        
        resultContent.textContent = results[activeTab] || results.titres;
    }, 2000);
});

// History item click
document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
        item.style.background = 'rgba(0, 188, 212, 0.1)';
        setTimeout(() => {
            item.style.background = '';
        }, 300);
    });
});

// Menu toggle for mobile
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}