/* global chrome */
// Configuration Twitch - À remplacer par vos propres identifiants
const TWITCH_CLIENT_ID = 'ho8jz11rsebugnc30gjzigiea1kjih';
const TWITCH_CLIENT_SECRET = '6b4h74j2aocjkurklghkw7lglziz08';
const STREAMER_NAME = 'bmsjoel';

// État global pour suivre si le streamer était en direct lors de la dernière vérification
let wasLiveLastCheck = false;

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

// Vérifier si le streamer est en direct
async function checkIfLive() {
  try {
    const accessToken = await getAccessToken();
    
    // Obtenir l'ID du streamer
    const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${STREAMER_NAME}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Streamer non trouvé');
    }

    const userData = await userResponse.json();
    
    if (!userData.data || userData.data.length === 0) {
      throw new Error('Streamer non trouvé');
    }

    const userId = userData.data[0].id;
    
    // Vérifier si le streamer est en direct
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
    
    // Mettre à jour le badge en fonction du statut
    const isLive = streamData.data && streamData.data.length > 0;
    
    if (isLive) {
      // Récupérer les informations du stream
      const streamInfo = streamData.data[0];
      const streamTitle = streamInfo.title;
      const gameName = streamInfo.game_name || "Jeu inconnu";
      const viewerCount = streamInfo.viewer_count || 0;
      
      // Mettre à jour le badge
      chrome.action.setBadgeText({ text: 'LIVE' });
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // Vert
      
      // Stocker les informations du stream en cours
      chrome.storage.local.set({
        isLive: true,
        streamUrl: `https://twitch.tv/${STREAMER_NAME}`,
        streamThumbnail: streamData.data[0].thumbnail_url
          .replace('{width}', '640')
          .replace('{height}', '360'),
        streamTitle: streamTitle,
        gameName: gameName,
        viewerCount: viewerCount,
        startedAt: streamData.data[0].started_at
      });
      
      // Si le streamer n'était pas en direct lors de la dernière vérification,
      // mais qu'il l'est maintenant, envoyer une notification
      if (!wasLiveLastCheck) {
        // Vérifier si les notifications sont activées dans les options
        chrome.storage.local.get('options', (data) => {
          const options = data.options || { enableNotifications: true, playSound: false };
          
          if (options.enableNotifications) {
            // Créer une notification
            const notificationOptions = {
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: `${STREAMER_NAME} est en direct !`,
              message: `${streamTitle}\nJeu: ${gameName}\nViewers: ${viewerCount}`,
              priority: 2,
              buttons: [
                {
                  title: 'Regarder maintenant'
                }
              ]
            };
            
            // Ajouter un son si l'option est activée
            if (options.playSound) {
              notificationOptions.silent = false;
            } else {
              notificationOptions.silent = true;
            }
            
            chrome.notifications.create('streamStartNotification', notificationOptions);
          }
        });
      }
      
      // Mettre à jour l'état
      wasLiveLastCheck = true;
    } else {
      chrome.action.setBadgeText({ text: '' });
      
      // Mettre à jour le statut
      chrome.storage.local.set({ isLive: false });
      
      // Mettre à jour l'état
      wasLiveLastCheck = false;
    }
    
    return isLive;
  } catch (err) {
    console.error('Erreur lors de la vérification du statut:', err);
    chrome.action.setBadgeText({ text: '' });
    return false;
  }
}

// Gérer les clics sur les notifications
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'streamStartNotification' && buttonIndex === 0) {
    // Ouvrir le stream dans un nouvel onglet
    chrome.tabs.create({ url: `https://twitch.tv/${STREAMER_NAME}` });
  }
});

// Mettre à jour l'intervalle de vérification
function updateCheckInterval(minutes) {
  // Supprimer l'alarme existante
  chrome.alarms.clear('checkLiveStatus', () => {
    // Créer une nouvelle alarme avec le nouvel intervalle
    chrome.alarms.create('checkLiveStatus', { periodInMinutes: minutes });
    console.log(`Intervalle de vérification mis à jour: ${minutes} minutes`);
  });
}

// Configurer l'alarme pour vérifier périodiquement si le streamer est en direct
chrome.runtime.onInstalled.addListener(() => {
  // Demander la permission de notifications si elle n'est pas déjà accordée
  chrome.permissions.contains({ permissions: ['notifications'] }, (result) => {
    if (!result) {
      chrome.permissions.request({ permissions: ['notifications'] }, (granted) => {
        if (granted) {
          console.log('Permission de notifications accordée');
        } else {
          console.log('Permission de notifications refusée');
        }
      });
    }
  });
  
  // Vérifier immédiatement au démarrage
  checkIfLive();
  
  // Récupérer l'intervalle de vérification des options
  chrome.storage.local.get('options', (data) => {
    const options = data.options || { checkInterval: 5 };
    const checkInterval = options.checkInterval || 5;
    
    // Configurer une vérification périodique
    chrome.alarms.create('checkLiveStatus', { periodInMinutes: checkInterval });
  });
});

// Réagir à l'alarme
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkLiveStatus') {
    checkIfLive();
  }
});

// Permettre à la popup de demander une vérification
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkLiveStatus') {
    checkIfLive().then(isLive => {
      sendResponse({ isLive });
    });
    return true; // Indique que la réponse sera envoyée de manière asynchrone
  } else if (message.action === 'updateCheckInterval') {
    updateCheckInterval(message.interval);
    sendResponse({ success: true });
    return false;
  }
}); 