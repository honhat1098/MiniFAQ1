import React, { useState, useEffect } from 'react';
import { GameState, GamePhase, ScenarioNode } from '../types';
import { generateScenarios } from '../services/geminiService';
import { broadcastEvent, calculateScore, getAvatarUrl, getQrCodeUrl, toggleBackgroundMusic, playSound } from '../services/gameService';
import { Users, Play, Trophy, ArrowRight, BarChart2, Loader2, RefreshCcw, Volume2, VolumeX, Copy, FileJson, Sparkles, Clock, Crown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TeacherViewProps {
  gameState: GameState;
  updateGameState: (newState: GameState) => void;
}

const SAMPLE_JSON = `[
  {
    "opponentName": "Sếp Tuấn",
    "situationContext": "Bạn nộp báo cáo trễ deadline 1 tiếng.",
    "npcDialogue": "Sao giờ mới nộp? Em coi công ty là cái chợ hả?",
    "options": [
      {
        "text": "Dạ em xin lỗi, máy em bị lag xíu ạ.",
        "strategy": "Né tránh",
        "isOptimal": false,
        "npcReaction": "Lý do lý trấu. Trừ lương!",
        "tensionChange": 20,
        "trustChange": -10,
        "explanation": "Bào chữa không giải quyết được vấn đề."
      },
      {
        "text": "Em xin lỗi sếp. Em đã cố gắng hoàn thiện số liệu chuẩn nhất nên hơi trễ. Em xin rút kinh nghiệm sâu sắc.",
        "strategy": "Hợp tác",
        "isOptimal": true,
        "npcReaction": "Hừm, lần sau chú ý hơn.",
        "tensionChange": -10,
        "trustChange": 10,
        "explanation": "Nhận lỗi chân thành và khẳng định chất lượng công việc."
      }
    ]
  }
]`;

export const TeacherView: React.FC<TeacherViewProps> = ({ gameState, updateGameState }) => {
  const [loading, setLoading] = useState(false);
  const [topicInput, setTopicInput] = useState("Mâu thuẫn bài tập nhóm");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true); // Default True
  const [timeSetting, setTimeSetting] = useState(30); // Mặc định 30s
  
  // Modes: 'AI' or 'MANUAL'
  const [creationMode, setCreationMode] = useState<'AI' | 'MANUAL'>('AI');
  const [jsonInput, setJsonInput] = useState('');

  // Auto-play music on mount
  useEffect(() => {
    toggleBackgroundMusic(true);
  }, []);

  // Timer & Auto-Skip Logic
  useEffect(() => {
    if (gameState.phase === GamePhase.PLAYING && gameState.startTime) {
      const currentQ = gameState.scenarios[gameState.currentScenarioIndex];
      const totalPlayers = gameState.players.length;
      
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.startTime!) / 1000);
        const remaining = Math.max(0, currentQ.timeLimit - elapsed);
        setTimeLeft(remaining);

        // --- LOGIC: Tự động qua câu khi TẤT CẢ đã trả lời ---
        const answeredCount = gameState.players.filter(p => p.lastAnswerId).length;
        if (totalPlayers > 0 && answeredCount === totalPlayers) {
            clearInterval(timer);
            // Delay 1s cho mượt rồi mới hiện kết quả
            setTimeout(() => revealResult(), 1000);
            return;
        }
        
        // Hiệu ứng âm thanh khi sắp hết giờ (5s cuối)
        if (remaining <= 5 && remaining > 0) {
           broadcastEvent({ type: 'PLAY_SOUND', payload: 'tick' });
        }

        if (remaining === 0) {
          clearInterval(timer);
          revealResult();
        }
      }, 500); // Check 0.5s/lần cho mượt
      return () => clearInterval(timer);
    }
  }, [gameState.phase, gameState.startTime, gameState.currentScenarioIndex, gameState.players]);

  const toggleMusic = () => {
    const newState = !isMusicPlaying;
    setIsMusicPlaying(newState);
    toggleBackgroundMusic(newState);
  };

  const handleGenerate = async () => {
    setLoading(true);
    const scenarios = await generateScenarios(topicInput, 5);
    // Áp dụng thời gian cài đặt
    const timedScenarios = scenarios.map(s => ({ ...s, timeLimit: timeSetting }));
    updateGameState({ ...gameState, scenarios: timedScenarios });
    setLoading(false);
  };

  const handleManualImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const scenarios: ScenarioNode[] = parsed.map((item: any, idx: number) => ({
        id: `manual-${Date.now()}-${idx}`,
        opponentName: item.opponentName.replace(/\s*\(.*?\)\s*/g, '').trim(), 
        opponentAvatarId: Math.floor(Math.random() * 1000),
        situationContext: item.situationContext,
        npcDialogue: item.npcDialogue,
        timeLimit: timeSetting, // Áp dụng thời gian cài đặt
        options: item.options.map((opt: any, optIdx: number) => ({
          ...opt,
          id: `opt-${idx}-${optIdx}`
        }))
      }));
      updateGameState({ ...gameState, scenarios });
      alert(`Đã nhập thành công ${scenarios.length} tình huống!`);
    } catch (e) {
      alert("Lỗi định dạng JSON. Hãy kiểm tra lại!");
      console.error(e);
    }
  };

  const startGame = () => {
    // --- LOGIC: Chặn bắt đầu nếu 0 người chơi ---
    if (gameState.players.length === 0) {
        alert("⚠️ Cần ít nhất 1 người chơi để bắt đầu!");
        return;
    }
    updateGameState({ 
      ...gameState, 
      phase: GamePhase.PLAYING, 
      currentScenarioIndex: 0,
      startTime: Date.now() 
    });
  };

  const revealResult = () => {
    updateGameState({ ...gameState, phase: GamePhase.RESULT_REVEAL });
  };

  const handleNext = () => {
    const currentScenario = gameState.scenarios[gameState.currentScenarioIndex];
    const updatedPlayers = gameState.players.map(player => {
        const selectedOpt = currentScenario.options.find(o => o.id === player.lastAnswerId);
        if (selectedOpt) {
            const addedScore = calculateScore(
                currentScenario.timeLimit - (player.lastAnswerTime || 0),
                currentScenario.timeLimit,
                selectedOpt.isOptimal ? player.streak + 1 : 0,
                selectedOpt.isOptimal
            );
            return {
                ...player,
                score: player.score + addedScore,
                streak: selectedOpt.isOptimal ? player.streak + 1 : 0
            };
        }
        return { ...player, streak: 0 };
    });

    updatedPlayers.sort((a, b) => b.score - a.score);

    // Chuyển sang Bảng xếp hạng sau mỗi câu
    updateGameState({ 
        ...gameState, 
        players: updatedPlayers,
        phase: GamePhase.LEADERBOARD 
    });
  };

  const nextScenario = () => {
      const nextIdx = gameState.currentScenarioIndex + 1;
      if (nextIdx < gameState.scenarios.length) {
          updateGameState({
              ...gameState,
              phase: GamePhase.PLAYING,
              currentScenarioIndex: nextIdx,
              startTime: Date.now(),
              players: gameState.players.map(p => ({ ...p, lastAnswerId: undefined, lastAnswerTime: undefined }))
          });
      } else {
          // Kết thúc game -> Hiện Vinh Danh và Phát nhạc
          playSound('victory');
          updateGameState({ ...gameState, phase: GamePhase.FINISHED });
      }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Đã copy link tham gia!");
  };

  // LOBBY
  if (gameState.phase === GamePhase.LOBBY) {
    const qrUrl = getQrCodeUrl(window.location.href);

    return (
      <div className="h-full flex flex-col p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-2xl font-bold flex items-center gap-2">
             <span className="text-brand-yellow">Lobby</span>
           </h2>
           <button onClick={toggleMusic} className={`p-3 rounded-full transition-colors ${isMusicPlaying ? 'bg-brand-accent text-white animate-pulse' : 'bg-white/10 text-white/50'}`}>
             {isMusicPlaying ? <Volume2 /> : <VolumeX />}
           </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 h-full">
          {/* Config Panel */}
          <div className="w-full md:w-1/3 glass-panel rounded-3xl p-6 flex flex-col">
            <div className="flex gap-2 mb-4 bg-black/20 p-1 rounded-xl">
               <button 
                 onClick={() => setCreationMode('AI')} 
                 className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${creationMode === 'AI' ? 'bg-brand-purple text-white shadow-md' : 'text-white/50 hover:bg-white/5'}`}
               >
                 <Sparkles size={16} /> AI Tạo
               </button>
               <button 
                 onClick={() => setCreationMode('MANUAL')} 
                 className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${creationMode === 'MANUAL' ? 'bg-brand-purple text-white shadow-md' : 'text-white/50 hover:bg-white/5'}`}
               >
                 <FileJson size={16} /> Tự Nhập
               </button>
            </div>

            {creationMode === 'AI' ? (
              <div className="mb-4 animate-pop">
                <label className="text-xs uppercase font-bold text-white/60 mb-1 block">Chủ đề </label>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    className="flex-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-brand-yellow outline-none"
                    placeholder="VD: Drama công sở..."
                  />
                  <button onClick={handleGenerate} disabled={loading} className="bg-brand-accent p-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
                  </button>
                </div>

                <label className="text-xs uppercase font-bold text-white/60 mb-1 block flex justify-between">
                    <span>Thời gian mỗi câu</span>
                    <span className="text-brand-yellow font-mono text-lg">{timeSetting}s</span>
                </label>
                <input 
                    type="range" 
                    min="10" 
                    max="120" 
                    step="5" 
                    value={timeSetting} 
                    onChange={(e) => setTimeSetting(Number(e.target.value))} 
                    className="w-full accent-brand-yellow h-2 bg-black/30 rounded-lg appearance-none cursor-pointer mb-2"
                />
              </div>
            ) : (
               <div className="mb-4 flex flex-col h-48 animate-pop">
                 <label className="text-xs uppercase font-bold text-white/60 mb-1 block flex justify-between">
                   <span>JSON Data</span>
                   <span className="cursor-pointer text-brand-yellow hover:underline" onClick={() => setJsonInput(SAMPLE_JSON)}>Mẫu</span>
                 </label>
                 <textarea 
                   value={jsonInput}
                   onChange={(e) => setJsonInput(e.target.value)}
                   className="flex-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-brand-yellow outline-none resize-none"
                   placeholder="Dán JSON vào đây..."
                 />
                 <button onClick={handleManualImport} className="mt-2 bg-white/10 hover:bg-white/20 py-2 rounded-lg text-xs font-bold uppercase">Nhập Dữ Liệu</button>
               </div>
            )}
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4 scrollbar-hide">
               {gameState.scenarios.length === 0 && <div className="text-center opacity-30 text-sm mt-10">Chưa có tình huống nào</div>}
               {gameState.scenarios.map((s, i) => (
                   <div key={s.id} className="bg-white/5 p-3 rounded-lg border-l-2 border-brand-yellow text-sm group relative hover:bg-white/10 transition-colors">
                       <div className="font-bold text-brand-yellow mb-1">Cảnh {i+1}: {s.opponentName}</div>
                       <div className="opacity-80 line-clamp-2">{s.npcDialogue}</div>
                       <div className="absolute right-2 top-2 text-xs opacity-50 bg-black/40 px-2 py-1 rounded">{s.timeLimit}s</div>
                   </div>
               ))}
            </div>

            <button 
              onClick={startGame}
              disabled={gameState.scenarios.length === 0 || gameState.players.length === 0}
              className="w-full py-4 bg-brand-yellow text-brand-dark rounded-xl font-black text-xl shadow-lg hover:bg-yellow-400 disabled:opacity-50 disabled:grayscale transition-transform active:scale-95"
            >
              {gameState.players.length === 0 ? 'ĐỢI NGƯỜI CHƠI...' : 'BẮT ĐẦU GAME'}
            </button>
          </div>

          {/* Join Panel */}
          <div className="w-full md:w-2/3 glass-panel rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-yellow via-brand-red to-brand-purple"></div>
             
             <div className="flex flex-col md:flex-row items-center gap-8 mb-8 z-10">
                <div className="bg-white p-4 rounded-xl shadow-2xl">
                    <img src={qrUrl} alt="Join QR" className="w-48 h-48 md:w-56 md:h-56 mix-blend-multiply" />
                </div>
                <div className="text-center md:text-left space-y-4">
                    <div>
                        <div className="text-sm uppercase tracking-widest opacity-70">Tham gia tại</div>
                        <div className="text-2xl font-bold break-all">harmony-heroes.web.app</div>
                    </div>
                    <div>
                        <div className="text-sm uppercase tracking-widest opacity-70">Mã PIN</div>
                        <div className="text-6xl font-black font-mono tracking-widest text-brand-yellow drop-shadow-lg">
                            {gameState.pin}
                        </div>
                    </div>
                    <button onClick={copyLink} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors mx-auto md:mx-0">
                        <Copy size={16} /> Copy Link
                    </button>
                </div>
             </div>

             <div className="w-full max-w-3xl">
                <div className="flex items-center gap-3 mb-4 text-xl font-bold border-b border-white/10 pb-2">
                    <Users /> {gameState.players.length} Người chơi
                </div>
                <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto justify-center">
                    {gameState.players.map(p => (
                        <div key={p.id} className="bg-white/10 px-4 py-2 rounded-full flex items-center gap-2 animate-pop border border-white/10">
                            <img src={getAvatarUrl(p.avatarId)} className="w-6 h-6 rounded-full bg-white" />
                            <span className="font-bold text-sm">{p.name}</span>
                        </div>
                    ))}
                    {gameState.players.length === 0 && (
                        <div className="opacity-50 italic">Đang chờ người tham gia quét mã...</div>
                    )}
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // GAMEPLAY & REVEAL
  if (gameState.phase === GamePhase.PLAYING || gameState.phase === GamePhase.RESULT_REVEAL) {
    const currentS = gameState.scenarios[gameState.currentScenarioIndex];
    const answeredCount = gameState.players.filter(p => p.lastAnswerId).length;
    const totalPlayers = gameState.players.length;
    const displayName = currentS.opponentName.replace(/\s*\(.*?\)\s*/g, '').trim();

    return (
      <div className="h-full flex flex-col items-center justify-center p-4 relative">
        {/* Timer Bar */}
        {gameState.phase === GamePhase.PLAYING && (
            <div className="absolute top-0 left-0 h-2 bg-brand-accent transition-all duration-1000 ease-linear z-50 shadow-[0_0_10px_#00b894]" style={{ width: `${(timeLeft / currentS.timeLimit) * 100}%` }}></div>
        )}

        {/* Cinematic Chat Container */}
        <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col h-[80vh] shadow-2xl relative">
             {/* Header */}
             <div className="bg-black/20 p-4 flex justify-between items-center backdrop-blur-md">
                 <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-full bg-white border-2 border-brand-yellow overflow-hidden">
                         <img src={getAvatarUrl(currentS.opponentAvatarId)} className="w-full h-full" />
                     </div>
                     <div>
                         <div className="font-bold text-lg">{displayName}</div>
                         <div className="text-xs opacity-70">{currentS.situationContext}</div>
                     </div>
                 </div>
                 <div className="text-right">
                     <div className="text-xs uppercase opacity-50">Trả lời</div>
                     <div className="text-2xl font-bold font-mono">{answeredCount} / {totalPlayers}</div>
                 </div>
             </div>

             {/* Chat Area */}
             <div className="flex-1 p-6 md:p-10 overflow-y-auto space-y-6 bg-black/10">
                 {/* NPC Message */}
                 <div className="flex gap-4 items-start">
                     <img src={getAvatarUrl(currentS.opponentAvatarId)} className="w-10 h-10 rounded-full bg-white mt-1" />
                     <div className="bg-white text-brand-dark p-4 rounded-2xl rounded-tl-none shadow-lg max-w-[80%]">
                         <div className="text-lg md:text-xl font-medium leading-relaxed">{currentS.npcDialogue}</div>
                     </div>
                 </div>

                 {/* Result Reveal */}
                 {gameState.phase === GamePhase.RESULT_REVEAL && (
                     <>
                        <div className="flex gap-4 items-end justify-end animate-pop">
                             <div className="bg-brand-accent text-white p-4 rounded-2xl rounded-tr-none shadow-lg max-w-[80%]">
                                 <div className="text-lg font-bold">
                                     {currentS.options.find(o => o.isOptimal)?.text}
                                 </div>
                                 <div className="mt-2 text-xs bg-black/20 px-2 py-1 rounded inline-block">
                                     Chiến lược: {currentS.options.find(o => o.isOptimal)?.strategy}
                                 </div>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-brand-dark border-2 border-white flex items-center justify-center font-bold text-xs">ME</div>
                        </div>

                        <div className="flex gap-4 items-start animate-pop" style={{animationDelay: '0.5s'}}>
                             <img src={getAvatarUrl(currentS.opponentAvatarId)} className="w-10 h-10 rounded-full bg-white mt-1" />
                             <div className="bg-gray-200 text-brand-dark p-4 rounded-2xl rounded-tl-none shadow-lg max-w-[80%] opacity-90 italic">
                                 {currentS.options.find(o => o.isOptimal)?.npcReaction}
                             </div>
                        </div>

                        {/* Explanation Box */}
                        <div className="mt-8 bg-black/40 p-6 rounded-xl border border-white/10 animate-pop text-center" style={{animationDelay: '1s'}}>
                            <h3 className="text-brand-yellow font-bold uppercase mb-2">Phân tích tình huống</h3>
                            <p className="text-lg">{currentS.options.find(o => o.isOptimal)?.explanation}</p>
                            
                            <div className="flex justify-center gap-8 mt-4">
                                <div className="text-center">
                                    <div className="text-xs uppercase opacity-60">Độ Quạo</div>
                                    <div className={`font-bold text-xl ${currentS.options.find(o => o.isOptimal)!.tensionChange > 0 ? 'text-brand-red' : 'text-brand-accent'}`}>
                                        {currentS.options.find(o => o.isOptimal)!.tensionChange > 0 ? '+' : ''}{currentS.options.find(o => o.isOptimal)!.tensionChange}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-xs uppercase opacity-60">Niềm tin</div>
                                    <div className={`font-bold text-xl ${currentS.options.find(o => o.isOptimal)!.trustChange > 0 ? 'text-brand-accent' : 'text-brand-red'}`}>
                                        {currentS.options.find(o => o.isOptimal)!.trustChange > 0 ? '+' : ''}{currentS.options.find(o => o.isOptimal)!.trustChange}
                                    </div>
                                </div>
                            </div>
                        </div>
                     </>
                 )}
             </div>

             {/* Footer Actions */}
             <div className="p-4 bg-black/20 flex justify-center">
                 {gameState.phase === GamePhase.PLAYING ? (
                     <div className="text-2xl font-bold font-mono text-brand-yellow animate-pulse flex items-center gap-2">
                         <Clock size={24} /> {timeLeft}s
                     </div>
                 ) : (
                     <button onClick={handleNext} className="bg-white text-brand-dark px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-lg">
                         Xem Bảng Xếp Hạng <ArrowRight size={20} />
                     </button>
                 )}
             </div>
        </div>
      </div>
    );
  }

  // LEADERBOARD
  if (gameState.phase === GamePhase.LEADERBOARD) {
      const currentS = gameState.scenarios[gameState.currentScenarioIndex];
      const stats = currentS.options.map(opt => ({
          name: opt.strategy,
          count: gameState.players.filter(p => p.lastAnswerId === opt.id).length,
          isOptimal: opt.isOptimal
      }));

      return (
          <div className="h-full flex flex-col p-6 max-w-6xl mx-auto animate-pop">
              <h2 className="text-4xl font-black text-center mb-8 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow to-brand-red">Kết Quả Vòng Này</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="glass-panel p-6 rounded-3xl h-80">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats} layout="vertical">
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="name" width={100} tick={{fill: 'white', fontSize: 12}} />
                              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={40}>
                                  {stats.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.isOptimal ? '#00b894' : '#636e72'} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  
                  <div className="glass-panel p-6 rounded-3xl overflow-y-auto">
                      <h3 className="font-bold text-xl mb-4 flex items-center gap-2"><Trophy className="text-brand-yellow" /> Top 5 Nhanh Nhất</h3>
                      {gameState.players.slice(0, 5).map((p, i) => (
                          <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-2 animate-pop" style={{animationDelay: `${i * 0.1}s`}}>
                              <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i===0 ? 'bg-brand-yellow text-black' : 'bg-white/20'}`}>{i+1}</div>
                                  <span className="font-bold">{p.name}</span>
                              </div>
                              <span className="font-mono text-brand-accent font-bold">{p.score}</span>
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className="flex justify-end">
                  <button onClick={nextScenario} className="bg-brand-accent text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-emerald-600">
                      {gameState.currentScenarioIndex < gameState.scenarios.length - 1 ? 'Tình huống tiếp theo' : 'Tổng kết & Vinh Danh'}
                  </button>
              </div>
          </div>
      )
  }

  // FINISHED (PODIUM)
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Confetti Background */}
        {[...Array(40)].map((_, i) => (
            <div key={i} className="confetti-piece" style={{ 
                left: `${Math.random() * 100}%`, 
                animationDuration: `${Math.random() * 3 + 2}s`, 
                animationDelay: `${Math.random() * 2}s`,
                animationName: 'fall'
            }}></div>
        ))}
        
        {/* Spotlights */}
        <div className="spotlight spotlight-left"></div>
        <div className="spotlight spotlight-right"></div>
        <div className="spotlight spotlight-center"></div>

        <h1 className="text-6xl font-black mb-12 uppercase tracking-tighter text-brand-yellow drop-shadow-lg animate-bounce-gentle z-10">
            VINH DANH
        </h1>
        
        {/* Podium Container */}
        <div className="flex items-end justify-center gap-4 md:gap-8 mb-12 z-10">
            {/* 2nd Place */}
            {gameState.players[1] && (
                <div className="flex flex-col items-center animate-pop" style={{animationDelay: '0.5s'}}>
                    <div className="w-20 h-20 rounded-full border-4 border-gray-300 overflow-hidden mb-2 shadow-lg bg-gray-200">
                        <img src={getAvatarUrl(gameState.players[1].avatarId)} className="w-full h-full bg-white" />
                    </div>
                    <div className="font-bold text-lg mb-1">{gameState.players[1].name}</div>
                    <div className="bg-gradient-to-b from-gray-300 to-gray-400 w-24 h-32 rounded-t-lg flex items-center justify-center shadow-lg border-t-4 border-gray-200 relative">
                        <span className="text-4xl font-black text-gray-600 opacity-60">2</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1 rounded-full mt-2 text-sm font-mono">{gameState.players[1].score} pts</div>
                </div>
            )}

            {/* 1st Place */}
            {gameState.players[0] && (
                <div className="flex flex-col items-center order-first md:order-none animate-pop z-20">
                     <Crown className="text-brand-yellow w-12 h-12 mb-2 animate-bounce-gentle filter drop-shadow-[0_0_10px_gold]" />
                    <div className="w-32 h-32 rounded-full border-4 border-brand-yellow overflow-hidden mb-2 shadow-[0_0_30px_rgba(253,203,110,0.6)] bg-yellow-100">
                        <img src={getAvatarUrl(gameState.players[0].avatarId)} className="w-full h-full bg-white" />
                    </div>
                    <div className="font-bold text-2xl mb-1 text-brand-yellow text-shadow">{gameState.players[0].name}</div>
                    <div className="bg-gradient-to-b from-yellow-300 to-yellow-500 w-32 h-48 rounded-t-lg flex items-center justify-center shadow-2xl border-t-4 border-yellow-200 relative overflow-hidden">
                        <span className="text-6xl font-black text-yellow-700 opacity-50">1</span>
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                    <div className="bg-brand-yellow text-black px-6 py-2 rounded-full mt-4 font-black font-mono shadow-[0_0_20px_rgba(253,203,110,0.8)] text-xl transform scale-110">{gameState.players[0].score} PTS</div>
                </div>
            )}

            {/* 3rd Place */}
            {gameState.players[2] && (
                <div className="flex flex-col items-center animate-pop" style={{animationDelay: '0.8s'}}>
                    <div className="w-20 h-20 rounded-full border-4 border-orange-400 overflow-hidden mb-2 shadow-lg bg-orange-200">
                        <img src={getAvatarUrl(gameState.players[2].avatarId)} className="w-full h-full bg-white" />
                    </div>
                    <div className="font-bold text-lg mb-1">{gameState.players[2].name}</div>
                    <div className="bg-gradient-to-b from-orange-400 to-orange-600 w-24 h-24 rounded-t-lg flex items-center justify-center shadow-lg border-t-4 border-orange-300">
                        <span className="text-4xl font-black text-orange-900 opacity-50">3</span>
                    </div>
                    <div className="bg-black/40 px-3 py-1 rounded-full mt-2 text-sm font-mono">{gameState.players[2].score} pts</div>
                </div>
            )}
        </div>

        <button onClick={() => window.location.reload()} className="mt-8 bg-white/10 hover:bg-white/20 px-8 py-3 rounded-full transition-colors z-10 font-bold uppercase tracking-wider">
            Chơi lại
        </button>
    </div>
  );
};