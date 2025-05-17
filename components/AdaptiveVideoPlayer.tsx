// components/AdaptiveVideoPlayer.tsx - Adaptive video player component for streaming proxies

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { Box, Text, Menu, Button, Loader, useMantineTheme } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconSettings, IconDeviceTv } from '@tabler/icons-react';

// Types for video sources
interface VideoSource {
  quality: string;
  url: string;
}

interface AdaptiveVideoPlayerProps {
  sources: VideoSource[];
  poster?: string;
  autoDetectQuality?: boolean;
  initialQuality?: string;
  width?: string | number;
  height?: string | number;
  onError?: (error: any) => void;
}

/**
 * Adaptive Video Player component
 * Automatically selects the appropriate quality based on connection speed
 * or allows manual quality selection
 */
export default function AdaptiveVideoPlayer({
  sources,
  poster,
  autoDetectQuality = true,
  initialQuality,
  width = '100%',
  height = 'auto',
  onError
}: AdaptiveVideoPlayerProps) {
  const theme = useMantineTheme();
  const playerRef = useRef<ReactPlayer>(null);
  
  // State for player
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentQuality, setCurrentQuality] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [menuOpened, setMenuOpened] = useState(false);
  
  // Find available qualities
  const qualityLevels = sources.map(source => source.quality);
  
  // Sort quality levels from highest to lowest
  const sortedQualityLevels = [...qualityLevels].sort((a, b) => {
    const qualityOrder: { [key: string]: number } = {
      '4K': 5,
      'Full HD': 4, 
      'HD': 3,
      'Medium': 2,
      'Low': 1
    };
    
    return (qualityOrder[b] || 0) - (qualityOrder[a] || 0);
  });
  
  // Auto-detect appropriate quality based on connection
  useEffect(() => {
    const detectQuality = async () => {
      if (!autoDetectQuality) {
        return;
      }
      
      try {
        // Use Navigator.connection if available
        // @ts-ignore
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        let selectedQuality = 'Medium'; // Default to medium quality
        
        if (connection) {
          // Determine quality based on connection type and speed
          const { effectiveType, downlink } = connection;
          
          if (effectiveType === '4g' && downlink > 5) {
            selectedQuality = sortedQualityLevels[0] || 'Full HD'; // Highest available
          } else if (effectiveType === '4g' || (effectiveType === '3g' && downlink > 2)) {
            selectedQuality = 'HD';
          } else if (effectiveType === '3g' || (effectiveType === '2g' && downlink > 0.5)) {
            selectedQuality = 'Medium';
          } else {
            selectedQuality = 'Low'; // Lowest quality for poor connections
          }
        } else {
          // Fallback to simple speed test
          const startTime = Date.now();
          const response = await fetch('/api/ping', { method: 'GET' });
          await response.text();
          const endTime = Date.now();
          const pingTime = endTime - startTime;
          
          if (pingTime < 100) {
            selectedQuality = sortedQualityLevels[0] || 'Full HD'; // Highest available
          } else if (pingTime < 300) {
            selectedQuality = 'HD';
          } else if (pingTime < 600) {
            selectedQuality = 'Medium';
          } else {
            selectedQuality = 'Low';
          }
        }
        
        // Find the closest available quality level
        const availableQualities = qualityLevels;
        const preferredQualityIndex = sortedQualityLevels.indexOf(selectedQuality);
        
        for (let i = preferredQualityIndex; i < sortedQualityLevels.length; i++) {
          if (availableQualities.includes(sortedQualityLevels[i])) {
            setCurrentQuality(sortedQualityLevels[i]);
            break;
          }
        }
        
        // If no quality found yet, try lower qualities
        if (!currentQuality) {
          for (let i = preferredQualityIndex - 1; i >= 0; i--) {
            if (availableQualities.includes(sortedQualityLevels[i])) {
              setCurrentQuality(sortedQualityLevels[i]);
              break;
            }
          }
        }
      } catch (error) {
        console.error('Error detecting quality:', error);
        // Fallback to specified initial quality or medium quality
        setCurrentQuality(initialQuality || 'Medium');
      }
    };
    
    // If initial quality is specified, use that
    if (initialQuality && qualityLevels.includes(initialQuality)) {
      setCurrentQuality(initialQuality);
    } else {
      // Otherwise auto-detect
      detectQuality();
    }
  }, []);
  
  // Select the source URL based on current quality
  useEffect(() => {
    if (currentQuality) {
      const source = sources.find(s => s.quality === currentQuality);
      if (source) {
        setSelectedSource(source);
      } else if (sources.length > 0) {
        // Fallback to first available source
        setSelectedSource(sources[0]);
      }
    }
  }, [currentQuality, sources]);
  
  // Handle quality change
  const handleQualityChange = (quality: string) => {
    // Save current playback time and playing state
    if (playerRef.current) {
      setCurrentTime(playerRef.current.getCurrentTime());
    }
    const wasPlaying = playing;
    
    // Pause player during quality switch
    setPlaying(false);
    setLoading(true);
    
    // Set new quality
    setCurrentQuality(quality);
    setMenuOpened(false);
    
    // Resume playback after a short delay to allow the player to load
    setTimeout(() => {
      if (wasPlaying) {
        setPlaying(true);
      }
    }, 500);
  };
  
  // Handle player ready
  const handleReady = () => {
    setLoading(false);
    
    // Seek to the saved time when changing quality
    if (currentTime > 0 && playerRef.current) {
      playerRef.current.seekTo(currentTime, 'seconds');
    }
  };
  
  // Toggle play/pause
  const togglePlay = () => {
    setPlaying(!playing);
  };
  
  // Render quality menu
  const renderQualityMenu = () => (
    <Menu opened={menuOpened} onChange={setMenuOpened} position="top-end">
      <Menu.Target>
        <Button 
          variant="subtle" 
          color="gray" 
          p={4}
          rightIcon={<IconSettings size={18} />}
          onClick={() => setMenuOpened(true)}
        >
          {currentQuality || 'Quality'}
        </Button>
      </Menu.Target>
      
      <Menu.Dropdown>
        <Menu.Label>Video Quality</Menu.Label>
        {sortedQualityLevels.map((quality) => (
          <Menu.Item
            key={quality}
            onClick={() => handleQualityChange(quality)}
            fw={quality === currentQuality ? 'bold' : 'normal'}
          >
            {quality === currentQuality ? `✓ ${quality}` : quality}
          </Menu.Item>
        ))}
        
        <Menu.Divider />
        
        <Menu.Item 
          onClick={() => setPlaying(!playing)}
          icon={playing ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
        >
          {playing ? 'Pause' : 'Play'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
  
  return (
    <Box
      sx={{ 
        position: 'relative',
        width, 
        height,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: theme.colors.dark[8]
      }}
    >
      {loading && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 2
          }}
        >
          <Loader color="blue" size="lg" />
        </Box>
      )}
      
      {!selectedSource && sources.length > 0 && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: theme.colors.dark[8],
            flexDirection: 'column',
            gap: theme.spacing.md
          }}
        >
          <IconDeviceTv size={48} />
          <Text>Selecting best quality...</Text>
        </Box>
      )}
      
      {selectedSource && (
        <ReactPlayer
          ref={playerRef}
          url={selectedSource.url}
          playing={playing}
          controls={false}
          width="100%"
          height="100%"
          onReady={handleReady}
          onError={(error) => {
            console.error('Video playback error:', error);
            if (onError) onError(error);
          }}
          onBuffer={() => setLoading(true)}
          onBufferEnd={() => setLoading(false)}
          config={{
            file: {
              attributes: {
                poster: poster,
                controlsList: 'nodownload',
                disablePictureInPicture: true,
              },
            },
          }}
        />
      )}
      
      {/* Custom controls overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: theme.spacing.sm,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          transition: 'opacity 0.3s ease',
          opacity: playing ? 0 : 1,
          '&:hover': {
            opacity: 1,
          },
        }}
      >
        <Button
          variant="subtle"
          color="gray"
          p={4}
          onClick={togglePlay}
        >
          {playing ? (
            <IconPlayerPause size={24} />
          ) : (
            <IconPlayerPlay size={24} />
          )}
        </Button>
        
        {renderQualityMenu()}
      </Box>
    </Box>
  );
}