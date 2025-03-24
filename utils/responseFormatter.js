// Additional formatting options

const stripAnsiCodes = (text) => {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
};

const prettifyCode = (code) => {
  return code.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
};

const formatAIResponse = (rawResponse) => {
  try {
    // Handle double-encoded JSON
    let parsedResponse = rawResponse;

    // First parse if it's a string
    if (typeof rawResponse === "string") {
      try {
        parsedResponse = JSON.parse(rawResponse);
      } catch (e) {
        // If first parse fails, return simple message format
        return {
          commentary: stripAnsiCodes(rawResponse.trim()),
          title: "",
          isCodeNeeded: false,
          dependencies: [],
          commands: [],
          file_path: "pages/app.js",
          code: "",
        };
      }
    }

    // Extract the actual response content
    if (typeof parsedResponse === "string") {
      try {
        parsedResponse = JSON.parse(parsedResponse);
      } catch (e) {
        console.error("Failed to parse second layer:", e);
      }
    }

    // Now format according to our structure
    return {
      commentary: stripAnsiCodes(parsedResponse.commentry || ""),
      title: parsedResponse.title || "",
      isCodeNeeded: parsedResponse.isCodeNeeded || false,
      dependencies: [], // Can be added if needed
      commands: Array.isArray(parsedResponse.COMMANDS)
        ? parsedResponse.COMMANDS.map((cmd) => cmd.trim())
        : [],
      file_path: "pages/app.js",
      code: parsedResponse["app.js"]
        ? prettifyCode(parsedResponse["app.js"])
        : "",
    };
  } catch (error) {
    console.error("Error formatting response:", error);
    return {
      commentary: stripAnsiCodes(
        typeof rawResponse === "string"
          ? rawResponse.trim()
          : JSON.stringify(rawResponse)
      ),
      title: "",
      isCodeNeeded: false,
      dependencies: [],
      commands: [],
      file_path: "",
      code: "",
    };
  }
};

module.exports = { formatAIResponse };
