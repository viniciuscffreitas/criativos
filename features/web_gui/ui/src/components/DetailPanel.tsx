// Right-side detail panel: shows a selected creative with mobile mockup preview.
// Slides in from the right when a creative is opened from the canvas or gallery.
// Trace button omitted — wired in Task 17 (onOpenTrace not yet available).
import type { Creative } from '../types';
import {
  IconClose, IconImage, IconVideo, IconLayers, IconText,
  IconPlay, IconCopy, IconRefresh, IconUpload, IconHeart, IconChevronRight,
} from './icons';

interface DetailPanelProps {
  creative: Creative;
  onClose: () => void;
}

export function DetailPanel({ creative, onClose }: DetailPanelProps) {
  return (
    <div style={{
      width: 420, flexShrink: 0,
      background: '#ffffff',
      borderLeft: '1px solid #e7e5e4',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.22s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #e7e5e4',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {creative.kind === 'image' && <IconImage size={14}/>}
          {creative.kind === 'video' && <IconVideo size={14}/>}
          {creative.kind === 'carousel' && <IconLayers size={14}/>}
          {creative.kind === 'copy' && <IconText size={14}/>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1917' }}>
            {creative.title}
          </div>
          <div style={{
            fontSize: 10, color: '#6f6a64',
            fontFamily: '"Geist Mono", monospace',
            marginTop: 1,
          }}>{creative.id} · {creative.placement}</div>
        </div>
        <button onClick={onClose} style={{
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', borderRadius: 6,
          color: '#78716c', cursor: 'pointer',
        }}><IconClose size={14}/></button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', padding: '0 16px', gap: 20,
        borderBottom: '1px solid #e7e5e4',
        fontSize: 12,
      }}>
        {['Preview', 'Copy', 'Metadata'].map((t, i) => (
          <div key={t} style={{
            padding: '10px 0 8px', color: i === 0 ? '#1c1917' : '#78716c',
            fontWeight: i === 0 ? 500 : 400,
            borderBottom: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, cursor: 'pointer',
          }}>{t}</div>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 16px' }}>
        {/* Mobile mockup */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: '8px 0 16px',
          background: 'linear-gradient(180deg, #fafaf9 0%, #f5f5f4 100%)',
          borderRadius: 12, marginBottom: 16,
        }}>
          <MiniPhone creative={creative}/>
        </div>

        {/* Ad copy */}
        <DetailSection title="Copy">
          <div style={{ fontSize: 13, color: '#1c1917', lineHeight: 1.5, marginBottom: 8, fontWeight: 500 }}>
            {creative.headline}
          </div>
          <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.55 }}>
            {creative.body}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {creative.ctas.map((c, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 4,
                background: '#f5f5f4', color: '#44403c',
                border: '1px solid #e7e5e4',
              }}>{c}</span>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="Desempenho previsto">
          <PredRow label="CTR estimado" value="2.4%" trend="+18%"/>
          <PredRow label="CPA estimado" value="R$ 12,40" trend="-8%"/>
          <PredRow label="Relevância" value="8.9/10" trend="+12%"/>
        </DetailSection>

        <DetailSection title="Metadata">
          <MetaRow k="Gerado em" v="há 2 min"/>
          <MetaRow k="Modelo" v="gpt-creative v3"/>
          <MetaRow k="Seed" v="78f2a1c"/>
          <MetaRow k="Formato" v={creative.format}/>
        </DetailSection>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid #e7e5e4',
        display: 'flex', gap: 8, background: '#fafaf9',
      }}>
        <button style={btnSecondary}><IconCopy size={13}/> Duplicar</button>
        <button style={btnSecondary}><IconRefresh size={13}/> Regerar</button>
        <div style={{ flex: 1 }}/>
        <button style={btnPrimary}><IconUpload size={13}/> Publicar</button>
      </div>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 10px', borderRadius: 6,
  background: '#fff', color: '#44403c', border: '1px solid #e7e5e4',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 6,
  background: '#1c1917', color: '#fafaf9', border: 'none',
  fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
        color: '#6f6a64', fontWeight: 500, marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function PredRow({ label, value, trend }: { label: string; value: string; trend: string }) {
  const up = trend.startsWith('+');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '6px 0',
      borderBottom: '1px solid #f5f5f4', fontSize: 12,
    }}>
      <span style={{ flex: 1, color: '#57534e' }}>{label}</span>
      <span style={{ color: '#1c1917', fontWeight: 500, marginRight: 10,
        fontFamily: '"Geist Mono", monospace', fontSize: 11 }}>{value}</span>
      <span style={{
        fontSize: 11, color: up ? '#16a34a' : '#dc2626',
        fontFamily: '"Geist Mono", monospace',
      }}>{trend}</span>
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{
      display: 'flex', padding: '4px 0', fontSize: 11,
      fontFamily: '"Geist Mono", monospace',
    }}>
      <span style={{ color: '#6f6a64', width: 90 }}>{k}</span>
      <span style={{ color: '#44403c' }}>{v}</span>
    </div>
  );
}

// ── Mini phone mockup ──────────────────────────────────────
function MiniPhone({ creative }: { creative: Creative }) {
  return (
    <div style={{
      width: 200, height: 400, borderRadius: 28, padding: 6,
      background: '#1c1917',
      boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
      position: 'relative',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 22,
        background: '#fafaf9', overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
          width: 50, height: 14, borderRadius: 8, background: '#1c1917', zIndex: 10,
        }}/>
        {/* Status bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '6px 14px', fontSize: 10,
          fontWeight: 600, color: '#1c1917',
        }}>
          <span>9:41</span>
          <span>•••</span>
        </div>

        {/* Content by kind */}
        {creative.kind === 'image' && <FeedImagePreview creative={creative}/>}
        {creative.kind === 'video' && <ReelsPreview creative={creative}/>}
        {creative.kind === 'carousel' && <CarouselPreview creative={creative}/>}
        {creative.kind === 'copy' && <CopyPreview creative={creative}/>}
      </div>
    </div>
  );
}

