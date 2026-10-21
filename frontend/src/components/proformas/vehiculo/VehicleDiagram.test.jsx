import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VehicleDiagram from './VehicleDiagram';
import { SuvDiagram, PickupDiagram } from './index';

function Controlado({ inicial = [] }) {
    const [sel, setSel] = useState(inicial);
    const toggle = (z) => setSel(s => (s.includes(z) ? s.filter(x => x !== z) : [...s, z]));
    return (
        <>
            <SuvDiagram seleccion={sel} onToggle={toggle} />
            <output data-testid="sel">{sel.join(',')}</output>
        </>
    );
}

test('clic en una zona la marca y un segundo clic la desmarca (todas sus vistas a la vez)', () => {
    const { container } = render(<Controlado />);
    const parachoques = container.querySelectorAll('path[data-zona="parachoques_delantero"]');
    expect(parachoques.length).toBeGreaterThan(1); // lateral izq, superior, frente, lateral der
    fireEvent.click(parachoques[0]);
    expect(screen.getByTestId('sel').textContent).toBe('parachoques_delantero');
    container.querySelectorAll('path[data-zona="parachoques_delantero"]').forEach(p => expect(p.getAttribute('class')).toContain('danada'));
    fireEvent.click(parachoques[1]);
    expect(screen.getByTestId('sel').textContent).toBe('');
});

test('se puede marcar con teclado (Enter) y tiene etiqueta accesible', () => {
    render(<Controlado />);
    const puerta = screen.getAllByRole('button', { name: 'Puerta delantera izquierda' })[0];
    fireEvent.keyDown(puerta, { key: 'Enter' });
    expect(screen.getByTestId('sel').textContent).toBe('puerta_del_izq');
    expect(screen.getAllByRole('button', { name: 'Puerta delantera izquierda (dañada)' }).length).toBeGreaterThan(0);
});

test('modo solo lectura: sin onToggle no hay botones', () => {
    render(<VehicleDiagram tipo="sedan" seleccion={['maletero']} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
});

test('cada carroceria tiene sus zonas propias', () => {
    const { container } = render(<PickupDiagram puertas={4} seleccion={[]} onToggle={() => {}} />);
    expect(container.querySelector('path[data-zona="balde"]')).not.toBeNull();
    expect(container.querySelector('path[data-zona="maletero"]')).toBeNull();
});
