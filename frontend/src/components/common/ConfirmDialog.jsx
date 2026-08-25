/**
 * SS SWAP - Diálogo de Confirmación Reutilizable (ConfirmDialog)
 * Proveedor + hook useConfirm que reemplazan window.confirm nativo
 * por un modal premium consistente en toda la aplicación.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

/**
 * Provee un dialogo de confirmacion premium (reemplaza window.confirm nativo).
 * Uso: const confirm = useConfirm(); const ok = await confirm('Eliminar X?');
 * Tambien acepta un objeto: confirm({ title, message, confirmLabel, danger })
 */
export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null); // { title, message, confirmLabel, cancelLabel, danger }
    const resolver = useRef(null);

    const confirm = useCallback((opts) => {
        const normalized = typeof opts === 'string' ? { message: opts } : (opts || {});
        setState({
            title: normalized.title || 'Confirmar accion',
            message: normalized.message || 'Estas seguro de continuar?',
            confirmLabel: normalized.confirmLabel || 'Eliminar',
            cancelLabel: normalized.cancelLabel || 'Cancelar',
            danger: normalized.danger !== false,
        });
        return new Promise((resolve) => { resolver.current = resolve; });
    }, []);

    const handle = (result) => {
        setState(null);
        if (resolver.current) { resolver.current(result); resolver.current = null; }
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && (
                <div className="modal-backdrop" onClick={() => handle(false)}>
                    <div
                        className="modal-box"
                        style={{ maxWidth: 400, textAlign: 'center', padding: '34px 30px 26px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            width: 54, height: 54, borderRadius: 16, margin: '0 auto 18px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: state.danger ? 'rgba(209,41,61,0.1)' : 'rgba(43,92,133,0.1)',
                            border: `1px solid ${state.danger ? 'rgba(209,41,61,0.3)' : 'rgba(43,92,133,0.3)'}`,
                            color: state.danger ? '#d1293d' : '#2b5c85',
                        }}>
                            {state.danger ? <IconAlertTriangle /> : <IconHelp />}
                        </div>
                        <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: 8 }}>
                            {state.title}
                        </h3>
                        <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: '.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 26 }}>
                            {state.message}
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button className="btn-ghost" onClick={() => handle(false)} style={{ flex: 1 }}>
                                {state.cancelLabel}
                            </button>
                            <button
                                className={state.danger ? 'btn-danger' : 'btn-primary'}
                                onClick={() => handle(true)}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                <span>{state.confirmLabel}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
    return ctx;
}

function IconAlertTriangle() {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IconHelp() {
    return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