function FeedImagePreview({ creative }: { creative: Creative }) {
  return (
    <div style={{ flex: 1, padding: '6px 8px', fontSize: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #fed7aa, #fb923c)' }}/>
        <div>
          <div style={{ fontWeight: 600, color: '#1c1917' }}>vibeweb.oficial</div>
          <div style={{ color: '#6f6a64', fontSize: 10 }}>Patrocinado</div>
        </div>
      </div>
      <div style={{
        aspectRatio: '1',
        background: '#e7e5e4',
        borderRadius: 6, overflow: 'hidden', position: 'relative',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: 10,
      }}>
        {creative.thumbnail_url && (
          <img
            src={creative.thumbnail_url}
            alt={creative.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{
          position: 'relative', zIndex: 1,
          fontSize: 11, fontWeight: 700, color: '#fff',
          letterSpacing: -0.3, lineHeight: 1.1,
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}>{creative.hero}</div>
      </div>
      <div style={{
        marginTop: 6, padding: '6px 8px', background: '#f5f5f4',
        borderRadius: 4, fontSize: 10,
      }}>
        <div style={{ color: '#1c1917', fontWeight: 500 }}>{creative.headline}</div>
        <div style={{
          marginTop: 4, padding: '4px 8px',
          background: '#1c1917', color: '#fff',
          borderRadius: 4, textAlign: 'center', fontWeight: 600,
        }}>{creative.ctas[0]}</div>
      </div>
    </div>
  );
}

function ReelsPreview({ creative }: { creative: Creative }) {
  return (
    <div style={{
      flex: 1, background: '#1c1917', position: 'relative',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: 10, overflow: 'hidden',
    }}>
      {creative.thumbnail_url && (
        <img
          src={creative.thumbnail_url}
          alt={creative.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* Play badge */}
      <div style={{
        position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', zIndex: 2,
      }}><IconPlay size={16}/></div>

      {/* Bottom overlay */}
      <div style={{ color: '#fff', fontSize: 10, position: 'relative', zIndex: 2 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>@vibeweb.oficial</div>
        <div style={{ fontSize: 10, opacity: 0.9, marginBottom: 6 }}>
          {creative.body.slice(0, 60)}…
        </div>
        <div style={{
          padding: '5px 10px', background: 'rgba(255,255,255,0.95)',
          color: '#1c1917', borderRadius: 4, fontWeight: 600,
          display: 'inline-block', fontSize: 10,
        }}>{creative.ctas[0]}</div>
      </div>

      {/* Right actions */}
      <div style={{
        position: 'absolute', right: 6, bottom: 40, zIndex: 2,
        display: 'flex', flexDirection: 'column', gap: 10,
        color: '#fff', fontSize: 10, alignItems: 'center',
      }}>
        <IconHeart size={14}/>
        <IconChevronRight size={14}/>
      </div>
    </div>
  );
}

function CarouselPreview({ creative }: { creative: Creative }) {
  return (
    <div style={{ flex: 1, padding: '6px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #fed7aa, #fb923c)' }}/>
        <div style={{ fontWeight: 600, color: '#1c1917' }}>vibeweb.oficial</div>
      </div>
      <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            flex: i === 0 ? '0 0 70%' : '0 0 35%',
            aspectRatio: '1',
            background: [
              '#e7e5e4',
              'linear-gradient(135deg, #1c1917, #44403c)',
              'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            ][i],
            borderRadius: 4, padding: 6,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            color: '#fff', fontSize: 10, fontWeight: 600,
            position: 'relative', overflow: 'hidden',
          }}>
            {i === 0 && creative.thumbnail_url && (
              <img
                src={creative.thumbnail_url}
                alt={creative.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>
              {i === 0 ? creative.hero : `0${i + 1}`}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 6, display: 'flex', gap: 2, justifyContent: 'center',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: i === 0 ? 10 : 3, height: 3, borderRadius: 2,
            background: i === 0 ? '#1c1917' : '#d6d3d1',
          }}/>
        ))}
      </div>
    </div>
  );
}

function CopyPreview({ creative }: { creative: Creative }) {
  return (
    <div style={{ flex: 1, padding: '10px 10px', fontSize: 10 }}>
      <div style={{ color: '#6f6a64', fontSize: 10, marginBottom: 6 }}>HEADLINE</div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#1c1917', lineHeight: 1.2,
        marginBottom: 12, letterSpacing: -0.3,
      }}>{creative.headline}</div>
      <div style={{ color: '#6f6a64', fontSize: 10, marginBottom: 6 }}>DESCRIÇÃO</div>
      <div style={{ color: '#44403c', fontSize: 10, lineHeight: 1.5, marginBottom: 12 }}>
        {creative.body}
      </div>
      <div style={{ color: '#6f6a64', fontSize: 10, marginBottom: 6 }}>CTAs</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {creative.ctas.map((c, i) => (
          <div key={i} style={{
            fontSize: 10, padding: '2px 5px', borderRadius: 4,
            border: '1px solid #e7e5e4', background: '#fff', color: '#44403c',
          }}>{c}</div>
        ))}
      </div>
    </div>
  );
}
