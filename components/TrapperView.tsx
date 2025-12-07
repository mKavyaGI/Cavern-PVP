import React, { useEffect, useState } from 'react';
import { GameState, Platform, TrapType } from '../types';

interface TrapperViewProps {
  gameState: GameState;
  onBack: () => void;
  sendTrap: (type: TrapType) => void;
}

export const TrapperView: React.FC<TrapperViewProps> = ({ gameState, sendTrap, onBack }) => {
  const [cooldowns, setCooldowns] = useState<Record<TrapType, number>>({
    [TrapType.BOMB]: 0,
    [TrapType.CRACK]: 0,
    [TrapType.REVERSE]: 0,
  });

  const COOLDOWN_TIMES = {
    [TrapType.BOMB]: 3000,
    [TrapType.CRACK]: 5000,
    [TrapType.REVERSE]: 8000,
  };

  const handleTrap = (type: TrapType) => {
    if (cooldowns[type] > 0) return;
    if (gameState.gameStatus !== 'PLAYING') return;

    sendTrap(type);
    setCooldowns(prev => ({ ...prev, [type]: COOLDOWN_TIMES[type] }));
  };

  // Cooldown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => {
        const next = { ...prev };
        (Object.keys(next) as TrapType[]).forEach(key => {
          if (next[key] > 0) next[key] = Math.max(0, next[key] - 100);
        });
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Minimap scaling
  // We want to fit the relevant part of the level (near player) into the view, or scroll it.
  // The user requested a "Horizontal minimap... showing P1 as a moving red dot."
  // Let's make it a scrolling window.
  const mapHeight = 300;
  const scale = 0.15; // Scale down the world
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  
  // Center map on player x
  const mapOffset = Math.max(0, (gameState.player.x * scale) - (viewportWidth / 2));

  return (
    <div className="w-full h-screen bg-black flex flex-col">
      {/* Minimap Container */}
      <div className="relative flex-1 w-full bg-cave-900 overflow-hidden border-b-2 border-cave-700">
        <div className="absolute top-4 left-4 text-xs text-cave-light uppercase tracking-widest z-10">
          Tracking Subject #01
        </div>

        <button 
          onClick={onBack}
          className="absolute top-4 right-4 z-20 text-xs text-red-500 hover:text-white border border-red-500/50 hover:border-white px-2 py-1 uppercase tracking-widest transition-colors bg-black/50"
        >
          [ ABORT LINK ]
        </button>

        {/* The World (Scaled) */}
        <div 
          className="absolute top-1/2 left-0 h-full w-full transition-transform duration-75 linear"
          style={{ 
              transform: `translateY(-50%) translateX(${-mapOffset}px)`, 
              width: `${gameState.levelLength * scale}px` 
          }}
        >
             {/* Base line */}
            <div className="absolute top-[300px] w-full border-b border-cave-800/30"></div>

             {/* Platforms */}
             {gameState.level.map(p => (
                <div 
                    key={p.id}
                    className="absolute bg-cave-700/60"
                    style={{
                        left: `${p.x * scale}px`,
                        top: `${p.y * scale}px`,
                        width: `${p.width * scale}px`,
                        height: `${p.height * scale}px`,
                    }}
                />
             ))}

             {/* Player Dot */}
             {gameState.gameStatus !== 'LOST' && (
                 <div 
                    className="absolute w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_#ff0000] animate-pulse"
                    style={{
                        left: `${gameState.player.x * scale}px`,
                        top: `${gameState.player.y * scale}px`,
                    }}
                 />
             )}
        </div>
        
        {/* Scan lines effect overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none"></div>

        {gameState.gameStatus === 'WON' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
             <div className="text-center">
                <h2 className="text-4xl font-bold text-red-500 mb-4">SUBJECT ESCAPED</h2>
                <button onClick={onBack} className="border border-white px-4 py-2 text-white hover:bg-white hover:text-black">RETURN</button>
             </div>
          </div>
        )}

        {gameState.gameStatus === 'LOST' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
             <div className="text-center">
                <h2 className="text-4xl font-bold text-green-500 mb-4">SUBJECT ELIMINATED</h2>
                <button onClick={onBack} className="border border-white px-4 py-2 text-white hover:bg-white hover:text-black">RETURN</button>
             </div>
          </div>
        )}

      </div>

      {/* Controls Area */}
      <div className="h-64 bg-cave-900 p-8 flex items-center justify-center gap-8">
        <TrapButton 
            type={TrapType.BOMB} 
            label="BOMB" 
            icon="💣" 
            cooldown={cooldowns[TrapType.BOMB]} 
            maxCooldown={COOLDOWN_TIMES[TrapType.BOMB]}
            onClick={() => handleTrap(TrapType.BOMB)}
        />
        <TrapButton 
            type={TrapType.CRACK} 
            label="CRACK" 
            icon="🔨" 
            cooldown={cooldowns[TrapType.CRACK]} 
            maxCooldown={COOLDOWN_TIMES[TrapType.CRACK]}
            onClick={() => handleTrap(TrapType.CRACK)}
        />
        <TrapButton 
            type={TrapType.REVERSE} 
            label="REVERSE" 
            icon="😵" 
            cooldown={cooldowns[TrapType.REVERSE]} 
            maxCooldown={COOLDOWN_TIMES[TrapType.REVERSE]}
            onClick={() => handleTrap(TrapType.REVERSE)}
        />
      </div>
    </div>
  );
};

interface TrapButtonProps {
    type: TrapType;
    label: string;
    icon: string;
    cooldown: number;
    maxCooldown: number;
    onClick: () => void;
}

const TrapButton: React.FC<TrapButtonProps> = ({ label, icon, cooldown, maxCooldown, onClick }) => {
    const isReady = cooldown === 0;
    const progress = 100 - ((cooldown / maxCooldown) * 100);

    return (
        <button
            onClick={onClick}
            disabled={!isReady}
            className={`
                group relative w-32 h-32 flex flex-col items-center justify-center gap-2
                border-2 transition-all duration-100 active:scale-95
                ${isReady 
                    ? 'border-cave-light bg-cave-800 hover:border-ui-accent hover:bg-cave-700 cursor-pointer' 
                    : 'border-cave-800 bg-cave-900 opacity-50 cursor-not-allowed'}
            `}
        >
            {/* Cooldown Overlay */}
            {!isReady && (
                <div 
                    className="absolute bottom-0 left-0 w-full bg-ui-accent/20 transition-all duration-100 ease-linear"
                    style={{ height: `${cooldown / maxCooldown * 100}%` }}
                />
            )}

            <span className="text-4xl filter drop-shadow-lg grayscale group-hover:grayscale-0 transition-all">{icon}</span>
            <span className={`text-xs font-bold tracking-widest ${isReady ? 'text-ui-text' : 'text-cave-light'}`}>{label}</span>
            
            {/* Available indicator */}
            {isReady && <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-ping" />}
        </button>
    );
}