import type { ArcInfo, LayerInfo, PadExportInfo, PourPolygonInfo, TraceInfo, ViaInfo } from '../types';
import { computeArcCenter, coord, sanitizeLayerName } from '../utils';

export interface NetObjects {
	pins: PadExportInfo[];
	vias: ViaInfo[];
	traces: TraceInfo[];
	arcs: ArcInfo[];
	pours: PourPolygonInfo[];
}

export function createNetObjects(): NetObjects {
	return { pins: [], vias: [], traces: [], arcs: [], pours: [] };
}

function isEmpty(objects: NetObjects): boolean {
	return objects.pins.length === 0
		&& objects.vias.length === 0
		&& objects.traces.length === 0
		&& objects.arcs.length === 0
		&& objects.pours.length === 0;
}

/**
 * 输出一个 {NET} 节，返回下一个可用的多边形 ID。
 */
export function writeNetObjects(
	lines: string[],
	netName: string,
	objects: NetObjects,
	copperLayers: LayerInfo[],
	polyId: number,
): number {
	if (isEmpty(objects))
		return polyId;

	const layerNameOf = (layerId: number): string | undefined => {
		const layer = copperLayers.find(l => l.id === layerId);
		return layer ? sanitizeLayerName(layer.name) : undefined;
	};

	lines.push(`{NET="${netName}"`);

	for (const pin of objects.pins) {
		lines.push(`  (PIN X=${coord(pin.x)} Y=${coord(pin.y)} R="${pin.ref}.${pin.padNumber}" P=${pin.padStackId})`);
	}

	for (const via of objects.vias) {
		lines.push(`  (VIA X=${coord(via.x)} Y=${coord(via.y)} P=${via.padStackId})`);
	}

	for (const trace of objects.traces) {
		const layerName = layerNameOf(trace.layer);
		if (!layerName)
			continue;
		lines.push(
			`  (SEG X1=${coord(trace.startX)} Y1=${coord(trace.startY)} X2=${coord(trace.endX)} Y2=${coord(trace.endY)} W=${coord(trace.width)} L="${layerName}")`,
		);
	}

	for (const arc of objects.arcs) {
		const layerName = layerNameOf(arc.layer);
		if (!layerName)
			continue;
		const { cx, cy, radius } = computeArcCenter(arc.startX, arc.startY, arc.endX, arc.endY, arc.arcAngle);
		let x1 = arc.startX;
		let y1 = arc.startY;
		let x2 = arc.endX;
		let y2 = arc.endY;
		// HyperLynx 约定圆弧按逆时针从起点到终点，顺时针弧需交换端点。
		if (arc.arcAngle < 0) {
			[x1, y1, x2, y2] = [x2, y2, x1, y1];
		}
		lines.push(
			`  (ARC X1=${coord(x1)} Y1=${coord(y1)} X2=${coord(x2)} Y2=${coord(y2)} XC=${coord(cx)} YC=${coord(cy)} R=${coord(radius)} W=${coord(arc.width)} L="${layerName}")`,
		);
	}

	let nextPolyId = polyId;
	for (const pour of objects.pours) {
		const layerName = layerNameOf(pour.layer);
		if (!layerName)
			continue;

		const ring = pour.outline;
		const head = ring[0];
		lines.push(
			`  {POLYGON T=POUR L="${layerName}" W=${coord(pour.lineWidth)} ID=${nextPolyId} X=${coord(head.x)} Y=${coord(head.y)}`,
		);
		for (const pt of ring) {
			lines.push(`    (LINE X=${coord(pt.x)} Y=${coord(pt.y)})`);
		}
		lines.push(`    (LINE X=${coord(head.x)} Y=${coord(head.y)})`);
		lines.push('  }');

		for (const hole of pour.holes) {
			const hHead = hole[0];
			lines.push(`  {POLYVOID ID=${nextPolyId} X=${coord(hHead.x)} Y=${coord(hHead.y)}`);
			for (const pt of hole) {
				lines.push(`    (LINE X=${coord(pt.x)} Y=${coord(pt.y)})`);
			}
			lines.push(`    (LINE X=${coord(hHead.x)} Y=${coord(hHead.y)})`);
			lines.push('  }');
		}

		nextPolyId++;
	}

	lines.push('}');
	lines.push('');

	return nextPolyId;
}
