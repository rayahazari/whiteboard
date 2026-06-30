// client/src/Whiteboard.jsx
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// 1. Accept roomId as a prop
const Whiteboard = ({ token, roomId }) => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL, {
      auth: { token }
    });

    socketRef.current.emit('join-room', roomId);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // NEW: Listen for the canvas history from MongoDB
    socketRef.current.on('load-canvas', (history) => {
      // Loop through every saved line and draw it
      history.forEach((step) => {
        drawLine(
          context, 
          step.x0, step.y0, 
          step.x1, step.y1, 
          step.incomingColor, step.incomingWidth, 
          false // false means don't emit these back to the server!
        );
      });
    });

    socketRef.current.on('draw', ({ x0, y0, x1, y1, incomingColor, incomingWidth }) => {
      drawLine(context, x0, y0, x1, y1, incomingColor, incomingWidth, false);
    });

    socketRef.current.on('clear', () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => socketRef.current.disconnect();
  }, [token, roomId]);

  // 4. Updated drawLine to accept dynamic styles
  const drawLine = (context, x0, y0, x1, y1, strokeColor, strokeWidth, emit = true) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeWidth;
    context.lineCap = 'round'; // Makes the lines look smoother
    context.stroke();
    context.closePath();

    if (!emit) return;

    // Send the color and width along with the coordinates
    socketRef.current.emit('draw', { 
      x0, y0, x1, y1, 
      incomingColor: strokeColor, 
      incomingWidth: strokeWidth 
    });
  };

  let currentX, currentY;

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

  // 5. Helper function to clear canvas locally and emit to others
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    socketRef.current.emit('clear');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* UI TOOLBAR */}
      <div style={{ 
        display: 'flex', gap: '20px', marginBottom: '15px', 
        padding: '10px 20px', background: '#f4f4f5', 
        borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        alignItems: 'center'
      }}>
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

        {/* Eraser is just setting the color to white */}
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
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseOut={onMouseUp}
      />
    </div>
  );
};

export default Whiteboard;