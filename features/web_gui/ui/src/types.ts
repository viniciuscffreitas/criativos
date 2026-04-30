export interface Project {
  slug: string;
  name: string;
  description: string;
  ad_count: number;
  variant_count: number;
  created_at: string;
}

export interface Brief {
  product: string;
  audience: string;
  pain: string;
  ctas: string[];
  social_proof: string | null;
}

export interface VariantAxes {
  relevance: number;
  originality: number;
  brand_fit: number;
}

export interface CopyVariant {
  id: string;
  headline: string;
  primary_text: string;
  description: string;
  ctas: string[];
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  axes: VariantAxes;
  reasoning: string;
  selected: boolean;
  confidence_symbol: string;
}

export interface Creative {
  id: string;
  kind: 'image' | 'video' | 'carousel' | 'copy';
  title: string;
  placement: string;
  format: string;
  headline: string;
  body: string;
  hero: string;
  ctas: string[];
  thumbnail_url: string;
  status: 'ready' | 'streaming' | 'failed';
  ad_id: string;
  variant_id: string | null;
  last_run_id: string | null;
}

export interface AgentResult {
  run_id: string;
  variants: CopyVariant[];
  trace: string;
  trace_structured: TraceNode[];
  methodology: string;
  model: string;
  pipeline_version: string;
  seed: number | null;
  created_at: string;
}

export interface TraceNode {
  id: string;
  label: string;
  start_ms: number;
  end_ms: number;
  tokens: number;
  confidence: number | null;
  output_preview: string;
}

export interface GenerateRequest {
  project_slug: string;
  ad_id: string;
  methodology: string;
  n_variants: number;
  brief_overrides?: Partial<Brief>;
  persist: boolean;
}

// One asset the pipeline can produce. The Studio view paints these as cards
// either as a thumbnail (when exists=true) or as a "pendente" placeholder.
export interface RenderManifestItem {
  category: string;
  relative_path: string;
  url: string;
  width: number;
  height: number;
  exists: boolean;
}

export interface RenderManifest {
  categories: Record<string, RenderManifestItem[]>;
}

export interface RenderResultItem {
  category: string;
  relative_path: string;
  status: 'ok' | 'missing' | 'error';
  bytes: number;
  error: string | null;
}

export interface RenderReport {
  category: 'brand-pack' | 'meta-ads' | 'instagram' | 'all';
  started_at: string;
  finished_at: string;
  duration_ms: number;
  ok_count: number;
  total: number;
  results: RenderResultItem[];
}
