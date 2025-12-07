import React, { useEffect, useRef } from 'react';
import { GameState, PlayerState, Platform } from '../types';

interface RunnerViewProps {
  gameState: GameState;
  onBack: () => void;
  sendAction?: (action: any) => void;
}

export const RunnerView: React.FC<RunnerViewProps> = ({ gameState, onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera follow logic
  // We want the player to be roughly in the center left of the screen, but clamp at start/end
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const cameraX = Math.max(0, gameState.player.x - viewportWidth * 0.3);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-cave-900"
    >
      {/* HUD Layer */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-50">
        <div className="flex flex-col gap-2">
          <div className="bg-cave-800/80 border border-cave-700 px-4 py-2 text-2xl font-bold tracking-widest text-white backdrop-blur-sm">
            TIME: {gameState.timeElapsed.toFixed(1)}s
          </div>
          {gameState.player.controlsReversed && (
             <div className="text-red-500 font-bold animate-pulse text-lg">
               ⚠ CONTROLS REVERSED ⚠
             </div>
          )}
        </div>

        {/* Right Side HUD */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
            <button 
                onClick={onBack}
                className="bg-cave-800/80 border border-cave-700 px-4 py-1 text-xs text-red-400 hover:text-white hover:bg-red-900/50 backdrop-blur-sm transition-colors uppercase tracking-widest"
            >
                [ Quit Run ]
            </button>
            <div className="text-cave-light text-sm uppercase tracking-widest mt-2">
                Objective: Reach {gameState.levelLength}m
            </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-none z-50">
         <div className="flex items-center gap-2 text-ui-accent">
            <span className="text-sm uppercase tracking-widest text-cave-light">Revives</span>
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-4 h-6 border-2 border-current ${i < gameState.revives ? 'bg-ui-accent' : 'bg-transparent opacity-30'}`}
                />
              ))}
            </div>
         </div>
      </div>

      {/* Game World Layer (Translated by camera) */}
      <div 
        className="absolute top-0 left-0 w-full h-full transition-transform duration-75 ease-linear will-change-transform"
        style={{ transform: `translateX(-${cameraX}px)` }}
      >
        {/* Level End Marker */}
        <div 
            className="absolute top-0 bottom-0 border-r-4 border-dashed border-green-500/30 flex items-center justify-center"
            style={{ left: `${gameState.levelLength}px`, width: '100px' }}
        >
            <span className="text-green-500/50 -rotate-90 text-4xl font-bold tracking-[1em]">FINISH</span>
        </div>

        {/* Platforms */}
        {gameState.level.map((platform) => (
          <div
            key={platform.id}
            className="absolute bg-cave-700 border-t-4 border-cave-light shadow-lg"
            style={{
              left: `${platform.x}px`,
              top: `${platform.y}px`,
              width: `${platform.width}px`,
              height: `${platform.height}px`,
            }}
          >
            {/* Texture Detail */}
            <div className="w-full h-full opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiLz4KPC9zdmc+')]"></div>
          </div>
        ))}

        {/* Player Character */}
        {gameState.gameStatus !== 'LOST' && (
            <div
            className={`absolute w-8 h-12 transition-colors duration-200 ${gameState.player.controlsReversed ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.3)]'}`}
            style={{
                left: `${gameState.player.x}px`,
                top: `${gameState.player.y}px`,
                // Simple animation tilt based on velocity
                transform: `skewX(${gameState.player.vx * -2}deg)`
            }}
            >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-1 bg-black/20"></div> {/* Visor */}
            </div>
        )}

        {/* Effects/Particles could go here */}
      </div>

      {/* Game Over / Win Screens */}
      {gameState.gameStatus === 'LOST' && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center flex-col gap-4">
            <h1 className="text-6xl font-bold text-red-600 tracking-tighter">GAME OVER</h1>
            <p className="text-cave-light">The caverns claimed you.</p>
            <button onClick={onBack} className="mt-8 px-6 py-2 border border-white text-white hover:bg-white hover:text-black uppercase">Return to Menu</button>
        </div>
      )}

      {gameState.gameStatus === 'WON' && (
        <div className="absolute inset-0 z-50 bg-green-900/90 flex items-center justify-center flex-col gap-4">
            <h1 className="text-6xl font-bold text-green-400 tracking-tighter">ESCAPED</h1>
            <p className="text-green-200">Time: {gameState.timeElapsed.toFixed(2)}s</p>
            <button onClick={onBack} className="mt-8 px-6 py-2 border border-white text-white hover:bg-white hover:text-black uppercase">Return to Menu</button>
        </div>
      )}
    </div>
  );
};