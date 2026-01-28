import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { GameEvent, GameState } from "../types";

// --- CẤU HÌNH SUPABASE ---
const SUPABASE_URL = 'https://depaeokhrsfwxczqckjr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlcGFlb2tocnNmd3hjenFja2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDU4NzgsImV4cCI6MjA4NTA4MTg3OH0.P4IiK6T3QL6HLNq61Az93B1boNNV5KNB_14xfoQPHVM'; 
// ---------------------------------------------

let supabase: any = null;
let currentChannel: RealtimeChannel | null = null;

// Initialize Supabase
try {
  if (SUPABASE_KEY && SUPABASE_URL) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error("Supabase init failed", e);
}

// Global callback to App.tsx
let onGameEvent: ((event: GameEvent) => void) | null = null;

export const connectToGameRoom = async (pin: string) => {
  if (!supabase) {
    alert("Lỗi khởi tạo Supabase. Vui lòng kiểm tra console.");
    return;
  }

  // Cleanup old channel
  if (currentChannel) {
    await supabase.removeChannel(currentChannel);
  }

  console.log("Connecting to Supabase Room:", pin);

  // Create new channel based on PIN
  currentChannel = supabase.channel(`game_room_${pin}`, {
    config: {
      broadcast: { self: true }, 
    },
  });

  currentChannel
    .on('broadcast', { event: 'game-event' }, (payload: { payload: GameEvent }) => {
      if (onGameEvent) {
        onGameEvent(payload.payload);
      }
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Đã kết nối phòng ${pin} thành công!`);
      }
      if (status === 'CHANNEL_ERROR') {
        alert("Lỗi kết nối Supabase. Có thể do mạng hoặc Key hết hạn.");
      }
    });
};

export const subscribeToGameEvents = (callback: (event: GameEvent) => void) => {
  onGameEvent = callback;
  return () => {
    onGameEvent = null;
  };
};

export const broadcastEvent = async (event: GameEvent) => {
  if (!currentChannel) {
    return;
  }
  await currentChannel.send({
    type: 'broadcast',
    event: 'game-event',
    payload: event,
  });
};

// --- Helpers ---

export const calculateScore = (timeLeft: number, totalTime: number, streak: number, isOptimal: boolean): number => {
  if (!isOptimal) return 0;
  const baseScore = 1000;
  const timeFactor = timeLeft / totalTime;
  const streakBonus = Math.min(streak * 100, 500);
  return Math.floor((baseScore * timeFactor) + streakBonus);
};

export const generatePin = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getAvatarUrl = (id: number) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;

export const getQrCodeUrl = (data: string) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
};

// --- Audio System ---
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
let bgMusicAudio: HTMLAudioElement | null = null;

export const toggleBackgroundMusic = (shouldPlay: boolean) => {
  // Ensure context is running (fixes "no sound" issues on many browsers)
  if (audioCtx.state === 'suspended') {
      audioCtx.resume();
  }

if (!bgMusicAudio) {
  bgMusicAudio = new Audio(
    'https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3?filename=action-cinematic-hero-14987.mp3'
  ); 

  bgMusicAudio.onerror = () => {
    console.warn("Không load được nhạc online.");
  };

  bgMusicAudio.loop = true;
  bgMusicAudio.volume = 0.4;
}

  if (shouldPlay) {
    // Xử lý policy chặn tự phát nhạc của trình duyệt
    const playPromise = bgMusicAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Chờ click để phát sau
        console.log("Chờ người dùng tương tác để phát nhạc.");
      });
    }
  } else {
    bgMusicAudio.pause();
  }
};

export const playSound = (type: 'join' | 'correct' | 'wrong' | 'tick' | 'victory' | 'click') => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case 'click': // Gentle Click Sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      gainNode.gain.setValueAtTime(0.05, now); // Very quiet
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    case 'join':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'correct':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(1000, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'wrong':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.3);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'tick':
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    case 'victory':
        // Âm thanh chiến thắng hoành tráng (Hợp âm C Major)
        const osc2 = audioCtx.createOscillator();
        const osc3 = audioCtx.createOscillator();
        const masterGain = audioCtx.createGain();
        
        osc.connect(masterGain);
        osc2.connect(masterGain);
        osc3.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        osc.type = 'triangle';
        osc2.type = 'sine';
        osc3.type = 'square';

        // Arpeggio
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6 (giữ dài)

        osc2.frequency.setValueAtTime(523.25, now);
        osc2.frequency.linearRampToValueAtTime(1046.50, now + 0.3);

        osc3.frequency.setValueAtTime(261.63, now); // C4 (bass)

        masterGain.gain.setValueAtTime(0.3, now);
        masterGain.gain.linearRampToValueAtTime(0, now + 3);
        
        osc.start(now); osc.stop(now + 3);
        osc2.start(now); osc2.stop(now + 3);
        osc3.start(now); osc3.stop(now + 3);
        break;
  }
};
