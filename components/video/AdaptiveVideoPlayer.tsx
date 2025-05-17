'use client';

import { useState, useEffect, useRef } from 'react';
import { Paper, Title, Group, Button, Select, Text, Slider, Box, ActionIcon, Skeleton, Stack } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconVolume, IconVolumeOff, IconMaximize, IconX } from '@tabler/icons-react';
import ReactPlayer from 'react-player';

interface AdaptiveVideoPlayerProps {
  sources: {
    quality: string;
    url: string;
    label: string;
  }[];
  title?: string;
  onClose?: () => void;
}

export default function AdaptiveVideoPlayer({ sources, title, onClose }: AdaptiveVideoPlayerProps) {
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const playerRef = useRef<ReactPlayer | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    // Select best quality based on screen size and window.navigator.connection if available
    const selectInitialQuality = () => {
      if (sources.length === 0) {
        setError('No video sources available');
        return;
      }
      
      try {
        // Get screen width to determine initial quality
        const screenWidth = window.innerWidth;
        
        // Get connection type if available (modern browsers only)
        // @ts-ignore - navigator.connection is not in the standard TS types
        const connectionType = window.navigator.connection?.effectiveType || null;
        
        // Logic for quality selection based on screen size and connection
        if (screenWidth > 1920) {
          // For large screens, check connection first
          if (connectionType === '4g') {
            // High-speed connection, use highest quality
            const highestQuality = sources.sort((a, b) => {
              // Sort by resolution if it's in the quality string (e.g., "1080p")
              const aRes = parseInt(a.quality.match(/\d+/)?.[0] || '0');
              const bRes = parseInt(b.quality.match(/\d+/)?.[0] || '0');
              return bRes - aRes;
            })[0];
            
            setSelectedQuality(highestQuality.quality);
          } else {
            // Lower speed connection, use medium quality
            const mediumQuality = sources.find(s => s.quality.includes('720')) || sources[Math.floor(sources.length / 2)];
            setSelectedQuality(mediumQuality.quality);
          }
        } else if (screenWidth > 768) {
          // For medium screens
          const mediumQuality = sources.find(s => s.quality.includes('720')) || sources[Math.floor(sources.length / 2)];
          setSelectedQuality(mediumQuality.quality);
        } else {
          // For small screens or slow connections
          const lowestQuality = sources.sort((a, b) => {
            const aRes = parseInt(a.quality.match(/\d+/)?.[0] || '0');
            const bRes = parseInt(b.quality.match(/\d+/)?.[0] || '0');
            return aRes - bRes;
          })[0];
          
          setSelectedQuality(lowestQuality.quality);
        }
      } catch (e) {
        // Fallback to middle quality option if error
        setSelectedQuality(sources[Math.floor(sources.length / 2)].quality);
      }
    };
    
    selectInitialQuality();
  }, [sources]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return hours > 0 
      ? `${hours}:${pad(mins)}:${pad(secs)}`
      : `${mins}:${pad(secs)}`;
  };

  // Handle player events
  const handleProgress = (state: { played: number; loaded: number }) => {
    setPlayed(state.played);
    setLoaded(state.loaded);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSeek = (value: number) => {
    setPlayed(value);
    playerRef.current?.seekTo(value);
  };

  const handleEnded = () => {
    setPlaying(false);
    setPlayed(0);
    playerRef.current?.seekTo(0);
  };

  const handleReady = () => {
    setLoading(false);
  };

  const handleError = (error: any) => {
    setError(`Error loading video: ${error}`);
    setLoading(false);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerContainerRef.current.requestFullscreen();
    }
  };

  // Get URL for selected quality
  const selectedSource = sources.find(s => s.quality === selectedQuality);
  const videoUrl = selectedSource?.url || '';
  
  // Options for quality selector
  const qualityOptions = sources.map(source => ({
    value: source.quality,
    label: source.label || source.quality
  }));

  return (
    <Paper radius="md" p="md" withBorder ref={playerContainerRef} style={{ position: 'relative' }}>
      {onClose && (
        <ActionIcon 
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }} 
          onClick={onClose}
          color="gray"
          variant="transparent"
        >
          <IconX size={24} />
        </ActionIcon>
      )}
      
      {title && (
        <Title order={3} mb="md">{title}</Title>
      )}
      
      {loading && (
        <Stack>
          <Skeleton height={360} radius="md" />
          <Group grow>
            <Skeleton height={40} radius="md" />
            <Skeleton height={40} width="30%" radius="md" />
          </Group>
        </Stack>
      )}
      
      {error && (
        <Paper p="md" withBorder bg="red.0" c="red.9">
          <Text>{error}</Text>
        </Paper>
      )}
      
      <Box style={{ display: loading ? 'none' : 'block' }}>
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="100%"
            height="100%"
            style={{ position: 'absolute', top: 0, left: 0 }}
            playing={playing}
            volume={volume}
            muted={muted}
            onReady={handleReady}
            onProgress={handleProgress}
            onDuration={handleDuration}
            onEnded={handleEnded}
            onError={handleError}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  onContextMenu: (e: any) => e.preventDefault()
                }
              }
            }}
          />
        </div>
        
        <Group mt="md" align="center">
          <ActionIcon
            onClick={() => setPlaying(!playing)}
            variant="light"
            color="blue"
            size="lg"
          >
            {playing ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
          </ActionIcon>
          
          <Box style={{ flex: 1 }}>
            <Slider
              value={played}
              onChange={handleSeek}
              min={0}
              max={1}
              step={0.01}
              label={null}
              size="md"
            />
            <Group justify="space-between" mt={5}>
              <Text size="sm" c="dimmed">{formatTime(played * duration)}</Text>
              <Text size="sm" c="dimmed">{formatTime(duration)}</Text>
            </Group>
          </Box>
          
          <Group wrap="nowrap">
            <ActionIcon onClick={() => setMuted(!muted)} variant="light">
              {muted ? <IconVolumeOff size={20} /> : <IconVolume size={20} />}
            </ActionIcon>
            
            <Box style={{ width: 80 }}>
              <Slider
                value={volume}
                onChange={setVolume}
                min={0}
                max={1}
                step={0.01}
                size="sm"
                disabled={muted}
              />
            </Box>
            
            <ActionIcon onClick={toggleFullscreen} variant="light">
              <IconMaximize size={20} />
            </ActionIcon>
            
            <Select
              data={qualityOptions}
              value={selectedQuality}
              onChange={setSelectedQuality}
              style={{ width: 100 }}
              size="xs"
              placeholder="Quality"
            />
          </Group>
        </Group>
      </Box>
    </Paper>
  );
}
