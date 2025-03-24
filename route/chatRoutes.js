const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const fs = require("fs").promises;
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { SYSTEM_PROMPT, USER_CODE } = require("../system_prompt");
const { formatAIResponse } = require("../utils/responseFormatter");

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Constants
const CHATS_DIR = path.join("/app/uploads/chats"); // Use same path everywhere
const MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 8000;
const MAX_CHAT_MESSAGES = 10; // Maximum number of messages per chat

// Ensure chats directory exists
const ensureDirectories = async () => {
  try {
    // Create both directories regardless of environment
    await fs.mkdir("/app/uploads", { recursive: true });
    await fs.mkdir(CHATS_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating directories:", error);
  }
};

// Call directory creation on startup
ensureDirectories().catch(console.error);

// Helper Functions
const getChatFilePath = (chatID) => {
  const fileName = `${chatID}.json`;
  return path.join(CHATS_DIR, fileName);
};

const saveChat = async (filePath, chatData) => {
  await fs.writeFile(filePath, JSON.stringify(chatData, null, 2), "utf8");
};

const loadChat = async (chatID) => {
  try {
    const filePath = getChatFilePath(chatID);
    const chatData = await fs.readFile(filePath, "utf8");
    return JSON.parse(chatData);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const getAnthropicResponse = async (messages) => {
  // Clean messages before sending to Anthropic API
  const cleanMessages = messages.map(({ role, content }) => ({
    role,
    content,
  }));

  const response = await anthropic.messages.create({
    messages: cleanMessages,
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
  });
  return response.content[0].text;
};

const createChatMessage = (role, content) => ({
  role,
  content,
  metadata: {
    timestamp: new Date(),
  },
});

const processChat = async (chatID, currentUserPrompt) => {
  try {
    const userMessage = createChatMessage("user", currentUserPrompt);
    const existingChat = chatID ? await loadChat(chatID) : null;
    const newChatID = existingChat ? chatID : uuidv4();

    // Check message limit for existing chats
    if (existingChat && existingChat.messages.length >= MAX_CHAT_MESSAGES) {
      throw new Error(
        "Chat limit exceeded. Maximum 10 messages allowed per chat."
      );
    }

    // Get messages for context
    let previousMessages = [];
    if (existingChat) {
      const allMessages = existingChat.messages;

      // Always include the first message
      const firstMessage = allMessages[0];

      // Get the last two messages
      const lastTwoMessages = allMessages.slice(-2);

      // Check if last two messages contain code
      const hasCodeInRecentMessages = lastTwoMessages.some(
        (msg) =>
          msg.role === "assistant" && formatAIResponse(msg.content).isCodeNeeded
      );

      // If no code in recent messages and we have latestCode, add it
      if (!hasCodeInRecentMessages && existingChat.latestCode?.code) {
        const codeContext = {
          role: "user",
          content: JSON.stringify(existingChat.latestCode),
        };

        previousMessages = [firstMessage, codeContext, ...lastTwoMessages];
      } else {
        previousMessages = [firstMessage, ...lastTwoMessages];
      }
    }

    const assistantContent = await getAnthropicResponse([
      ...previousMessages,
      { role: userMessage.role, content: userMessage.content },
    ]);

    const assistantMessage = createChatMessage("assistant", assistantContent);
    const formattedResponse = formatAIResponse(assistantContent);

    // Initialize or update chat data with latest code
    const chatData = existingChat || {
      chatID: newChatID,
      messages: [],
      latestCode: {
        title: "",
        code: "",
        file_path: "",
        isCodeNeeded: false,
        commands: [],
      },
    };

    // Update latest code if new code is generated
    if (formattedResponse.isCodeNeeded && formattedResponse.code) {
      chatData.latestCode = {
        title: formattedResponse.title,
        code: formattedResponse.code,
        file_path: formattedResponse.file_path,
        isCodeNeeded: formattedResponse.isCodeNeeded,
        commands: formattedResponse.commands,
      };
    }

    chatData.messages.push(userMessage, assistantMessage);
    await saveChat(getChatFilePath(newChatID), chatData);

    return {
      chatID: newChatID,
      aiResponse: formattedResponse,
    };
  } catch (error) {
    console.error("Chat processing error:", error);
    throw error;
  }
};

router.post("/", async (req, res) => {
  try {
    const { chatID, currentUserPrompt } = req.body;
    const result = await processChat(chatID, currentUserPrompt);
    res.json(result);
  } catch (error) {
    console.error("Request error:", error);

    // Send specific error for chat limit3890
    if (error.message.includes("Chat limit exceeded")) {
      return res.status(400).json({
        error: "Chat limit exceeded",
        message:
          "Maximum 10 messages allowed per chat. Please start a new chat.",
      });
    }

    // Default error response
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
