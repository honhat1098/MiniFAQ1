import React, { useState, useEffect } from 'react';
import { GamePhase, GameState, Player } from '../types';
import { broadcastEvent, getAvatarUrl, playSound, connectToGameRoom } from '../services/gameService';
import { Send, Clock, AlertCircle } from 'lucide-react';

interface StudentViewProps {
  gameState: GameState;
  localPlayerId: string | null;
  setLocalPlayerId: (id: string) => void;
}

export const StudentView: React.FC<StudentViewProps> = ({ gameState, localPlayerId, setLocalPlayerId }) => {
  const [name, setName] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const me = gameState.players.find(p => p.id === localPlayerId);

  useEffect(() => {
    setHasAnswered(false);
  }, [gameState.currentScenarioIndex]);

  const handleJoin = async () => {
    if (!name || !pinInput) return;
    setIsJoining(true);
    
    try {
      // 1. Connect to the room first
      await connectToGameRoom(pinInput);

      // 2. Create Player Object
      const newPlayer: Player = {
        id: `player-${Date.now()}`,
        name: name,
        score: 0,
        streak: 0,
        avatarId: Math.floor(Math.random() * 1000)
      };

      setLocalPlayerId(newPlayer.id);

      // 3. Ask Host to add me (or ask for state if game already running)
      broadcastEvent({ type: 'PLAYER_JOIN', payload: newPlayer });
      
      // 4. Request current state explicitly (handles late join)
      setTimeout(() => {
        broadcastEvent({ type: 'REQUEST_STATE', payload: { playerId: newPlayer.id } });
      }, 500);

    } catch (e) {
      alert("Lỗi kết nối server!");
      setIsJoining(false);
    }
  };

  const handleAnswer = (optionId: string) => {
    if (hasAnswered) return;
    setHasAnswered(true);
    const timeTaken = gameState.startTime ? Math.floor((Date.now() - gameState.startTime) / 1000) : 0;
    
    playSound('correct'); 

    broadcastEvent({ 
      type: 'PLAYER_ANSWER', 
      payload: { playerId: localPlayerId!, answerId: optionId, timeTaken } 
    });
  };

  // 1. LOGIN
  if (!localPlayerId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="glass-panel w-full max-w-md p-8 rounded-3xl">
          <h2 className="text-3xl font-black text-center mb-8">Tham Gia</h2>
          <div className="space-y-4">
            <input type="text" placeholder="Mã PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} 
                   className="w-full bg-black/20 p-4 rounded-xl text-center text-xl font-mono tracking-widest text-white border border-white/20 focus:border-brand-yellow outline-none" />
            <input type="text" placeholder="Tên của bạn" value={name} onChange={e => setName(e.target.value)} 
                   className="w-full bg-black/20 p-4 rounded-xl text-center text-xl font-bold text-white border border-white/20 focus:border-brand-yellow outline-none" />
            <button onClick={handleJoin} disabled={isJoining} className="w-full bg-brand-yellow text-brand-dark font-black p-4 rounded-xl shadow-lg hover:bg-yellow-400 active:scale-95 transition-transform disabled:opacity-50">
              {isJoining ? 'ĐANG KẾT NỐI...' : 'VÀO GAME'}
            </button>
            <p className="text-xs text-center opacity-60 mt-2">Đảm bảo nhập đúng PIN trên màn hình chủ trì</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. LOBBY (Waiting for Host Sync)
  if (gameState.phase === GamePhase.LOBBY || !gameState.pin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-32 h-32 rounded-full border-4 border-white mb-6 animate-bounce-gentle overflow-hidden bg-white mx-auto">
           <img src={getAvatarUrl(me?.avatarId || 0)} className="w-full h-full" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Xin chào, {me?.name}!</h2>
        <p className="opacity-70 animate-pulse">
           {gameState.pin ? "Đang đợi Host bắt đầu..." : "Đang đồng bộ với Host..."}
        </p>
      </div>
    );
  }

  // 3. PLAYING & RESULTS (Mobile Chat UI)
  if (gameState.phase === GamePhase.PLAYING || gameState.phase === GamePhase.RESULT_REVEAL || gameState.phase === GamePhase.LEADERBOARD || gameState.phase === GamePhase.FINISHED) {
      const currentS = gameState.scenarios[gameState.currentScenarioIndex];
      // Only useful if in LEADERBOARD or RESULT phase
      const myAnswer = currentS?.options.find(o => o.id === me?.lastAnswerId);
      const isOptimal = myAnswer?.isOptimal;

      if (!currentS) return <div>Loading scenario...</div>;

      return (
          <div className="h-full flex flex-col max-w-lg mx-auto bg-black/20 md:rounded-3xl overflow-hidden md:border border-white/10 md:my-4 md:h-[95%]">
              {/* Header */}
              <div className="p-4 bg-brand-dark/80 backdrop-blur-md flex items-center gap-3 border-b border-white/10">
                  <div className="relative">
                      <img src={getAvatarUrl(currentS.opponentAvatarId)} className="w-10 h-10 rounded-full bg-white" />
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-brand-dark"></div>
                  </div>
                  <div className="flex-1">
                      <div className="font-bold text-sm">{currentS.opponentName}</div>
                      <div className="text-xs opacity-70">Đang hoạt động</div>
                  </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* NPC Message */}
                  <div className="flex gap-2 max-w-[85%]">
                      <img src={getAvatarUrl(currentS.opponentAvatarId)} className="w-8 h-8 rounded-full bg-white mt-1 shrink-0" />
                      <div className="bg-white text-brand-dark p-3 rounded-2xl rounded-tl-none shadow-sm text-sm">
                          {currentS.npcDialogue}
                      </div>
                  </div>

                  {/* My Answer (If answered) */}
                  {hasAnswered && (
                      <div className="flex gap-2 max-w-[85%] ml-auto justify-end">
                          <div className={`p-3 rounded-2xl rounded-tr-none shadow-sm text-sm text-white ${isOptimal === false && gameState.phase !== GamePhase.PLAYING ? 'bg-brand-red' : 'bg-brand-accent'}`}>
                             {myAnswer?.text}
                             {/* Show feedback if revealing */}
                             {gameState.phase !== GamePhase.PLAYING && (
                                 <div className="mt-2 pt-2 border-t border-white/20 text-xs font-bold flex items-center gap-1">
                                     {isOptimal ? '✅ Chiến lược tốt nhất' : '⚠️ Có cách tốt hơn'}
                                 </div>
                             )}
                          </div>
                      </div>
                  )}
                  
                  {/* NPC Reply (Result Phase) */}
                  {gameState.phase !== GamePhase.PLAYING && hasAnswered && (
                      <div className="flex gap-2 max-w-[85%] animate-pop delay-75">
                          <img src={getAvatarUrl(currentS.opponentAvatarId)} className="w-8 h-8 rounded-full bg-white mt-1 shrink-0" />
                          <div className="bg-gray-200 text-brand-dark p-3 rounded-2xl rounded-tl-none shadow-sm text-sm italic">
                              {myAnswer?.npcReaction}
                          </div>
                      </div>
                  )}

                  {gameState.phase === GamePhase.FINISHED && (
                      <div className="text-center py-4">
                          <div className="inline-block bg-brand-yellow text-brand-dark px-4 py-2 rounded-full font-bold">
                              Tổng điểm: {me?.score}
                          </div>
                      </div>
                  )}
              </div>

              {/* Input Area (Options) */}
              {gameState.phase === GamePhase.PLAYING && !hasAnswered && (
                  <div className="p-3 bg-brand-dark/90 backdrop-blur-md border-t border-white/10 grid grid-cols-1 gap-2 pb-safe">
                      {currentS.options.map((opt) => (
                          <button 
                            key={opt.id}
                            onClick={() => handleAnswer(opt.id)}
                            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl text-left text-sm transition-colors border border-white/5 active:scale-98"
                          >
                             {opt.text}
                          </button>
                      ))}
                  </div>
              )}
              
              {gameState.phase === GamePhase.PLAYING && hasAnswered && (
                   <div className="p-6 text-center opacity-60 text-sm animate-pulse">
                       Đang đợi những người khác...
                   </div>
              )}
              
              {gameState.phase !== GamePhase.PLAYING && gameState.phase !== GamePhase.FINISHED && (
                  <div className="p-4 text-center">
                      <div className="text-xs uppercase opacity-50 mb-1">Điểm hiện tại</div>
                      <div className="text-2xl font-mono font-bold">{me?.score}</div>
                      <div className="text-xs text-brand-yellow mt-1">Nhìn lên màn hình lớn nhé!</div>
                  </div>
              )}
          </div>
      );
  }

  return <div>Loading...</div>;
};
