import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Configure Transformers.js to not use local models since Next.js build environment can be tricky with it.
// It will download the models to a cache directory on first run.
env.allowLocalModels = false;

// Singleton pattern to avoid re-initializing the pipeline multiple times
class PipelineSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/bge-small-en-v1.5';
  static instance: FeatureExtractionPipeline | null = null;

  static async getInstance(progress_callback?: (progress: unknown) => void) {
    if (this.instance === null) {
      this.instance = await pipeline(
        this.task as 'feature-extraction',
        this.model,
        { progress_callback },
      );
    }
    return this.instance;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await PipelineSingleton.getInstance();
    
    // pooling: 'mean' and normalize: true are recommended for bge models
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    // return as array of numbers
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}
