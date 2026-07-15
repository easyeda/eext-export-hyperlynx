import type { ArcInfo, LayerInfo, PadExportInfo, TraceInfo, ViaInfo } from '../types';
import { computeArcCenter, fmt, sanitizeLayerName } from '../utils';

export function writeNetObjects(
	lines: string[],
	netName: string,
	pins: PadExportInfo[],
	vias: ViaInfo[],
	traces: TraceInfo[],
	arcs: ArcInfo[],
	copperLayers: LayerInfo[],
): void {
	if (pins.length === 0 && vias.length === 0 && traces.length === 0 && arcs.length === 0)
		return;

	lines.push(`{NET="${netName}"`);

	for (const pin of pins) {
		lines.push(`  (PIN X=${fmt(pin.x, 10)} Y=${fmt(-pin.y, 10)} R="${pin.ref}.${pin.padNumber}" P=${pin.padStackId})`);
	}

	for (const via of vias) {
		lines.push(`  (VIA X=${fmt(via.x, 10)} Y=${fmt(-via.y, 10)} P=${via.padStackId})`);
	}

	for (const trace of traces) {
		const layer = copperLayers.find(l => l.id === trace.layer);
		if (!layer)
			continue;
		const layerName = sanitizeLayerName(layer.name);
		lines.push(
			`  (SEG X1=${fmt(trace.startX, 10)} Y1=${fmt(-trace.startY, 10)} X2=${fmt(trace.endX, 10)} Y2=${fmt(-trace.endY, 10)} W=${fmt(trace.width, 10)} L="${layerName}")`,
		);
	}

	for (const arc of arcs) {
		const layer = copperLayers.find(l => l.id === arc.layer);
		if (!layer)
			continue;
		const layerName = sanitizeLayerName(layer.name);
		const { cx, cy, radius } = computeArcCenter(
			arc.startX,
			arc.startY,
			arc.endX,
			arc.endY,
			arc.arcAngle,
		);
		let x1 = arc.startX;
		let y1 = arc.startY;
		let x2 = arc.endX;
		let y2 = arc.endY;
		if (arc.arcAngle < 0) {
			[x1, y1, x2, y2] = [x2, y2, x1, y1];
		}
		lines.push(
			`  (ARC X1=${fmt(x1, 10)} Y1=${fmt(-y1, 10)} X2=${fmt(x2, 10)} Y2=${fmt(-y2, 10)} XC=${fmt(cx, 10)} YC=${fmt(-cy, 10)} R=${fmt(radius, 10)} W=${fmt(arc.width, 10)} L="${layerName}")`,
		);
	}

	lines.push('}');
	lines.push('');
}

export function writeNetObject(
	lines: string[],
	netName: string,
	pin: PadExportInfo | null,
	via: ViaInfo | null,
	trace: TraceInfo | null,
	arc: ArcInfo | null,
	copperLayers: LayerInfo[],
): void {
	writeNetObjects(
		lines,
		netName,
		pin ? [pin] : [],
		via ? [via] : [],
		trace ? [trace] : [],
		arc ? [arc] : [],
		copperLayers,
	);
}
