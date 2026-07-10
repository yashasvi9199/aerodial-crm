import React from 'react';

/**
 * JSDoc: Renders the enhanced test call popup.
 * Prompt the user to verify if the 197 test call was successful.
 * If not, triggers the next failsafe dialer method.
 */
export default function TestCallPopup({ isOpen, onClose, onSuccess, onFail }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '15px'
        }}>
          📞
        </div>
        <h3 style={{
          margin: '0 0 10px 0',
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--text)'
        }}>
          Test Call Triggered (197)
        </h3>
        <p style={{
          margin: '0 0 25px 0',
          color: 'var(--text-muted)',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          Please inspect your connected Android phone. Was the test call successful?
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button
            onClick={onSuccess}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#10b981',
              color: '#000000',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease'
            }}
          >
            Yes, Successful
          </button>
          <button
            onClick={onFail}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
          >
            No, Try Next Method
          </button>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Cancel Test
        </button>
      </div>
    </div>
  );
}
