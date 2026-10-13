/**
 * SS SWAP - Ventanas y piezas compartidas del modulo de Finanzas.
 * Modal base + formularios: ingreso/egreso, transferencia, cuenta de dinero,
 * datos de nomina, pago a empleado y anulacion con motivo.
 */
import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { dinero, hoyLocal, mesActual, METODOS_PAGO, TIPOS_PAGO_EMPLEADO, ROL_LABEL, VERDE, ROJO } from './tema';

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

/** Tarjeta de indicador (mismo estilo que el resumen de Proveedores) */
export function Kpi({ theme, label, value, color, hint, grande }) {
    const { card, bdr, cardSh, txt, mut } = theme;
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh, borderTop: `3px solid ${color}` }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.16em', color, marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: grande ? '2rem' : '1.4rem', color: txt, lineHeight: 1 }}>{value}</p>
            {hint && <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 6 }}>{hint}</p>}
        </div>
    );
}

export function Badge({ color, children }) {
    return <span className="prov-badge" style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}>{children}</span>;
}

/** Monto con signo y color segun ingreso/egreso */
export function Monto({ tipo, monto, tachado }) {
    const color = tipo === 'ingreso' ? VERDE : ROJO;
    return (
        <span style={{ color, fontWeight: 600, whiteSpace: 'nowrap', textDecoration: tachado ? 'line-through' : 'none', opacity: tachado ? .55 : 1 }}>
            {tipo === 'ingreso' ? '+' : '−'}{dinero(monto)}
        </span>
    );
}

export function Modal({ theme, etiqueta, titulo, onClose, children, ancho = 560 }) {
    const { txt, mut, bdr, boxBg, SKY_DEEP } = theme;
    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: ancho, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>{etiqueta}</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>{titulo}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Pie({ theme, onClose, saving, label }) {
    const { bdr, mut, btnPrim } = theme;
    return (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
            <button type="submit" disabled={saving} style={{ ...btnPrim, opacity: saving ? .6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'GUARDANDO...' : label}
            </button>
        </div>
    );
}

/** Envia el formulario y muestra el error del backend si falla */
function useEnvio(onGuardado, onClose) {
    const [saving, setSaving] = useState(false);
    const enviar = async (fn, exito) => {
        setSaving(true);
        try { await fn(); toast.success(exito); onGuardado?.(); onClose(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo guardar.'); }
        finally { setSaving(false); }
    };
    return [saving, enviar];
}

const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 13 };

// ── Ingreso / egreso manual ────────────────────────────────────
export function ModalMovimiento({ theme, tipo: tipoInicial = 'egreso', categorias, cuentas, onClose, onGuardado }) {
    const { labelSt, inputSt, mut } = theme;
    const activas = cuentas.filter(c => c.activa);
    const [form, setForm] = useState({
        tipo: tipoInicial, categoria: '', monto: '', fecha: hoyLocal(), metodo_pago: 'efectivo',
        cuenta_dinero_id: activas.find(c => c.tipo === 'caja' && c.predeterminada)?.id || activas[0]?.id || '',
        descripcion: '', referencia: '',
    });
    const [saving, enviar] = useEnvio(onGuardado, onClose);
    const opciones = useMemo(() => categorias.filter(c => c.manual && (c.tipo === form.tipo || c.tipo === 'ambos')), [categorias, form.tipo]);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Al elegir el metodo, sugerir la cuenta predeterminada correspondiente.
    const cambiarMetodo = (m) => {
        const tipoCta = m === 'efectivo' ? 'caja' : 'banco';
        const sug = activas.find(c => c.tipo === tipoCta && c.predeterminada);
        setForm(f => ({ ...f, metodo_pago: m, cuenta_dinero_id: sug ? sug.id : f.cuenta_dinero_id }));
    };

    const submit = (e) => {
        e.preventDefault();
        if (!form.categoria) return toast.error('Selecciona la categoria.');
        enviar(() => api.post('/finanzas/movimientos', form), form.tipo === 'ingreso' ? 'Ingreso registrado.' : 'Egreso registrado.');
    };

    return (
        <Modal theme={theme} etiqueta="FINANZAS" titulo={form.tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'} onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['ingreso', 'egreso'].map(t => (
                        <button type="button" key={t} onClick={() => setForm(f => ({ ...f, tipo: t, categoria: '' }))}
                            style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontFamily: "'Bebas Neue'", letterSpacing: '.14em', fontSize: '.8rem',
                                border: `1px solid ${form.tipo === t ? (t === 'ingreso' ? VERDE : ROJO) : theme.bdr}`,
                                background: form.tipo === t ? `${t === 'ingreso' ? VERDE : ROJO}18` : 'transparent',
                                color: form.tipo === t ? (t === 'ingreso' ? VERDE : ROJO) : mut }}>
                            {t === 'ingreso' ? '+ INGRESO' : '− EGRESO'}
                        </button>
                    ))}
                </div>
                <div style={grid2}>
                    <div>
                        <label style={labelSt}>CATEGORIA *</label>
                        <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={inputSt} required>
                            <option value="">Seleccionar...</option>
                            {opciones.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>MONTO *</label>
                        <input type="number" step="0.01" min="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} style={inputSt} required />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelSt}>DESCRIPCION *</label>
                        <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} style={inputSt} required maxLength={255} placeholder="Ej: Arriendo de octubre" />
                    </div>
                    <div>
                        <label style={labelSt}>METODO</label>
                        <select value={form.metodo_pago} onChange={e => cambiarMetodo(e.target.value)} style={inputSt}>
                            {METODOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>CUENTA *</label>
                        <select value={form.cuenta_dinero_id} onChange={e => set('cuenta_dinero_id', e.target.value)} style={inputSt} required>
                            {activas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({dinero(c.saldo)})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>FECHA</label>
                        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>REFERENCIA</label>
                        <input value={form.referencia} onChange={e => set('referencia', e.target.value)} style={inputSt} placeholder="N° factura / comprobante" />
                    </div>
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut }}>
                    Cobros a clientes, pagos a proveedores, gastos y sueldos se registran en su propio módulo y aparecen aquí automáticamente.
                </p>
                <Pie theme={theme} onClose={onClose} saving={saving} label="REGISTRAR" />
            </form>
        </Modal>
    );
}

