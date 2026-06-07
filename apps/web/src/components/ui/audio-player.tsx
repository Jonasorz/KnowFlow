import { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '@/stores/audio-store';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Gauge,
  Download,
} from 'lucide-react';

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    seekTime,
    setPlaying,
    setCurrentTime,
    setDuration,
    setPlaybackRate,
    clearSeek,
    stopTrack,
    seekTo,
  } = useAudioStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  // Synchronize play/pause with Zustand store
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch((err) => {
        console.warn('Audio playback failed:', err);
        setPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack, setPlaying]);

  // Synchronize seekTime with audio element
  useEffect(() => {
    if (seekTime !== null && audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      clearSeek();
    }
  }, [seekTime, clearSeek, setCurrentTime]);

  // Synchronize volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Synchronize playback speed
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, currentTrack]);

  if (!currentTrack) return null;

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleDurationChange = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const handleRewind = () => {
    seekTo(Math.max(0, currentTime - 15));
  };

  const handleForward = () => {
    seekTo(Math.min(duration, currentTime + 15));
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDragTime(val);
  };

  const handleProgressStart = () => {
    setIsDragging(true);
    setDragTime(currentTime);
  };

  const handleProgressEnd = () => {
    setIsDragging(false);
    seekTo(dragTime);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  const displayedTime = isDragging ? dragTime : currentTime;

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur px-4 py-3 shadow-lg flex flex-col md:flex-row items-center gap-4 shrink-0 transition-all z-40 select-none">
      <audio
        ref={audioRef}
        src={currentTrack.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
      />

      {/* Left section: Track details */}
      <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
        {currentTrack.coverUrl ? (
          <img
            src={currentTrack.coverUrl}
            alt={currentTrack.title}
            className="w-10 h-10 rounded-lg object-cover bg-muted border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">POD</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-foreground leading-tight">
            {currentTrack.title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {currentTrack.podcastName}
          </p>
        </div>
      </div>

      {/* Center section: Controls and Progress */}
      <div className="flex-1 flex flex-col items-center gap-1.5 w-full">
        {/* Control buttons */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRewind}
            title="快退 15 秒"
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 fill-current text-primary-foreground" />
            ) : (
              <Play className="h-6 w-6 fill-current text-primary-foreground translate-x-[1px]" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleForward}
            title="快进 15 秒"
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
            {formatTime(displayedTime)}
          </span>
          
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={displayedTime}
            onChange={handleProgressChange}
            onMouseDown={handleProgressStart}
            onTouchStart={handleProgressStart}
            onMouseUp={handleProgressEnd}
            onTouchEnd={handleProgressEnd}
            className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none transition-all hover:h-1.5"
            style={{
              background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${
                (displayedTime / (duration || 1)) * 100
              }%, var(--color-muted) ${(displayedTime / (duration || 1)) * 100}%, var(--color-muted) 100%)`,
            }}
          />

          <span className="text-[10px] font-mono text-muted-foreground w-10 text-left">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right section: Speed, Volume, and Close */}
      <div className="flex items-center justify-end gap-3 w-full md:w-1/4">
        {/* Download */}
        {currentTrack.audioUrl && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => window.open(currentTrack.audioUrl, '_blank')}
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            title="下载音频"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}

        {/* Speed */}
        <Button
          variant="outline"
          size="sm"
          onClick={cyclePlaybackRate}
          className="h-8 text-xs font-semibold gap-1 px-2.5 hover:bg-muted"
          title="切换播放倍速"
        >
          <Gauge className="h-3.5 w-3.5" />
          <span>{playbackRate}x</span>
        </Button>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleMute}
            className="text-muted-foreground hover:text-foreground"
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            style={{
              background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${
                (isMuted ? 0 : volume) * 100
              }%, var(--color-muted) ${(isMuted ? 0 : volume) * 100}%, var(--color-muted) 100%)`,
            }}
          />
        </div>

        <div className="h-4 w-[1px] bg-border mx-1" />

        {/* Close */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={stopTrack}
          className="text-muted-foreground hover:text-destructive"
          title="关闭播放器"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
