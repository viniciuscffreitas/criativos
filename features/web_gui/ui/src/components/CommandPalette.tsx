// Command palette — ⌘K overlay with search, keyboard nav, wired/unwired commands.
// Inputs: open flag + close/nav callbacks. Outputs: runs command then closes.
import { useEffect, useRef, useState } from 'react';
import type { NavSection } from './Sidebar';

interface Command {
  id: string;
  label: string;
  hint: string;
  wired: boolean;
  onRun: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNav: (section: NavSection) => void;
  onOpenTweaks: () => void;
  onOpenTrace: (() => void) | null;
}

export function CommandPalette({ open, onClose, onNav, onOpenTweaks, onOpenTrace }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'nav-flow',    label: 'Ir para Novo fluxo',        hint: '⌘1', wired: true,  onRun: () => onNav('flow') },
    { id: 'nav-gallery', label: 'Ir para Galeria',           hint: '⌘2', wired: true,  onRun: () => onNav('gallery') },
    { id: 'nav-brand',   label: 'Ir para Marca',             hint: '⌘3', wired: true,  onRun: () => onNav('brand') },
    { id: 'tweaks',      label: 'Abrir ajustes rápidos',     hint: '⌘;', wired: true,  onRun: onOpenTweaks },
    {
      id: 'trace',
      label: 'Ver trace da última geração',
      hint: '⌘L',
      wired: onOpenTrace !== null,
      onRun: onOpenTrace !== null ? onOpenTrace : () => console.info('[CommandPalette] no run yet — trace unavailable'),
    },
    { id: 'ab-test',     label: 'A/B Test de variantes',     hint: '⌘T', wired: false, onRun: () => console.info('[CommandPalette]', 'coming in Spec 2: ab-test') },
    { id: 'export-meta', label: 'Publicar no Meta',          hint: '⌘E', wired: false, onRun: () => console.info('[CommandPalette]', 'coming in Spec 4: export-meta') },
    { id: 'settings',    label: 'Preferências',              hint: '⌘,', wired: false, onRun: () => console.info('[CommandPalette]', 'coming in Spec 2: settings') },
  ];

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  // Clamp selected index when list shrinks
  const clampedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Defer focus until after render so the input is in the DOM
      requestAnimationFrame(() => { inputRef.current?.focus(); });
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape')    { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[clampedIndex];
        if (cmd) { cmd.onRun(); onClose(); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, filtered, clampedIndex, onClose]);

  if (!open) return null;

  const runCommand = (cmd: Command) => {
    cmd.onRun();
    onClose();
  };

  return (
    <div
      data-testid="palette-overlay"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 100,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 120,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560, borderRadius: 10,
          background: '#fff',
          border: '1px solid #e7e5e4',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e7e5e4' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar comando…"
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontSize: 14, color: '#1c1917',
              background: 'transparent', fontFamily: 'inherit',
              letterSpacing: -0.1,
            }}
          />
        </div>

        {/* Command list */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', fontSize: 13, color: '#78716c', textAlign: 'center' }}>
              Nenhum comando encontrado
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <CommandRow
                key={cmd.id}
                cmd={cmd}
                active={i === clampedIndex}
                onClick={() => runCommand(cmd)}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #e7e5e4',
          display: 'flex', gap: 12,
          fontSize: 11, color: '#78716c',
          fontFamily: '"Geist Mono", monospace',
        }}>
          <span>↑↓ navegar</span>
          <span>↵ executar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}

// ── Command row ────────────────────────────────────────────────────────────────

interface CommandRowProps {
  cmd: Command;
  active: boolean;
  onClick: () => void;
}

function CommandRow({ cmd, active, onClick }: CommandRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer',
        background: active ? '#fafaf9' : 'transparent',
        opacity: cmd.wired ? 1 : 0.5,
        transition: 'background 80ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#1c1917', letterSpacing: -0.1 }}>{cmd.label}</span>
        {!cmd.wired && (
          <span style={{
            padding: '1px 6px', borderRadius: 4,
            background: '#f5f5f4', border: '1px solid #e7e5e4',
            fontSize: 10, color: '#78716c', fontWeight: 500,
          }}>em breve</span>
        )}
      </div>
      <span style={{
        fontSize: 11, color: '#78716c',
        fontFamily: '"Geist Mono", monospace',
        padding: '2px 6px', borderRadius: 4,
        background: '#f5f5f4', border: '1px solid #e7e5e4',
      }}>{cmd.hint}</span>
    </div>
  );
}
