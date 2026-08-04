import type { LayerInfo, PadStackEntry } from '../types';
import { coord, sanitizeLayerName } from '../utils';

export function writePadStacks(lines: string[], padStacks: PadStackEntry[], copperLayers: LayerInfo[]): void {
	for (const ps of padStacks) {
		const shape = `${ps.shapeId}, ${coord(ps.sx)}, ${coord(ps.sy)}, ${ps.angle.toFixed(1)}, M`;
		const layerNames: string[] = [];

		if (ps.isThrough) {
			// 通孔焊盘覆盖所有铜层，使用 MDEF 占位符。
			layerNames.push('MDEF');
		}
		else {
			for (const layerId of ps.layers) {
				const layer = copperLayers.find(l => l.id === layerId);
				if (layer)
					layerNames.push(sanitizeLayerName(layer.name));
			}
		}

		if (layerNames.length === 0)
			continue;

		lines.push(`{PADSTACK=${ps.id}, ${coord(ps.drill)}`);
		for (const name of layerNames) {
			lines.push(`  ("${name}", ${shape})`);
		}
		lines.push('}');
		lines.push('');
	}
}
