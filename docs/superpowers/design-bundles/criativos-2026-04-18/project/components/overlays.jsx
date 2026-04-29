// Command palette (⌘K) + brand library view + tweaks panel

function CommandPalette({ open, onClose, onAction }) {
  const [q, setQ] = React.useState('');
  if (!open) return null;

  const items = [
    { icon: IconZap, label: 'Executar fluxo completo', hint: '⌘↵', action: 'run' },
    { icon: IconSparkle, label: 'Gerar nova imagem', hint: '⌘I', action: 'gen-image' },
    { icon: IconVideo, label: 'Gerar novo vídeo Reels', hint: '⌘V', action: 'gen-video' },
    { icon: IconLayers, label: 'Gerar novo carrossel', hint: '⌘L', action: 'gen-carousel' },
    { icon: IconText, label: 'Gerar variações de copy', hint: '⌘T', action: 'gen-copy' },
    { icon: IconCanvas, label: 'Ir para Canvas', hint: '⌘1', action: 'nav-canvas' },
    { icon: IconGrid, label: 'Ir para Galeria', hint: '⌘2', action: 'nav-gallery' },
    { icon: IconBrand, label: 'Ir para Marca', hint: '⌘3', action: 'nav-brand' },
    { icon: IconUpload, label: 'Publicar no Meta Ads Manager', hint: '⌘P', action: 'publish' },
    { icon: IconDownload, label: 'Exportar criativos selecionados', hint: '⌘E', action: 'export' },
  ];
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(28,25,23,0.2)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 120,
      animation: 'fadeIn 0.15s ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, background: '#fff', borderRadius: 12,
        border: '1px solid #e7e5e4',
        boxShadow: '0 24px 60px rgba(28,25,23,0.25)',
        overflow: 'hidden',
        animation: 'scaleIn 0.15s ease-out',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderBottom: '1px solid #f5f5f4',
        }}>
          <IconSearch size={15} stroke="#a8a29e"/>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar comandos, criativos, projetos…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 14, color: '#1c1917',
              fontFamily: 'inherit', background: 'transparent',
            }}/>
          <span style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 10,
            padding: '2px 6px', borderRadius: 4,
            background: '#f5f5f4', color: '#78716c',
          }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflow: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6f6a64', fontSize: 13 }}>
              Nenhum comando encontrado para "{q}"
            </div>
          ) : filtered.map((it, i) => {
            const I = it.icon;
            return (
              <div key={i} onClick={() => { onAction?.(it.action); onClose(); }} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 10px', borderRadius: 6,
                cursor: 'pointer', fontSize: 13,
                background: i === 0 ? '#f5f5f4' : 'transparent',
              }}>
                <I size={15} stroke="#57534e"/>
                <span style={{ flex: 1, color: '#1c1917' }}>{it.label}</span>
                <span style={{
                  fontFamily: '"Geist Mono", monospace', fontSize: 10,
                  color: '#6f6a64',
                }}>{it.hint}</span>
              </div>
            );
          })}
        </div>
        <div style={{
          padding: '8px 12px', borderTop: '1px solid #f5f5f4',
          fontSize: 10, color: '#6f6a64', display: 'flex', gap: 14,
          fontFamily: '"Geist Mono", monospace',
        }}>
          <span>↑↓ navegar</span><span>↵ selecionar</span><span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}

