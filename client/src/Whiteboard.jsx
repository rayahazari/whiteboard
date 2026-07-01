import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const Whiteboard = ({ token, roomId, onLeave }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL, {
      auth: { token }
    });

    // 1. Tell the server which room we are in
    socketRef.current.emit('join-room', roomId);

    // 2. LISTEN FOR HISTORY: Paint the past drawings when we join
    socketRef.current.on('canvas-history', (lines) => {
      const context = canvasRef.current.getContext('2d');
      lines.forEach(line => {
        drawLine(context, line.currentX, line.currentY, line.newX, line.newY, line.color, line.lineWidth, false);
      });
    });

    // 3. LISTEN FOR OTHERS DRAWING
    socketRef.current.on('draw', (data) => {
      const context = canvasRef.current.getContext('2d');
      drawLine(context, data.currentX, data.currentY, data.newX, data.newY, data.color, data.lineWidth, false);
    });

    // 4. LISTEN FOR CLEAR EVENT
    socketRef.current.on('clear', () => {
      const context = canvasRef.current.getContext('2d');
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    return () => socketRef.current.disconnect();
  }, [roomId, token]);

  // The central drawing function handling both local paint and server emitting
  const drawLine = (context, currentX, currentY, newX, newY, strokeColor, strokeWidth, emit = true) => {
    context.beginPath();
    context.moveTo(currentX, currentY);
    context.lineTo(newX, newY);
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeWidth;
    context.lineCap = 'round';
    context.stroke();
    context.closePath();

    if (!emit) return; // If receiving from server, don't echo it back!

    // CRITICAL FIX: Include roomId and exact property names expected by the server/history
    socketRef.current.emit('draw', { 
      roomId, // Tells the server where to broadcast and save
      currentX, 
      currentY, 
      newX, 
      newY, 
      color: strokeColor, 
      lineWidth: strokeWidth 
    });
  };

  let currentX, currentY;

  // --- MOUSE EVENTS ---
  const onMouseDown = (e) => {
    setIsDrawing(true);
    currentX = e.nativeEvent.offsetX;
    currentY = e.nativeEvent.offsetY;
  };

  const onMouseMove = (e) => {
    if (!isDrawing) return;
    const newX = e.nativeEvent.offsetX;
    const newY = e.nativeEvent.offsetY;
    
    const context = canvasRef.current.getContext('2d');
    drawLine(context, currentX, currentY, newX, newY, color, lineWidth, true);
    
    currentX = newX;
    currentY = newY;
  };

  const onMouseUp = () => setIsDrawing(false);

  // --- TOUCH EVENTS ---
  const getTouchPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  const onTouchStart = (e) => {
    e.preventDefault(); 
    setIsDrawing(true);
    const pos = getTouchPos(e);
    currentX = pos.x;
    currentY = pos.y;
  };

  const onTouchMove = (e) => {
    e.preventDefault(); 
    if (!isDrawing) return;
    const pos = getTouchPos(e);
    const newX = pos.x;
    const newY = pos.y;
    
    const context = canvasRef.current.getContext('2d');
    drawLine(context, currentX, currentY, newX, newY, color, lineWidth, true);
    
    currentX = newX;
    currentY = newY;
  };

  const onTouchEnd = (e) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  // Helper function to clear canvas locally and emit to others
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    // You could also update your server to listen for this and delete lines from MongoDB!
    socketRef.current.emit('clear', { roomId }); 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* UI TOOLBAR */}
      <div style={{ 
        display: 'flex', gap: '20px', marginBottom: '15px', 
        padding: '10px 20px', background: '#f4f4f5', 
        borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'
      }}>
        
        {/* NEW: Leave Room Button */}
        {onLeave && (
          <button 
            onClick={onLeave}
            style={{ padding: '5px 10px', cursor: 'pointer', background: '#374151', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            ← Back to Dashboard
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label><b>Color:</b></label>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)} 
            style={{ cursor: 'pointer' }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label><b>Brush Size:</b> {lineWidth}</label>
          <input 
            type="range" 
            min="1" max="30" 
            value={lineWidth} 
            onChange={(e) => setLineWidth(e.target.value)} 
            style={{ cursor: 'pointer' }}
          />
        </div>

        <button 
          onClick={() => setColor('#FFFFFF')}
          style={{ padding: '5px 10px', cursor: 'pointer' }}
        >
          Eraser
        </button>
        
        <button 
          onClick={clearCanvas}
          style={{ padding: '5px 10px', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Clear Canvas
        </button>
      </div>

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        width={1000}
        height={600}
        style={{ 
          border: '2px solid #d1d5db', 
          borderRadius: '8px',
          cursor: 'crosshair', 
          backgroundColor: '#ffffff',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          touchAction: 'none' // CRITICAL for mobile
        }}
        // Desktop Listeners
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseOut={onMouseUp}
        // Mobile Listeners
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      />
    </div>
  );
};

export default Whiteboard;