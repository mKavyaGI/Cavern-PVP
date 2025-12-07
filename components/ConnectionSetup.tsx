import React, { useState, useEffect } from 'react';
import { Role, ConnectionMode } from '../types';
import { UDPNetwork } from '../services/p2p';

interface ConnectionSetupProps {
  role: Role;
  mode: ConnectionMode;
  network: UDPNetwork;
  onConnected: () => void;
  onBack: () => void;
}

export const ConnectionSetup: React.FC<ConnectionSetupProps> = ({ role, mode, network, onConnected, onBack }) => {
  const [serverIp, setServerIp] = useState<string>('localhost');
  const [status, setStatus] = useState<string>('Standby');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Listen for the UDP channel opening (which triggers PING/JOIN_LOBBY)
    network.onMessage((msg) => {
        if (msg.type === 'PING' || msg.type === 'JOIN_LOBBY' || msg.type === 'ACK_JOIN') {
            onConnected();
        }
    });
  }, [network, onConnected]);

  const handleConnect = async () => {
      if (isConnecting) return;
      setIsConnecting(true);
      setStatus(`Contacting Signaling Server at ${serverIp}...`);

      try {
          // This connects TCP first, then auto-negotiates UDP
          await network.connect(role, serverIp);
          setStatus('Signaling Connected. Negotiating UDP Link...');
          
          // The UDP negotiation happens automatically in the background class.
          // We just wait for the 'open' event in the network class which will allow messages to flow.
          
          // Timeout fallback
          setTimeout(() => {
              if (status.includes('Negotiating')) {
                  setStatus('Negotiating... (Ensure other player is connected)');
              }
          }, 5000);

      } catch (e) {
          setIsConnecting(false);
          setStatus('Error: Could not reach Signaling Server (TCP).');
      }
  };

  return (
    <div className="min-h-screen bg-cave-900 flex items-center justify-center p-4 font-mono">
      <div className="max-w-md w-full bg-black border-2 border-cave-700 shadow-2xl p-8 relative">
        <button onClick={onBack} className="absolute top-4 right-4 text-cave-700 hover:text-white text-xs">[ABORT]</button>
        
        <h2 className="text-3xl font-bold text-ui-accent mb-2">UDP LINK SETUP</h2>
        <div className="text-xs text-cave-light mb-8 border-b border-cave-800 pb-4">
            PROTOCOL: UNRELIABLE DATA CHANNEL (UDP) // ROLE: {role}
        </div>

        <div className="space-y-6">
             <div>
                 <p className="text-white text-sm mb-2">SIGNALING SERVER IP</p>
                 <p className="text-[10px] text-cave-light mb-4">
                     Enter the IP of the machine running `node server.js`.<br/>
                     This sets up the direct UDP connection.
                 </p>
                 <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        placeholder="192.168.1.X"
                        className="flex-1 bg-cave-900 border border-cave-light/30 text-white px-4 py-2 text-sm focus:border-ui-accent outline-none"
                    />
                    <button 
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className={`
                            font-bold px-6 py-2 text-sm transition-colors
                            ${isConnecting ? 'bg-cave-700 text-cave-light' : 'bg-ui-accent text-white hover:bg-red-600'}
                        `}
                    >
                        {isConnecting ? '...' : 'LINK'}
                    </button>
                 </div>
             </div>
        </div>

        <div className="mt-8 pt-4 border-t border-cave-800 text-center">
            <span className={`text-xs ${status.includes('Error') ? 'text-red-500' : 'text-green-500'} animate-pulse`}>
                {status}
            </span>
        </div>
      </div>
    </div>
  );
};