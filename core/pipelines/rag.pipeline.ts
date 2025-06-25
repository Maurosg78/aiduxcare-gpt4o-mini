import { vectorStoreRetriever, RetrievedDocument } from '@/core/retrievers/vectorStore.retriever';
import { azureOpenAIService } from '@/core/services/openai.service';
import { supabaseVectorClient } from '@/core/vector-stores/supabase.client';

/**
 * Interfaz para el resultado del pipeline RAG
 */
export interface RAGResult {
  query: string;
  retrievedDocuments: RetrievedDocument[];
  generatedResponse: string;
  metadata: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    retrievalTime: number;
    generationTime: number;
    totalTime: number;
    documentCount: number;
    averageSimilarity: number;
  };
}

/**
 * Opciones para el pipeline RAG
 */
export interface RAGOptions {
  topK?: number;
  similarityThreshold?: number;
  includeClinicalDocuments?: boolean;
  includeGuidelines?: boolean;
  includeProtocols?: boolean;
  patientId?: string;
  sessionId?: string;
  temperature?: number;
  maxTokens?: number;
  enableHybridSearch?: boolean;
}

/**
 * Pipeline RAG (Retrieval-Augmented Generation)
 * 
 * Este pipeline implementa el flujo completo de RAG:
 * 1. Recibe una consulta del usuario
 * 2. Genera embeddings para la consulta
 * 3. Busca documentos similares en el vector store
 * 4. Genera una respuesta basada en los documentos recuperados
 * 5. Retorna la respuesta con metadatos del proceso
 */
export class RAGPipeline {
  /**
   * Ejecuta el pipeline RAG completo
   */
  async execute(
    query: string,
    options: RAGOptions = {}
  ): Promise<RAGResult> {
    const startTime = Date.now();
    
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('La consulta no puede estar vacía');
      }

      // Paso 1: Recuperar documentos relevantes
      const retrievalStartTime = Date.now();
      const retrievedDocuments = await this.retrieveDocuments(query, options);
      const retrievalTime = Date.now() - retrievalStartTime;

      // Paso 2: Generar respuesta basada en los documentos
      const generationStartTime = Date.now();
      const response = await this.generateResponse(query, retrievedDocuments, options);
      const generationTime = Date.now() - generationStartTime;

      const totalTime = Date.now() - startTime;

      // Calcular metadatos
      const averageSimilarity = retrievedDocuments.length > 0
        ? retrievedDocuments.reduce((sum, doc) => sum + doc.similarity, 0) / retrievedDocuments.length
        : 0;

