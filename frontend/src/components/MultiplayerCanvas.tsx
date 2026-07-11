import React, { useEffect, useState, useRef } from 'react';

interface CursorPos {
  x: number;
  y: number;
}

interface MultiplayerCanvasProps {
  workspaceId: number;
  userEmail: string;
  onSliderTick?: (growth: number, attrition: number) => void;
  growthRate: number;
  attritionRate: number;
}

export const MultiplayerCanvas: React.FC<MultiplayerCanvasProps> = ({
  workspaceId,
  userEmail,
  onSliderTick,
  growthRate,
  attritionRate
}) => {
  const [peerCursors, setPeerCursors] = useState<Record<string, CursorPos>>({});
  const socketRef = useRef<WebSocket | null>(null);

  // 1. Establish WebSocket client connection
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect directly to port 8000 backend or use fallback host
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:8000' : `${window.location.hostname}:8000`;
    const wsUrl = `${wsProtocol}//${wsHost}/api/v1/ws/canvas/${workspaceId}`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        if (type === 'CURSOR_MOVE') {
          const { user_email, x_pos, y_pos } = payload;
          if (user_email !== userEmail) {
            setPeerCursors((prev) => ({
              ...prev,
              [user_email]: { x: x_pos, y: y_pos }
            }));
          }
        } else if (type === 'SLIDER_TICK') {
          const { growthRate: peerGrowth, attritionRate: peerAttrition } = payload;
          if (onSliderTick) {
            onSliderTick(peerGrowth, peerAttrition);
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    socket.onclose = () => {
      console.log('Multiplayer canvas connection closed.');
    };

    return () => {
      socket.close();
    };
  }, [workspaceId, userEmail, onSliderTick]);

  // 2. Throttle and broadcast local mouse movements
  useEffect(() => {
    let lastSent = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastSent < 50) return; // throttle to every 50ms
      lastSent = now;

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'CURSOR_MOVE',
            payload: {
              user_email: userEmail,
              x_pos: e.clientX,
              y_pos: e.clientY
            }
          })
        );
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [userEmail]);

  // 3. Broadcast What-If slider changes when they update locally
  useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'SLIDER_TICK',
          payload: {
            growthRate,
            attritionRate
          }
        })
      );
    }
  }, [growthRate, attritionRate]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Object.entries(peerCursors).map(([email, pos]) => (
        <div
          key={email}
          className="absolute transition-all duration-75 ease-out"
          style={{ left: pos.x, top: pos.y }}
        >
          <svg className="h-5 w-5 text-brand-teal fill-current drop-shadow-md" viewBox="0 0 24 24">
            <path d="M4.5 3v15.5l4.5-4.5h6.5L4.5 3z" />
          </svg>
          <div className="bg-slate-800 text-white font-sans text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md mt-1 ml-3 border border-slate-700 whitespace-nowrap">
            {email.split('@')[0]}
          </div>
        </div>
      ))}
    </div>
  );
};
