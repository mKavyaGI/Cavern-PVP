import { ConnectionMode, Role, NetworkMessage } from "../types";

export interface NetworkAdapter {
  type: ConnectionMode;
  connect: (role: Role, address?: string) => Promise<void>;
  send: (msg: NetworkMessage) => void;
  onMessage: (callback: (msg: NetworkMessage) => void) => void;
  disconnect: () => void;
}

// ---------------------------------------------------------
// STRATEGY 1: BROADCAST CHANNEL (Same Device Loopback)
// ---------------------------------------------------------
export class LocalNetwork implements NetworkAdapter {
  type: ConnectionMode = 'LOCAL';
  private channel: BroadcastChannel | null = null;
  private messageCallback: ((msg: NetworkMessage) => void) | null = null;
  private channelName = 'pvp_platformer_local';

  async connect(role: Role) {
    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event) => {
      if (this.messageCallback) this.messageCallback(event.data);
    };
  }

  send(msg: NetworkMessage) {
    this.channel?.postMessage(msg);
  }

  onMessage(callback: (msg: NetworkMessage) => void) {
    this.messageCallback = callback;
  }

  disconnect() {
    this.channel?.close();
  }
}

// ---------------------------------------------------------
// STRATEGY 2: FAST UDP (WebRTC Unreliable + TCP Signaling)
// ---------------------------------------------------------
export class UDPNetwork implements NetworkAdapter {
  type: ConnectionMode = 'UDP_P2P';
  private signalingWs: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private messageCallback: ((msg: NetworkMessage) => void) | null = null;
  private role: Role = null;

  // STUN servers help finding the public IP/UDP port
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  async connect(role: Role, address: string = 'localhost'): Promise<void> {
    this.role = role;
    return new Promise((resolve, reject) => {
      // 1. Connect to Signaling Server (TCP)
      console.log(`[UDP_NET] Connecting to Signaling Server at ws://${address}:8080`);
      this.signalingWs = new WebSocket(`ws://${address}:8080`);

      this.signalingWs.onopen = () => {
        console.log("[UDP_NET] Connected to Signaling. Initiating UDP Handshake...");
        this.initiatePeerConnection();
        resolve();
      };

      this.signalingWs.onerror = (err) => {
        console.error("[UDP_NET] Signaling Error", err);
        reject(err);
      };

      this.signalingWs.onmessage = async (event) => {
        let data = event.data;
        if (data instanceof Blob) data = await data.text();
        try {
          const msg = JSON.parse(data as string) as NetworkMessage;
          this.handleSignalingMessage(msg);
        } catch (e) {
          console.error("Signal Parse Error", e);
        }
      };
    });
  }

  private initiatePeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ type: 'SIGNAL_ICE', payload: event.candidate });
      }
    };

    if (this.role === 'RUNNER') {
      // Host creates the Data Channel
      // CRITICAL: ordered: false, maxRetransmits: 0 makes this behave like UDP!
      const channel = this.peerConnection.createDataChannel("fast_udp_game", {
        ordered: false, 
        maxRetransmits: 0 
      });
      this.setupDataChannel(channel);
      this.createOffer();
    } else {
      // Guest waits for Data Channel
      this.peerConnection.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => {
      console.log("[UDP_NET] UDP Data Channel OPEN! High-speed link established.");
      // Optional: We could close signalingWs here, but keeping it is fine for fallback
      this.send({ type: 'PING' }); // Wake up the app logic
    };
    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (this.messageCallback) this.messageCallback(msg);
      } catch (e) {
        // Ignore malformed UDP packets
      }
    };
  }

  private async createOffer() {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.sendSignal({ type: 'SIGNAL_OFFER', payload: offer });
  }

  private async handleSignalingMessage(msg: NetworkMessage) {
    if (!this.peerConnection) return;

    // Ignore messages from self if reflected by simple broadcast server
    // (In a simple broadcast, we get our own messages back, so we filter by role roughly)
    // Actually, simple check: if I am RUNNER, I ignore OFFER. If TRAPPER, I ignore ANSWER.
    
    if (msg.type === 'SIGNAL_OFFER' && this.role === 'TRAPPER') {
       console.log("[UDP_NET] Received Offer");
       await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));
       const answer = await this.peerConnection.createAnswer();
       await this.peerConnection.setLocalDescription(answer);
       this.sendSignal({ type: 'SIGNAL_ANSWER', payload: answer });
    }
    else if (msg.type === 'SIGNAL_ANSWER' && this.role === 'RUNNER') {
       console.log("[UDP_NET] Received Answer");
       await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));
    }
    else if (msg.type === 'SIGNAL_ICE') {
       // A bit naive, but try to add all candidates that aren't ours
       try {
         await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
       } catch (e) {
         // Candidate might be for the other state or invalid, ignore
       }
    }
  }

  private sendSignal(msg: NetworkMessage) {
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify(msg));
    }
  }

  send(msg: NetworkMessage) {
    // Send via UDP DataChannel if open
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(msg));
    } else {
        // Fallback or early state: can't send game data yet
        console.warn("[UDP_NET] UDP Channel not ready, dropping packet:", msg.type);
    }
  }

  onMessage(callback: (msg: NetworkMessage) => void) {
    this.messageCallback = callback;
  }

  disconnect() {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.signalingWs?.close();
  }
}