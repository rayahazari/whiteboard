// client/src/App.jsx
import { useState } from 'react';
import Whiteboard from './Whiteboard';
import Dashboard from './Dashboard';

function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  
  // NEW: State for managing rooms
  const [roomId, setRoomId] = useState(null);
  const [roomInput, setRoomInput] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/login' : '/signup';
    
    const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      if (isLogin) {
        setToken(data.token);
      } else {
        alert("Signup successful! You can now log in.");
        setIsLogin(true);
        setPassword('');
      }
    } else {
      alert(data.message || "Authentication failed");
    }
  };

  // 1. If not logged in, show Auth Screen
  if (!token) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ width: '300px' }}>
          <h2 style={{ textAlign: 'center' }}>{isLogin ? 'Login' : 'Sign Up'}</h2>
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required style={{ padding: '8px' }} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required style={{ padding: '8px' }} />
            <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span style={{ color: 'blue', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "Sign up" : "Log in"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  // 2. If logged in but hasn't picked a room, show Room Screen
  // if (token && !roomId) {
  //   return (
  //     <div style={{ padding: '40px', display: 'flex', justifyContent: 'center', fontFamily: 'sans-serif' }}>
  //        <form onSubmit={(e) => { e.preventDefault(); setRoomId(roomInput); }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '300px' }}>
  //           <h2 style={{ textAlign: 'center' }}>Join a Room</h2>
  //           <p style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>Type any room name to create or join it.</p>
  //           <input value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder="e.g., DesignTeam" required style={{ padding: '8px' }} />
  //           <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>Enter Whiteboard</button>
  //        </form>
  //     </div>
  //   );
  // }

  // 2. If logged in but NO room selected, show the NEW Dashboard
  if (token && !roomId) {
    return (
      <Dashboard 
        username={username} 
        onJoinRoom={(id) => setRoomId(id)} 
        onLogout={() => {
          setToken(null);
          setUsername("");
        }}
      />
    );
  }

  // 3. If logged in AND has a room, show Whiteboard
  // We pass the roomId down as a prop!
  // return <Whiteboard token={token} roomId={roomId} />;

  // 3. If a room IS selected, show the Whiteboard
  return (
    <Whiteboard 
      token={token}
      roomId={roomId} 
      username={username} 
      onLeave={() => setRoomId(null)} // Allows them to go back to dashboard
    />
  );
}

export default App;