// ── Brand library view ──────────────────────────────────
function BrandLibrary() {
  const colors = [
    { name: 'Primary', hex: '#1c1917', role: 'Base escura' },
    { name: 'Accent', hex: '#d97757', role: 'Destaque coral' },
    { name: 'Sand', hex: '#fed7aa', role: 'Apoio quente' },
    { name: 'Stone', hex: '#fafaf9', role: 'Fundo claro' },
    { name: 'Ink', hex: '#44403c', role: 'Texto secundário' },
  ];
  const fonts = [
    { name: 'Geist', role: 'UI e títulos', preview: 'Aa' },
    { name: 'Geist Mono', role: 'Técnicos · IDs', preview: 'M0' },
    { name: 'Fraunces', role: 'Headlines emocionais', preview: 'Hh' },
  ];
  const assets = [
    { kind: 'logo', label: 'Logo horizontal', color: '#1c1917' },
    { kind: 'logo', label: 'Logo marca', color: 'oklch(0.65 0.18 25)' },
    { kind: 'product', label: 'X3 Coral', color: 'linear-gradient(135deg, oklch(0.65 0.18 25), oklch(0.5 0.18 25))' },
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
        }}>Tênis Urban Run</span>
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
                  fontFamily: f.name === 'Geist Mono' ? '"Geist Mono", monospace'
                    : f.name === 'Fraunces' ? 'Fraunces, serif'
                    : '"Geist", sans-serif',
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
          <SectionLabel>Ativos <span style={{ color: '#6f6a64', fontWeight: 400 }}>({assets.length})</span></SectionLabel>
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
                  {a.kind === 'logo' && <div style={{
                    color: a.color === '#1c1917' ? '#fafaf9' : '#fff',
                    fontWeight: 700, fontSize: 18, letterSpacing: -0.5,
                  }}>URBAN RUN</div>}
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

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
      color: '#78716c', fontWeight: 500, marginBottom: 12,
    }}>{children}</div>
  );
}

// ── Tweaks panel ────────────────────────────────────────
function TweaksPanel({ open, onClose, tweaks, setTweaks }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16, zIndex: 90,
      width: 300, background: '#fff',
      border: '1px solid #e7e5e4', borderRadius: 10,
      boxShadow: '0 16px 40px rgba(28,25,23,0.15)',
      overflow: 'hidden', fontSize: 12,
      animation: 'slideInUp 0.2s ease-out',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #f5f5f4',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1c1917' }}>Tweaks</div>
        <IconClose size={13} stroke="#a8a29e" style={{ cursor: 'pointer' }} onClick={onClose}/>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TweakRow label="Tema">
          <SegBtns value={tweaks.theme} set={v => setTweaks({theme: v})}
            options={[['light','Claro'],['dark','Escuro']]}/>
        </TweakRow>
        <TweakRow label="Cor de destaque">
          <div style={{ display: 'flex', gap: 6 }}>
            {[['coral', 'oklch(0.65 0.18 25)'], ['blue', 'oklch(0.55 0.18 250)'], ['green', 'oklch(0.6 0.15 145)'], ['violet', 'oklch(0.6 0.2 290)']].map(([k, c]) => (
              <div key={k} onClick={() => setTweaks({accent: k})} style={{
                width: 22, height: 22, borderRadius: 5, background: c,
                cursor: 'pointer', position: 'relative',
                outline: tweaks.accent === k ? '2px solid #1c1917' : 'none',
                outlineOffset: 2,
              }}/>
            ))}
          </div>
        </TweakRow>
        <TweakRow label="Streaming do agente">
          <SegBtns value={tweaks.streaming ? 'on' : 'off'}
            set={v => setTweaks({streaming: v === 'on'})}
            options={[['on','Ligado'],['off','Desligado']]}/>
        </TweakRow>
        <TweakRow label="Densidade">
          <SegBtns value={tweaks.density} set={v => setTweaks({density: v})}
            options={[['compact','Compacta'],['relaxed','Relaxada']]}/>
        </TweakRow>
      </div>
    </div>
  );
}

function TweakRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#78716c', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function SegBtns({ value, set, options }) {
  return (
    <div style={{
      display: 'inline-flex', background: '#f5f5f4', borderRadius: 6, padding: 2,
    }}>
      {options.map(([k, l]) => (
        <div key={k} onClick={() => set(k)} style={{
          padding: '5px 10px', borderRadius: 4, fontSize: 11,
          background: value === k ? '#fff' : 'transparent',
          color: value === k ? '#1c1917' : '#78716c',
          boxShadow: value === k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          fontWeight: value === k ? 500 : 400,
          cursor: 'pointer',
        }}>{l}</div>
      ))}
    </div>
  );
}

Object.assign(window, { CommandPalette, BrandLibrary, TweaksPanel });
