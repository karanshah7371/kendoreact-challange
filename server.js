require("dotenv").config();
const express = require("express");
const cors = require("cors");
const chatRoutes = require("./routes/chatRoutes");

const app = express();

// CORS configuration
const corsOptions = {
  origin: "*", //origin: ["http://localhost:3000", "http://localhost:3001"], // Add your frontend URLs
  methods: ["GET", "POST"],
  // credentials: true,
  // optionsSuccessStatus: 204,
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Other middleware
app.use(express.json());

// Routes
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
