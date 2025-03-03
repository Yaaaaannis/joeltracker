/* global chrome */
// Configuration Twitch - À remplacer par vos propres identifiants
const TWITCH_CLIENT_ID = 'ho8jz11rsebugnc30gjzigiea1kjih';
const TWITCH_CLIENT_SECRET = '6b4h74j2aocjkurklghkw7lglziz08';
const STREAMER_NAME = 'bmsjoel';

// Éléments DOM
const appElement = document.getElementById('app');

// État
let lastStream = null;
let timeElapsed = '';
let streamerAvatar = null;
let monthlyStreamTime = null;
let isLive = false;
let streamUrl = '';
let streamThumbnail = '';
let error = null;

// Obtenir un token d'accès Twitch
async function getAccessToken() {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
    });

    if (!response.ok) {
      throw new Error('Impossible d\'obtenir le token d\'accès');
    }

    const data = await response.json();
    return data.access_token;
  } catch (err) {
    console.error('Erreur token:', err);
    throw err;
  }
}

// Récupérer les informations du dernier stream
async function fetchLastStream() {
  try {
    // D'abord, vérifier si nous avons des données stockées sur le statut en direct
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const storedData = await new Promise(resolve => {
        chrome.storage.local.get(['isLive', 'streamUrl', 'streamThumbnail'], resolve);
      });
      
      // Si nous avons des données stockées, les utiliser
      if (storedData.isLive !== undefined) {
        isLive = storedData.isLive;
        streamUrl = storedData.streamUrl || '';
        streamThumbnail = storedData.streamThumbnail || '';
      }
    }
    
    // Demander au script d'arrière-plan de vérifier le statut en direct
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'checkLiveStatus' }, response => {
        if (response && response.isLive !== undefined) {
          isLive = response.isLive;
          renderApp(); // Mettre à jour l'interface si le statut a changé
        }
      });
    }
    
    const accessToken = await getAccessToken();
    console.log('Token obtenu avec succès');

    // D'abord, obtenir l'ID du streamer
    const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${STREAMER_NAME}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      console.error('Erreur API Twitch:', errorData);
      throw new Error('Streamer non trouvé');
    }

    const userData = await userResponse.json();
    
    if (!userData.data || userData.data.length === 0) {
      throw new Error('Streamer non trouvé');
    }

    // Sauvegarder l'avatar du streamer
    streamerAvatar = userData.data[0].profile_image_url;

    const userId = userData.data[0].id;
    
    // Vérifier si le streamer est en direct (si pas déjà fait par le background)
    if (!isLive) {
      const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!streamResponse.ok) {
        throw new Error('Impossible de vérifier si le streamer est en direct');
      }
      
      const streamData = await streamResponse.json();
      
      // Vérifier si le streamer est en direct
      if (streamData.data && streamData.data.length > 0) {
        isLive = true;
        streamUrl = `https://twitch.tv/${STREAMER_NAME}`;
        
        // Récupérer et formater l'URL de la miniature
        const thumbnailUrl = streamData.data[0].thumbnail_url
          .replace('{width}', '640')
          .replace('{height}', '360');
        streamThumbnail = thumbnailUrl;
      } else {
        isLive = false;
        streamUrl = '';
        streamThumbnail = '';
      }
    }

    // Calculer la période des 30 derniers jours
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const videosResponse = await fetch(
      `https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=100&started_at=${startDate.toISOString()}&ended_at=${endDate.toISOString()}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!videosResponse.ok) {
      throw new Error('Impossible de récupérer les streams');
    }

    const videosData = await videosResponse.json();
    
    // Calculer le temps total de stream du mois
    let totalMinutes = 0;
    if (videosData.data) {
      totalMinutes = videosData.data.reduce((acc, video) => {
        const videoDate = new Date(video.created_at);
        // Ne compter que les vidéos des 30 derniers jours
        if (videoDate >= startDate && videoDate <= endDate) {
          const duration = video.duration || '0h0m0s';
          const hours = parseInt(duration.match(/(\d+)h/)?.[1] || 0);
          const minutes = parseInt(duration.match(/(\d+)m/)?.[1] || 0);
          const seconds = parseInt(duration.match(/(\d+)s/)?.[1] || 0);
          return acc + (hours * 60) + minutes + (seconds / 60);
        }
        return acc;
      }, 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);
      monthlyStreamTime = `${hours}h ${minutes}m`;
    }

    if (videosData.data && videosData.data.length > 0) {
      lastStream = new Date(videosData.data[0].created_at);
      error = null;
    } else {
      throw new Error('Aucun stream trouvé pour ce streamer');
    }
    
    // Mettre à jour l'interface
    renderApp();
    startTimer();
  } catch (err) {
    console.error('Erreur complète:', err);
    error = err.message;
    streamerAvatar = null;
    monthlyStreamTime = null;
    renderApp();
  }
}

// Calculer le temps écoulé depuis le dernier stream
function calculateTimeElapsed() {
  if (!lastStream) return;

  const now = new Date();
  const diff = now - lastStream;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  timeElapsed = `${days}j ${hours}h ${minutes}m ${seconds}s`;
  
  // Mettre à jour uniquement l'élément du temps écoulé pour éviter de redessiner toute l'interface
  const timeElement = document.getElementById('time-elapsed');
  if (timeElement) {
    timeElement.textContent = timeElapsed;
  } else {
    renderApp(); // Si l'élément n'existe pas, redessiner toute l'interface
  }
}

// Démarrer le timer pour mettre à jour le temps écoulé
function startTimer() {
  if (lastStream) {
    calculateTimeElapsed();
    setInterval(calculateTimeElapsed, 1000);
  }
}

// Afficher l'interface utilisateur
function renderApp() {
  let html = '';
  
  if (error) {
    html = `<div class="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
      <p class="text-red-500">${error}</p>
    </div>`;
  } else {
    if (isLive) {
      // Récupérer les informations supplémentaires du stream si disponibles
      let streamTitle = '';
      let gameName = '';
      let viewerCount = '';
      let startedAt = '';
      
      // Récupérer les données stockées
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['streamTitle', 'gameName', 'viewerCount', 'startedAt'], (data) => {
          if (data.streamTitle) {
            streamTitle = data.streamTitle;
            const titleElement = document.getElementById('stream-title');
            if (titleElement) {
              titleElement.textContent = streamTitle;
            }
          }
          
          if (data.gameName) {
            gameName = data.gameName;
            const gameElement = document.getElementById('game-name');
            if (gameElement) {
              gameElement.textContent = gameName;
            }
          }
          
          if (data.viewerCount) {
            viewerCount = data.viewerCount;
            const viewersElement = document.getElementById('viewer-count');
            if (viewersElement) {
              viewersElement.textContent = viewerCount;
            }
          }
          
          if (data.startedAt) {
            const startTime = new Date(data.startedAt);
            const now = new Date();
            const diffMs = now - startTime;
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            startedAt = `${diffHrs}h ${diffMins}m`;
            
            const durationElement = document.getElementById('stream-duration');
            if (durationElement) {
              durationElement.textContent = startedAt;
            }
          }
        });
      }
      
      html = `
        <div class="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
          <div class="flex justify-end mb-2">
            <a href="#" id="options-link" class="text-purple-400 hover:text-purple-300 text-sm">
              ⚙️ Options
            </a>
          </div>
          
          ${streamerAvatar ? `
            <div class="mb-4 flex justify-center">
              <img 
                src="${streamerAvatar}" 
                alt="Avatar de ${STREAMER_NAME}"
                class="w-24 h-24 rounded-full border-4 border-purple-500"
              />
            </div>
          ` : ''}
          
          <h2 class="text-2xl font-bold text-green-500 mb-4">
            ${STREAMER_NAME} est en live ! Viens voir le Big Boss
          </h2>
          
          <div class="mb-4 p-4 bg-gray-700 rounded-lg text-left">
            <h3 id="stream-title" class="text-xl font-bold text-white mb-2">
              Chargement du titre...
            </h3>
            <div class="grid grid-cols-2 gap-2 text-gray-300">
              <div>
                <span class="font-bold">Jeu:</span> 
                <span id="game-name">Chargement...</span>
              </div>
              <div>
                <span class="font-bold">Viewers:</span> 
                <span id="viewer-count">Chargement...</span>
              </div>
              <div>
                <span class="font-bold">Durée:</span> 
                <span id="stream-duration">Chargement...</span>
              </div>
            </div>
          </div>
          
          ${streamThumbnail ? `
            <div class="mb-4">
              <img 
                src="${streamThumbnail}" 
                alt="Stream de ${STREAMER_NAME}"
                class="w-full max-w-lg mx-auto rounded-lg shadow-lg border-2 border-purple-500"
              />
            </div>
          ` : ''}
          
          <a 
            href="${streamUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300"
          >
            Rejoindre le stream
          </a>
        </div>
      `;
    } else {
      html = `
        <div class="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
          <div class="flex justify-end mb-2">
            <a href="#" id="options-link" class="text-purple-400 hover:text-purple-300 text-sm">
              ⚙️ Options
            </a>
          </div>
          
          ${streamerAvatar ? `
            <div class="mb-4 flex justify-center">
              <img 
                src="${streamerAvatar}" 
                alt="Avatar de ${STREAMER_NAME}"
                class="w-24 h-24 rounded-full border-4 border-purple-500"
              />
            </div>
          ` : ''}
          
          <h2 class="text-2xl font-bold text-purple-500 mb-4">
            Temps écoulé depuis le dernier stream de ${STREAMER_NAME}
          </h2>
          <div id="time-elapsed" class="text-4xl font-mono text-white">
            ${timeElapsed || 'Chargement...'}
          </div>
          ${lastStream ? `
            <p class="text-gray-400 mt-4">
              Dernier stream : ${lastStream.toLocaleDateString()} à ${lastStream.toLocaleTimeString()}
            </p>
          ` : ''}
          ${monthlyStreamTime ? `
            <div class="mt-6 p-4 bg-gray-700 rounded-lg">
              <h3 class="text-xl font-bold text-purple-400 mb-2">
                Temps de stream les 30 derniers jours
              </h3>
              <div class="text-2xl text-white">
                ${monthlyStreamTime}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
  }
  
  appElement.innerHTML = html;
  
  // Ajouter l'événement de clic sur le lien des options
  const optionsLink = document.getElementById('options-link');
  if (optionsLink) {
    optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });
  }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
  renderApp(); // Afficher l'interface initiale
  fetchLastStream(); // Récupérer les données
  
  // Ajouter un badge sur l'icône de l'extension quand le streamer est en direct
  function updateBadge() {
    // Vérifier si l'API chrome est disponible (pour la compatibilité avec d'autres navigateurs)
    if (typeof chrome !== 'undefined' && chrome.action) {
      if (isLive) {
        chrome.action.setBadgeText({ text: 'LIVE' });
        chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // Vert
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  }
  
  // Mettre à jour le badge au chargement
  updateBadge();
  
  // Vérifier périodiquement si le streamer est en direct (toutes les 5 minutes)
  setInterval(() => {
    fetchLastStream();
    updateBadge();
  }, 5 * 60 * 1000);
}); 