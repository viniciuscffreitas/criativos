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
