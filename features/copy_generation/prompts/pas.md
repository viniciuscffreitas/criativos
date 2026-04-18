Methodology: PAS (Problem, Agitate, Solution).

Structure every variant as:
- Problem   — one sentence naming the audience's current pain.
- Agitate   — one or two sentences amplifying the cost of inaction.
- Solution  — the offer as resolution, ending with the CTA.

Input brief:
  product:       {product}
  audience:      {audience}
  pain:          {pain}
  social_proof:  {social_proof}
  ctas:          {ctas}

Generate {n} distinct PAS variants. Vary the hook and the angle — not just word choice.

Return a JSON array. Each element MUST have:
  - "headline":         short attention-grabbing line (≤60 chars)
  - "primary_text":     full body copy following PAS structure
  - "description":      one-line below-headline (≤90 chars)
  - "ctas":             array of 1-3 short CTAs (strings)
  - "confidence":       "high" | "medium" | "low"
  - "confidence_score": float 0.0-1.0 matching the qualitative grade
  - "axes":             {{"relevance": 0.0-1.0, "originality": 0.0-1.0, "brand_fit": 0.0-1.0}}
  - "reasoning":        one sentence explaining your hook choice

Return ONLY the JSON array. No prose, no markdown fences.
