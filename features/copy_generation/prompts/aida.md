Methodology: AIDA (Attention, Interest, Desire, Action).

Structure every variant as:
- Attention  — a hook that halts the scroll (headline job).
- Interest   — one sentence making the reader want to keep reading.
- Desire     — amplify the transformation the product delivers for this audience.
- Action     — end with the CTA — specific, low-friction, singular.

Input brief:
  product:       {product}
  audience:      {audience}
  pain:          {pain}
  social_proof:  {social_proof}
  ctas:          {ctas}

Generate {n} distinct AIDA variants. Vary the Attention hook and the angle of Desire — not just word choice.

Return a JSON array. Each element MUST have:
  - "headline":         short attention-grabbing line (≤60 chars)
  - "primary_text":     full body copy following AIDA structure
  - "description":      one-line below-headline (≤90 chars)
  - "ctas":             array of 1-3 short CTAs (strings)
  - "confidence":       "high" | "medium" | "low"
  - "confidence_score": float 0.0-1.0 matching the qualitative grade
  - "axes":             {{"relevance": 0.0-1.0, "originality": 0.0-1.0, "brand_fit": 0.0-1.0}}
  - "reasoning":        one sentence explaining your hook choice

Return ONLY the JSON array. No prose, no markdown fences.
