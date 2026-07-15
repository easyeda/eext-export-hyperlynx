import type { LayerInfo, PadStackEntry } from '../types';
import { fmt, mil2inch, sanitizeLayerName } from '../utils';

export function writePadStacks(lines: string[], padStacks: PadStackEntry[], copperLayers: LayerInfo[]): void {
	for (const ps of padStacks) {
		lines.push(`{PADSTACK=${ps.id}, ${mil2inch(ps.drill).toFixed(9)}}`);
		const shape = `${ps.shapeId}, ${fmt(ps.sx, 9)}, ${fmt(ps.sy, 9)}, ${ps.angle.toFixed(1)}, M`;
		if (ps.isThrough) {
			lines.push(`  ("MDEF", ${shape})`);
		}
		else {
			for (const layerId of ps.layers) {
				const layer = copperLayers.find(l => l.id === layerId);
				if (layer) {
					const layerName = sanitizeLayerName(layer.name);
					lines.push(`  ("${layerName}", ${shape})`);
				}
			}
		}
		lines.push('}');
		lines.push('');
	}
}
