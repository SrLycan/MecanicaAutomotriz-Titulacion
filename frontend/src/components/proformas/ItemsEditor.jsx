/**
 * SS SWAP - Editor de items de proforma (Fase 2 del modulo Proformas)
 *
 * Reutilizable para las 6 categorias: producto, servicio, mano_obra,
 * pintura, repuesto, insumo. `modoSimple` oculta cantidad (queda fija en 1)
 * y muestra solo Descripcion + Valor — para que Mano de obra/Pintura
 * repliquen el formato "Item/Descripcion/Valor" de la plantilla original,
 * sin perder la capacidad de calcular subtotal = cantidad * precio por
 * debajo (cantidad=1 en ese caso).
 *
 * `catalogo`, si se pasa, agrega un selector que autocompleta descripcion
 * y precio desde el inventario (productos/repuestos) o servicios — nunca
 * se duplica ese catalogo, solo se consulta.
 *
 * Sprint 14: un item elegido del inventario queda ligado al producto
 * (referencia_tipo='repuesto' + referencia_id). Esa relacion es la que
 * luego permite descontar el stock al "Confirmar uso de materiales". El
 * catalogo de inventario se agrupa por area (Mecanica / Colisiones) y
 * muestra el stock disponible; `areaPreferida` define que grupo va primero.
 */
import React from 'react';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }

const ETIQUETA_AREA = { mecanica: 'Inventario Mecánica', colisiones: 'Inventario Colisiones / Pintura' };
const fmtCant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));

