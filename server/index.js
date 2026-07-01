require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// 1. CORS Configuration (Handles the trailing slash issue)
const allowedOrigin = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "*";

app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// 2. Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// 3. MongoDB Schemas & Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

const drawingSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  lines: { type: Array, default: [] } 
});
const Drawing = mongoose.model('Drawing', drawingSchema);

// 4. REST API Routes

// -- Auth Routes --
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ username }, process.env.SECRET_KEY);
    res.status(201).json({ token, username });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ username }, process.env.SECRET_KEY);
    res.status(200).json({ token, username });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// -- Room Management Routes --
app.post('/api/rooms', async (req, res) => {
  try {
    const { name, createdBy } = req.body;
    const roomId = crypto.randomBytes(4).toString('hex');
    
    const newRoom = new Room({ roomId, name, createdBy });
    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);
    res.status(500).json({ message: "Error creating room" });
  }
});

app.get('/api/rooms/:username', async (req, res) => {
  try {
    const rooms = await Room.find({ createdBy: req.params.username });
    res.status(200).json(rooms);
  } catch (error) {
    console.error("FETCH ROOMS ERROR:", error);
    res.status(500).json({ message: "Error fetching rooms" });
  }
});

app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    await Room.deleteOne({ roomId: req.params.roomId });
    // Also delete the associated drawings when the room is deleted
    await Drawing.deleteOne({ roomId: req.params.roomId });
    res.status(200).json({ message: "Room and associated drawings deleted" });
  } catch (error) {
    console.error("DELETE ROOM ERROR:", error);
    res.status(500).json({ message: "Error deleting room" });
  }
});

// 5. Socket.IO Setup & Middleware
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// Verify JWT for Sockets
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error: No token provided"));
  
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) return next(new Error("Authentication error: Invalid token"));
    socket.user = decoded;
    next();
  });
});

// 6. Socket.IO Event Listeners
io.on("connection", (socket) => {
  console.log("User connected:", socket.user.username);

  // Join Room & Send History
  socket.on("join-room", async (roomId) => {
    socket.join(roomId);
    
    // Find past drawings in MongoDB
    let drawing = await Drawing.findOne({ roomId });
    
    // If room has never been drawn in, create an empty canvas record
    if (!drawing) {
      drawing = new Drawing({ roomId, lines: [] });
      await drawing.save();
    }

    // Send the past lines to the user who just joined
    socket.emit("canvas-history", drawing.lines);
  });

  // Broadcast & Save New Lines
  socket.on("draw", async (data) => {
    // Send to everyone else in this specific room
    socket.to(data.roomId).emit("draw", data);

    // Save this line to MongoDB so it persists forever
    await Drawing.updateOne(
       { roomId: data.roomId },
       { $push: { lines: data } }
    );
  });

  socket.on("clear", async ({ roomId }) => {
    // Tell everyone else in the room to wipe their screens immediately
    socket.to(roomId).emit("clear");

    // Wipe the history in MongoDB so the lines don't come back on refresh
    await Drawing.updateOne(
      { roomId },
      { $set: { lines: [] } } 
    );
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.user.username);
  });
});

// 7. Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/* // server/index.js
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
  roomId: { type: String, required: true, unique: true }, // e.g., 'abc-123-xyz'
  name: { type: String, required: true }, // e.g., "Math Assignment"
  createdBy: { type: String, required: true }, // The username or user ID
  createdAt: { type: Date, default: Date.now }
});
const Room = mongoose.model('Room', roomSchema);

const drawingSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  lines: { type: Array, default: [] } // Stores all the coordinates drawn
});
const Drawing = mongoose.model('Drawing', drawingSchema);

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

const crypto = require('crypto');

// CREATE a new room
app.post('/api/rooms', async (req, res) => {
  const { name, createdBy } = req.body;
  const roomId = crypto.randomBytes(4).toString('hex'); // Generates a unique 8-character ID
  
  try {
    const newRoom = new Room({ roomId, name, createdBy });
    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (error) {
    res.status(500).json({ message: "Error creating room" });
  }
});

// GET all rooms for a specific user
app.get('/api/rooms/:username', async (req, res) => {
  try {
    const rooms = await Room.find({ createdBy: req.params.username });
    res.status(200).json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Error fetching rooms" });
  }
});

// DELETE a room
app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    await Room.deleteOne({ roomId: req.params.roomId });
    res.status(200).json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting room" });
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
*/