// ── Transferencia entre cuentas ────────────────────────────────
export function ModalTransferencia({ theme, cuentas, onClose, onGuardado }) {
    const { labelSt, inputSt, mut } = theme;
    const activas = cuentas.filter(c => c.activa);
    const [form, setForm] = useState({
        origen_id: activas.find(c => c.tipo === 'caja')?.id || activas[0]?.id || '',
        destino_id: activas.find(c => c.tipo === 'banco')?.id || activas[1]?.id || '',
        monto: '', fecha: hoyLocal(), descripcion: '', referencia: '',
    });
    const [saving, enviar] = useEnvio(onGuardado, onClose);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const origen = activas.find(c => String(c.id) === String(form.origen_id));

    const submit = (e) => {
        e.preventDefault();
        if (String(form.origen_id) === String(form.destino_id)) return toast.error('Elige cuentas distintas.');
        enviar(() => api.post('/finanzas/transferencias', form), 'Transferencia registrada.');
    };

    return (
        <Modal theme={theme} etiqueta="FINANZAS" titulo="Transferir entre cuentas" onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={grid2}>
                    <div>
                        <label style={labelSt}>DESDE *</label>
                        <select value={form.origen_id} onChange={e => set('origen_id', e.target.value)} style={inputSt}>
                            {activas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({dinero(c.saldo)})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>HACIA *</label>
                        <select value={form.destino_id} onChange={e => set('destino_id', e.target.value)} style={inputSt}>
                            {activas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>MONTO *</label>
                        <input type="number" step="0.01" min="0.01" max={origen ? Math.max(0, origen.saldo) : undefined} value={form.monto} onChange={e => set('monto', e.target.value)} style={inputSt} required />
                    </div>
                    <div>
                        <label style={labelSt}>FECHA</label>
                        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelSt}>DETALLE</label>
                        <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)} style={inputSt} placeholder="Ej: Depósito de la caja al banco" />
                    </div>
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut }}>
                    Una transferencia solo mueve el dinero de lugar: no cuenta como ingreso ni como gasto.
                </p>
                <Pie theme={theme} onClose={onClose} saving={saving} label="TRANSFERIR" />
            </form>
        </Modal>
    );
}

