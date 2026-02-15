import express from 'express';
import cors from 'cors';
import { mentalHealthKnowledgeBase } from './knowledge-base.js';
import { crisisResources, crisisProtocol } from './crisis-resources.js';
import { copingStrategies } from './coping-strategies.js';
import { cbtTechniques } from './cbt-techniques.js';

const PORT = process.env.MCP_SERVER_PORT || 3001;

/**
 * VishAI MCP Server
 * Provides mental health resources and tools via Model Context Protocol
 * This server exposes mental health knowledge, crisis protocols, and therapeutic techniques
 * for AI agents to access
 */

class VishAIMCPServer {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'vishai-mcp-server',
        version: '1.0.0',
        capabilities: ['resources', 'tools'],
        resources: 5,
        tools: 6
      });
    });

    // MCP Resources endpoint - list available resources
    this.app.get('/mcp/resources', (req, res) => {
      res.json({
        resources: [
          {
            uri: 'vishai://crisis-resources',
            name: 'Crisis Resources & Emergency Protocols',
            description: 'Emergency hotlines, crisis intervention protocols',
            mimeType: 'application/json'
          },
          {
            uri: 'vishai://coping-strategies',
            name: 'Evidence-Based Coping Strategies',
            description: 'Immediate, short-term, and long-term coping mechanisms',
            mimeType: 'application/json'
          },
          {
            uri: 'vishai://cbt-techniques',
            name: 'CBT Techniques',
            description: 'Cognitive Behavioral Therapy methods with step-by-step guidance',
            mimeType: 'application/json'
          },
          {
            uri: 'vishai://mental-health-topics',
            name: 'Mental Health Education',
            description: 'Information on conditions, symptoms, and treatments',
            mimeType: 'application/json'
          }
        ]
      });
    });

    // MCP Resource read - get specific resource content
    this.app.get('/mcp/resources/:resource', (req, res) => {
      const { resource } = req.params;
      
      let content;
      switch (resource) {
        case 'crisis-resources':
          content = { crisisResources, crisisProtocol };
          break;
        case 'coping-strategies':
          content = copingStrategies;
          break;
        case 'cbt-techniques':
          content = cbtTechniques;
          break;
        case 'mental-health-topics':
          content = mentalHealthKnowledgeBase;
          break;
        default:
          return res.status(404).json({ error: 'Resource not found' });
      }

      res.json({
        uri: `vishai://${resource}`,
        content
      });
    });

    // MCP Tools endpoint - list available tools
    this.app.get('/mcp/tools', (req, res) => {
      res.json({
        tools: [
          {
            name: 'search_mental_health_topics',
            description: 'Search mental health knowledge base',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', default: 5 }
              },
              required: ['query']
            }
          },
          {
            name: 'get_crisis_resources',
            description: 'Get crisis resources by country and type',
            inputSchema: {
              type: 'object',
              properties: {
                country: { type: 'string', default: 'US' },
                crisisType: { type: 'string', enum: ['suicide', 'emergency', 'veterans', 'lgbtq'] }
              }
            }
          },
          {
            name: 'recommend_coping_strategies',
            description: 'Recommend coping strategies for specific conditions',
            inputSchema: {
              type: 'object',
              properties: {
                condition: { type: 'string', description: 'Mental health challenge' },
                urgency: { type: 'string', enum: ['immediate', 'short-term', 'long-term'], default: 'short-term' },
                limit: { type: 'number', default: 3 }
              },
              required: ['condition']
            }
          },
          {
            name: 'get_cbt_technique',
            description: 'Get CBT technique with steps',
            inputSchema: {
              type: 'object',
              properties: {
                technique: {
                  type: 'string',
                  enum: ['thought-challenging', 'behavioral-activation', 'problem-solving', 'exposure-therapy']
                }
              },
              required: ['technique']
            }
          },
          {
            name: 'assess_crisis_level',
            description: 'Assess crisis level from user message',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'User message to analyze' }
              },
              required: ['message']
            }
          }
        ]
      });
    });

    // MCP Tool call - execute tool
    this.app.post('/mcp/tools/call', async (req, res) => {
      const { name, arguments: args } = req.body;

      try {
        let result;
        switch (name) {
          case 'search_mental_health_topics':
            result = this.searchMentalHealthTopics(args.query, args.limit || 5);
            break;
          case 'get_crisis_resources':
            result = this.getCrisisResources(args.country || 'US', args.crisisType);
            break;
          case 'recommend_coping_strategies':
            result = this.recommendCopingStrategies(args.condition, args.urgency || 'short-term', args.limit || 3);
            break;
          case 'get_cbt_technique':
            result = this.getCBTTechnique(args.technique);
            break;
          case 'assess_crisis_level':
            result = this.assessCrisisLevel(args.message);
            break;
          default:
            return res.status(400).json({ error: `Unknown tool: ${name}` });
        }

        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // Tool implementations
  searchMentalHealthTopics(query, limit) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const [topic, info] of Object.entries(mentalHealthKnowledgeBase)) {
      let score = 0;
      if (topic.toLowerCase().includes(queryLower)) score += 10;
      if (info.description?.toLowerCase().includes(queryLower)) score += 5;
      if (info.symptoms?.some(s => s.toLowerCase().includes(queryLower))) score += 3;

      if (score > 0) {
        results.push({ topic, ...info, relevanceScore: score });
      }
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return {
      query,
      resultsCount: Math.min(results.length, limit),
      results: results.slice(0, limit)
    };
  }

  getCrisisResources(country, crisisType) {
    const resources = crisisResources[country] || crisisResources['US'];
    let filtered = resources;

    if (crisisType && resources[crisisType]) {
      filtered = { [crisisType]: resources[crisisType], emergency: resources.emergency };
    }

    return {
      country,
      crisisType: crisisType || 'all',
      resources: filtered,
      urgentNote: '⚠️ If life-threatening emergency, call emergency services immediately.'
    };
  }

  recommendCopingStrategies(condition, urgency, limit) {
    const conditionLower = condition.toLowerCase();
    const strategies = copingStrategies[urgency] || copingStrategies['short-term'];

    const relevant = strategies.filter(strategy => 
      strategy.applicableTo.some(c => c.toLowerCase().includes(conditionLower) ||
                                      conditionLower.includes(c.toLowerCase()))
    ).slice(0, limit);

    return {
      condition,
      urgency,
      strategiesCount: relevant.length,
      strategies: relevant
    };
  }

  getCBTTechnique(technique) {
    const techniqueData = cbtTechniques[technique];
    if (!techniqueData) {
      throw new Error(`CBT technique not found: ${technique}`);
    }
    return techniqueData;
  }

  assessCrisisLevel(message) {
    const msgLower = message.toLowerCase();

    const severeKeywords = ['suicide', 'kill myself', 'end my life', 'want to die', 
                           'better off dead', 'no reason to live', 'overdose'];
    const moderateKeywords = ['hopeless', 'helpless', 'worthless', 'give up', 
                             'cant go on', "can't take it", 'hurt myself'];

    let level = 'low';
    let confidence = 0.9;

    for (const keyword of severeKeywords) {
      if (msgLower.includes(keyword)) {
        level = 'severe';
        confidence = 0.95;
        break;
      }
    }

    if (level === 'low') {
      for (const keyword of moderateKeywords) {
        if (msgLower.includes(keyword)) {
          level = 'moderate';
          confidence = 0.75;
          break;
        }
      }
    }

    return {
      crisisLevel: level,
      confidence,
      protocol: crisisProtocol[level],
      shouldEscalateToCrisisAgent: level !== 'low'
    };
  }

  start() {
    this.app.listen(PORT, () => {
      console.log(`✅ VishAI MCP Server running on port ${PORT}`);
      console.log(`📚 Resources: 4 mental health resource collections`);
      console.log(`🔧 Tools: 5 therapeutic tools available`);
      console.log(`🏥 Ready to serve AI agents with mental health knowledge`);
    });
  }
}

const server = new VishAIMCPServer();
server.start();

export default VishAIMCPServer;
