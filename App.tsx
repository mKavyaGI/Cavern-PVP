import React, { useState, useEffect, useRef } from 'react';
import { GameState, Role, TrapType, GRAVITY, JUMP_FORCE, MOVE_SPEED, MAX_FALL_SPEED, LEVEL_LENGTH, AppScreen, ChatMessage, ConnectionMode, NetworkMessage } from './types';
import { generateLevel } from './services/geminiService';
import { LocalNetwork, UDPNetwork, NetworkAdapter } from './services/p2p';
import { RunnerView } from './components/RunnerView';
import { TrapperView } from './components/TrapperView';
import { LobbyView } from './components/LobbyView';
import { ConnectionSetup } from './components/ConnectionSetup';

const INITIAL_GAME_STATE: GameState = {
  isPlaying: false,
  gameStatus: 'IDLE',
  level: [],
  player: {
    x: 100,
    y: 300,
    vx: 0,
    vy: 0,
    isGrounded: false,
    isDead: false,
    controlsReversed: false,
    reverseTimer: 0,
  },
  revives: 3,
  timeElapsed: 0,
  levelLength: LEVEL_LENGTH,
};

const App: React.FC = () => {
  const [role, setRole] = useState<Role>(null);
  const [screen, setScreen] = useState<AppScreen>('MENU');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('LOCAL');
  
  // Game State
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [isLoading, setIsLoading] = useState(false);
  
  // Networking/Lobby State
  const [isOpponentConnected, setIsOpponentConnected] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // Network Service
  const networkRef = useRef<NetworkAdapter | null>(null);
  
  // Input Refs for Runner
  const keysPressed = useRef<Set<string>>(new Set());
  
  // Game Loop Refs
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const stateRef = useRef<GameState>(INITIAL_GAME_STATE);

  // --- NETWORKING SETUP ---
  useEffect(() => {
    // We only init network when we leave menu
    if (screen === 'MENU') {
        networkRef.current?.disconnect();
        networkRef.current = null;
        setIsOpponentConnected(false);
        setChatHistory([]);
    }
  }, [screen]);

  const setupNetworkListeners = (adapter: NetworkAdapter) => {
      adapter.onMessage((data: NetworkMessage) => {
        switch (data.type) {
            case 'PING':
               setIsOpponentConnected(true);
               // Reply to ping to ensure both sides know
               adapter.send({ type: 'ACK_JOIN' });
               break;
            case 'JOIN_LOBBY':
              if (screen === 'LOBBY' || screen === 'CONNECTION') {
                 setIsOpponentConnected(true);
                 adapter.send({ type: 'ACK_JOIN' });
              }
              break;
            case 'ACK_JOIN':
               setIsOpponentConnected(true);
              break;
            case 'CHAT_MSG':
              setChatHistory(prev => [...prev, data.payload]);
              break;
            case 'START_GAME':
              if (role === 'TRAPPER') {
                startRemoteGame(data.payload);
              }
              break;
            case 'STATE_UPDATE':
              if (role === 'TRAPPER') {
                 setGameState(data.payload);
              }
              break;
            case 'TRAP_TRIGGER':
              if (role === 'RUNNER') {
                handleTrapTrigger(data.payload);
              }
              break;
          }
      });
  };

  // Periodic heartbeat
  useEffect(() => {
    if ((screen === 'LOBBY' || screen === 'GAME') && role && networkRef.current) {
      // Announce self
      networkRef.current.send({ type: 'JOIN_LOBBY', role });
      
      const interval = setInterval(() => {
        networkRef.current?.send({ type: 'JOIN_LOBBY', role });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [screen, role]);

  // --- INPUT LISTENERS (RUNNER) ---
  useEffect(() => {
    if (role !== 'RUNNER' || screen !== 'GAME') return;

    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [role, screen]);

  // --- ACTIONS ---

  const handleModeSelect = (selectedRole: Role, mode: ConnectionMode) => {
    setRole(selectedRole);
    setConnectionMode(mode);

    if (mode === 'LOCAL') {
        const adapter = new LocalNetwork();
        adapter.connect(selectedRole);
        setupNetworkListeners(adapter);
        networkRef.current = adapter;
        setScreen('LOBBY');
    } else if (mode === 'UDP_P2P') {
        // We delay connection until the Setup screen for UDP
        const adapter = new UDPNetwork();
        setupNetworkListeners(adapter);
        networkRef.current = adapter;
        setScreen('CONNECTION');
    }
  };

  const handleRemoteConnected = () => {
      setScreen('LOBBY');
  };

  const handleSendMessage = (text: string) => {
    if (!role) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: role,
      text,
      timestamp: Date.now(),
    };
    setChatHistory(prev => [...prev, msg]);
    networkRef.current?.send({ type: 'CHAT_MSG', payload: msg });
  };

  // Shared Game Start Action (Runner or Trapper Force Start)
  const initiateGame = async () => {
    setIsLoading(true);
    const generatedLevel = await generateLevel();
    setIsLoading(false);

    const newGame: GameState = {
      ...INITIAL_GAME_STATE,
      isPlaying: true,
      gameStatus: 'PLAYING',
      level: generatedLevel,
    };
    
    stateRef.current = newGame;
    setGameState(newGame);
    setScreen('GAME');

    // Notify other player if connected
    networkRef.current?.send({
      type: 'START_GAME',
      payload: generatedLevel
    });

    // Start Loop (Only if Runner - Trapper receives state updates)
    if (role === 'RUNNER') {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  // Trapper Action (Triggered via network)
  const startRemoteGame = (levelData: any[]) => {
    const newGame: GameState = {
      ...INITIAL_GAME_STATE,
      isPlaying: true,
      gameStatus: 'PLAYING',
      level: levelData,
    };
    setGameState(newGame);
    setScreen('GAME');
  };

  const handleTrapTrigger = (trapType: TrapType) => {
    const currentState = stateRef.current;
    if (currentState.gameStatus !== 'PLAYING') return;

    let newState = { ...currentState };
    const p = { ...newState.player };

    switch (trapType) {
      case TrapType.BOMB:
        p.vx = (Math.random() > 0.5 ? 12 : -12);
        p.vy = -12;
        p.isGrounded = false;
        break;
      case TrapType.CRACK:
        const platformUnder = newState.level.find(plat => 
           p.x + 20 > plat.x && 
           p.x + 10 < plat.x + plat.width &&
           p.y + 50 >= plat.y && p.y + 50 <= plat.y + 10
        );
        if (platformUnder) {
            newState.level = newState.level.filter(pl => pl.id !== platformUnder.id);
        }
        break;
      case TrapType.REVERSE:
        p.controlsReversed = true;
        p.reverseTimer = 3000;
        break;
    }

    newState.player = p;
    stateRef.current = newState;
  };

  const gameLoop = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const deltaTime = Math.min((time - lastTimeRef.current), 50);
    lastTimeRef.current = time;

    updatePhysics(deltaTime);
    
    networkRef.current?.send({
        type: 'STATE_UPDATE',
        payload: stateRef.current
    });

    setGameState(stateRef.current);
    
    if (stateRef.current.gameStatus === 'PLAYING') {
        requestRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const updatePhysics = (dt: number) => {
    const state = stateRef.current;
    const player = { ...state.player };
    let { x, y, vx, vy, isGrounded } = player;

    // Controls
    let moveDir = 0;
    if (keysPressed.current.has('ArrowLeft')) moveDir -= 1;
    if (keysPressed.current.has('ArrowRight')) moveDir += 1;

    if (player.controlsReversed) {
        moveDir *= -1;
        player.reverseTimer -= dt;
        if (player.reverseTimer <= 0) player.controlsReversed = false;
    }

    vx = moveDir * MOVE_SPEED;

    if (keysPressed.current.has('Space') && isGrounded) {
      vy = JUMP_FORCE;
      isGrounded = false;
    }

    // Physics
    vy += GRAVITY;
    vy = Math.min(vy, MAX_FALL_SPEED);

    let nextX = x + vx;
    let nextY = y + vy;
    
    // Collision
    isGrounded = false;
    if (vy >= 0) {
        for (const plat of state.level) {
            if (nextX + 30 > plat.x && nextX < plat.x + plat.width) {
                const feetY = y + 48;
                const nextFeetY = nextY + 48;
                
                if (feetY <= plat.y && nextFeetY >= plat.y) {
                    nextY = plat.y - 48;
                    vy = 0;
                    isGrounded = true;
                    break;
                }
            }
        }
    }

    player.x = nextX;
    player.y = nextY;
    player.vx = vx;
    player.vy = vy;
    player.isGrounded = isGrounded;

    // Win/Loss
    if (player.x >= state.levelLength) {
        stateRef.current = { ...state, player, gameStatus: 'WON', isPlaying: false };
        return;
    }

    if (player.y > 800) {
        if (state.revives > 0) {
            const safePlat = state.level
                .filter(p => p.x < player.x && p.x > 0)
                .sort((a, b) => b.x - a.x)[0] || state.level[0];
            
            player.x = safePlat.x;
            player.y = safePlat.y - 60;
            player.vx = 0;
            player.vy = 0;
            stateRef.current = { 
                ...state, 
                player, 
                revives: state.revives - 1 
            };
        } else {
            stateRef.current = { ...state, player, gameStatus: 'LOST', isPlaying: false };
        }
        return;
    }

    stateRef.current = {
        ...state,
        player,
        timeElapsed: state.timeElapsed + (dt / 1000)
    };
  };

  const sendTrap = (type: TrapType) => {
      networkRef.current?.send({
          type: 'TRAP_TRIGGER',
          payload: type
      });
  };

  // --- RENDER ---

  if (screen === 'MENU') {
    return (
        <div className="flex h-screen items-center justify-center bg-cave-900 font-mono text-ui-text">
            <div className="max-w-xl w-full p-8 border-2 border-cave-700 bg-cave-800 shadow-2xl relative">
                <h1 className="text-5xl font-bold mb-2 text-center tracking-tighter text-white">CAVERN PVP</h1>
                <p className="text-center text-cave-light mb-8 text-sm tracking-widest uppercase">
                  Asymmetric Network Warfare
                </p>
                
                <div className="space-y-6">
                   <div className="border border-cave-light/20 p-4">
                     <p className="text-xs text-cave-light mb-3 font-bold uppercase border-b border-cave-700 pb-1">1. Local Device (Testing)</p>
                     <div className="flex gap-2 mb-4">
                        <button 
                            onClick={() => handleModeSelect('RUNNER', 'LOCAL')}
                            className="flex-1 bg-cave-900 border border-cave-light/30 hover:bg-white hover:text-black py-2 text-[10px] uppercase transition-colors"
                        >
                            Host (Runner)
                        </button>
                        <button 
                            onClick={() => handleModeSelect('TRAPPER', 'LOCAL')}
                            className="flex-1 bg-cave-900 border border-cave-light/30 hover:border-ui-accent hover:text-ui-accent py-2 text-[10px] uppercase transition-colors"
                        >
                            Join (Trapper)
                        </button>
                     </div>

                     <p className="text-xs text-cave-light mb-3 font-bold uppercase border-b border-cave-700 pb-1">2. Network Play (UDP via LAN)</p>
                     <div className="flex gap-2">
                        <button 
                            onClick={() => handleModeSelect('RUNNER', 'UDP_P2P')}
                            className="flex-1 bg-cave-900 border border-cave-light/30 hover:bg-white hover:text-black py-2 text-[10px] uppercase transition-colors"
                        >
                             Host (Runner)
                        </button>
                        <button 
                            onClick={() => handleModeSelect('TRAPPER', 'UDP_P2P')}
                            className="flex-1 bg-cave-900 border border-cave-light/30 hover:border-ui-accent hover:text-ui-accent py-2 text-[10px] uppercase transition-colors"
                        >
                             Join (Trapper)
                        </button>
                     </div>
                   </div>
                </div>
            </div>
        </div>
    );
  }

  if (screen === 'CONNECTION' && role && networkRef.current) {
      return (
          <ConnectionSetup 
            role={role} 
            mode={connectionMode}
            network={networkRef.current as UDPNetwork}
            onConnected={handleRemoteConnected}
            onBack={() => setScreen('MENU')}
          />
      );
  }

  if (screen === 'LOBBY' && role) {
    return (
      <LobbyView 
        role={role}
        connectionMode={connectionMode}
        chatHistory={chatHistory}
        onSendMessage={handleSendMessage}
        onStartGame={initiateGame}
        isOpponentConnected={isOpponentConnected}
        isLoading={isLoading}
        onBack={() => setScreen('MENU')}
      />
    );
  }

  if (screen === 'GAME') {
    if (role === 'RUNNER') return <RunnerView gameState={gameState} onBack={() => setScreen('MENU')} />;
    if (role === 'TRAPPER') return <TrapperView gameState={gameState} sendTrap={sendTrap} onBack={() => setScreen('MENU')} />;
  }

  return null;
};

export default App;