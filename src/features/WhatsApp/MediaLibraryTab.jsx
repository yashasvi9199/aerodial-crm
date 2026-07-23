import { FileText, Upload, Trash, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function MediaLibraryTab({ mediaFiles, isConnected, uploadMedia, deleteMedia, uploadProgress }) {
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMedia(file)
    }
  }

  // Filter media files
  const images = mediaFiles.filter(file => {
    const ext = file.filename.split('.').pop().toLowerCase()
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
  })

  const pdfs = mediaFiles.filter(file => {
    const ext = file.filename.split('.').pop().toLowerCase()
    return ext === 'pdf'
  })

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Upload Header Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: 'var(--text)' }}>WhatsApp Media Library</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Upload files to the local device cache. Slices files into 1MB chunks to bypass size limits.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={async () => {
              try {
                const command = JSON.stringify({ action: 'sync_media' })
                await supabase.from('system_state').update({ command }).eq('id', 1)
                alert('Media refresh command queued! Reloading cache list...')
              } catch (e) {
                alert('Sync trigger failed: ' + e.message)
              }
            }}
            disabled={!isConnected}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              opacity: isConnected ? 1 : 0.6
            }}
          >
            🔄 Refresh Cache
          </button>
          <label style={{
            background: isConnected ? 'var(--accent)' : 'var(--border)',
            color: '#000000',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isConnected ? 1 : 0.6
          }}>
            <Upload size={14} /> Upload File (Images / PDF)
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
              onChange={handleFileChange}
              disabled={!isConnected}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Progress Indicator */}
      {uploadProgress && (
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: 'var(--text)', fontWeight: '600' }}>
              {uploadProgress.status === 'reading' && '📖 Reading file...'}
              {uploadProgress.status === 'uploading' && '☁️ Uploading chunks...'}
              {uploadProgress.status === 'dispatching' && '📲 Assembling and pushing...'}
              {uploadProgress.status === 'done' && '✅ Upload complete!'}
              {uploadProgress.status === 'error' && '❌ Upload failed'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{uploadProgress.percent}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${uploadProgress.percent}%`,
              height: '100%',
              background: uploadProgress.status === 'error' ? '#ef4444' : uploadProgress.status === 'done' ? '#22c55e' : 'var(--accent)',
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Media Content sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Images section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <ImageIcon size={16} style={{ color: 'var(--accent)' }} /> Image Files ({images.length})
          </h4>
          {images.length === 0 ? (
            <div style={{ padding: '30px 10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
              No images uploaded yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {images.map((file, idx) => (
                <div key={idx} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                  <button
                    onClick={() => deleteMedia(file.filename)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.85)', color: '#fff', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}
                    title="Delete"
                  >
                    <Trash size={11} />
                  </button>
                  <div style={{ width: '100%', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', borderRadius: '4px', marginBottom: '6px', overflow: 'hidden' }}>
                    {file.thumbnail ? (
                      <img src={file.thumbnail} alt={file.filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <span style={{ width: '100%', fontSize: '11px', fontWeight: '600', color: 'var(--text)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.filename}>
                    {file.filename}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PDF Documents section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            <FileText size={16} style={{ color: 'var(--accent)' }} /> PDF Documents ({pdfs.length})
          </h4>
          {pdfs.length === 0 ? (
            <div style={{ padding: '30px 10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
              No PDF documents uploaded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {pdfs.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justify: 'space-between', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', flexShrink: 0 }}>
                      <FileText size={18} style={{ color: '#ef4444' }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.filename}>
                      {file.filename}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteMedia(file.filename)}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
