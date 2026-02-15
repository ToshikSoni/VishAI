export class MCPClient {
  constructor(mcpServerUrl = "http://localhost:3001") {
    this.mcpServerUrl = mcpServerUrl;
    this.connected = false;
  }

  async connect() {
    try {
      const response = await fetch(`${this.mcpServerUrl}/health`);
      if (response.ok) {
        const health = await response.json();
        console.log(`Connected to MCP Server: ${health.server} v${health.version}`);
        this.connected = true;
        return true;
      }
    } catch (error) {
      console.warn("MCP Server not available:", error.message);
      this.connected = false;
      return false;
    }
  }

  async callTool(toolName, args = {}) {
    if (!this.connected) throw new Error("MCP Server not connected");

    const response = await fetch(`${this.mcpServerUrl}/mcp/tools/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: toolName, arguments: args }),
    });

    if (!response.ok) throw new Error(`MCP tool call failed: ${response.statusText}`);
    return await response.json();
  }
}

export default MCPClient;
