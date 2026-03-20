document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

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
        if (sidebar && menuToggle && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
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

// Note: Toute la logique du chatbot (assistant-input, btn-send, sendMessage) 
// a été retirée de ce fichier pour éviter les conflits avec dashboard.js
});