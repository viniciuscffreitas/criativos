// User uploads section of the BrandLibrary.
//
// Lists assets persisted under uploads_dir() via /api/v1/projects/{slug}/assets,
// supports multi-select and bulk delete via the DELETE counterpart. Empty-state
// nudges the user toward the existing "Subir ativo" button in the parent header.
import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface UploadedAsset {
  file_id: string;
  filename: string;
  size: number;
  kind: string;
}

interface BrandUploadsSectionProps {
  projectSlug: string;
  /** Bumps when a successful upload happens — triggers refetch. */
  refetchKey: number;
  /** Bumps when an external action (delete) needs us to refetch. */
  externalRefetchKey?: number;
  /** Render slot for the section label so parent can wrap with its own component. */
  renderLabel?: (label: React.ReactNode) => React.ReactNode;
  /** Selection state lives at the BrandLibrary level so it spans uploads + canonical. */
  selected: Set<string>;
  /** Toggle a selectionId (always prefixed "upload:" for items in this section). */
  onToggle: (selectionId: string) => void;
}

export function BrandUploadsSection({
  projectSlug, refetchKey, externalRefetchKey = 0, renderLabel, selected, onToggle,
}: BrandUploadsSectionProps) {
  const [uploads, setUploads] = useState<UploadedAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refetch(): Promise<void> {
    setError(null);
    try {
      const r = await api.listAssets(projectSlug);
      setUploads(r.assets);
    } catch (err) {
      console.error('[BrandUploadsSection] listAssets failed', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refetch(); }, [projectSlug, refetchKey, externalRefetchKey]);

  const labelNode = (
    <>Seus uploads {uploads && (
      <span style={{ color: '#6f6a64', fontWeight: 400 }}>({uploads.length})</span>
    )}</>
  );

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        {renderLabel ? renderLabel(labelNode) : (
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
            color: '#78716c', fontWeight: 500,
          }}>{labelNode}</div>
        )}
      </div>
      {error && (
        <div role="alert" style={{
          padding: '8px 12px', borderRadius: 6,
          background: 'rgba(220,38,38,0.10)', color: '#dc2626',
          fontFamily: '"Geist Mono", monospace', fontSize: 12,
          marginBottom: 10,
        }}>
          erro ao listar uploads: {error}
        </div>
      )}
      {uploads !== null && uploads.length === 0 && (
        <div style={{
          padding: '16px 20px', borderRadius: 8,
          background: '#fff', border: '1px dashed #d6d3d1',
          color: '#78716c', fontSize: 13,
          textAlign: 'center',
        }}>
          Nenhum ativo enviado. Use "Subir ativo" no topo pra adicionar.
        </div>
      )}
      {uploads && uploads.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {uploads.map(u => {
            const selectionId = `upload:${u.file_id}`;
            const isSelected = selected.has(selectionId);
            const previewable = u.kind === 'image' || u.kind === 'logo';
            return (
              <div key={u.file_id} style={{
                background: '#fff',
                border: isSelected ? '2px solid var(--accent)' : '1px solid #e7e5e4',
                borderRadius: 8, overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  aspectRatio: '1', background: '#fafaf9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 16,
                }}>
                  {previewable ? (
                    <img
                      src={`/api/v1/projects/${projectSlug}/assets/${u.file_id}/blob`}
                      alt={u.filename}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{
                      fontSize: 12, color: '#78716c',
                      fontFamily: '"Geist Mono", monospace',
                    }}>{u.kind}</span>
                  )}
                </div>
                <label style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 22, height: 22, borderRadius: 6,
                  background: 'rgba(255,255,255,0.95)',
                  border: '1px solid #d6d3d1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${u.filename}`}
                    checked={isSelected}
                    onChange={() => onToggle(selectionId)}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                </label>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#1c1917',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.filename}
                  </div>
                  <div style={{ fontSize: 10, color: '#6f6a64',
                    fontFamily: '"Geist Mono", monospace', marginTop: 1 }}>
                    {u.kind} · {Math.ceil(u.size / 1024)} KB
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
