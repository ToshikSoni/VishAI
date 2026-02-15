/**
 * Azure Cosmos DB Integration for VishAI
 * Provides persistent storage for conversation history and user sessions
 */

const { CosmosClient } = require('@azure/cosmos');

class CosmosDBService {
  constructor() {
    this.endpoint = process.env.COSMOS_DB_ENDPOINT || '';
    this.key = process.env.COSMOS_DB_KEY || '';
    this.databaseId = process.env.COSMOS_DB_DATABASE || 'vishai_db';
    
    this.client = null;
    this.database = null;
    this.containers = {
      conversations: null,
      userProfiles: null,
      agentInteractions: null
    };
    
    this.isInitialized = false;
  }

  /**
   * Initialize Cosmos DB connection
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Skip if credentials not available (fallback to in-memory)
      if (!this.endpoint || !this.key) {
        console.warn('⚠️ Cosmos DB credentials not configured - using in-memory storage');
        return;
      }

      this.client = new CosmosClient({ endpoint: this.endpoint, key: this.key });
      
      // Create database if doesn't exist
      const { database } = await this.client.databases.createIfNotExists({
        id: this.databaseId
      });
      this.database = database;

      // Create containers if don't exist
      await this._createContainers();
      
      this.isInitialized = true;
      console.log('✅ Cosmos DB initialized successfully');
    } catch (error) {
      console.error('❌ Cosmos DB initialization failed:', error.message);
      console.warn('⚠️ Falling back to in-memory storage');
    }
  }

  async _createContainers() {
    // Conversations container
    const { container: conversationsContainer } = await this.database.containers.createIfNotExists({
      id: 'conversations',
      partitionKey: { paths: ['/sessionId'] },
      defaultTtl: 2592000 // 30 days
    });
    this.containers.conversations = conversationsContainer;

    // User profiles container
    const { container: profilesContainer } = await this.database.containers.createIfNotExists({
      id: 'user_profiles',
      partitionKey: { paths: ['/userId'] }
    });
    this.containers.userProfiles = profilesContainer;

    // Agent interactions container (analytics)
    const { container: interactionsContainer } = await this.database.containers.createIfNotExists({
      id: 'agent_interactions',
      partitionKey: { paths: ['/agentRole'] }
    });
    this.containers.agentInteractions = interactionsContainer;
  }

  /**
   * Save conversation message
   */
  async saveMessage(sessionId, message) {
    if (!this.isInitialized) return null;

    try {
      const item = {
        id: `${sessionId}-${Date.now()}`,
        sessionId,
        timestamp: new Date().toISOString(),
        ...message
      };

      const { resource } = await this.containers.conversations.items.create(item);
      return resource;
    } catch (error) {
      console.error('Error saving message to Cosmos DB:', error.message);
      return null;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId, limit = 50) {
    if (!this.isInitialized) return [];

    try {
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.sessionId = @sessionId ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit',
        parameters: [
          { name: '@sessionId', value: sessionId },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.containers.conversations.items
        .query(querySpec)
        .fetchAll();

      return resources.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error fetching conversation history:', error.message);
      return [];
    }
  }

  /**
   * Save agent interaction for analytics
   */
  async logAgentInteraction(sessionId, agentRole, interaction) {
    if (!this.isInitialized) return null;

    try {
      const item = {
        id: `${sessionId}-${agentRole}-${Date.now()}`,
        sessionId,
        agentRole,
        timestamp: new Date().toISOString(),
        ...interaction
      };

      const { resource } = await this.containers.agentInteractions.items.create(item);
      return resource;
    } catch (error) {
      console.error('Error logging agent interaction:', error.message);
      return null;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    if (!this.isInitialized) return null;

    try {
      const { resource } = await this.containers.userProfiles.item(userId, userId).read();
      return resource;
    } catch (error) {
      if (error.code === 404) return null;
      console.error('Error fetching user profile:', error.message);
      return null;
    }
  }

  /**
   * Update or create user profile
   */
  async upsertUserProfile(userId, profileData) {
    if (!this.isInitialized) return null;

    try {
      const item = {
        id: userId,
        userId,
        lastUpdated: new Date().toISOString(),
        ...profileData
      };

      const { resource } = await this.containers.userProfiles.items.upsert(item);
      return resource;
    } catch (error) {
      console.error('Error upserting user profile:', error.message);
      return null;
    }
  }

  /**
   * Get agent usage statistics
   */
  async getAgentStatistics(agentRole, startDate, endDate) {
    if (!this.isInitialized) return [];

    try {
      const querySpec = {
        query: `
          SELECT 
            c.agentRole,
            COUNT(1) as interactionCount,
            AVG(c.duration) as avgDuration
          FROM c 
          WHERE c.agentRole = @agentRole 
            AND c.timestamp >= @startDate 
            AND c.timestamp <= @endDate
          GROUP BY c.agentRole
        `,
        parameters: [
          { name: '@agentRole', value: agentRole },
          { name: '@startDate', value: startDate },
          { name: '@endDate', value: endDate }
        ]
      };

      const { resources } = await this.containers.agentInteractions.items
        .query(querySpec)
        .fetchAll();

      return resources;
    } catch (error) {
      console.error('Error fetching agent statistics:', error.message);
      return [];
    }
  }

  /**
   * Delete old conversations (cleanup)
   */
  async deleteOldConversations(daysOld = 30) {
    if (!this.isInitialized) return 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const querySpec = {
        query: 'SELECT c.id, c.sessionId FROM c WHERE c.timestamp < @cutoffDate',
        parameters: [{ name: '@cutoffDate', value: cutoffDate.toISOString() }]
      };

      const { resources } = await this.containers.conversations.items
        .query(querySpec)
        .fetchAll();

      let deletedCount = 0;
      for (const item of resources) {
        await this.containers.conversations.item(item.id, item.sessionId).delete();
        deletedCount++;
      }

      console.log(`🗑️ Deleted ${deletedCount} old conversations`);
      return deletedCount;
    } catch (error) {
      console.error('Error deleting old conversations:', error.message);
      return 0;
    }
  }
}

// Singleton instance
const cosmosDB = new CosmosDBService();

module.exports = cosmosDB;
