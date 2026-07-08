import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className="modal-container glass-panel">
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-content">
                    {children}
                </div>
            </div>

            <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--bg-overlay);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }

        .modal-container {
          width: 100%;
          max-width: 540px;
          background: var(--bg-card);
          color: var(--text-main);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: var(--shadow-xl);
          overflow: hidden;
        }

        .modal-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-card);
        }

        .modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: -0.01em;
        }

        .close-btn {
          color: var(--text-muted);
          padding: 0.4rem;
          border-radius: 50%;
          transition: all var(--transition-base);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: var(--bg-subtle);
          color: var(--text-main);
          transform: rotate(90deg);
        }

        .modal-content {
          padding: 1.5rem;
          overflow-y: auto;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Form Helpers inside Modal */
        .form-group {
            margin-bottom: 1rem;
        }
        .form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--text-main);
        }
        .form-input {
            width: 100%;
            padding: 0.7rem 0.85rem;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            font-size: 0.95rem;
            background: var(--bg-elevated);
            color: var(--text-main);
            transition: all var(--transition-base);
            font-family: inherit;
        }
        .form-input:hover {
            border-color: var(--border-strong);
        }
        .form-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: var(--shadow-focus);
        }

        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
            margin-top: 1.5rem;
        }

        .btn-cancel {
            padding: 0.7rem 1.1rem;
            border-radius: var(--radius-md);
            color: var(--text-muted);
            font-weight: 600;
            background: var(--bg-subtle);
            border: 1px solid var(--border);
            transition: all var(--transition-base);
        }
        .btn-cancel:hover {
            background: var(--bg-card);
            color: var(--text-main);
        }
        .btn-submit {
             padding: 0.7rem 1.4rem;
             border-radius: var(--radius-md);
             background: var(--gradient-primary);
             color: var(--primary-text);
             font-weight: 700;
             box-shadow: var(--shadow-sm);
             transition: all var(--transition-base);
             letter-spacing: -0.01em;
        }
        .btn-submit:hover {
             transform: translateY(-1px);
             box-shadow: var(--shadow-md);
        }
        .btn-submit:active {
             transform: translateY(0);
        }
        .btn-submit:disabled {
             opacity: 0.55;
             cursor: default;
             transform: none;
             box-shadow: none;
        }

        /* 모바일 — 모달 풀스크린화 (Phase 4d) */
        @media (max-width: 640px) {
            .modal-overlay {
                align-items: stretch;
                padding: 0;
            }
            .modal-container {
                max-width: 100%;
                max-height: 100vh;
                border-radius: 0;
                width: 100%;
            }
            .modal-header {
                padding: 1rem 1.25rem;
                position: sticky;
                top: 0;
                background: white;
                z-index: 10;
            }
            .modal-content {
                padding: 1rem 1.25rem;
            }
            .modal-actions {
                position: sticky;
                bottom: 0;
                background: white;
                padding-top: 0.75rem;
                margin-top: 1rem;
                border-top: 1px solid var(--border);
                margin-left: -1.25rem;
                margin-right: -1.25rem;
                padding-left: 1.25rem;
                padding-right: 1.25rem;
                padding-bottom: 0.75rem;
            }
            .btn-submit, .btn-cancel {
                flex: 1;
                text-align: center;
                justify-content: center;
            }
        }
      `}</style>
        </div>
    );
};

export default Modal;
