import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

/**
 * Cliente de Supabase configurado para pgvector
 * 
 * Este cliente maneja la conexión a Supabase y proporciona métodos
 * para trabajar con embeddings y búsquedas vectoriales.
 */
export class SupabaseVectorClient {
  private client;
  private tableName: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    }

    this.client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    this.tableName = process.env.VECTOR_STORE_TABLE_NAME || 'clinical_documents';
  }

  /**
   * Almacena un documento con su embedding en la base de datos
   */
  async storeDocument(document: {
    content: string;
    embedding: number[];
    metadata?: Record<string, any>;
    documentType?: string;
    patientId?: string;
    sessionId?: string;
  }): Promise<{ id: string; success: boolean }> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert({
          content: document.content,
          embedding: document.embedding,
          metadata: document.metadata || {},
          document_type: document.documentType || 'clinical_note',
          patient_id: document.patientId,
          session_id: document.sessionId,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error almacenando documento:', error);
        throw new Error(`Error al almacenar documento: ${error.message}`);
      }

      return { id: data.id, success: true };
    } catch (error) {
      console.error('Error en storeDocument:', error);
      throw error;
    }
  }

  /**
   * Busca documentos similares usando búsqueda vectorial
   */
  async searchSimilarDocuments(
    queryEmbedding: number[],
    options: {
      topK?: number;
      similarityThreshold?: number;
      filters?: Record<string, any>;
    } = {}
  ): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    similarity: number;
  }>> {
    try {
      const topK = options.topK || parseInt(process.env.VECTOR_STORE_TOP_K || '5');
      const similarityThreshold = options.similarityThreshold || 
        parseFloat(process.env.VECTOR_STORE_SIMILARITY_THRESHOLD || '0.7');

      // Construir la consulta base
      let query = this.client
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: similarityThreshold,
          match_count: topK
        });

      // Aplicar filtros si se proporcionan
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error en búsqueda vectorial:', error);
        throw new Error(`Error en búsqueda: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error en searchSimilarDocuments:', error);
      throw error;
    }
  }

  /**
   * Elimina un documento por ID
   */
  async deleteDocument(id: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando documento:', error);
        throw new Error(`Error al eliminar documento: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error en deleteDocument:', error);
      throw error;
    }
  }

  /**
   * Actualiza un documento existente
   */
  async updateDocument(
    id: string,
    updates: {
      content?: string;
      embedding?: number[];
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error actualizando documento:', error);
        throw new Error(`Error al actualizar documento: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error en updateDocument:', error);
      throw error;
    }
  }

  /**
   * Obtiene un documento por ID
   */
  async getDocument(id: string): Promise<{
    id: string;
    content: string;
    metadata: Record<string, any>;
    documentType: string;
    patientId?: string;
    sessionId?: string;
    createdAt: string;
  } | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Documento no encontrado
        }
        console.error('Error obteniendo documento:', error);
        throw new Error(`Error al obtener documento: ${error.message}`);
      }

      return {
        id: data.id,
        content: data.content,
        metadata: data.metadata,
        documentType: data.document_type,
        patientId: data.patient_id,
        sessionId: data.session_id,
        createdAt: data.created_at
      };
    } catch (error) {
      console.error('Error en getDocument:', error);
      throw error;
    }
  }

  /**
   * Verifica la conexión a la base de datos
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error en health check:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error en healthCheck:', error);
      return false;
    }
  }
}

// Instancia singleton del cliente
export const supabaseVectorClient = new SupabaseVectorClient();

export default supabaseVectorClient; 