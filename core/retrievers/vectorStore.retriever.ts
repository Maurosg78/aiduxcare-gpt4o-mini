import { azureOpenAIService } from '@/core/services/openai.service';
import { supabaseVectorClient } from '@/core/vector-stores/supabase.client';

/**
 * Interfaz para documentos recuperados
 */
export interface RetrievedDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  documentType: string;
  patientId?: string;
  sessionId?: string;
}

/**
 * Opciones para la búsqueda de documentos
 */
export interface SearchOptions {
  topK?: number;
  similarityThreshold?: number;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

/**
 * Retriever para buscar documentos similares en el vector store
 * 
 * Este componente implementa la lógica de recuperación de documentos
 * relevantes basándose en similitud semántica usando embeddings.
 */
export class VectorStoreRetriever {
  /**
   * Busca documentos similares a una consulta
   */
  async searchSimilarDocuments(
    query: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('La consulta no puede estar vacía');
      }

      // Generar embedding para la consulta
      const queryEmbedding = await azureOpenAIService.generateEmbedding(query);

      // Buscar documentos similares en el vector store
      const similarDocuments = await supabaseVectorClient.searchSimilarDocuments(
        queryEmbedding,
        {
          topK: options.topK,
          similarityThreshold: options.similarityThreshold,
          filters: options.filters
        }
      );

      // Transformar los resultados al formato esperado
      return similarDocuments.map(doc => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        similarity: doc.similarity,
        documentType: doc.metadata?.document_type || 'unknown',
        patientId: doc.metadata?.patient_id,
        sessionId: doc.metadata?.session_id
      }));
    } catch (error) {
      console.error('Error en searchSimilarDocuments:', error);
      throw new Error(`Error al buscar documentos similares: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Busca documentos por tipo específico
   */
  async searchByDocumentType(
    query: string,
    documentType: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    return this.searchSimilarDocuments(query, {
      ...options,
      filters: {
        ...options.filters,
        document_type: documentType
      }
    });
  }

  /**
   * Busca documentos relacionados con un paciente específico
   */
  async searchByPatient(
    query: string,
    patientId: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    return this.searchSimilarDocuments(query, {
      ...options,
      filters: {
        ...options.filters,
        patient_id: patientId
      }
    });
  }

  /**
   * Busca documentos de una sesión específica
   */
  async searchBySession(
    query: string,
    sessionId: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    return this.searchSimilarDocuments(query, {
      ...options,
      filters: {
        ...options.filters,
        session_id: sessionId
      }
    });
  }

  /**
   * Busca documentos clínicos (notas SOAP, evaluaciones, etc.)
   */
  async searchClinicalDocuments(
    query: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    const clinicalTypes = ['soap_note', 'evaluation', 'treatment_plan', 'progress_note'];
    
    const allResults: RetrievedDocument[] = [];
    
    for (const docType of clinicalTypes) {
      try {
        const results = await this.searchByDocumentType(query, docType, options);
        allResults.push(...results);
      } catch (error) {
        console.warn(`Error buscando documentos de tipo ${docType}:`, error);
        // Continuar con otros tipos de documentos
      }
    }

    // Ordenar por similitud y limitar resultados
    const topK = options.topK || 5;
    return allResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Busca guías clínicas y protocolos
   */
  async searchClinicalGuidelines(
    query: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    return this.searchByDocumentType(query, 'clinical_guideline', options);
  }

  /**
   * Busca protocolos de tratamiento
   */
  async searchTreatmentProtocols(
    query: string,
    options: SearchOptions = {}
  ): Promise<RetrievedDocument[]> {
    return this.searchByDocumentType(query, 'treatment_protocol', options);
  }

  /**
   * Realiza una búsqueda híbrida combinando múltiples fuentes
   */
  async hybridSearch(
    query: string,
    options: {
      includeClinicalDocuments?: boolean;
      includeGuidelines?: boolean;
      includeProtocols?: boolean;
      patientId?: string;
      sessionId?: string;
      topK?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<RetrievedDocument[]> {
    const allResults: RetrievedDocument[] = [];
    const topK = options.topK || 5;

    // Búsqueda general
    try {
      const generalResults = await this.searchSimilarDocuments(query, {
        topK: Math.ceil(topK / 2),
        similarityThreshold: options.similarityThreshold
      });
      allResults.push(...generalResults);
    } catch (error) {
      console.warn('Error en búsqueda general:', error);
    }

    // Búsqueda de documentos clínicos
    if (options.includeClinicalDocuments !== false) {
      try {
        const clinicalResults = await this.searchClinicalDocuments(query, {
          topK: Math.ceil(topK / 3),
          similarityThreshold: options.similarityThreshold
        });
        allResults.push(...clinicalResults);
      } catch (error) {
        console.warn('Error en búsqueda de documentos clínicos:', error);
      }
    }

    // Búsqueda de guías clínicas
    if (options.includeGuidelines) {
      try {
        const guidelineResults = await this.searchClinicalGuidelines(query, {
          topK: Math.ceil(topK / 4),
          similarityThreshold: options.similarityThreshold
        });
        allResults.push(...guidelineResults);
      } catch (error) {
        console.warn('Error en búsqueda de guías clínicas:', error);
      }
    }

    // Búsqueda de protocolos
    if (options.includeProtocols) {
      try {
        const protocolResults = await this.searchTreatmentProtocols(query, {
          topK: Math.ceil(topK / 4),
          similarityThreshold: options.similarityThreshold
        });
        allResults.push(...protocolResults);
      } catch (error) {
        console.warn('Error en búsqueda de protocolos:', error);
      }
    }

    // Filtrar por paciente si se especifica
    let filteredResults = allResults;
    if (options.patientId) {
      filteredResults = allResults.filter(doc => doc.patientId === options.patientId);
    }

    // Filtrar por sesión si se especifica
    if (options.sessionId) {
      filteredResults = filteredResults.filter(doc => doc.sessionId === options.sessionId);
    }

    // Eliminar duplicados y ordenar por similitud
    const uniqueResults = this.removeDuplicates(filteredResults);
    return uniqueResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Elimina documentos duplicados basándose en el ID
   */
  private removeDuplicates(documents: RetrievedDocument[]): RetrievedDocument[] {
    const seen = new Set<string>();
    return documents.filter(doc => {
      if (seen.has(doc.id)) {
        return false;
      }
      seen.add(doc.id);
      return true;
    });
  }

  /**
   * Verifica la conectividad del retriever
   */
  async healthCheck(): Promise<{
    vectorStore: boolean;
    openAI: boolean;
    overall: boolean;
  }> {
    try {
      const vectorStoreHealth = await supabaseVectorClient.healthCheck();
      const openAIHealth = await azureOpenAIService.healthCheck();

      return {
        vectorStore: vectorStoreHealth,
        openAI: openAIHealth,
        overall: vectorStoreHealth && openAIHealth
      };
    } catch (error) {
      console.error('Error en health check del retriever:', error);
      return {
        vectorStore: false,
        openAI: false,
        overall: false
      };
    }
  }
}

// Instancia singleton del retriever
export const vectorStoreRetriever = new VectorStoreRetriever();

export default vectorStoreRetriever; 