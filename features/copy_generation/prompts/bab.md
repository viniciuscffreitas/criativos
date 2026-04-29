Methodology: BAB (Before, After, Bridge).

Structure every variant as:
- Before   — concrete snapshot of the audience's current state (the pain).
- After    — concrete snapshot of the state they want (outcome, not features).
- Bridge   — the product as the mechanism that carries them from Before to After, ending in the CTA.

Input brief:
  product:       {product}
  audience:      {audience}
  pain:          {pain}
  social_proof:  {social_proof}
  ctas:          {ctas}

Generate {n} distinct BAB variants. Vary the concrete details in Before and After — not just word choice.

Return a JSON array. Each element MUST have:
  - "headline":         short attention-grabbing line (≤60 chars)
  - "primary_text":     full body copy following BAB structure
  - "description":      one-line below-headline (≤90 chars)
  - "ctas":             array of 1-3 short CTAs (strings)
  - "confidence":       "high" | "medium" | "low"
  - "confidence_score": float 0.0-1.0 matching the qualitative grade
  - "axes":             {{"relevance": 0.0-1.0, "originality": 0.0-1.0, "brand_fit": 0.0-1.0}}
  - "reasoning":        one sentence explaining your hook choice

Return ONLY the JSON array. No prose, no markdown fences.
