// Brand library view — palette, typography specimen, and asset grid.
// Colors derived from src/tokens.ts (mirrors brand/tokens.css).
import { tokens } from '../tokens';
import { IconUpload } from './icons';

export function BrandLibrary() {
  const colors = [
    { name: 'Accent', hex: tokens.accent, role: 'Destaque verde' },
    { name: 'Background', hex: tokens.bg, role: 'Fundo escuro' },
    { name: 'Text', hex: tokens.text, role: 'Texto principal' },
    { name: 'Text Muted', hex: tokens.textMuted, role: 'Texto secundário' },
    { name: 'Border', hex: tokens.border, role: 'Bordas e divisores' },
  ];

  const fonts = [
    { name: 'Geist', role: 'UI e títulos', preview: 'Aa', stack: tokens.fontUI },
    { name: 'Geist Mono', role: 'Técnicos · IDs', preview: 'M0', stack: tokens.fontMono },
    { name: 'Fraunces', role: 'Headlines emocionais', preview: 'Hh', stack: tokens.fontDisplay },
  ];

  const assets = [
    { kind: 'logo', label: 'Logo horizontal', color: '#1c1917' },
    { kind: 'logo', label: 'Logo marca', color: 'var(--accent)' },
    { kind: 'product', label: 'X3 Coral', color: 'linear-gradient(135deg, var(--accent), oklch(0.5 0.18 25))' },
    { kind: 'product', label: 'X3 Preto', color: 'linear-gradient(135deg, #1c1917, #44403c)' },
    { kind: 'product', label: 'X3 Areia', color: 'linear-gradient(135deg, #fed7aa, #fb923c)' },
    { kind: 'lifestyle', label: 'Urbano · pôr do sol', color: 'linear-gradient(135deg, #fbbf24, #dc2626, #1c1917)' },
    { kind: 'lifestyle', label: 'Asfalto · noite', color: 'linear-gradient(135deg, #292524, #44403c, #78716c)' },
    { kind: 'lifestyle', label: 'Parque · manhã', color: 'linear-gradient(135deg, #bbf7d0, #fef3c7)' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafaf9', overflow: 'auto' }}>
      <div style={{
        height: 56, flexShrink: 0, background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1 }}>
          Marca
        </h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
        }}>Vibe Web</span>
        <div style={{ flex: 1 }}/>
        <button style={btnSecondary}><IconUpload size={13}/> Subir ativo</button>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Colors */}
        <div>
          <SectionLabel>Paleta</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {colors.map(c => (
              <div key={c.name} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{ height: 80, background: c.hex }}/>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#6f6a64', marginTop: 1,
                    fontFamily: '"Geist Mono", monospace' }}>{c.hex}</div>
                  <div style={{ fontSize: 11, color: '#78716c', marginTop: 4 }}>{c.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fonts */}
        <div>
          <SectionLabel>Tipografia</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {fonts.map(f => (
              <div key={f.name} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, padding: 16,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  fontSize: 40, fontWeight: 600, letterSpacing: -1,
                  color: '#1c1917', lineHeight: 1,
                  fontFamily: f.stack,
                }}>{f.preview}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: '#78716c', marginTop: 2 }}>{f.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assets */}
        <div>
          <SectionLabel>
            Ativos <span style={{ color: '#6f6a64', fontWeight: 400 }}>({assets.length})</span>
          </SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {assets.map((a, i) => (
              <div key={i} style={{
                background: '#fff', border: '1px solid #e7e5e4',
                borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  aspectRatio: '1', background: a.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {a.kind === 'logo' && (
                    <div style={{
                      color: a.color === '#1c1917' ? '#fafaf9' : '#fff',
                      fontWeight: 700, fontSize: 18, letterSpacing: -0.5,
                    }}>VIBE WEB</div>
                  )}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#1c1917' }}>{a.label}</div>
                  <div style={{ fontSize: 10, color: '#6f6a64',
                    fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>{a.kind}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
      color: '#78716c', fontWeight: 500, marginBottom: 12,
    }}>{children}</div>
  );
}

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 10px', borderRadius: 6,
  background: '#fff', color: '#44403c', border: '1px solid #e7e5e4',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