export default function ItemsEditor({ theme, categoria, titulo, items, onChange, modoSimple, catalogo, areaPreferida, bloqueado }) {
    const { txt, txtSf, mut, bdr, inputSt, SKY_DEEP } = theme;
    const propios = items.filter(it => it.categoria === categoria);
    const esInventario = ['producto', 'repuesto', 'insumo'].includes(categoria);
    const tipoReferencia = esInventario ? 'repuesto' : 'servicio';

    // Catalogo agrupado por area (solo aplica a inventario; servicios no tienen area)
    const grupos = (() => {
        if (!catalogo) return [];
        if (!esInventario || !catalogo.some(c => c.area)) return [{ clave: 'todos', etiqueta: null, opciones: catalogo }];
        const orden = areaPreferida === 'colisiones' ? ['colisiones', 'mecanica'] : ['mecanica', 'colisiones'];
        return orden.map(a => ({ clave: a, etiqueta: ETIQUETA_AREA[a], opciones: catalogo.filter(c => c.area === a) })).filter(g => g.opciones.length);
    })();

    const actualizar = (idx, campo, valor) => {
        const nuevos = [...propios];
        nuevos[idx] = { ...nuevos[idx], [campo]: valor };
        if (campo === 'referencia_id' && catalogo) {
            const encontrado = valor ? catalogo.find(c => String(c.id) === String(valor)) : null;
            if (encontrado) {
                nuevos[idx].referencia_id = encontrado.id;
                nuevos[idx].descripcion = encontrado.nombre;
                nuevos[idx].precio_unitario = encontrado.precio;
                nuevos[idx].referencia_tipo = tipoReferencia;
            } else {
                // "Item libre": se rompe el vinculo con el catalogo (no descontara stock)
                nuevos[idx].referencia_id = null;
                nuevos[idx].referencia_tipo = null;
            }
        }
        reemplazarPropios(nuevos);
    };
    const productoDe = (it) => (catalogo && it.referencia_id ? catalogo.find(c => String(c.id) === String(it.referencia_id)) : null);

    const reemplazarPropios = (nuevosPropios) => {
        const otros = items.filter(it => it.categoria !== categoria);
        onChange([...otros, ...nuevosPropios]);
    };

    const agregar = () => {
        reemplazarPropios([...propios, { categoria, descripcion: '', cantidad: 1, precio_unitario: 0, referencia_id: null, referencia_tipo: null }]);
    };
    const quitar = (idx) => reemplazarPropios(propios.filter((_, i) => i !== idx));

    const subtotalCategoria = propios.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0);

    const gridCols = modoSimple
        ? (catalogo ? '1.4fr 2fr 1fr auto' : '2.6fr 1fr auto')
        : (catalogo ? '1.4fr 1.8fr .7fr 1fr 1fr auto' : '2.2fr .7fr 1fr 1fr auto');

    return (
        <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.1em', color: SKY_DEEP }}>{titulo.toUpperCase()}</p>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', fontWeight: 600, color: txt }}>${subtotalCategoria.toFixed(2)}</p>
            </div>

            {propios.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {propios.map((it, idx) => {
                        const prod = esInventario ? productoDe(it) : null;
                        const excede = prod && prod.stock !== undefined && (parseFloat(it.cantidad) || 0) > prod.stock;
                        return (
                        <div key={idx}>
                        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8, alignItems: 'center' }}>
                            {catalogo && (
                                <select value={it.referencia_id || ''} onChange={e => actualizar(idx, 'referencia_id', e.target.value)} disabled={bloqueado}
                                    title={esInventario ? 'Producto del inventario (se descontará al confirmar el uso)' : 'Servicio del catálogo'}
                                    style={{ ...inputSt, padding: '8px 10px', fontSize: '.8rem', borderColor: it.referencia_id && esInventario ? SKY_DEEP : inputSt.borderColor }}>
                                    <option value="">{esInventario ? 'Item libre (no inventario)...' : 'Item libre...'}</option>
                                    {grupos.map(g => {
                                        const opciones = g.opciones.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre}{c.stock !== undefined ? ` — stock ${fmtCant(c.stock)} ${c.unidad || ''}` : ''}
                                            </option>
                                        ));
                                        return g.etiqueta ? <optgroup key={g.clave} label={g.etiqueta}>{opciones}</optgroup> : opciones;
                                    })}
                                </select>
                            )}
                            <input placeholder="Descripción" value={it.descripcion} onChange={e => actualizar(idx, 'descripcion', e.target.value)} style={{ ...inputSt, padding: '8px 10px', fontSize: '.8rem' }} />
                            {!modoSimple && (
                                <input type="number" min="0.01" step="0.01" placeholder="Cant." value={it.cantidad} onChange={e => actualizar(idx, 'cantidad', e.target.value)} style={{ ...inputSt, padding: '8px 10px', fontSize: '.8rem' }} />
                            )}
                            <input type="number" min="0" step="0.01" placeholder={modoSimple ? 'Valor' : 'P. Unit.'} value={it.precio_unitario} onChange={e => actualizar(idx, 'precio_unitario', e.target.value)} style={{ ...inputSt, padding: '8px 10px', fontSize: '.8rem' }} />
                            {!modoSimple && (
                                <div style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf, textAlign: 'right', paddingRight: 4 }}>
                                    ${((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0)).toFixed(2)}
                                </div>
                            )}
                            <button type="button" onClick={() => quitar(idx)} disabled={bloqueado}
                                style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: 7, cursor: 'pointer', color: '#ef4444' }}>
                                <IconTrash />
                            </button>
                        </div>
                        {prod && (
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: excede ? '#ef4444' : mut, margin: '3px 0 0 4px' }}>
                                {excede
                                    ? `⚠ Stock insuficiente: hay ${fmtCant(prod.stock)} ${prod.unidad || ''} de ${prod.nombre}. No se podrá confirmar el uso hasta reponer stock.`
                                    : `Vinculado al inventario (${prod.area === 'colisiones' ? 'Colisiones / Pintura' : 'Mecánica'}) · disponible ${fmtCant(prod.stock)} ${prod.unidad || ''}`}
                            </p>
                        )}
                        </div>
                        );
                    })}
                </div>
            )}

            <button type="button" onClick={agregar} disabled={bloqueado}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px dashed ${bdr}`, borderRadius: 9, padding: '7px 13px', cursor: 'pointer', color: SKY_DEEP, fontFamily: "'Outfit'", fontSize: '.8rem' }}>
                <IconPlus /> Agregar {titulo.toLowerCase()}
            </button>
        </div>
    );
}
