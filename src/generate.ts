import type { BoardData } from './types';
import type { NetObjects } from './writers/nets';
import { writeBoardOutline } from './writers/board';
import { writeDevices } from './writers/devices';
import { createNetObjects, writeNetObjects } from './writers/nets';
import { writePadStacks } from './writers/padstacks';
import { writeStackup } from './writers/stackup';

export function generateHypContent(data: BoardData, boardName: string): string {
	const { copperLayers, nets, components, vias, traces, arcs, padStacks, padExports, outlineSegments, pours, fills, regions } = data;
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

	// 按网络归组，未命名网络的对象单独归入 EmptyNet<N>。
	const byNet = new Map<string, NetObjects>();
	const orphans: NetObjects[] = [];

	const bucketOf = (net: string): NetObjects => {
		if (!net) {
			const fresh = createNetObjects();
			orphans.push(fresh);
			return fresh;
		}
		let bucket = byNet.get(net);
		if (!bucket) {
			bucket = createNetObjects();
			byNet.set(net, bucket);
		}
		return bucket;
	};

	for (const pin of padExports) bucketOf(pin.net).pins.push(pin);
	for (const via of vias) bucketOf(via.net).vias.push(via);
	for (const trace of traces) bucketOf(trace.net).traces.push(trace);
	for (const arc of arcs) bucketOf(arc.net).arcs.push(arc);
	for (const pour of pours) bucketOf(pour.net).pours.push(pour);
	for (const fill of fills) bucketOf(fill.net).fills.push(fill);
	for (const region of regions) bucketOf(region.net).regions.push(region);

	// POLYGON 的 ID 在整个文件内唯一，从 1 开始递增。
	let polyId = 1;

	const orderedNets = [...nets.filter(n => n && byNet.has(n))];
	for (const net of byNet.keys()) {
		if (!orderedNets.includes(net))
			orderedNets.push(net);
	}

	for (const netName of orderedNets) {
		polyId = writeNetObjects(lines, netName, byNet.get(netName)!, copperLayers, polyId);
	}

	let emptyNetIdx = 0;
	for (const bucket of orphans) {
		polyId = writeNetObjects(lines, `EmptyNet${emptyNetIdx++}`, bucket, copperLayers, polyId);
	}

	lines.push('{END}');
	return `${lines.join('\n')}\n`;
}
