import { useState, useEffect } from 'react'
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from './config'
import './index.css'
import './App.css'

function App() {
  const [lastStream, setLastStream] = useState(null)
  const [timeElapsed, setTimeElapsed] = useState('')
  const [streamerName] = useState('bmsjoel')
  const [error, setError] = useState(null)
  const [streamerAvatar, setStreamerAvatar] = useState(null)
  const [monthlyStreamTime, setMonthlyStreamTime] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [streamUrl, setStreamUrl] = useState('')
  const [streamThumbnail, setStreamThumbnail] = useState('')

  const getAccessToken = async () => {
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
      })

      if (!response.ok) {
        throw new Error('Impossible d\'obtenir le token d\'accès')
      }

      const data = await response.json()
      return data.access_token
    } catch (err) {
      console.error('Erreur token:', err)
      throw err
    }
  }

  const fetchLastStream = async () => {
    try {
      const accessToken = await getAccessToken()
      console.log('Token obtenu avec succès')

      // D'abord, obtenir l'ID du streamer
      const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${streamerName}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!userResponse.ok) {
        const errorData = await userResponse.json()
        console.error('Erreur API Twitch:', errorData)
        throw new Error('Streamer non trouvé')
      }

      const userData = await userResponse.json()
      
      if (!userData.data || userData.data.length === 0) {
        throw new Error('Streamer non trouvé')
      }

      // Sauvegarder l'avatar du streamer
      setStreamerAvatar(userData.data[0].profile_image_url)

      const userId = userData.data[0].id
      
      // Vérifier si le streamer est en direct
      const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (!streamResponse.ok) {
        throw new Error('Impossible de vérifier si le streamer est en direct')
      }
      
      const streamData = await streamResponse.json()
      
      // Vérifier si le streamer est en direct
      if (streamData.data && streamData.data.length > 0) {
        setIsLive(true)
        setStreamUrl(`https://twitch.tv/${streamerName}`)
        
        // Récupérer et formater l'URL de la miniature
        // L'URL de la miniature contient des placeholders {width} et {height} que nous remplaçons par des valeurs réelles
        const thumbnailUrl = streamData.data[0].thumbnail_url
          .replace('{width}', '640')
          .replace('{height}', '360');
        setStreamThumbnail(thumbnailUrl)
      } else {
        setIsLive(false)
        setStreamUrl('')
        setStreamThumbnail('')
      }

      // Calculer la période des 30 derniers jours
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)
      
      const videosResponse = await fetch(
        `https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=100&started_at=${startDate.toISOString()}&ended_at=${endDate.toISOString()}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!videosResponse.ok) {
        throw new Error('Impossible de récupérer les streams')
      }

      const videosData = await videosResponse.json()
      
      // Calculer le temps total de stream du mois
      let totalMinutes = 0
      if (videosData.data) {
        totalMinutes = videosData.data.reduce((acc, video) => {
          const videoDate = new Date(video.created_at)
          // Ne compter que les vidéos des 30 derniers jours
          if (videoDate >= startDate && videoDate <= endDate) {
            const duration = video.duration || '0h0m0s'
            const hours = parseInt(duration.match(/(\d+)h/)?.[1] || 0)
            const minutes = parseInt(duration.match(/(\d+)m/)?.[1] || 0)
            const seconds = parseInt(duration.match(/(\d+)s/)?.[1] || 0)
            return acc + (hours * 60) + minutes + (seconds / 60)
          }
          return acc
        }, 0)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = Math.floor(totalMinutes % 60)
        setMonthlyStreamTime(`${hours}h ${minutes}m`)
      }

      if (videosData.data && videosData.data.length > 0) {
        setLastStream(new Date(videosData.data[0].created_at))
        setError(null)
      } else {
        throw new Error('Aucun stream trouvé pour ce streamer')
      }
    } catch (err) {
      console.error('Erreur complète:', err)
      setError(err.message)
      setStreamerAvatar(null)
      setMonthlyStreamTime(null)
    }
  }

  const calculateTimeElapsed = () => {
    if (!lastStream) return

    const now = new Date()
    const diff = now - lastStream

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    setTimeElapsed(`${days}j ${hours}h ${minutes}m ${seconds}s`)
  }

  useEffect(() => {
    fetchLastStream()
  }, [])

  useEffect(() => {
    if (lastStream) {
      const timer = setInterval(calculateTimeElapsed, 1000)
      return () => clearInterval(timer)
    }
  }, [lastStream])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            {streamerAvatar && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={streamerAvatar} 
                  alt={`Avatar de ${streamerName}`}
                  className="w-24 h-24 rounded-full border-4 border-purple-500"
                />
              </div>
            )}
            
            {isLive ? (
              <>
                <h2 className="text-2xl font-bold text-green-500 mb-4">
                  {streamerName} est en live ! Viens voir le Big Boss
                </h2>
                
                {streamThumbnail && (
                  <div className="mb-4">
                    <img 
                      src={streamThumbnail} 
                      alt={`Stream de ${streamerName}`}
                      className="w-full max-w-lg mx-auto rounded-lg shadow-lg border-2 border-purple-500"
                    />
                  </div>
                )}
                
                <a 
                  href={streamUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300"
                >
                  Rejoindre le stream
                </a>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-purple-500 mb-4">
                  Temps écoulé depuis le dernier stream de {streamerName}
                </h2>
                <div className="text-4xl font-mono text-white">
                  {timeElapsed || 'Chargement...'}
                </div>
                {lastStream && (
                  <p className="text-gray-400 mt-4">
                    Dernier stream : {lastStream.toLocaleDateString()} à {lastStream.toLocaleTimeString()}
                  </p>
                )}
                {monthlyStreamTime && (
                  <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                    <h3 className="text-xl font-bold text-purple-400 mb-2">
                      Temps de stream les 30 derniers jours
                    </h3>
                    <div className="text-2xl text-white">
                      {monthlyStreamTime}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App