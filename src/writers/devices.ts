import type { ComponentInfo, LayerInfo } from '../types';
import { sanitizeLayerName } from '../utils';

export function writeDevices(lines: string[], components: ComponentInfo[], copperLayers: LayerInfo[]): void {
	lines.push('{DEVICES');

	const fallbackLayer = copperLayers.length > 0 ? sanitizeLayerName(copperLayers[0].name) : 'Top Layer';

	for (const comp of components) {
		const layer = copperLayers.find(l => l.id === comp.layer);
		const layerName = layer ? sanitizeLayerName(layer.name) : fallbackLayer;
		const ref = comp.designator || 'EMPTY';
		lines.push(`  (? REF="${ref}" L="${layerName}")`);
	}

	lines.push('}');
	lines.push('');
}
