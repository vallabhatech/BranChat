import { Client } from '@elastic/elasticsearch';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface MemoryDocument {
  summary: string;
  keywords: string[];
  conversationId: string;
  subchatId: string;
  userId: string;
  embedding?: number[];
  createdAt: Date;
  mergedAt: Date;
}

export interface SearchResult {
  id: string;
  score: number;
  document: MemoryDocument;
}

export class ElasticService {
  private client: Client;
  private indexName = 'subchat-memories';
  private isConnected = false;
  private hasVectorSupport = false;

  constructor() {
    // Initialize Elasticsearch client
    const clientConfig: any = {
      node: config.elastic.url,
    };

    // Use API key if provided, otherwise use username/password
    if (config.elastic.apiKey) {
      clientConfig.auth = {
        apiKey: config.elastic.apiKey,
      };
    } else if (config.elastic.username && config.elastic.password) {
      clientConfig.auth = {
        username: config.elastic.username,
        password: config.elastic.password,
      };
    }

    this.client = new Client(clientConfig);
  }

  /**
   * Initialize connection and ensure index exists
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      await this.client.ping();
      this.isConnected = true;
      logger.info('Connected to Elasticsearch');

      // Check for vector support
      await this.checkVectorSupport();

      // Ensure index exists
      await this.ensureIndex();
      
      logger.info(`Elasticsearch initialized with vector support: ${this.hasVectorSupport}`);
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Check if Elasticsearch supports vector operations
   */
  private async checkVectorSupport(): Promise<void> {
    try {
      const info = await this.client.info();
      const version = info.version?.number;
      
      if (version) {
        // Vector support was added in Elasticsearch 8.0
        const majorVersion = parseInt(version.split('.')[0]);
        this.hasVectorSupport = majorVersion >= 8;
      }
      
      logger.info(`Elasticsearch version: ${version}, vector support: ${this.hasVectorSupport}`);
    } catch (error) {
      logger.warn('Could not determine Elasticsearch version, assuming no vector support');
      this.hasVectorSupport = false;
    }
  }

