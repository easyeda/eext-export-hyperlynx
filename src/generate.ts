import type { BoardData } from './types';
import { writeBoardOutline } from './writers/board';
import { writeDevices } from './writers/devices';
import { writeNetObject, writeNetObjects } from './writers/nets';
import { writePadStacks } from './writers/padstacks';
import { writeStackup } from './writers/stackup';

export function generateHypContent(data: BoardData, boardName: string): string {
	const { copperLayers, nets, components, vias, traces, arcs, padStacks, padExports, outlineSegments } = data;
	const lines: string[] = [];

	lines.push('{VERSION=2.14}');
	lines.push('{UNITS=ENGLISH LENGTH}');
	lines.push('');

	const allPrimitives: Array<{ x: number; y: number } | { startX: number; startY: number; endX: number; endY: number }> = [
		...components.map(c => ({ x: c.x, y: c.y })),
		...padExports.map(p => ({ x: p.x, y: p.y })),
		...vias.map(v => ({ x: v.x, y: v.y })),
		...traces.map(t => ({ startX: t.startX, startY: t.startY, endX: t.endX, endY: t.endY })),
		...arcs.map(a => ({ startX: a.startX, startY: a.startY, endX: a.endX, endY: a.endY })),
	];

	writeBoardOutline(lines, outlineSegments, allPrimitives, boardName);
	writeStackup(lines, copperLayers);
	writeDevices(lines, components, copperLayers);
	writePadStacks(lines, padStacks, copperLayers);

	for (const netName of nets) {
		if (!netName)
			continue;
		const netPins = padExports.filter(p => p.net === netName);
		const netVias = vias.filter(v => v.net === netName);
		const netTraces = traces.filter(t => t.net === netName);
		const netArcs = arcs.filter(a => a.net === netName);
		writeNetObjects(lines, netName, netPins, netVias, netTraces, netArcs, copperLayers);
	}

	// Export unconnected objects each in their own EmptyNet section.
	const nullPins = padExports.filter(p => !p.net);
	const nullVias = vias.filter(v => !v.net);
	const nullTraces = traces.filter(t => !t.net);
	const nullArcs = arcs.filter(a => !a.net);
	let emptyNetIdx = 0;
	for (const pin of nullPins) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, pin, null, null, null, copperLayers);
	}
	for (const via of nullVias) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, null, via, null, null, copperLayers);
	}
	for (const trace of nullTraces) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, null, null, trace, null, copperLayers);
	}
	for (const arc of nullArcs) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, null, null, null, arc, copperLayers);
	}

	lines.push('{END}');
	return lines.join('\n');
}
