import type { ArcInfo, LayerInfo, PadExportInfo, PolygonSegment, PourPolygonInfo, TraceInfo, ViaInfo } from '../types';
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

		function writeRing(segments: PolygonSegment[], isHole: boolean): void {
			if (segments.length === 0)
				return;
			const head = segments[0];
			if (isHole) {
				lines.push(`  {POLYVOID ID=${nextPolyId} X=${coord(head.x1)} Y=${coord(head.y1)}`);
			}
			else {
				lines.push(
					`  {POLYGON T=POUR L="${layerName}" W=${coord(pour.lineWidth)} ID=${nextPolyId} X=${coord(head.x1)} Y=${coord(head.y1)}`,
				);
			}

			for (const seg of segments) {
				if (seg.type === 'arc') {
					lines.push(
						`    (CURVE X1=${coord(seg.x1)} Y1=${coord(seg.y1)} X2=${coord(seg.x2)} Y2=${coord(seg.y2)} XC=${coord(seg.cx)} YC=${coord(seg.cy)} R=${coord(seg.radius)})`,
					);
				}
				else {
					lines.push(`    (LINE X=${coord(seg.x2)} Y=${coord(seg.y2)})`);
				}
			}

			// Close the ring if it isn't already.
			const tail = segments[segments.length - 1];
			const closed = Math.abs(tail.x2 - head.x1) < 1e-9 && Math.abs(tail.y2 - head.y1) < 1e-9;
			if (!closed)
				lines.push(`    (LINE X=${coord(head.x1)} Y=${coord(head.y1)})`);

			lines.push('  }');
		}

		writeRing(pour.outline, false);
		for (const hole of pour.holes)
			writeRing(hole, true);

		nextPolyId++;
	}

	lines.push('}');
	lines.push('');

	return nextPolyId;
}