  /**
   * Ensure the memories index exists with proper mapping
   */
  async ensureIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.createIndex();
        logger.info(`Created Elasticsearch index: ${this.indexName}`);
      } else {
        logger.info(`Elasticsearch index already exists: ${this.indexName}`);
      }
    } catch (error) {
      logger.error('Failed to ensure index exists:', error);
      throw error;
    }
  }

  /**
   * Create the memories index with appropriate mapping
   */
  private async createIndex(): Promise<void> {
    const mapping: any = {
      properties: {
        summary: {
          type: 'text',
          analyzer: 'standard',
        },
        keywords: {
          type: 'keyword',
        },
        conversationId: {
          type: 'keyword',
        },
        subchatId: {
          type: 'keyword',
        },
        userId: {
          type: 'keyword',
        },
        createdAt: {
          type: 'date',
        },
        mergedAt: {
          type: 'date',
        },
      },
    };

    // Add vector field if supported
    if (this.hasVectorSupport) {
      mapping.properties.embedding = {
        type: 'dense_vector',
        dims: 768, // Gemini embedding dimension
        index: true,
        similarity: 'cosine',
      };
    }

    await this.client.indices.create({
      index: this.indexName,
      body: {
        mappings: mapping,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0, // For development, increase for production
        },
      },
    });
  }

  /**
   * Check if Elasticsearch is available and connected
   */
  isAvailable(): boolean {
    return this.isConnected;
  }

  /**
   * Check if vector search is supported
   */
  supportsVectorSearch(): boolean {
    return this.hasVectorSupport && this.isConnected;
  }

  /**
   * Get index health information
   */
  async getIndexHealth(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Elasticsearch not connected');
    }

    try {
      const health = await this.client.cluster.health({
        index: this.indexName,
      });
      return health;
    } catch (error) {
      logger.error('Failed to get index health:', error);
      throw error;
    }
  }

  /**
   * Store or update a memory summary with optional vector embedding
   */
  async upsertSummary(
    subchatId: string,
    document: Omit<MemoryDocument, 'embedding'>,
    embedding?: number[]
  ): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Elasticsearch not available, skipping memory storage');
      return;
    }

    try {
      const body: any = {
        ...document,
        updatedAt: new Date(),
      };

      // Add embedding if vector support is available and embedding is provided
      if (this.hasVectorSupport && embedding) {
        body.embedding = embedding;
      }

      await this.client.index({
        index: this.indexName,
        id: subchatId,
        body,
      });

      logger.info('Memory summary stored successfully', {
        subchatId,
        hasEmbedding: !!embedding,
        vectorSupport: this.hasVectorSupport,
      });
    } catch (error) {
      logger.error('Failed to store memory summary:', error);
      throw error;
    }
  }

  /**
   * Search memories using vector similarity or text search as fallback
   */
  async search(
    query: string,
    userId: string,
    options: {
      topK?: number;
      embedding?: number[];
      similarityThreshold?: number;
      conversationId?: string;
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.isConnected) {
      logger.warn('Elasticsearch not available, returning empty results');
      return [];
    }

    const {
      topK = 5,
      embedding,
      similarityThreshold = 0.7,
      conversationId,
    } = options;

    try {
      let searchBody: any;

      // Use vector search if available and embedding is provided
      if (this.hasVectorSupport && embedding) {
        searchBody = {
          query: {
            bool: {
              must: [
                {
                  term: { userId },
                },
                {
                  script_score: {
                    query: { match_all: {} },
                    script: {
                      source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                      params: {
                        query_vector: embedding,
                      },
                    },
                    min_score: similarityThreshold + 1.0, // Adjust for cosine similarity offset
                  },
                },
              ],
            },
          },
          size: topK,
        };

        // Exclude current conversation if specified
        if (conversationId) {
          searchBody.query.bool.must_not = [
            { term: { conversationId } },
          ];
        }
      } else {
        // Fallback to text search using BM25
        searchBody = {
          query: {
            bool: {
              must: [
                {
                  term: { userId },
                },
                {
                  multi_match: {
                    query,
                    fields: ['summary^2', 'keywords^1.5'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                  },
                },
              ],
            },
          },
          size: topK,
        };

        // Exclude current conversation if specified
        if (conversationId) {
          searchBody.query.bool.must_not = [
            { term: { conversationId } },
          ];
        }
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody,
      });

      const results: SearchResult[] = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        document: hit._source as MemoryDocument,
      }));

      logger.info('Memory search completed', {
        query: query.substring(0, 100),
        userId,
        resultsCount: results.length,
        searchType: this.hasVectorSupport && embedding ? 'vector' : 'text',
      });

      return results;
    } catch (error) {
      logger.error('Memory search failed:', error);
      
      // Return empty results instead of throwing to allow graceful degradation
      logger.warn('Returning empty search results due to Elasticsearch error');
      return [];
    }
  }

  /**
   * Delete a memory entry
   */
  async deleteMemory(subchatId: string): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Elasticsearch not available, skipping memory deletion');
      return;
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: subchatId,
      });

      logger.info('Memory deleted successfully', { subchatId });
    } catch (error) {
      if ((error as any)?.statusCode === 404) {
        logger.warn('Memory not found for deletion', { subchatId });
        return;
      }
      
      logger.error('Failed to delete memory:', error);
      throw error;
    }
  }

  /**
   * Clean up old memories based on age or user
   */
  async cleanupMemories(options: {
    userId?: string;
    olderThanDays?: number;
    maxEntries?: number;
  } = {}): Promise<{ deleted: number }> {
    if (!this.isConnected) {
      logger.warn('Elasticsearch not available, skipping memory cleanup');
      return { deleted: 0 };
    }

    const { userId, olderThanDays, maxEntries } = options;

    try {
      let deleteQuery: any = { match_all: {} };

      if (userId || olderThanDays) {
        deleteQuery = {
          bool: {
            must: [],
          },
        };

        if (userId) {
          deleteQuery.bool.must.push({ term: { userId } });
        }

        if (olderThanDays) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
          
          deleteQuery.bool.must.push({
            range: {
              createdAt: {
                lt: cutoffDate.toISOString(),
              },
            },
          });
        }
      }

      // If maxEntries is specified, first get the oldest entries
      if (maxEntries) {
        const searchResponse = await this.client.search({
          index: this.indexName,
          body: {
            query: deleteQuery,
            sort: [{ createdAt: { order: 'desc' } }],
            from: maxEntries,
            size: 1000, // Limit batch size
            _source: false,
          },
        });

        if (searchResponse.hits.hits.length > 0) {
          const idsToDelete = searchResponse.hits.hits.map((hit: any) => hit._id);
          
          const deleteResponse = await this.client.deleteByQuery({
            index: this.indexName,
            body: {
              query: {
                ids: {
                  values: idsToDelete,
                },
              },
            },
          });

          logger.info('Memory cleanup completed (max entries)', {
            deleted: deleteResponse.deleted,
            maxEntries,
          });

          return { deleted: deleteResponse.deleted || 0 };
        }
      } else {
        // Delete by query
        const deleteResponse = await this.client.deleteByQuery({
          index: this.indexName,
          body: {
            query: deleteQuery,
          },
        });

        logger.info('Memory cleanup completed', {
          deleted: deleteResponse.deleted,
          userId,
          olderThanDays,
        });

        return { deleted: deleteResponse.deleted || 0 };
      }

      return { deleted: 0 };
    } catch (error) {
      logger.error('Memory cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: string): Promise<{
    totalMemories: number;
    oldestMemory?: Date;
    newestMemory?: Date;
    averageKeywords: number;
  }> {
    if (!this.isConnected) {
      return {
        totalMemories: 0,
        averageKeywords: 0,
      };
    }

    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            term: { userId },
          },
          aggs: {
            total_count: {
              value_count: {
                field: 'subchatId',
              },
            },
            oldest_memory: {
              min: {
                field: 'createdAt',
              },
            },
            newest_memory: {
              max: {
                field: 'createdAt',
              },
            },
            avg_keywords: {
              avg: {
                script: {
                  source: "doc['keywords'].length",
                },
              },
            },
          },
          size: 0,
        },
      });

      const aggs = response.aggregations as any;
      
      return {
        totalMemories: aggs?.total_count?.value || 0,
        oldestMemory: aggs?.oldest_memory?.value_as_string ? new Date(aggs.oldest_memory.value_as_string) : undefined,
        newestMemory: aggs?.newest_memory?.value_as_string ? new Date(aggs.newest_memory.value_as_string) : undefined,
        averageKeywords: Math.round(aggs?.avg_keywords?.value || 0),
      };
    } catch (error) {
      logger.error('Failed to get memory stats:', error);
      return {
        totalMemories: 0,
        averageKeywords: 0,
      };
    }
  }
}

// Export singleton instance
export const elasticService = new ElasticService();