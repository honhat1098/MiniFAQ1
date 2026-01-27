import React, { useState, useEffect } from 'react';
import { GamePhase, GameState, Player, GameEvent } from './types';
import { broadcastEvent, subscribeToGameEvents, generatePin, playSound, connectToGameRoom, toggleBackgroundMusic } from './services/gameService';
import { TeacherView } from './components/TeacherView';
import { StudentView } from './components/StudentView';
import { Home } from './components/Home';

const INITIAL_STATE: GameState = {
  pin: '',
  phase: GamePhase.LOBBY,
  players: [],
  scenarios: [],
  currentScenarioIndex: 0,
  startTime: null,
};

const App: React.FC = () => {
  const [role, setRole] = useState<'teacher' | 'student' | null>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);

  // Global Effect: Click Ripple & Music Resume
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // 1. Tạo hiệu ứng Ripple (Sóng)
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      // 2. Kích hoạt nhạc nền ngay lần click đầu tiên (Fix lỗi trình duyệt chặn Autoplay)
      toggleBackgroundMusic(true);
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Sync state logic
  useEffect(() => {
    const unsubscribe = subscribeToGameEvents((event: GameEvent) => {
      // Logic for Teacher
      if (role === 'teacher') {
        if (event.type === 'PLAYER_JOIN') {
          playSound('join');
          setGameState(prev => {
            // Avoid duplicates
            if (prev.players.find(p => p.id === event.payload.id)) return prev;
            
            const newState = { ...prev, players: [...prev.players, event.payload] };
            // Host creates source of truth, so we broadcast back the new state
            broadcastEvent({ type: 'SYNC_STATE', payload: newState });
            return newState;
          });
        } 
        else if (event.type === 'PLAYER_ANSWER') {
          setGameState(prev => {
            const updatedPlayers = prev.players.map(p => {
              if (p.id === event.payload.playerId) {
                return { 
                  ...p, 
                  lastAnswerId: event.payload.answerId,
                  lastAnswerTime: event.payload.timeTaken
                };
              }
              return p;
            });
            const newState = { ...prev, players: updatedPlayers };
            // Optionally broadcast here if we want real-time answer counts on student devices
            broadcastEvent({ type: 'SYNC_STATE', payload: newState });
            return newState;
          });
        }
        else if (event.type === 'REQUEST_STATE') {
          // A late joiner or reconnected student needs the state
          broadcastEvent({ type: 'SYNC_STATE', payload: gameState });
        }
      } 
      
      // Logic for Student
      else if (role === 'student') {
        if (event.type === 'SYNC_STATE') {
          setGameState(event.payload);
        } else if (event.type === 'PLAY_SOUND') {
          playSound(event.payload);
        }
      }
    });

    return () => unsubscribe();
  }, [role, gameState]); // Add gameState to dependency to ensure Host has latest state when replying to REQUEST_STATE

  const handleBecomeHost = async () => {
    const newPin = generatePin();
    // Connect to Supabase Room
    await connectToGameRoom(newPin);
    
    const newState = { ...INITIAL_STATE, pin: newPin };
    setGameState(newState);
    setRole('teacher');
    
    // Broadcast initial state just in case
    setTimeout(() => broadcastEvent({ type: 'SYNC_STATE', payload: newState }), 1000);
  };

  const handleBecomeStudent = () => {
    setRole('student');
  };

  const handleUpdateGameState = (newState: GameState) => {
    setGameState(newState);
    broadcastEvent({ type: 'SYNC_STATE', payload: newState });
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col font-sans relative">
       {/* Background Animation */}
       <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#1e3c72] to-[#2a5298]"></div>
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-30 animate-float"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-30 animate-float" style={{animationDelay: '2s'}}></div>
       </div>

      {/* Watermark */}
      <div className="fixed top-4 right-4 z-50 text-white/30 font-bold text-xs md:text-sm pointer-events-none text-right">
        <div className="uppercase tracking-widest">Kỹ năng thích ứng và giải quyết vấn đề</div>
        <div>Nhóm 4</div>
      </div>

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {!role && <Home onHost={handleBecomeHost} onJoin={handleBecomeStudent} />}
        
        {role === 'teacher' && (
          <TeacherView 
            gameState={gameState} 
            updateGameState={handleUpdateGameState} 
          />
        )}
        
        {role === 'student' && (
          <StudentView 
            gameState={gameState} 
            localPlayerId={localPlayerId} 
            setLocalPlayerId={setLocalPlayerId}
          />
        )}
      </main>
    </div>
  );
};

export default App;