/**
 * SS SWAP - Editor del logo de una empresa
 *
 * Vista previa ANTES de guardar, validación en el navegador (PNG o JPG,
 * máximo 2 MB; el servidor vuelve a validar la firma real del archivo) y
 * botones para guardar o quitar. Lo usan "Configuración de la empresa"
 * (rutaBase '/empresa') y la plataforma ('/plataforma/empresas/:id').
 */
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from './ConfirmDialog';
import { usePaleta, bebas, outfit, BotonPrimario } from './PanelUI';
import { LogoEmpresa } from './MarcaEmpresa';

const TIPOS = ['image/png', 'image/jpeg'];
const MAX_BYTES = 2 * 1024 * 1024;

/** Mensaje de error si el archivo no sirve como logo, o null. */
export function validarArchivoLogo(file) {
    if (!file) return 'Selecciona una imagen.';
    if (!TIPOS.includes(file.type) || !/\.(png|jpe?g)$/i.test(file.name)) return 'El logo debe ser una imagen PNG o JPG.';
    if (file.size > MAX_BYTES) return 'El logo no puede superar 2 MB.';
    return null;
}

export default function EditorLogo({ empresa, rutaBase, editable, onGuardado }) {
    const p = usePaleta();
    const confirm = useConfirm();
    const input = useRef(null);
    const [archivo, setArchivo] = useState(null);
    const [preview, setPreview] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const elegir = (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const error = validarArchivoLogo(f);
        if (error) { toast.error(error); return; }
        setArchivo(f);
        setPreview(URL.createObjectURL(f));
    };
    const descartar = () => { setArchivo(null); setPreview(''); };

    const guardar = async () => {
        if (!archivo) return;
        setGuardando(true);
        try {
            const fd = new FormData();
            fd.append('logo', archivo);
            const { data } = await api.post(`${rutaBase}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Logo guardado.');
            descartar();
            onGuardado?.(data.empresa);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo guardar el logo.');
        } finally { setGuardando(false); }
    };

    const quitar = async () => {
        if (!(await confirm({ title: 'Quitar logo', message: 'Los documentos nuevos saldrán sin logo. Los ya emitidos conservan el logo con el que se crearon. ¿Continuar?', confirmLabel: 'Quitar', danger: true }))) return;
        setGuardando(true);
        try {
            const { data } = await api.delete(`${rutaBase}/logo`);
            toast.success('Logo quitado.');
            onGuardado?.(data.empresa);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo quitar el logo.');
        } finally { setGuardando(false); }
    };

    const marco = { width: 220, height: 130, borderRadius: 12, border: `1px solid ${p.bdr}`, background: '#fff', padding: 10, boxSizing: 'border-box' };
    return (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
                <p style={{ ...bebas('.6rem', '.2em'), color: p.mut, marginBottom: 6 }}>{preview ? 'VISTA PREVIA (SIN GUARDAR)' : 'LOGO ACTUAL'}</p>
                <div style={marco}>
                    {preview
                        ? <img src={preview} alt="Vista previa del logo" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                        : <LogoEmpresa empresa={empresa} alto={110} colorTexto={p.SKY_DEEP} />}
                </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ ...outfit('.84rem'), color: p.txtSf, marginBottom: 10 }}>
                    Aparece en el panel, en las proformas, órdenes de trabajo y facturas (PDF y Excel) de esta empresa.
                    PNG o JPG de hasta 2 MB; se ajusta sin deformarse. Recomendado: fondo transparente o blanco, al menos 400 px de ancho.
                </p>
                {editable && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input ref={input} type="file" accept="image/png,image/jpeg" onChange={elegir} style={{ display: 'none' }} aria-label="Elegir archivo de logo" />
                        {!archivo && <BotonPrimario onClick={() => input.current?.click()} disabled={guardando}>{empresa?.logo_url ? 'CAMBIAR LOGO' : 'SUBIR LOGO'}</BotonPrimario>}
                        {archivo && <BotonPrimario onClick={guardar} disabled={guardando}>{guardando ? 'GUARDANDO...' : 'GUARDAR LOGO'}</BotonPrimario>}
                        {archivo && <BotonPrimario onClick={descartar} disabled={guardando} color="#64748b">DESCARTAR</BotonPrimario>}
                        {!archivo && empresa?.logo_url && <BotonPrimario onClick={quitar} disabled={guardando} color="#ef4444">QUITAR LOGO</BotonPrimario>}
                    </div>
                )}
            </div>
        </div>
    );
}
