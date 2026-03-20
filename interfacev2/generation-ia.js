const GENERATIVE_API_URL = 'http://127.0.0.1:5001/api/generate';
const CLEAR_HISTORY_API_URL = 'http://127.0.0.1:5001/api/clear-history';

let currentChannel = null;

document.addEventListener('DOMContentLoaded', () => {
    setupMobileMenu();
    loadCurrentChannel();
    setupPageForChatOnly();
    setupForm();
    setupAutoResize();
    showWelcomeMessage();
});

function setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

function loadCurrentChannel() {
    const savedChannel = localStorage.getItem('selectedChannel');

    if (!savedChannel) {
        window.location.href = 'login.html';
        return;
    }

    currentChannel = JSON.parse(savedChannel);
    displayChannelInfo();
}

function displayChannelInfo() {
    if (!currentChannel) return;

    const channelName = document.getElementById('channelName');
    const channelId = document.getElementById('channelId');
    const channelAvatar = document.getElementById('channelAvatar');

    if (channelName) {
        channelName.textContent = currentChannel.title || 'Chaîne inconnue';
    }

    if (channelId) {
        channelId.textContent = `Channel ID : ${currentChannel.channel_id || 'inconnu'}`;
    }

    let thumbnailUrl = '';

    const thumbs = currentChannel.thumbnails;

    if (thumbs) {
        if (typeof thumbs === 'string') {
            try {
                const parsed = JSON.parse(thumbs);
                thumbnailUrl =
                    parsed?.high?.url ||
                    parsed?.medium?.url ||
                    parsed?.default?.url ||
                    '';
            } catch {
                thumbnailUrl = thumbs;
            }
        } else if (typeof thumbs === 'object') {
            thumbnailUrl =
                thumbs?.high?.url ||
                thumbs?.medium?.url ||
                thumbs?.default?.url ||
                '';
        }
    }

    if (channelAvatar) {
        if (thumbnailUrl) {
            channelAvatar.innerHTML = `
                <img src="${thumbnailUrl}" alt="${escapeHtml(currentChannel.title || 'Chaîne')}">
            `;
        } else {
            channelAvatar.innerHTML = `<span>${getInitials(currentChannel.title || 'C')}</span>`;
        }
    }

    console.log('currentChannel =', currentChannel);
    console.log('thumbnailUrl =', thumbnailUrl);
}

function setupPageForChatOnly() {
    const contextTitle = document.getElementById('contextTitle');
    const contextText = document.getElementById('contextText');
    const input = document.getElementById('chatInput');

    if (contextTitle) {
        contextTitle.textContent = 'Agent génératif';
    }

    if (contextText) {
        contextText.textContent = 'Demande librement un titre, une description, un script ou une miniature. L’agent détecte lui-même ce que tu veux générer.';
    }

    if (input) {
        input.placeholder = 'Exemple : écris-moi 5 titres pour une vidéo sur les erreurs des débutants sur YouTube...';
    }

    const modeSwitcher = document.getElementById('modeSwitcher');
    if (modeSwitcher) {
        modeSwitcher.remove();
    }

    const quickActions = document.getElementById('quickActions');
    if (quickActions) {
        quickActions.remove();
    }

    const clearBtn = document.getElementById('clearChatBtn');
    if (clearBtn) {
        clearBtn.remove();
    }
}

function showWelcomeMessage() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    chatMessages.innerHTML = '';

    addAssistantMessage(
        "Bonjour ! Je suis votre assistant IA pour la création de contenu YouTube.\n\n" +
        "Vous pouvez me demander directement un titre, une description, un script ou une miniature pour votre prochaine vidéo."
    );
}

function setupForm() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');

    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = input.value.trim();
        if (!message) return;

        addUserMessage(message);
        input.value = '';
        resetTextareaHeight(input);

        await sendMessageToGenerativeAgent(message);
    });

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.requestSubmit();
        }
    });
}

async function sendMessageToGenerativeAgent(message) {
    const sendBtn = document.getElementById('sendBtn');
    const typing = document.getElementById('typingIndicator');

    try {
        if (sendBtn) sendBtn.disabled = true;
        if (typing) typing.classList.add('active');

        const response = await fetch(GENERATIVE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                creator_name: currentChannel.title,
                channel_id: currentChannel.channel_id,
                session_id: `generation_${currentChannel.channel_id}`
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || `Erreur HTTP ${response.status}`);
        }

        addAssistantMessage(data.response || 'Aucune réponse');

    } catch (error) {
        console.error('❌ Erreur génération IA :', error);

        addAssistantMessage(
            `❌ Erreur : ${error.message || 'Impossible de contacter le serveur Flask.'}`
        );
    } finally {
        if (typing) typing.classList.remove('active');
        if (sendBtn) sendBtn.disabled = false;
        scrollChatToBottom();
    }
}

function addUserMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-message';
    messageDiv.innerHTML = `<p><strong>Vous :</strong> ${formatMessage(text)}</p>`;

    container.appendChild(messageDiv);
    scrollChatToBottom();
}

function addAssistantMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-response';
    messageDiv.innerHTML = `<p><strong>Assistant :</strong> ${formatMessage(text)}</p>`;

    container.appendChild(messageDiv);
    scrollChatToBottom();
}

function formatMessage(text) {
    return escapeHtml(text || '').replace(/\n/g, '<br>');
}

function scrollChatToBottom() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.scrollTop = container.scrollHeight;
}

function setupAutoResize() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    input.addEventListener('input', () => {
        resetTextareaHeight(input);
    });

    resetTextareaHeight(input);
}

function resetTextareaHeight(textarea) {
    textarea.style.height = '52px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function getInitials(name) {
    if (!name) return '?';

    const words = name.trim().split(' ').filter(Boolean);

    if (words.length === 1) {
        return words[0].charAt(0).toUpperCase();
    }

    return (
        words[0].charAt(0) +
        words[words.length - 1].charAt(0)
    ).toUpperCase();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* Optionnel si plus tard tu veux remettre un bouton "effacer" */
async function clearGenerativeHistory() {
    if (!currentChannel) return;

    try {
        await fetch(CLEAR_HISTORY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: `generation_${currentChannel.channel_id}`,
                agent_type: 'generatif'
            })
        });

        showWelcomeMessage();
    } catch (error) {
        console.error('Erreur clear history:', error);
    }
}