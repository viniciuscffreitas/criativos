// Conversational input — single textarea + Send. Submits a free-form
// prompt that the studio_agent translates into a StudioPlan.
//
// Auto-grows up to ~6 lines. Cmd+Enter / Ctrl+Enter submits. Plain Enter
// inserts a newline (so users can compose multi-line briefs). Disabled
// while a stream is running so we don't spawn parallel runs.
import { useRef, useState } from 'react';

interface ConversationalPromptProps {
  onSubmit: (prompt: string) => void;
  busy: boolean;
}

export function ConversationalPrompt({ onSubmit, busy }: ConversationalPromptProps) {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function trySubmit() {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  }

  const canSubmit = !busy && value.trim().length > 0;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e7e5e4',
      borderRadius: 12,
      padding: 14,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end',
      boxShadow: '0 1px 2px rgba(28,25,23,0.03)',
    }}>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          // Auto-grow up to 6 lines (~144px @ 24px line-height)
          const ta = taRef.current;
          if (ta) {
            ta.style.height = 'auto';
            ta.style.height = `${Math.min(ta.scrollHeight, 144)}px`;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            trySubmit();
          }
        }}
        placeholder="Pedir pra Claude — descreva em linguagem natural o que você precisa…"
        rows={1}
        disabled={busy}
        style={{
          flex: 1, resize: 'none',
          fontFamily: 'inherit', fontSize: 14, color: '#1c1917',
          border: 'none', outline: 'none',
          background: 'transparent',
          minHeight: 22, maxHeight: 144,
          lineHeight: 1.5,
          padding: '4px 0',
        }}
      />
      <button
        type="button"
        onClick={trySubmit}
        disabled={!canSubmit}
        aria-label={busy ? 'Trabalhando' : 'Enviar'}
        style={{
          padding: '7px 14px', borderRadius: 8,
          background: canSubmit ? '#1c1917' : '#e7e5e4',
          color: canSubmit ? '#fafaf9' : '#78716c',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'default',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          flexShrink: 0, whiteSpace: 'nowrap',
          transition: 'background 180ms ease, color 180ms ease',
        }}
      >
        {busy ? 'Trabalhando…' : 'Enviar'}
      </button>
    </div>
  );
}