      return {
        query,
        retrievedDocuments,
        generatedResponse: response.response,
        metadata: {
          totalTokens: response.usage.totalTokens,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          retrievalTime,
          generationTime,
          totalTime,
          documentCount: retrievedDocuments.length,
          averageSimilarity
        }
      };
    } catch (error) {
      console.error('Error en pipeline RAG:', error);
      throw new Error(`Error en pipeline RAG: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Recupera documentos relevantes para la consulta
   */
  private async retrieveDocuments(
    query: string,
    options: RAGOptions
  ): Promise<RetrievedDocument[]> {
    try {
      if (options.enableHybridSearch) {
        // Búsqueda híbrida que combina múltiples fuentes
        return await vectorStoreRetriever.hybridSearch(query, {
          includeClinicalDocuments: options.includeClinicalDocuments,
          includeGuidelines: options.includeGuidelines,
          includeProtocols: options.includeProtocols,
          patientId: options.patientId,
          sessionId: options.sessionId,
          topK: options.topK,
          similarityThreshold: options.similarityThreshold
        });
      } else {
        // Búsqueda simple
        return await vectorStoreRetriever.searchSimilarDocuments(query, {
          topK: options.topK,
          similarityThreshold: options.similarityThreshold,
          filters: this.buildFilters(options)
        });
      }
    } catch (error) {
      console.error('Error recuperando documentos:', error);
      throw error;
    }
  }

  /**
   * Genera una respuesta basada en los documentos recuperados
   */
  private async generateResponse(
    query: string,
    documents: RetrievedDocument[],
    options: RAGOptions
  ): Promise<{
    response: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      if (documents.length === 0) {
        // Si no hay documentos relevantes, generar una respuesta informativa
        const noContextResponse = await azureOpenAIService.generateChatCompletion([
          {
            role: 'system',
            content: 'Eres un asistente clínico especializado en fisioterapia. Si no tienes información específica sobre la consulta, indícalo claramente y sugiere consultar con un profesional de la salud.'
          },
          {
            role: 'user',
            content: `Consulta: ${query}\n\nNo se encontraron documentos relevantes en la base de conocimientos. Por favor, proporciona una respuesta apropiada.`
          }
        ], {
          temperature: options.temperature,
          maxTokens: options.maxTokens
        });

        return {
          response: noContextResponse.content,
          usage: noContextResponse.usage
        };
      }

      // Generar respuesta usando los documentos recuperados
      return await azureOpenAIService.generateClinicalResponse(
        query,
        documents.map(doc => ({
          content: doc.content,
          metadata: {
            ...doc.metadata,
            documentType: doc.documentType,
            similarity: doc.similarity,
            patientId: doc.patientId,
            sessionId: doc.sessionId
          }
        })),
        {
          temperature: options.temperature,
          maxTokens: options.maxTokens
        }
      );
    } catch (error) {
      console.error('Error generando respuesta:', error);
      throw error;
    }
  }

  /**
   * Construye filtros para la búsqueda basados en las opciones
   */
  private buildFilters(options: RAGOptions): Record<string, any> {
    const filters: Record<string, any> = {};

    if (options.patientId) {
      filters.patient_id = options.patientId;
    }

    if (options.sessionId) {
      filters.session_id = options.sessionId;
    }

    return filters;
  }

  /**
   * Almacena un nuevo documento en el vector store
   */
  async storeDocument(document: {
    content: string;
    metadata?: Record<string, any>;
    documentType?: string;
    patientId?: string;
    sessionId?: string;
  }): Promise<{ id: string; success: boolean }> {
    try {
      // Generar embedding para el documento
      const embedding = await azureOpenAIService.generateEmbedding(document.content);

      // Almacenar en el vector store
      return await supabaseVectorClient.storeDocument({
        content: document.content,
        embedding,
        metadata: document.metadata,
        documentType: document.documentType,
        patientId: document.patientId,
        sessionId: document.sessionId
      });
    } catch (error) {
      console.error('Error almacenando documento:', error);
      throw error;
    }
  }

  /**
   * Almacena múltiples documentos en lote
   */
  async storeDocuments(documents: Array<{
    content: string;
    metadata?: Record<string, any>;
    documentType?: string;
    patientId?: string;
    sessionId?: string;
  }>): Promise<Array<{ id: string; success: boolean }>> {
    try {
      const results: Array<{ id: string; success: boolean }> = [];

      for (const document of documents) {
        try {
          const result = await this.storeDocument(document);
          results.push(result);
        } catch (error) {
          console.error(`Error almacenando documento:`, error);
          results.push({ id: '', success: false });
        }
      }

      return results;
    } catch (error) {
      console.error('Error almacenando documentos en lote:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una consulta de solo recuperación (sin generación)
   */
  async retrieveOnly(
    query: string,
    options: RAGOptions = {}
  ): Promise<{
    query: string;
    retrievedDocuments: RetrievedDocument[];
    retrievalTime: number;
  }> {
    const startTime = Date.now();

    try {
      const documents = await this.retrieveDocuments(query, options);
      const retrievalTime = Date.now() - startTime;

      return {
        query,
        retrievedDocuments: documents,
        retrievalTime
      };
    } catch (error) {
      console.error('Error en recuperación:', error);
      throw error;
    }
  }

  /**
   * Verifica la salud de todos los componentes del pipeline
   */
  async healthCheck(): Promise<{
    retriever: boolean;
    openAI: boolean;
    vectorStore: boolean;
    overall: boolean;
  }> {
    try {
      const retrieverHealth = await vectorStoreRetriever.healthCheck();
      const openAIHealth = await azureOpenAIService.healthCheck();

      return {
        retriever: retrieverHealth.overall,
        openAI: openAIHealth,
        vectorStore: retrieverHealth.vectorStore,
        overall: retrieverHealth.overall && openAIHealth
      };
    } catch (error) {
      console.error('Error en health check del pipeline:', error);
      return {
        retriever: false,
        openAI: false,
        vectorStore: false,
        overall: false
      };
    }
  }
}

// Instancia singleton del pipeline
export const ragPipeline = new RAGPipeline();

export default ragPipeline; 