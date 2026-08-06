import type { ArcInfo, LayerInfo, PadExportInfo, PolygonFillInfo, PolygonSegment, PourPolygonInfo, TraceInfo, ViaInfo } from '../types';
import { computeArcCenter, coord, sanitizeLayerName } from '../utils';

export interface NetObjects {
	pins: PadExportInfo[];
	vias: ViaInfo[];
	traces: TraceInfo[];
	arcs: ArcInfo[];
	pours: PourPolygonInfo[];
	fills: PolygonFillInfo[];
	regions: PolygonFillInfo[];
}

export function createNetObjects(): NetObjects {
	return { pins: [], vias: [], traces: [], arcs: [], pours: [], fills: [], regions: [] };
}

function isEmpty(objects: NetObjects): boolean {
	return objects.pins.length === 0
		&& objects.vias.length === 0
		&& objects.traces.length === 0
		&& objects.arcs.length === 0
		&& objects.pours.length === 0
		&& objects.fills.length === 0
		&& objects.regions.length === 0;
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
		// 将角度归一化到 [-180, 180]，保证导出的是小圆弧。
		let arcAngle = arc.arcAngle;
		if (arcAngle > 180)
			arcAngle -= 360;
		if (arcAngle < -180)
			arcAngle += 360;
		const { cx, cy, radius, ccw } = computeArcCenter(arc.startX, arc.startY, arc.endX, arc.endY, arcAngle);
		// HyperLynx 的 ARC 没有方向标志，实测其方向为顺时针；如果源圆弧为逆时针，
		// 需要交换起点与终点，否则会在 HyperLynx 中显示为大圆弧或开口反向。
		const [x1, y1, x2, y2] = ccw
			? [arc.endX, arc.endY, arc.startX, arc.startY]
			: [arc.startX, arc.startY, arc.endX, arc.endY];
		lines.push(
			`  (ARC X1=${coord(x1)} Y1=${coord(y1)} X2=${coord(x2)} Y2=${coord(y2)} XC=${coord(cx)} YC=${coord(cy)} R=${coord(radius)} W=${coord(arc.width)} L="${layerName}")`,
		);
	}

	function curveLine(seg: PolygonSegment): string {
		// HyperLynx CURVE 的方向实测为逆时针；若源圆弧为顺时针，交换起止点。
		const x1 = seg.ccw ? seg.x1 : seg.x2;
		const y1 = seg.ccw ? seg.y1 : seg.y2;
		const x2 = seg.ccw ? seg.x2 : seg.x1;
		const y2 = seg.ccw ? seg.y2 : seg.y1;
		return `    (CURVE X1=${coord(x1)} Y1=${coord(y1)} X2=${coord(x2)} Y2=${coord(y2)} XC=${coord(seg.cx)} YC=${coord(seg.cy)} R=${coord(seg.radius)})`;
	}

	let nextPolyId = polyId;
	for (const pour of objects.pours) {
		const layerName = layerNameOf(pour.layer);
		if (!layerName)
			continue;

		function writeRing(segments: PolygonSegment[], type: 'pour' | 'copper' | 'hole', width: number, id: number): void {
			if (segments.length === 0)
				return;
			const head = segments[0];
			if (type === 'hole') {
				lines.push(`  {POLYVOID ID=${id} X=${coord(head.x1)} Y=${coord(head.y1)}`);
			}
			else {
				const tag = type === 'pour' ? 'POUR' : 'COPPER';
				lines.push(
					`  {POLYGON T=${tag} L="${layerName}" W=${coord(width)} ID=${id} X=${coord(head.x1)} Y=${coord(head.y1)}`,
				);
			}

			for (const seg of segments) {
				if (seg.type === 'arc') {
					lines.push(curveLine(seg));
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

		// 覆铜边框输出为布线线段（包边），实际铜填充输出为 T=COPPER，挖空区域输出为 POLYVOID。
		for (const seg of pour.boundary) {
			if (seg.type === 'arc') {
				const [x1, y1, x2, y2] = seg.ccw
					? [seg.x2, seg.y2, seg.x1, seg.y1]
					: [seg.x1, seg.y1, seg.x2, seg.y2];
				lines.push(`  (ARC X1=${coord(x1)} Y1=${coord(y1)} X2=${coord(x2)} Y2=${coord(y2)} XC=${coord(seg.cx)} YC=${coord(seg.cy)} R=${coord(seg.radius)} W=${coord(pour.lineWidth)} L="${layerName}")`);
			}
			else {
				lines.push(`  (SEG X1=${coord(seg.x1)} Y1=${coord(seg.y1)} X2=${coord(seg.x2)} Y2=${coord(seg.y2)} W=${coord(pour.lineWidth)} L="${layerName}")`);
			}
		}
		const copperId = nextPolyId++;
		writeRing(pour.outline, 'copper', 0, copperId);
		for (const hole of pour.holes)
			writeRing(hole, 'hole', 0, copperId);

		// 热焊辐条输出为布线段，与走线一致。
		for (const spoke of pour.spokes) {
			lines.push(
				`  (SEG X1=${coord(spoke.x1)} Y1=${coord(spoke.y1)} X2=${coord(spoke.x2)} Y2=${coord(spoke.y2)} W=${coord(spoke.width)} L="${layerName}")`,
			);
		}
	}

	// 实心铜填充 / 铜皮区域输出为 COPPER + POLYVOID。
	for (const fill of [...objects.fills, ...objects.regions]) {
		const layerName = layerNameOf(fill.layer);
		if (!layerName)
			continue;

		function writeRing(segments: PolygonSegment[], type: 'copper' | 'hole', id: number, width: number): void {
			if (segments.length === 0)
				return;
			const head = segments[0];
			if (type === 'hole') {
				lines.push(`  {POLYVOID ID=${id} X=${coord(head.x1)} Y=${coord(head.y1)}`);
			}
			else {
				lines.push(
					`  {POLYGON T=COPPER L="${layerName}" W=${coord(width)} ID=${id} X=${coord(head.x1)} Y=${coord(head.y1)}`,
				);
			}

			for (const seg of segments) {
				if (seg.type === 'arc') {
					lines.push(curveLine(seg));
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

		const fillId = nextPolyId++;
		let first = true;
		for (const ring of fill.rings) {
			writeRing(ring, first ? 'copper' : 'hole', fillId, first ? fill.lineWidth : 0);
			first = false;
		}
	}

	lines.push('}');
	lines.push('');

	return nextPolyId;
}