// ── Cuenta de dinero ───────────────────────────────────────────
export function ModalCuenta({ theme, cuenta, onClose, onGuardado }) {
    const { labelSt, inputSt, mut, txtSf } = theme;
    const [form, setForm] = useState(cuenta ? {
        ...cuenta, banco: cuenta.banco || '', numero_cuenta: cuenta.numero_cuenta || '', notas: cuenta.notas || '',
        saldo_inicial: String(cuenta.saldo_inicial), fecha_saldo_inicial: String(cuenta.fecha_saldo_inicial).slice(0, 10),
    } : { nombre: '', tipo: 'banco', banco: '', numero_cuenta: '', saldo_inicial: '0', fecha_saldo_inicial: hoyLocal(), predeterminada: false, activa: true, notas: '' });
    const [saving, enviar] = useEnvio(onGuardado, onClose);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = (e) => {
        e.preventDefault();
        enviar(() => cuenta ? api.put(`/finanzas/cuentas/${cuenta.id}`, form) : api.post('/finanzas/cuentas', form), cuenta ? 'Cuenta actualizada.' : 'Cuenta creada.');
    };
    const check = (k, txt, disabled) => (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1 }}>
            <input type="checkbox" checked={Boolean(form[k])} disabled={disabled} onChange={e => set(k, e.target.checked)} /> {txt}
        </label>
    );

    return (
        <Modal theme={theme} etiqueta="CUENTAS DE DINERO" titulo={cuenta ? 'Editar cuenta' : 'Nueva cuenta'} onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={grid2}>
                    <div>
                        <label style={labelSt}>NOMBRE *</label>
                        <input value={form.nombre} onChange={e => set('nombre', e.target.value)} style={inputSt} required placeholder="Ej: Banco Pichincha" />
                    </div>
                    <div>
                        <label style={labelSt}>TIPO</label>
                        <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inputSt} disabled={cuenta?.predeterminada}>
                            <option value="caja">Caja (efectivo)</option>
                            <option value="banco">Banco</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                    {form.tipo === 'banco' && <>
                        <div>
                            <label style={labelSt}>BANCO</label>
                            <input value={form.banco} onChange={e => set('banco', e.target.value)} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>N° DE CUENTA</label>
                            <input value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)} style={inputSt} />
                        </div>
                    </>}
                    <div>
                        <label style={labelSt}>SALDO INICIAL</label>
                        <input type="number" step="0.01" value={form.saldo_inicial} onChange={e => set('saldo_inicial', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>AL INICIO DEL DIA</label>
                        <input type="date" value={form.fecha_saldo_inicial} onChange={e => set('fecha_saldo_inicial', e.target.value)} style={inputSt} />
                    </div>
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: -4 }}>
                    Saldo inicial = el dinero que había en esta cuenta al empezar ese día. Desde esa fecha el sistema suma y resta solo.
                </p>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {check('predeterminada', `Predeterminada para ${form.tipo === 'caja' ? 'efectivo' : 'transferencias / tarjeta / cheque'}`, cuenta?.predeterminada)}
                    {cuenta && check('activa', 'Activa', cuenta.predeterminada)}
                </div>
                <div>
                    <label style={labelSt}>NOTAS</label>
                    <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
                </div>
                <Pie theme={theme} onClose={onClose} saving={saving} label={cuenta ? 'GUARDAR CAMBIOS' : 'CREAR CUENTA'} />
            </form>
        </Modal>
    );
}

