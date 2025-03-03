# Joel Stream Tracker - Extension Chrome

Cette extension Chrome permet de suivre les streams de bmsjoel sur Twitch. Elle affiche le temps écoulé depuis le dernier stream et notifie lorsque le streamer est en direct.

## Fonctionnalités

- Affichage du temps écoulé depuis le dernier stream
- Notification lorsque le streamer est en direct (badge "LIVE" sur l'icône)
- Affichage du temps total de stream sur les 30 derniers jours
- Lien direct vers le stream lorsqu'il est en direct

## Installation

1. Téléchargez ou clonez ce dépôt
2. Ouvrez Chrome et accédez à `chrome://extensions/`
3. Activez le "Mode développeur" en haut à droite
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier contenant l'extension

## Configuration

Avant d'utiliser l'extension, vous devez configurer vos identifiants Twitch :

1. Créez une application sur [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Obtenez votre Client ID et Client Secret
3. Modifiez les fichiers `popup.js`, `background.js` et `config.js` pour remplacer les valeurs `VOTRE_CLIENT_ID` et `VOTRE_CLIENT_SECRET` par vos propres identifiants

## Utilisation

Cliquez sur l'icône de l'extension dans la barre d'outils de Chrome pour voir le statut du streamer. Un badge "LIVE" apparaîtra sur l'icône lorsque le streamer est en direct.

## Politique de confidentialité

Cette extension respecte votre vie privée. Toutes les données sont stockées localement sur votre appareil et ne sont jamais transmises à des tiers. Pour plus d'informations, consultez notre [politique de confidentialité](https://votre-url-vercel.vercel.app/privacy-policy.html).

## Publication sur le Chrome Web Store

Pour publier cette extension sur le Chrome Web Store :

1. Créez un fichier ZIP contenant tous les fichiers de l'extension
2. Accédez à la [Console développeur Chrome](https://chrome.google.com/webstore/devconsole/)
3. Cliquez sur "Nouvel élément" et téléchargez le fichier ZIP
4. Remplissez les informations requises, y compris l'URL de la politique de confidentialité
5. Soumettez l'extension pour examen
