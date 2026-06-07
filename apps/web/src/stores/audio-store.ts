import { create } from 'zustand';

export interface Track {
  id: string;
  title: string;
  podcastName: string;
  audioUrl: string;
  coverUrl?: string;
}

interface AudioState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  seekTime: number | null;
  
  playTrack: (track: Track) => void;
  stopTrack: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  seekTo: (time: number) => void;
  clearSeek: () => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  seekTime: null,

  playTrack: (track) =>
    set({
      currentTrack: track,
      isPlaying: true,
      currentTime: 0,
      seekTime: 0,
    }),

  stopTrack: () =>
    set({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      seekTime: null,
    }),

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  seekTo: (time) => set({ seekTime: time }),
  clearSeek: () => set({ seekTime: null }),
}));
