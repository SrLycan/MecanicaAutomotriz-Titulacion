/**
 * Prueba de componente para ConfirmProvider/useConfirm.
 *
 * A diferencia de imagen.test.js (funcion pura), aca sí se renderiza un
 * componente real, se simula un click de usuario, y se verifica tanto lo
 * que aparece en pantalla como el valor con el que se resuelve la promesa
 * de confirm(). Este es el patron a copiar para probar cualquier otro
 * componente interactivo del proyecto.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from './ConfirmDialog';

// Componente de prueba: dispara confirm() al hacer click y muestra el resultado.
function Probador() {
    const confirm = useConfirm();
    const [resultado, setResultado] = React.useState(null);

    return (
        <div>
            <button onClick={async () => {
                const ok = await confirm({ title: 'Eliminar repuesto', message: '¿Seguro?', danger: true });
                setResultado(ok ? 'confirmado' : 'cancelado');
            }}>
                Abrir confirmacion
            </button>
            <p>Resultado: {resultado ?? 'ninguno'}</p>
        </div>
    );
}

function renderConProvider() {
    return render(
        <ConfirmProvider>
            <Probador />
        </ConfirmProvider>
    );
}

describe('ConfirmDialog (ConfirmProvider + useConfirm)', () => {
    test('no muestra el dialogo hasta que se llama a confirm()', () => {
        renderConProvider();
        expect(screen.queryByText('Eliminar repuesto')).not.toBeInTheDocument();
    });

    test('muestra el titulo y el mensaje al abrir', async () => {
        const user = userEvent.setup();
        renderConProvider();

        await user.click(screen.getByText('Abrir confirmacion'));

        expect(screen.getByText('Eliminar repuesto')).toBeInTheDocument();
        expect(screen.getByText('¿Seguro?')).toBeInTheDocument();
    });

    test('al aceptar, la promesa resuelve true y el dialogo se cierra', async () => {
        const user = userEvent.setup();
        renderConProvider();

        await user.click(screen.getByText('Abrir confirmacion'));
        await user.click(screen.getByText('Eliminar')); // confirmLabel por defecto en danger

        expect(screen.getByText('Resultado: confirmado')).toBeInTheDocument();
        expect(screen.queryByText('Eliminar repuesto')).not.toBeInTheDocument();
    });

    test('al cancelar, la promesa resuelve false y el dialogo se cierra', async () => {
        const user = userEvent.setup();
        renderConProvider();

        await user.click(screen.getByText('Abrir confirmacion'));
        await user.click(screen.getByText('Cancelar'));

        expect(screen.getByText('Resultado: cancelado')).toBeInTheDocument();
        expect(screen.queryByText('Eliminar repuesto')).not.toBeInTheDocument();
    });

    test('useConfirm() fuera de un ConfirmProvider lanza un error claro', () => {
        // Silenciamos el console.error que React imprime para errores de render
        // durante esta prueba puntual, para no ensuciar la salida del test.
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        function Suelto() { useConfirm(); return null; }
        expect(() => render(<Suelto />)).toThrow('useConfirm debe usarse dentro de <ConfirmProvider>');
        spy.mockRestore();
    });
});
