/**
 * SS SWAP - Finanzas · Cuentas de dinero
 * Donde esta la plata (caja, bancos...) con su saldo actual.
 */
import React, { useState } from 'react';
import { Badge, ModalCuenta } from './Modales';
import { dinero, fechaCorta, VERDE, ROJO } from './tema';
import { useAuth } from '../../context/AuthContext';

const TIPO_LABEL = { caja: 'CAJA · EFECTIVO', banco: 'BANCO', otro: 'OTRO' };

export default function CuentasTab({ theme, cuentas, onCambio, onTransferir, irA }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, card, cardSh, SKY_DEEP, btnPrim, btnSec } = theme;
    const [editando, setEditando] = useState(null); // cuenta | 'nueva'
    const disponible = cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo, 0);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>
                    Total disponible: <strong style={{ color: txt, fontSize: '1rem' }}>{dinero(disponible)}</strong>
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    {puede('finanzas', 'crear') && <button style={btnSec} onClick={onTransferir}>⇄ TRANSFERIR</button>}
                    {puede('finanzas', 'crear') && <button style={btnPrim} onClick={() => setEditando('nueva')}>+ NUEVA CUENTA</button>}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {cuentas.map(c => (
                    <div key={c.id} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, boxShadow: cardSh, padding: 18, opacity: c.activa ? 1 : .55, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.18em', color: SKY_DEEP }}>{TIPO_LABEL[c.tipo]}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '1rem', color: txt, marginTop: 2 }}>{c.nombre}</p>
                                {(c.banco || c.numero_cuenta) && <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut }}>{[c.banco, c.numero_cuenta].filter(Boolean).join(' · ')}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {c.predeterminada && <Badge color={SKY_DEEP}>PREDETERMINADA</Badge>}
                                {!c.activa && <Badge color={mut}>INACTIVA</Badge>}
                            </div>
                        </div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', color: c.saldo < 0 ? ROJO : txt, lineHeight: 1 }}>{dinero(c.saldo)}</p>
                        <div style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: txtSf, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                            <span>Saldo inicial ({fechaCorta(c.fecha_saldo_inicial)})</span><span style={{ textAlign: 'right' }}>{dinero(c.saldo_inicial)}</span>
                            <span>Entradas</span><span style={{ textAlign: 'right', color: VERDE }}>+{dinero(c.ingresos)}</span>
                            <span>Salidas</span><span style={{ textAlign: 'right', color: ROJO }}>−{dinero(c.egresos)}</span>
                        </div>
                        {c.saldo < 0 && <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: ROJO }}>Saldo negativo: revisa el saldo inicial o si falta registrar un ingreso.</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                            {puede('finanzas', 'editar') && <button className="prov-icon-btn" style={{ color: SKY_DEEP, fontFamily: "'Bebas Neue'", fontSize: '.64rem', letterSpacing: '.12em', padding: '6px 10px' }} onClick={() => setEditando(c)}>EDITAR</button>}
                            <button className="prov-icon-btn" style={{ color: txtSf, fontFamily: "'Bebas Neue'", fontSize: '.64rem', letterSpacing: '.12em', padding: '6px 10px' }} onClick={() => irA('movimientos', c.id)}>VER MOVIMIENTOS ({c.movimientos})</button>
                        </div>
                    </div>
                ))}
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 18, lineHeight: 1.5 }}>
                Lo cobrado o pagado en <strong>efectivo</strong> se suma o resta solo en la caja predeterminada; transferencias, tarjetas y cheques van al banco predeterminado.
                Si el saldo no coincide con el real, ajusta el <strong>saldo inicial</strong> (el dinero que había al empezar a usar el sistema).
            </p>

            {editando && (
                <ModalCuenta theme={theme} cuenta={editando === 'nueva' ? null : editando} onClose={() => setEditando(null)} onGuardado={onCambio} />
            )}
        </div>
    );
}
