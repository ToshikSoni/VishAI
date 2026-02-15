/**
 * MCP Client
 * Connects to VishAI MCP Server to access mental health resources and tools
 */

export class MCPClient {
  constructor(mcpServerUrl = 'http://localhost:3001') {
    this.mcpServerUrl = mcpServerUrl;
    this.connected = false;
  }

  /**
   * Initialize connection to MCP server
   */
  async connect() {
    try {
      const response = await fetch(`${this.mcpServerUrl}/health`);
      if (response.ok) {
        const health = await response.json();
        console.log(`✅ Connected to MCP Server: ${health.server} v${health.version}`);
        console.log(`📚 Resources available: ${health.resources}`);
        console.log(`🔧 Tools available: ${health.tools}`);
        this.connected = true;
        return true;
      }
    } catch (error) {
      console.warn('⚠️ MCP Server not available:', error.message);
      console.warn('Continuing without MCP integration (degraded functionality)');
      this.connected = false;
      return false;
    }
  }

  /**
   * List available MCP resources
   */
  async listResources() {
    if (!this.connected) return [];
    
    try {
      const response = await fetch(`${this.mcpServerUrl}/mcp/resources`);
      const data = await response.json();
      return data.resources;
    } catch (error) {
      console.error('Failed to list MCP resources:', error.message);
      return [];
    }
  }

  /**
   * Read a specific MCP resource
   * @param {string} resourceName - Resource name (e.g., 'crisis-resources')
   */
  async readResource(resourceName) {
    if (!this.connected) return null;

    try {
      const response = await fetch(`${this.mcpServerUrl}/mcp/resources/${resourceName}`);
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error(`Failed to read MCP resource ${resourceName}:`, error.message);
      return null;
    }
  }

  /**
   * List available MCP tools
   */
  async listTools() {
    if (!this.connected) return [];

    try {
      const response = await fetch(`${this.mcpServerUrl}/mcp/tools`);
      const data = await response.json();
      return data.tools;
    } catch (error) {
      console.error('Failed to list MCP tools:', error.message);
      return [];
    }
  }

  /**
   * Call an MCP tool
   * @param {string} toolName - Name of the tool to call
   * @param {object} args - Tool arguments
   */
  async callTool(toolName, args = {}) {
    if (!this.connected) {
      throw new Error('MCP Server not connected');
    }

    try {
      const response = await fetch(`${this.mcpServerUrl}/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: toolName,
          arguments: args
        })
      });

      if (!response.ok) {
        throw new Error(`MCP tool call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to call MCP tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if MCP server is connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Disconnect from MCP server
   */
  disconnect() {
    this.connected = false;
    console.log('Disconnected from MCP Server');
  }
}

export default MCPClient;
