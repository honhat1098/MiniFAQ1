export enum GamePhase {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  RESULT_REVEAL = 'RESULT_REVEAL',
  LEADERBOARD = 'LEADERBOARD',
  FINISHED = 'FINISHED'
}

export interface ScenarioNode {
  id: string;
  opponentName: string;
  opponentAvatarId: number;
  situationContext: string; // "Bối cảnh: Bạn cùng phòng..."
  npcDialogue: string; // What the NPC says
  timeLimit: number;
  options: {
    id: string;
    text: string; // The player's reply
    strategy: string; 
    isOptimal: boolean; 
    tensionChange: number; // e.g., +20 (bad), -10 (good)
    trustChange: number;   // e.g., -10 (bad), +20 (good)
    npcReaction: string;   // How NPC replies to this specific option
    explanation: string;
  }[];
}

export interface Player {
  id: string;
  name: string;
  score: number;
  streak: number;
  lastAnswerId?: string;
  lastAnswerTime?: number;
  avatarId: number;
}

export interface GameState {
  pin: string;
  phase: GamePhase;
  players: Player[];
  scenarios: ScenarioNode[];
  currentScenarioIndex: number;
  startTime: number | null;
}

export type GameEvent = 
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'REQUEST_STATE'; payload: { playerId: string } } // New event: Student asks for current state
  | { type: 'PLAYER_JOIN'; payload: Player }
  | { type: 'PLAYER_ANSWER'; payload: { playerId: string; answerId: string; timeTaken: number } }
  | { type: 'HOST_ACTION'; payload: Partial<GameState> }
  | { type: 'PLAY_SOUND'; payload: 'join' | 'correct' | 'wrong' | 'tick' };
