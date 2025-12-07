export type Role = 'RUNNER' | 'TRAPPER' | null;

export interface Point {
  x: number;
  y: number;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  isDead: boolean;
  controlsReversed: boolean;
  reverseTimer: number;
}

export interface GameState {
  isPlaying: boolean;
  gameStatus: 'IDLE' | 'PLAYING' | 'WON' | 'LOST';
  level: Platform[];
  player: PlayerState;
  revives: number;
  timeElapsed: number;
  levelLength: number;
}

export enum TrapType {
  BOMB = 'BOMB',
  CRACK = 'CRACK',
  REVERSE = 'REVERSE',
}

export interface TrapAction {
  type: TrapType;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender: Role;
  text: string;
  timestamp: number;
}

// UDP_P2P uses the Server for signaling (TCP) then switches to WebRTC (UDP) for data
export type ConnectionMode = 'LOCAL' | 'UDP_P2P'; 
export type AppScreen = 'MENU' | 'CONNECTION' | 'LOBBY' | 'GAME';

export const GRAVITY = 0.6;
export const JUMP_FORCE = -12;
export const MOVE_SPEED = 5;
export const MAX_FALL_SPEED = 15;
export const LEVEL_LENGTH = 4000;

// Network Internal Types
export type MessageType = 
  | 'PING' 
  | 'JOIN_LOBBY' 
  | 'ACK_JOIN' 
  | 'CHAT_MSG' 
  | 'START_GAME' 
  | 'STATE_UPDATE' 
  | 'TRAP_TRIGGER'
  // Signaling Messages
  | 'SIGNAL_OFFER'
  | 'SIGNAL_ANSWER'
  | 'SIGNAL_ICE';

export interface NetworkMessage {
  type: MessageType;
  payload?: any;
  role?: Role;
  target?: Role;
}