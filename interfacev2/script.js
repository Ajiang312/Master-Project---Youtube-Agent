// Menu toggle for mobile
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

// Navigation items
const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
    item.addEventListener('click', function() {
        navItems.forEach(nav => nav.classList.remove('active'));
        this.classList.add('active');
    });
});

// Assistant input
const assistantInput = document.querySelector('.assistant-input input');
const sendButton = document.querySelector('.btn-send');

if (assistantInput && sendButton) {
    sendButton.addEventListener('click', sendMessage);
    
    assistantInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function sendMessage() {
    const message = assistantInput.value.trim();
    if (message) {
        console.log('Message envoyé:', message);
        // Ici vous pouvez ajouter la logique pour envoyer le message à votre backend
        assistantInput.value = '';
    }
}

// Create buttons
const createButtons = document.querySelectorAll('.btn-create');

createButtons.forEach(button => {
    button.addEventListener('click', function() {
        const suggestionCard = this.closest('.suggestion-card');
        const title = suggestionCard.querySelector('h3').textContent;
        console.log('Création du contenu:', title);
        // Ici vous pouvez ajouter la logique pour créer le contenu
    });
});

// Animate stats on load
window.addEventListener('load', () => {
    const statValues = document.querySelectorAll('.stat-value');
    
    statValues.forEach(stat => {
        const value = stat.textContent;
        stat.style.opacity = '0';
        stat.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            stat.style.transition = 'all 0.6s ease';
            stat.style.opacity = '1';
            stat.style.transform = 'translateY(0)';
        }, 100);
    });
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

// Aller a la page parametre
document.querySelectorAll('.nav-item[data-link]').forEach(item => {
    item.addEventListener('click', () => {
        window.location.href = item.dataset.link;
    });
});