// ── Datos de nomina de un empleado ─────────────────────────────
export function ModalPerfilEmpleado({ theme, empleado, onClose, onGuardado }) {
    const { labelSt, inputSt, txtSf, mut } = theme;
    const [form, setForm] = useState({
        cargo: empleado.cargo || ROL_LABEL[empleado.rol] || '', sueldo_base: empleado.tiene_perfil ? String(empleado.sueldo_base) : '',
        frecuencia_pago: empleado.frecuencia_pago || 'mensual', fecha_ingreso: empleado.fecha_ingreso ? String(empleado.fecha_ingreso).slice(0, 10) : '',
        banco: empleado.banco || '', numero_cuenta: empleado.numero_cuenta || '', tipo_cuenta: empleado.tipo_cuenta || '',
        en_nomina: empleado.tiene_perfil ? empleado.en_nomina : true, notas: empleado.notas || '',
    });
    const [saving, enviar] = useEnvio(onGuardado, onClose);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const submit = (e) => { e.preventDefault(); enviar(() => api.put(`/finanzas/empleados/${empleado.id}`, form), 'Datos de nómina guardados.'); };

    return (
        <Modal theme={theme} etiqueta="NOMINA" titulo={empleado.nombre} onClose={onClose}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={grid2}>
                    <div>
                        <label style={labelSt}>CARGO</label>
                        <input value={form.cargo} onChange={e => set('cargo', e.target.value)} style={inputSt} placeholder="Ej: Mecánico" />
                    </div>
                    <div>
                        <label style={labelSt}>SUELDO MENSUAL *</label>
                        <input type="number" step="0.01" min="0" value={form.sueldo_base} onChange={e => set('sueldo_base', e.target.value)} style={inputSt} required />
                    </div>
                    <div>
                        <label style={labelSt}>SE PAGA</label>
                        <select value={form.frecuencia_pago} onChange={e => set('frecuencia_pago', e.target.value)} style={inputSt}>
                            <option value="mensual">Mensual</option>
                            <option value="quincenal">Quincenal</option>
                            <option value="semanal">Semanal</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>FECHA DE INGRESO</label>
                        <input type="date" value={form.fecha_ingreso} onChange={e => set('fecha_ingreso', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>BANCO</label>
                        <input value={form.banco} onChange={e => set('banco', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>N° DE CUENTA</label>
                        <input value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>TIPO DE CUENTA</label>
                        <select value={form.tipo_cuenta} onChange={e => set('tipo_cuenta', e.target.value)} style={inputSt}>
                            <option value="">—</option>
                            <option value="ahorros">Ahorros</option>
                            <option value="corriente">Corriente</option>
                        </select>
                    </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.en_nomina} onChange={e => set('en_nomina', e.target.checked)} /> Incluir en la nómina mensual
                </label>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: -6 }}>
                    El sueldo mensual se usa para calcular cuánto falta pagarle cada mes (sueldo + anticipos).
                </p>
                <Pie theme={theme} onClose={onClose} saving={saving} label="GUARDAR" />
            </form>
        </Modal>
    );
}

// ── Pago a empleado ────────────────────────────────────────────
export function ModalPagoEmpleado({ theme, empleados, empleado, periodo, cuentas, onClose, onGuardado }) {
    const { labelSt, inputSt, mut, txt, SKY_PALE, bdr } = theme;
    const activas = cuentas.filter(c => c.activa);
    const lista = empleados.filter(e => e.activo);
    const sugerido = (e) => (e && e.pendiente > 0 ? String(e.pendiente) : '');
    const [form, setForm] = useState({
        usuario_id: empleado?.id || '', tipo: 'sueldo', periodo: (periodo || mesActual()).slice(0, 7),
        monto_bruto: sugerido(empleado), descuentos: '0', fecha: hoyLocal(), metodo_pago: 'transferencia',
        cuenta_dinero_id: activas.find(c => c.tipo === 'banco' && c.predeterminada)?.id || activas[0]?.id || '',
        referencia: '', notas: '',
    });
    const [saving, enviar] = useEnvio(onGuardado, onClose);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const emp = lista.find(e => String(e.id) === String(form.usuario_id));
    const neto = Math.max(0, (Number(form.monto_bruto) || 0) - (Number(form.descuentos) || 0));

    const cambiarMetodo = (m) => {
        const sug = activas.find(c => c.tipo === (m === 'efectivo' ? 'caja' : 'banco') && c.predeterminada);
        setForm(f => ({ ...f, metodo_pago: m, cuenta_dinero_id: sug ? sug.id : f.cuenta_dinero_id }));
    };
    const submit = (e) => { e.preventDefault(); enviar(() => api.post('/finanzas/pagos-empleados', form), 'Pago registrado.'); };

    return (
        <Modal theme={theme} etiqueta="NOMINA" titulo="Pagar a empleado" onClose={onClose} ancho={620}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={grid2}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={labelSt}>EMPLEADO *</label>
                        <select value={form.usuario_id} required style={inputSt}
                            onChange={e => { const n = lista.find(x => String(x.id) === e.target.value); setForm(f => ({ ...f, usuario_id: e.target.value, monto_bruto: f.tipo === 'sueldo' ? sugerido(n) : f.monto_bruto })); }}>
                            <option value="">Seleccionar...</option>
                            {lista.map(e => <option key={e.id} value={e.id}>{e.nombre} · {e.cargo || ROL_LABEL[e.rol]}</option>)}
                        </select>
                    </div>
                    {emp && emp.en_nomina && (
                        <div style={{ gridColumn: '1/-1', background: SKY_PALE, border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 14px', fontFamily: "'Outfit'", fontSize: '.8rem', color: txt }}>
                            Sueldo {dinero(emp.sueldo_base)} · Pagado este mes {dinero(emp.pagado_sueldo)} · <strong>Falta {dinero(emp.pendiente)}</strong>
                        </div>
                    )}
                    <div>
                        <label style={labelSt}>CONCEPTO</label>
                        <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inputSt}>
                            {TIPOS_PAGO_EMPLEADO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>MES QUE SE PAGA</label>
                        <input type="month" value={form.periodo} onChange={e => set('periodo', e.target.value)} style={inputSt} required />
                    </div>
                    <div>
                        <label style={labelSt}>MONTO *</label>
                        <input type="number" step="0.01" min="0.01" value={form.monto_bruto} onChange={e => set('monto_bruto', e.target.value)} style={inputSt} required />
                    </div>
                    <div>
                        <label style={labelSt}>DESCUENTOS (IESS, multas...)</label>
                        <input type="number" step="0.01" min="0" value={form.descuentos} onChange={e => set('descuentos', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>METODO</label>
                        <select value={form.metodo_pago} onChange={e => cambiarMetodo(e.target.value)} style={inputSt}>
                            {METODOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>SALE DE LA CUENTA</label>
                        <select value={form.cuenta_dinero_id} onChange={e => set('cuenta_dinero_id', e.target.value)} style={inputSt}>
                            {activas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({dinero(c.saldo)})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelSt}>FECHA DE PAGO</label>
                        <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>REFERENCIA</label>
                        <input value={form.referencia} onChange={e => set('referencia', e.target.value)} style={inputSt} placeholder="N° comprobante" />
                    </div>
                </div>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.06em', color: txt, textAlign: 'right' }}>
                    <span style={{ color: mut, fontSize: '.8rem', letterSpacing: '.16em' }}>NETO A PAGAR </span>{dinero(neto)}
                </p>
                <Pie theme={theme} onClose={onClose} saving={saving} label="REGISTRAR PAGO" />
            </form>
        </Modal>
    );
}

// ── Anulacion con motivo (los registros de dinero no se borran) ──
export function ModalAnular({ theme, titulo, detalle, onConfirmar, onClose }) {
    const { labelSt, inputSt, txtSf } = theme;
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try { await onConfirmar(motivo.trim()); onClose(); }
        catch (err) { toast.error(err.response?.data?.error || 'No se pudo anular.'); }
        finally { setSaving(false); }
    };
    return (
        <Modal theme={theme} etiqueta="ANULAR" titulo={titulo} onClose={onClose} ancho={480}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf }}>{detalle}</p>
                <div>
                    <label style={labelSt}>MOTIVO *</label>
                    <input value={motivo} onChange={e => setMotivo(e.target.value)} style={inputSt} required maxLength={255} autoFocus placeholder="Ej: Registrado por error" />
                </div>
                <Pie theme={theme} onClose={onClose} saving={saving} label="ANULAR" />
            </form>
        </Modal>
    );
}
