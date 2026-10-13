/**
 * SS SWAP - Facturación electrónica: panel y listado de comprobantes (/dashboard/facturacion)
 *
 * Indicadores separados a propósito: FACTURADO (autorizado por el SRI, neto
 * de notas de crédito), COBRADO (pagos registrados) y SALDO. Una factura
 * autorizada no significa que el cliente pagó, y un pago no autoriza una
 * factura. El ambiente de PRUEBAS se muestra aparte y marcado.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePaleta, bebas, outfit, BotonPrimario, BotonSecundario, Pildora, KpiCard, Modal } from '../../components/common/PanelUI';
import Paginador from '../../components/proveedores/Paginador';
import { ESTADOS, TIPO_DOC, dinero, fechaCorta } from './comun';
import '../Proformas.css';

const POR_PAGINA = 20;

export default function Facturacion() {
    const p = usePaleta();
    const navigate = useNavigate();
    const { puede } = useAuth();
    const [catalogos, setCatalogos] = useState(null);
    const [resumen, setResumen] = useState(null);
    const [lista, setLista] = useState({ comprobantes: [], total: 0 });
    const [cargando, setCargando] = useState(true);
    const [pagina, setPagina] = useState(1);
    const [filtros, setFiltros] = useState({ q: '', estado: '', cod_doc: '', ambiente: '', desde: '', hasta: '' });
    const [elegir, setElegir] = useState(false);

    useEffect(() => {
        api.get('/facturacion/catalogos').then(({ data }) => setCatalogos(data)).catch(() => {});
        api.get('/facturacion/resumen').then(({ data }) => setResumen(data)).catch(() => {});
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/facturacion?${params}`);
            setLista(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudieron cargar los comprobantes.');
        } finally { setCargando(false); }
    }, [filtros, pagina]);
    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { cargar(); }, [cargar]);

    const filtroSel = { padding: '8px 10px', fontSize: '.8rem', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, fontFamily: "'Outfit'", outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, ...bebas('.72rem', '.2em'), color: p.SKY_DEEP };
    const prod = resumen?.produccion;
    const pruebas = resumen?.pruebas;
    const ambiente = catalogos?.ambiente || 1;

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--pf-bdr': p.bdr, '--pf-sky': p.SKY_DEEP }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>FACTURACIÓN ELECTRÓNICA · SRI</span></div>
                    <h1 style={{ ...bebas('2.6rem', '.04em'), color: p.txt, lineHeight: 1 }}>Comprobantes electrónicos</h1>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {ambiente === 2
                            ? <Pildora color="#10b981">AMBIENTE: PRODUCCIÓN (VALIDEZ TRIBUTARIA)</Pildora>
                            : <Pildora color="#f59e0b">AMBIENTE: PRUEBAS · SIN VALIDEZ TRIBUTARIA</Pildora>}
                        {catalogos && <Pildora color={p.SKY_DEEP}>FICHA TÉCNICA SRI v{catalogos.version_ficha}</Pildora>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {puede('facturacion_config', 'ver') && <BotonSecundario onClick={() => navigate('/dashboard/facturacion/config')}>CONFIGURACIÓN</BotonSecundario>}
                    {puede('facturacion', 'crear') && <BotonPrimario onClick={() => setElegir(true)}>+ NUEVA FACTURA</BotonPrimario>}
                </div>
            </div>

            {catalogos?.faltantes?.length > 0 && (
                <div role="alert" style={{ padding: 16, borderRadius: 12, border: '1px solid #f59e0b66', background: '#f59e0b14', marginBottom: 18 }}>
                    <p style={{ ...bebas('.8rem', '.16em'), color: '#b45309', marginBottom: 6 }}>LA EMISIÓN AÚN NO ESTÁ LISTA</p>
                    <ul style={{ margin: 0, paddingLeft: 18, ...outfit('.84rem'), color: p.txtSf }}>
                        {catalogos.faltantes.map(f => <li key={f}>{f}</li>)}
                    </ul>
                    {puede('facturacion_config', 'editar') && <div style={{ marginTop: 10 }}><BotonSecundario color={p.SKY_DEEP} onClick={() => navigate('/dashboard/facturacion/config')}>COMPLETAR CONFIGURACIÓN</BotonSecundario></div>}
                </div>
            )}

            <p style={{ ...bebas('.7rem', '.2em'), color: p.mut, marginBottom: 8 }}>
                MES ACTUAL ({resumen ? `${fechaCorta(resumen.desde)} – ${fechaCorta(resumen.hasta)}` : '…'}) · PRODUCCIÓN
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 10 }}>
                <KpiCard label="Facturado neto (autorizado)" value={dinero(prod?.neto)} color="#10b981" />
                <KpiCard label="IVA facturado" value={dinero(prod?.iva)} color={p.SKY_DEEP} />
                <KpiCard label="Cobrado (pagos registrados)" value={dinero(resumen?.cobrado)} color="#8b5cf6" />
                <KpiCard label="Saldo de clientes facturados" value={dinero(resumen?.saldo_facturas_produccion)} color="#f59e0b" />
                <KpiCard label="En curso / con error" value={`${prod?.en_curso || 0} / ${prod?.con_error || 0}`} color="#ef4444" />
            </div>
            <p style={{ ...outfit('.76rem'), color: p.mut, marginBottom: pruebas ? 6 : 18 }}>
                Facturado ≠ cobrado: una factura autorizada puede estar pendiente de pago, y los pagos se registran en el pagaré del cliente.
            </p>
            {pruebas && (
                <p style={{ ...outfit('.78rem'), color: '#b45309', marginBottom: 18 }}>
                    Pruebas (sin validez): {pruebas.facturas} factura(s) autorizada(s) por {dinero(pruebas.neto)} · {pruebas.borradores} borrador(es).
                </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                    <label style={labelSt} htmlFor="fac-q">BUSCAR</label>
                    <input id="fac-q" value={filtros.q} onChange={e => setFiltros({ ...filtros, q: e.target.value })} placeholder="Cliente, RUC/cédula, número o clave de acceso..." style={{ ...filtroSel, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                    <label style={labelSt} htmlFor="fac-estado">ESTADO</label>
                    <select id="fac-estado" style={filtroSel} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.etiqueta}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt} htmlFor="fac-tipo">TIPO</label>
                    <select id="fac-tipo" style={filtroSel} value={filtros.cod_doc} onChange={e => setFiltros({ ...filtros, cod_doc: e.target.value })}>
                        <option value="">Todos</option><option value="01">Facturas</option><option value="04">Notas de crédito</option>
                    </select>
                </div>
                <div>
                    <label style={labelSt} htmlFor="fac-amb">AMBIENTE</label>
                    <select id="fac-amb" style={filtroSel} value={filtros.ambiente} onChange={e => setFiltros({ ...filtros, ambiente: e.target.value })}>
                        <option value="">Todos</option><option value="2">Producción</option><option value="1">Pruebas</option>
                    </select>
                </div>
                <div><label style={labelSt} htmlFor="fac-desde">DESDE</label><input id="fac-desde" type="date" style={filtroSel} value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} /></div>
                <div><label style={labelSt} htmlFor="fac-hasta">HASTA</label><input id="fac-hasta" type="date" style={filtroSel} value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} /></div>
            </div>

            {cargando ? (
                <p style={{ ...outfit('.9rem'), color: p.mut, padding: 40, textAlign: 'center' }}>Cargando comprobantes...</p>
            ) : lista.comprobantes.length === 0 ? (
                <div style={{ padding: 50, textAlign: 'center', background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14 }}>
                    <p style={{ ...bebas('1.2rem'), color: p.txt }}>Sin comprobantes para estos filtros</p>
                    <p style={{ ...outfit('.84rem'), color: p.mut, marginTop: 6 }}>Las facturas se preparan desde una proforma aprobada o una orden de trabajo.</p>
                </div>
            ) : (
                <div className="pf-table-wrap" style={{ background: p.card, border: `1px solid ${p.bdr}`, boxShadow: p.cardSh }}>
                    <table className="pf-table">
                        <thead>
                            <tr style={{ background: p.SKY_PALE }}>
                                {['Número', 'Fecha', 'Tipo', 'Cliente', 'Origen', 'Total', 'Estado', 'Correo', ''].map(h => <th key={h} style={{ color: p.SKY_DEEP }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {lista.comprobantes.map(c => {
                                const est = ESTADOS[c.estado] || { etiqueta: c.estado, color: p.mut };
                                return (
                                    <tr key={c.id} style={{ borderColor: p.bdr }}>
                                        <td style={{ color: p.txt, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {c.numero || <span style={{ color: p.mut, fontWeight: 400 }}>sin número</span>}
                                            {Number(c.ambiente) === 1 && <span className="pf-badge" style={{ display: 'block', marginTop: 3, background: '#f59e0b14', border: '1px solid #f59e0b55', color: '#b45309' }}>PRUEBAS</span>}
                                        </td>
                                        <td style={{ color: p.txtSf, whiteSpace: 'nowrap' }}>{fechaCorta(c.fecha_emision)}</td>
                                        <td style={{ color: p.txtSf }}>{TIPO_DOC[c.cod_doc]}</td>
                                        <td style={{ color: p.txt }}>{c.comprador_razon_social}<span style={{ display: 'block', fontSize: '.72rem', color: p.mut }}>{c.comprador_identificacion}</span></td>
                                        <td style={{ color: p.txtSf }}>{c.proforma_numero || '—'}</td>
                                        <td style={{ color: p.txt, fontWeight: 600 }}>{dinero(c.importe_total)}</td>
                                        <td><span className="pf-badge" title={est.ayuda} style={{ background: `${est.color}18`, border: `1px solid ${est.color}44`, color: est.color }}>{est.etiqueta.toUpperCase()}</span></td>
                                        <td style={{ color: c.correo_estado === 'error' ? '#ef4444' : p.mut, fontSize: '.76rem' }}>{c.estado === 'autorizado' ? ({ enviado: 'Enviado', error: 'Error', sin_correo: 'Sin correo', pendiente: 'Pendiente' }[c.correo_estado]) : '—'}</td>
                                        <td><Link to={`/dashboard/facturacion/${c.id}`} className="pf-icon-btn" style={{ color: p.SKY_DEEP, padding: '6px 10px', ...bebas('.74rem') }}>VER</Link></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <Paginador pagina={pagina} setPagina={setPagina} total={lista.total} porPagina={POR_PAGINA} theme={{ txt: p.txt, mut: p.mut, bdr: p.bdr }} />

            {elegir && <ElegirOrigen onClose={() => setElegir(false)} />}
        </div>
    );
}

/** Selección de lo que se va a facturar: una proforma aprobada/convertida o una orden de trabajo. */
function ElegirOrigen({ onClose }) {
    const p = usePaleta();
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [proformas, setProformas] = useState([]);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        let vigente = true;
        const t = setTimeout(async () => {
            setCargando(true);
            try {
                const peticiones = ['aprobada', 'convertida'].map(estado => api.get(`/proformas?estado=${estado}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}`));
                const r = await Promise.all(peticiones);
                if (vigente) setProformas(r.flatMap(x => x.data.proformas || []).sort((a, b) => b.id - a.id));
            } catch { if (vigente) setProformas([]); } finally { if (vigente) setCargando(false); }
        }, 250);
        return () => { vigente = false; clearTimeout(t); };
    }, [q]);

    return (
        <Modal titulo="¿Qué va a facturar?" etiqueta="FACTURACIÓN · NUEVA" ancho={640} onClose={onClose}
            subtitulo="La factura toma los conceptos APROBADOS en la proforma (también la de una orden de trabajo). No vuelve a descontar inventario ni registra pagos.">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proforma por número, cliente o placa..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem'), marginBottom: 12 }} />
            {cargando ? <p style={{ ...outfit('.85rem'), color: p.mut }}>Buscando...</p> : proformas.length === 0 ? (
                <p style={{ ...outfit('.85rem'), color: p.mut }}>No hay proformas aprobadas o convertidas con ese criterio.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                    {proformas.map(pr => (
                        <button key={pr.id} type="button" onClick={() => navigate(`/dashboard/facturacion/nueva?proforma_id=${pr.id}`)}
                            style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 11, border: `1px solid ${p.bdr}`, background: p.card, cursor: 'pointer', color: p.txt }}>
                            <span style={{ ...bebas('.9rem', '.06em') }}>{pr.numero}</span>
                            <span style={{ ...outfit('.8rem'), color: p.mut, marginLeft: 10 }}>{pr.cliente_nombre} · {pr.vehiculo_placa || 'sin placa'} · {dinero(pr.total)} · {pr.estado}</span>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}
