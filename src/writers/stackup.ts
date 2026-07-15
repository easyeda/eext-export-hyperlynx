import type { LayerInfo } from '../types';
import { sanitizeLayerName } from '../utils';

export function writeStackup(lines: string[], copperLayers: LayerInfo[]): void {
	lines.push('{STACKUP');
	const copperThicknessInch = 0.0014; // ~35um = 1.4mil
	const dielectricThicknessInch = 0.008; // ~0.2mm
	const resistivity = 1.724e-8;
	for (let i = 0; i < copperLayers.length; i++) {
		const layer = copperLayers[i];
		const layerName = sanitizeLayerName(layer.name);
		lines.push(`  (SIGNAL T=${copperThicknessInch.toFixed(6)} P=0.000000 C=${resistivity} L="${layerName}" M=COPPER)`);
		if (i < copperLayers.length - 1) {
			lines.push(`  (DIELECTRIC T=${dielectricThicknessInch.toFixed(6)} C=4.500000 L="DE_${layerName}" M="FR4")`);
		}
	}
	lines.push('}');
	lines.push('');
}
