import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

/**
 * Servicio de Azure OpenAI para generar embeddings y completaciones
 * 
 * Este servicio maneja la comunicación con Azure OpenAI para:
 * - Generar embeddings de texto usando text-embedding-ada-002
 * - Generar completaciones usando GPT-4
 */
export class AzureOpenAIService {
  private client: OpenAIClient;
  private chatDeployment: string;
  private embeddingDeployment: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
      throw new Error('AZURE_OPENAI_ENDPOINT y AZURE_OPENAI_API_KEY son requeridos');
    }

    this.client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
    this.chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4';
    this.embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
  }

  /**
   * Genera embeddings para un texto dado
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('El texto no puede estar vacío');
      }

      // Limitar el texto a 8000 tokens (aproximadamente 6000 palabras)
      const truncatedText = this.truncateText(text, 6000);

      const response = await this.client.getEmbeddings(this.embeddingDeployment, [truncatedText]);

      if (!response.data || response.data.length === 0) {
        throw new Error('No se recibieron embeddings de Azure OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generando embedding:', error);
      throw new Error(`Error al generar embedding: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Genera embeddings para múltiples textos
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      if (!texts || texts.length === 0) {
        throw new Error('La lista de textos no puede estar vacía');
      }

      // Limitar a 16 textos por request (límite de Azure OpenAI)
      const batchSize = 16;
      const allEmbeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const truncatedBatch = batch.map(text => this.truncateText(text, 6000));

        const response = await this.client.getEmbeddings(this.embeddingDeployment, truncatedBatch);

        if (!response.data) {
          throw new Error('No se recibieron embeddings de Azure OpenAI');
        }

        allEmbeddings.push(...response.data.map((item: { embedding: number[] }) => item.embedding));
      }

      return allEmbeddings;
    } catch (error) {
      console.error('Error generando embeddings:', error);
      throw new Error(`Error al generar embeddings: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Genera una completación de chat
   */
  async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    } = {}
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      if (!messages || messages.length === 0) {
        throw new Error('Los mensajes no pueden estar vacíos');
      }

      const response = await this.client.getChatCompletions(this.chatDeployment, messages, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1000,
        topP: options.topP ?? 0.95,
        frequencyPenalty: options.frequencyPenalty ?? 0,
        presencePenalty: options.presencePenalty ?? 0,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No se recibió respuesta de Azure OpenAI');
      }

      const choice = response.choices[0];
      if (!choice.message?.content) {
        throw new Error('La respuesta no contiene contenido');
      }

      return {
        content: choice.message.content,
        usage: {
          promptTokens: response.usage?.promptTokens ?? 0,
          completionTokens: response.usage?.completionTokens ?? 0,
          totalTokens: response.usage?.totalTokens ?? 0,
        },
      };
    } catch (error) {
      console.error('Error generando completación de chat:', error);
      throw new Error(`Error al generar completación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Genera una respuesta para una consulta clínica usando RAG
   */
  async generateClinicalResponse(
    query: string,
    contextDocuments: Array<{ content: string; metadata?: Record<string, any> }>,
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<{
    response: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      // Construir el contexto a partir de los documentos
      const contextText = contextDocuments
        .map((doc, index) => `Documento ${index + 1}:\n${doc.content}`)
        .join('\n\n');

      const systemPrompt = `Eres un asistente clínico especializado en fisioterapia. 
Tu tarea es responder preguntas basándote únicamente en el contexto proporcionado.
Si la información no está en el contexto, indica que no tienes suficiente información.

Contexto disponible:
${contextText}

Instrucciones:
1. Responde de manera clara y profesional
2. Cita específicamente el documento relevante cuando sea apropiado
3. Si no encuentras información relevante en el contexto, indícalo claramente
4. Mantén un tono clínico apropiado
5. No inventes información que no esté en el contexto`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: query }
      ];

      const result = await this.generateChatCompletion(messages, options);

      return {
        response: result.content,
        usage: result.usage,
      };
    } catch (error) {
      console.error('Error generando respuesta clínica:', error);
      throw error;
    }
  }

  /**
   * Trunca el texto a un número máximo de palabras
   */
  private truncateText(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }
    return words.slice(0, maxWords).join(' ');
  }

  /**
   * Verifica la conectividad con Azure OpenAI
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Intentar generar un embedding simple
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      console.error('Error en health check de Azure OpenAI:', error);
      return false;
    }
  }

  /**
   * Obtiene información sobre los deployments disponibles
   */
  async getDeploymentInfo(): Promise<{
    chatDeployment: string;
    embeddingDeployment: string;
    endpoint: string;
  }> {
    return {
      chatDeployment: this.chatDeployment,
      embeddingDeployment: this.embeddingDeployment,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'No configurado',
    };
  }
}

// Instancia singleton del servicio
export const azureOpenAIService = new AzureOpenAIService();

export default azureOpenAIService; 