// ==== MODULES ====
const fs = require("fs");
const express = require("express");
const https = require("https");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const { authenticate, verifyToken } = require("./auth");

dotenv.config();

// ==== APP SETUP ====
const app = express();
app.use(cors());
app.use(express.json());

// ==== HTTPS SERVER ====
const server = https.createServer(
  {
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem"),
  },
  app
);

// ==== SOCKET.IO SETUP ====
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 5000,
});

const MAX_CLIENTS = 5;

// ==== MONGODB CONNECT ====
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ==== ROUTES ====
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const User = require("./models/User");

  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: "Username already exists" });

    const user = new User({ username, password });
    await user.save();

    const token = await authenticate(username, password);
    res.json({ message: "User registered successfully", token });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const token = await authenticate(username, password);
    if (!token) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ==== SOCKET.IO AUTH ====
io.use((socket, next) => {
  if (io.engine.clientsCount >= MAX_CLIENTS) {
    return next(new Error("Server at capacity. Try again later."));
  }

  const token = socket.handshake.auth?.token;
  const payload = verifyToken(token);
  if (!payload) return next(new Error("Invalid or expired token"));

  socket.username = payload.username;
  next();
});

// ==== SOCKET.IO EVENTS ====
io.on("connection", (socket) => {
  console.log(`🔌 ${socket.username} connected`);
  socket.broadcast.emit("new user", socket.username);

  socket.on("chat message", (msg) => {
    const fullMsg = `${socket.username}: ${msg}`;
    console.log(`💬 ${fullMsg}`);
    io.emit("chat message", fullMsg);
  });

  socket.on("disconnect", () => {
    console.log(`❌ ${socket.username} disconnected`);
  });
});

// ==== START SERVER ====
server.listen(3000, () => {
  console.log("🚀 Server listening on https://localhost:3000");
});
