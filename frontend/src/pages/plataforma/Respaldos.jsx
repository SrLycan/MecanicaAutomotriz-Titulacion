/**
 * SS SWAP - Plataforma: respaldos (solo superadministrador)
 *
 * Muestra la configuración REAL del servidor (carpeta, programación, cifrado,
 * retención, motor disponible), el historial de respaldos y de pruebas de
 * restauración, y permite lanzar un respaldo manual o una prueba de
 * restauración en una base temporal aislada. Nunca restaura producción:
 * eso solo se hace desde el servidor (npm run restaurar) y con confirmación.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { usePaleta, bebas, outfit, Pildora, BotonPrimario, BotonSecundario } from '../../components/common/PanelUI';
import '../Usuarios.css';

const COLOR = { exito: '#10b981', error: '#ef4444', en_curso: '#f59e0b' };
const TIPO = { automatico: 'Automático', manual: 'Manual', previo_migracion: 'Antes de migración', previo_restauracion: 'Antes de restaurar', prueba_restauracion: 'Prueba de restauración' };
const tamano = (b) => (b == null ? '—' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Respaldos() {
    const p = usePaleta();
    const confirm = useConfirm();
    const [datos, setDatos] = useState(null);
    const [ocupado, setOcupado] = useState(null);

    const cargar = useCallback(() => api.get('/plataforma/respaldos').then(r => setDatos(r.data))
        .catch(err => toast.error(err.response?.data?.error || 'No se pudo cargar el estado de los respaldos.')), []);
    useEffect(() => { cargar(); }, [cargar]);

    const ejecutar = async (tipo) => {
        const texto = tipo === 'respaldo'
            ? 'Se hará un respaldo completo de la base de datos (todas las empresas) y de los archivos subidos.'
            : 'Se restaurará el último respaldo en una base TEMPORAL aislada, se verificarán filas y relaciones y luego se borrará. La base de la aplicación no se toca.';
        if (!(await confirm({ title: tipo === 'respaldo' ? 'Respaldo manual' : 'Prueba de restauración', message: texto, confirmLabel: 'Ejecutar', danger: false }))) return;
        setOcupado(tipo);
        try {
            const { data } = tipo === 'respaldo' ? await api.post('/plataforma/respaldos') : await api.post('/plataforma/respaldos/prueba');
            const r = data.respaldo || data.prueba;
            if (r.resultado === 'exito') toast.success(tipo === 'respaldo' ? `Respaldo creado: ${r.archivo}` : 'Restauración verificada: filas y relaciones coinciden.');
            else toast.error(r.error || 'La operación terminó con error.');
        } catch (err) {
            toast.error(err.response?.data?.respaldo?.error || err.response?.data?.prueba?.error || err.response?.data?.error || 'La operación falló.');
        } finally { setOcupado(null); cargar(); }
    };

    if (!datos) return <div className="sk-pulse" style={{ height: 220, borderRadius: 16, background: p.card }} />;
    const c = datos.configuracion;
    const seccion = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, padding: 18, marginBottom: 18 };
    const fila = (l, v, alerta) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: `1px dashed ${p.bdr}`, ...outfit('.84rem') }}>
            <span style={{ color: p.mut }}>{l}</span><span style={{ color: alerta ? '#ef4444' : p.txt, fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
        </div>
    );
    const th = { padding: '11px 14px', textAlign: 'left', ...bebas('.74rem', '.2em'), color: p.SKY_DEEP, whiteSpace: 'nowrap' };
    const td = { padding: '10px 14px', ...outfit('.8rem'), color: p.txtSf, verticalAlign: 'top' };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>PLATAFORMA · SUPERADMINISTRADOR</span></div>
                    <h1 style={{ ...bebas('2.6rem', '.04em'), color: p.txt, lineHeight: 1 }}>Respaldos</h1>
                    <p style={{ ...outfit('.85rem'), color: p.mut, marginTop: 6, maxWidth: 700 }}>
                        Un respaldo solo cuenta como recuperación validada cuando su prueba de restauración salió bien.
                        La restauración sobre la base real solo se hace desde el servidor y con confirmación.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <BotonSecundario onClick={() => ejecutar('prueba')} disabled={Boolean(ocupado)} color={p.SKY_DEEP}>{ocupado === 'prueba' ? 'PROBANDO...' : 'PROBAR RESTAURACIÓN'}</BotonSecundario>
                    <BotonPrimario onClick={() => ejecutar('respaldo')} disabled={Boolean(ocupado)}>{ocupado === 'respaldo' ? 'RESPALDANDO...' : 'RESPALDAR AHORA'}</BotonPrimario>
                </div>
            </div>

            <div style={seccion}>
                <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 6 }}>CONFIGURACIÓN DEL SERVIDOR</p>
                {fila('Respaldo automático diario', c.automatico ? `Activado a las ${String(c.hora).padStart(2, '0')}:00` : 'DESACTIVADO (BACKUP_AUTO)', !c.automatico)}
                {fila('Motor', c.motor)}
                {fila('Cifrado', c.cifrado ? 'AES-256-GCM (BACKUP_ENCRYPTION_KEY)' : 'Sin cifrar: define BACKUP_ENCRYPTION_KEY', !c.cifrado)}
                {fila('Retención', `${c.retencion_dias} días · siempre se conservan los últimos ${c.minimo_conservar}`)}
                {fila('Carpeta (fuera de la web pública)', c.carpeta)}
            </div>

            <div style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                        <tr style={{ background: p.SKY_PALE, borderBottom: `1px solid ${p.bdr}` }}>
                            {['Fecha', 'Tipo', 'Resultado', 'Motor', 'Archivo', 'Tamaño', 'Cifrado', 'Versión', 'Detalle'].map(h => <th key={h} style={th}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {datos.registro.length === 0 ? (
                            <tr><td colSpan={9} style={{ ...td, padding: 30, textAlign: 'center' }}>Todavía no hay respaldos registrados.</td></tr>
                        ) : datos.registro.map(r => (
                            <tr key={r.id} className="u-row" style={{ borderBottom: `1px solid ${p.bdr}` }}>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(r.inicio).toLocaleString('es-EC')}</td>
                                <td style={td}>{TIPO[r.tipo] || r.tipo}</td>
                                <td style={td}><Pildora color={COLOR[r.resultado] || p.mut}>{r.resultado.toUpperCase()}</Pildora></td>
                                <td style={td}>{r.motor || '—'}</td>
                                <td style={{ ...td, wordBreak: 'break-all' }}>{r.archivo || '—'}</td>
                                <td style={td}>{tamano(r.tamano_bytes)}</td>
                                <td style={td}>{r.cifrado ? 'Sí' : 'No'}</td>
                                <td style={td}>{r.version_app || '—'}{r.commit_git ? ` (${r.commit_git})` : ''}</td>
                                <td style={{ ...td, maxWidth: 320 }}>
                                    {r.detalle?.error ? <span style={{ color: '#ef4444' }}>{r.detalle.error}</span>
                                        : r.tipo === 'prueba_restauracion' && r.detalle
                                            ? `${r.detalle.tablas} tablas · ${r.detalle.filas_totales} filas · ${r.detalle.relaciones_revisadas} relaciones · ${r.detalle.huerfanos?.length || 0} huérfanos`
                                            : r.detalle?.uploads ? (r.detalle.uploads.incluido ? 'Incluye uploads/' : `Sin uploads/: ${r.detalle.uploads.motivo}`) : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
