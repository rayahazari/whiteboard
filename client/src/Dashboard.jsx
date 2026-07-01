import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ username, onJoinRoom, onLogout }) => {
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // Fetch rooms on load
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${username}`)
      .then(res => res.json())
      .then(data => setRooms(data));
  }, [username]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoomName, createdBy: username })
    });
    const newRoom = await res.json();
    setRooms([...rooms, newRoom]);
    setNewRoomName("");
  };

  const handleDelete = async (roomId) => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`, { method: 'DELETE' });
    setRooms(rooms.filter(r => r.roomId !== roomId));
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Welcome, {username}</h2>
        <button className="btn-secondary" onClick={onLogout}>Logout</button>
      </header>

      <div className="dashboard-grid">
        {/* Create Room Panel */}
        <section className="panel">
          <h3>Create a New Board</h3>
          <form onSubmit={handleCreateRoom} className="form-group">
            <input 
              type="text" 
              placeholder="e.g., Brainstorming Session" 
              value={newRoomName} 
              onChange={(e) => setNewRoomName(e.target.value)} 
              required
            />
            <button type="submit" className="btn-primary">Create Room</button>
          </form>
        </section>

        {/* Join by Code Panel */}
        <section className="panel">
          <h3>Join an Existing Board</h3>
          <form onSubmit={(e) => { e.preventDefault(); onJoinRoom(joinCode); }} className="form-group">
            <input 
              type="text" 
              placeholder="Enter Room ID" 
              value={joinCode} 
              onChange={(e) => setJoinCode(e.target.value)} 
              required
            />
            <button type="submit" className="btn-primary">Join Room</button>
          </form>
        </section>
      </div>

      {/* Room Management List */}
      <section className="panel room-list-panel">
        <h3>Your Whiteboards</h3>
        {rooms.length === 0 ? <p>No rooms created yet.</p> : (
          <ul className="room-list">
            {rooms.map(room => (
              <li key={room.roomId} className="room-item">
                <div className="room-info">
                  <strong>{room.name}</strong>
                  <span className="room-id">ID: {room.roomId}</span>
                </div>
                <div className="room-actions">
                  <button className="btn-join" onClick={() => onJoinRoom(room.roomId)}>Join</button>
                  <button className="btn-delete" onClick={() => handleDelete(room.roomId)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Dashboard;