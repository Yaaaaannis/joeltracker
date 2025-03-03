/* global chrome */
// Sauvegarder les options dans le stockage local
function saveOptions() {
  const enableNotifications = document.getElementById('enableNotifications').checked;
  const playSound = document.getElementById('playSound').checked;
  const checkInterval = parseInt(document.getElementById('checkInterval').value, 10);
  const theme = document.getElementById('theme').value;
  
  chrome.storage.local.set({
    options: {
      enableNotifications,
      playSound,
      checkInterval,
      theme
    }
  }, () => {
    // Mettre à jour l'intervalle de vérification
    chrome.runtime.sendMessage({ 
      action: 'updateCheckInterval', 
      interval: checkInterval 
    });
    
    // Afficher un message de confirmation
    const status = document.getElementById('status');
    status.classList.remove('hidden');
    
    setTimeout(() => {
      status.classList.add('hidden');
    }, 2000);
  });
}

// Charger les options sauvegardées
function restoreOptions() {
  chrome.storage.local.get('options', (data) => {
    if (data.options) {
      document.getElementById('enableNotifications').checked = data.options.enableNotifications !== false;
      document.getElementById('playSound').checked = data.options.playSound || false;
      
      const intervalSelect = document.getElementById('checkInterval');
      if (data.options.checkInterval) {
        for (let i = 0; i < intervalSelect.options.length; i++) {
          if (parseInt(intervalSelect.options[i].value, 10) === data.options.checkInterval) {
            intervalSelect.selectedIndex = i;
            break;
          }
        }
      }
      
      const themeSelect = document.getElementById('theme');
      if (data.options.theme) {
        for (let i = 0; i < themeSelect.options.length; i++) {
          if (themeSelect.options[i].value === data.options.theme) {
            themeSelect.selectedIndex = i;
            break;
          }
        }
      }
    } else {
      // Valeurs par défaut si aucune option n'est sauvegardée
      document.getElementById('enableNotifications').checked = true;
      document.getElementById('playSound').checked = false;
      document.getElementById('checkInterval').value = '5';
      document.getElementById('theme').value = 'dark';
      
      // Sauvegarder les valeurs par défaut
      saveOptions();
    }
  });
}

// Initialiser la page d'options
document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  document.getElementById('saveOptions').addEventListener('click', saveOptions);
}); 