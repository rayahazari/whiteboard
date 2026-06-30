// server/index.js
require('dotenv').config(); // Loads variables from .env
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// 1. Dynamic CORS (Localhost for dev, real URL for production)
app.use(cors({ origin: process.env.CLIENT_URL }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL }
});

// 2. Connect to MongoDB Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// 3. Define User Schema & Model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  drawHistory: { type: Array, default: [] } // Stores all the lines drawn
});
const Room = mongoose.model('Room', roomSchema);

// 4. Secure Signup Route
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Required fields missing" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash the password before saving!
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword });

    res.json({ message: "User created successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 5. Secure Login Route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    // Compare the plain text password with the hashed password in DB
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: '1h' });
      return res.json({ token });
    }
    return res.status(401).json({ message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 2. Socket.IO Middleware for JWT Verification
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }
  
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) return next(new Error("Authentication error: Invalid token"));
    socket.user = decoded; // Attach user payload to the socket
    next();
  });
});

// 3. Handle Real-Time Drawing Events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username}`);

  // 1. JOIN ROOM & LOAD HISTORY
  socket.on('join-room', async (roomId) => {
    if (socket.currentRoom) socket.leave(socket.currentRoom);
    
    socket.join(roomId);
    socket.currentRoom = roomId;

    try {
      // Find the room in the DB, or create it if it doesn't exist
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = await Room.create({ roomId, drawHistory: [] });
      }

      // Send the drawing history ONLY to the user who just joined
      socket.emit('load-canvas', room.drawHistory);
    } catch (err) {
      console.error("Error loading room history", err);
    }
  });

  // 2. BROADCAST DRAWING & SAVE TO DB
  socket.on('draw', async (drawData) => {
    if (socket.currentRoom) {
      // Broadcast instantly for sub-second latency
      socket.to(socket.currentRoom).emit('draw', drawData); 
      
      // Save to MongoDB in the background
      await Room.updateOne(
        { roomId: socket.currentRoom },
        { $push: { drawHistory: drawData } }
      ).catch(err => console.error("Error saving draw data", err));
    }
  });

  // 3. BROADCAST CLEAR & WIPE DB
  socket.on('clear', async () => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('clear');
      
      // Empty the array in the database
      await Room.updateOne(
        { roomId: socket.currentRoom },
        { $set: { drawHistory: [] } }
      ).catch(err => console.error("Error clearing room history", err));
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});