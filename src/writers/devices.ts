import type { ComponentInfo, LayerInfo } from '../types';
import { sanitizeLayerName } from '../utils';

export function writeDevices(lines: string[], components: ComponentInfo[], copperLayers: LayerInfo[]): void {
	lines.push('{DEVICES');
	for (const comp of components) {
		const layerName = sanitizeLayerName(
			copperLayers.find(l => l.id === comp.layer)?.name || 'Top',
		);
		const ref = comp.designator || 'EMPTY';
		lines.push(`  (? REF="${ref}" L="${layerName}")`);
	}
	lines.push('}');
	lines.push('');
}
