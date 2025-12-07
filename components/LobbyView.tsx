import React, { useState, useEffect, useRef } from 'react';
import { Role, ChatMessage, ConnectionMode } from '../types';

interface LobbyViewProps {
  role: Role;
  connectionMode: ConnectionMode;
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => void;
  onStartGame: () => void;
  onBack: () => void;
  isOpponentConnected: boolean;
  isLoading: boolean;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  role,
  connectionMode,
  chatHistory,
  onSendMessage,
  onStartGame,
  onBack,
  isOpponentConnected,
  isLoading
}) => {
  const [inputText, setInputText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="flex h-screen bg-cave-900 font-mono text-ui-text overflow-hidden">
      {/* Left Panel: Status */}
      <div className="w-1/3 border-r-2 border-cave-700 bg-cave-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-bold tracking-tighter text-white">NET_LOBBY</h2>
          </div>
          
          <div className="space-y-6">
            <div className="p-4 border border-cave-light/30 bg-black/20">
              <div className="text-xs uppercase text-cave-light mb-1">Local Status</div>
              <div className={`text-xl font-bold ${role === 'RUNNER' ? 'text-white' : 'text-ui-accent'}`}>
                YOU: {role}
              </div>
              <div className="text-[10px] text-cave-light mt-1">
                PROTOCOL: {connectionMode === 'UDP_P2P' ? 'UDP STREAM (FAST)' : 'LOCAL BUS'}
              </div>
            </div>

            <div className="p-4 border border-cave-light/30 bg-black/20">
              <div className="text-xs uppercase text-cave-light mb-1">Remote Status</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isOpponentConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-900'}`} />
                <span className={`text-xl font-bold ${isOpponentConnected ? 'text-green-500' : 'text-red-900'}`}>
                  {isOpponentConnected ? 'OPPONENT LINKED' : 'SEARCHING...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-xs text-cave-light">
             <p>1. Wait for opponent to connect.</p>
             <p>2. Chat to confirm readiness.</p>
             {role === 'RUNNER' ? <p>3. Start the simulation.</p> : <p>3. Wait for Runner to start.</p>}
          </div>

          <div className="flex flex-col gap-2">
            {role === 'RUNNER' ? (
                <button
                onClick={onStartGame}
                disabled={isLoading}
                className={`
                    w-full py-4 font-bold text-xl border-2 transition-all
                    ${isLoading
                    ? 'border-cave-700 text-cave-700 cursor-not-allowed' 
                    : !isOpponentConnected 
                        ? 'border-yellow-600 text-yellow-500 hover:bg-yellow-900/20'
                        : 'border-white text-white hover:bg-white hover:text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                    }
                `}
                >
                {isLoading ? 'GENERATING...' : isOpponentConnected ? 'INITIATE RUN' : 'FORCE RUN (OFFLINE)'}
                </button>
            ) : (
                 <button
                    onClick={onStartGame}
                    disabled={isLoading}
                    className={`
                        w-full py-4 font-bold text-md border-2 transition-all
                        ${isLoading ? 'border-cave-700 text-cave-700' : 
                          isOpponentConnected 
                            ? 'border-cave-700 text-cave-light hover:border-ui-accent hover:text-ui-accent' 
                            : 'border-ui-accent text-ui-accent hover:bg-red-900/20'}
                    `}
                >
                    {isLoading ? 'LOADING...' : 
                     isOpponentConnected ? 'WAITING FOR RUNNER (OR CLICK TO FORCE)' : 'ENTER SIMULATION (DEBUG)'}
                </button>
            )}
            
            <button 
                onClick={onBack}
                className="w-full py-2 text-xs uppercase border border-cave-700 text-cave-light hover:text-white hover:border-white transition-colors"
            >
                Leave Lobby
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel: Chat Terminal */}
      <div className="flex-1 flex flex-col bg-black relative">
        {/* Header */}
        <div className="h-12 border-b border-cave-700 flex items-center px-4 bg-cave-900/50">
           <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
           <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
           <span className="w-3 h-3 bg-green-500 rounded-full mr-4"></span>
           <span className="text-sm text-cave-light tracking-widest">SECURE_CHANNEL_V1</span>
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 font-mono">
          {chatHistory.length === 0 && (
            <div className="text-cave-700 italic text-center mt-10">
              -- Connection Established --<br/>
              -- No Messages --
            </div>
          )}
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === role ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`
                  max-w-[70%] p-3 border-l-4 
                  ${msg.sender === 'RUNNER' 
                    ? 'border-white bg-cave-800 text-white' 
                    : 'border-ui-accent bg-cave-800 text-ui-accent'
                  }
                `}
              >
                <div className="text-[10px] opacity-50 mb-1 uppercase flex justify-between gap-4">
                  <span>{msg.sender}</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                </div>
                <div className="break-words">{msg.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-cave-700 p-4 bg-cave-900">
          <div className="flex gap-2">
            <span className="text-cave-light py-2">{'>'}</span>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Transmit message..."
              className="flex-1 bg-transparent border-none outline-none text-white font-mono focus:ring-0"
              autoFocus
            />
            <button 
              type="submit"
              className="px-4 py-2 border border-cave-light text-cave-light hover:bg-cave-light hover:text-black text-xs uppercase"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};