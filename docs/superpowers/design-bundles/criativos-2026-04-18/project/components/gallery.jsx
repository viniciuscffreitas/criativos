// Gallery view — grid of all generated creatives, filterable

function Gallery({ onOpenCreative }) {
  const [filter, setFilter] = React.useState('all');
  const [traceFor, setTraceFor] = React.useState(null);
  const filtered = filter === 'all'
    ? SAMPLE_CREATIVES
    : SAMPLE_CREATIVES.filter(c => c.kind === filter);

  const tabs = [
    { id: 'all', label: 'Todos', count: SAMPLE_CREATIVES.length },
    { id: 'image', label: 'Imagens', count: creativesByKind('image').length },
    { id: 'video', label: 'Vídeos', count: creativesByKind('video').length },
    { id: 'carousel', label: 'Carrosséis', count: creativesByKind('carousel').length },
    { id: 'copy', label: 'Copy', count: creativesByKind('copy').length },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafaf9' }}>
      {/* Toolbar */}
      <div style={{
        height: 56, flexShrink: 0, background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1c1917', letterSpacing: -0.1, flexShrink: 0 }}>
          Galeria
        </h1>
        <span style={{
          fontFamily: '"Geist Mono", monospace', fontSize: 10,
          padding: '2px 6px', borderRadius: 4,
          background: '#f5f5f4', color: '#78716c',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>{SAMPLE_CREATIVES.length} criativos</span>
        <div style={{ flex: 1 }}/>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 6,
          background: '#fafaf9', border: '1px solid #e7e5e4',
          width: 220, fontSize: 12, color: '#6f6a64',
        }}>
          <IconSearch size={13}/>
          <span>Buscar…</span>
          <div style={{ flex: 1 }}/>
          <span style={{
            fontFamily: '"Geist Mono", monospace', fontSize: 10,
            padding: '1px 5px', borderRadius: 4,
            background: '#fff', border: '1px solid #e7e5e4',
          }}>⌘K</span>
        </div>
        <button style={btnPrimary}><IconPlus size={13}/> Novo criativo</button>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: '12px 20px 0', background: '#fff',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex', gap: 4,
      }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setFilter(t.id)} style={{
            padding: '8px 12px', fontSize: 12, cursor: 'pointer',
            color: filter === t.id ? '#1c1917' : '#78716c',
            fontWeight: filter === t.id ? 500 : 400,
            borderBottom: filter === t.id ? '2px solid oklch(0.65 0.18 25)' : '2px solid transparent',
            marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            <span style={{
              fontSize: 10, color: '#6f6a64',
              fontFamily: '"Geist Mono", monospace',
            }}>{t.count}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflow: 'auto', padding: 20, minHeight: 0,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gridAutoRows: 'max-content',
          gap: 16,
        }}>
        {filtered.map((c, i) => (
          <GalleryCard key={c.id} creative={c} idx={i}
            onOpen={() => onOpenCreative(c)}
            onShowTrace={() => setTraceFor(c)}/>
        ))}
        </div>
      </div>

      {traceFor && <GenerationTraceModal creative={traceFor} onClose={() => setTraceFor(null)}/>}
    </div>
  );
}

function GalleryCard({ creative, idx, onOpen, onShowTrace }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onOpen}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff', borderRadius: 10,
        border: '1px solid #e7e5e4',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: hover ? '0 8px 20px rgba(28,25,23,0.08)' : '0 1px 2px rgba(28,25,23,0.02)',
        transform: hover ? 'translateY(-2px)' : 'none',
        animation: `fadeInUp 0.3s ease-out ${idx * 0.03}s backwards`,
      }}>
      <div style={{
        aspectRatio: creative.kind === 'video' ? '9/16' : '1',
        maxHeight: creative.kind === 'video' ? 240 : 'auto',
        background: creative.bg, position: 'relative',
        overflow: 'hidden',
        display: 'flex', alignItems: 'flex-end', padding: 14,
      }}>
        {creative.kind === 'video' && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}><IconPlay size={14}/></div>
        )}
        {creative.kind === 'copy' ? (
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#1c1917',
            letterSpacing: -0.3, lineHeight: 1.2,
          }}>{creative.headline}</div>
        ) : (
          <div style={{
            fontSize: 15, fontWeight: 700, color: '#fff',
            letterSpacing: -0.3, lineHeight: 1.1,
            textShadow: '0 1px 6px rgba(0,0,0,0.3)',
          }}>{creative.hero || creative.headline}</div>
        )}

        {creative.status === 'streaming' && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)',
              animation: 'shimmer 1.5s infinite',
            }}/>
            <div style={{
              position: 'absolute', top: 10, right: 10,
              padding: '3px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.95)', color: 'oklch(0.5 0.18 25)',
              fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: '"Geist Mono", monospace',
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%',
                background: 'oklch(0.65 0.18 25)',
                animation: 'pulse 1.2s ease-in-out infinite' }}/>
              gerando
            </div>
          </>
        )}

        {/* Kind badge */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          padding: '3px 7px', borderRadius: 4,
          background: 'rgba(28,25,23,0.7)', backdropFilter: 'blur(8px)',
          color: '#fff', fontSize: 10, fontWeight: 500,
          fontFamily: '"Geist Mono", monospace',
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{creative.kind}</div>

        {/* Hover action: ver como foi gerado */}
        {hover && onShowTrace && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowTrace(); }}
            style={{
              position: 'absolute', bottom: 10, right: 10,
              padding: '5px 9px', borderRadius: 6,
              background: 'rgba(28,25,23,0.85)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 10, fontWeight: 500,
              fontFamily: '"Geist Mono", monospace',
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              animation: 'fadeIn 0.12s ease-out',
            }}
            title="Ver como foi gerado"
          >
            <IconCanvas size={11}/>
            ver trace
          </button>
        )}
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: '#1c1917',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{creative.title}</div>
        <div style={{
          fontSize: 10, color: '#6f6a64', marginTop: 2,
          fontFamily: '"Geist Mono", monospace',
        }}>{creative.id} · {creative.format}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Gallery, GalleryCard });
