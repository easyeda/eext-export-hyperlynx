import * as extensionConfig from '../extension.json';

export function activate(_status?: 'onStartupFinished', _arg?: string): void {}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		`Export HyperLynx v${extensionConfig.version}\n\n${
			eda.sys_I18n.text('Export PCB to HyperLynx format')}`,
		eda.sys_I18n.text('About'),
	);
}

// EasyEDA PCB unit is 1mil. HyperLynx uses inches.
function mil2inch(mil: number): number {
	return mil / 1000.0;
}

function fmt(value: number, decimals: number): string {
	return mil2inch(value).toFixed(decimals);
}

function sanitizeLayerName(name: string): string {
	return name.replace(/[^\w.]/g, '_').substring(0, 20);
}

interface LayerInfo {
	id: number;
	name: string;
	type: string;
}

interface PadStackEntry {
	id: number;
	shapeId: number;
	sx: number;
	sy: number;
	angle: number;
	drill: number;
	layers: number[];
	isThrough: boolean;
}

interface ComponentInfo {
	primitiveId: string;
	designator: string;
	name: string;
	x: number;
	y: number;
	rotation: number;
	layer: number;
	pads: Array<{ primitiveId: string; net: string; padNumber: string }>;
}

interface ViaInfo {
	primitiveId: string;
	x: number;
	y: number;
	net: string;
	padStackId: number;
}

interface PadExportInfo {
	x: number;
	y: number;
	net: string;
	ref: string;
	padNumber: string;
	padStackId: number;
}

interface TraceInfo {
	primitiveId: string;
	net: string;
	layer: number;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	width: number;
}

interface ArcInfo {
	primitiveId: string;
	net: string;
	layer: number;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	arcAngle: number;
	width: number;
}

interface BoardOutlineSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

const LAYER_TOP = 1;
const LAYER_BOTTOM = 2;
const LAYER_BOARD_OUTLINE = 11;
const LAYER_MULTI = 12;
const COPPER_LAYER_IDS = [
	LAYER_TOP,
	LAYER_BOTTOM,
	15,
	16,
	17,
	18,
	19,
	20,
	21,
	22,
	23,
	24,
	25,
	26,
	27,
	28,
	29,
	30,
	31,
	32,
	33,
	34,
	35,
	36,
	37,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
];

function isCopperLayer(layer: LayerInfo): boolean {
	return COPPER_LAYER_IDS.includes(layer.id);
}

function isThroughHolePadLayer(layerId: number): boolean {
	return layerId === LAYER_MULTI;
}

function arraysEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i])
			return false;
	}
	return true;
}

function normalizeAngle(rotation: number): number {
	let angle = 180.0 - rotation;
	while (angle < 0.0) angle += 360.0;
	while (angle >= 360.0) angle -= 360.0;
	return angle;
}

function parsePadShape(padShape: unknown): { sx: number; sy: number; shapeId: number } {
	if (!Array.isArray(padShape) || padShape.length < 3) {
		return { sx: 0, sy: 0, shapeId: 0 };
	}

	const shapeType = String(padShape[0]).toUpperCase();
	let sx = Number(padShape[1]) || 0;
	let sy = Number(padShape[2]) || 0;
	let shapeId = 0;

	switch (shapeType) {
		case 'ELLIPSE':
		case 'OVAL':
			shapeId = 0;
			break;
		case 'RECT':
		case 'RECTANGLE': {
			const round = Number(padShape[3]) || 0;
			shapeId = round > 0 ? 2 : 1;
			break;
		}
		case 'NGON':
		case 'REGULAR_POLYGON':
			// Approximate polygon pads as oval/circular.
			shapeId = 0;
			sx = sy = Math.max(sx, sy);
			break;
		default:
			shapeId = 0;
	}

	return { sx, sy, shapeId };
}

function parsePadDrill(hole: unknown): number {
	if (!Array.isArray(hole) || hole.length < 2)
		return 0;
	return Number(hole[1]) || 0;
}

function computeArcCenter(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	arcAngle: number,
): { cx: number; cy: number; radius: number; ccw: boolean } {
	const dx = endX - startX;
	const dy = endY - startY;
	const chord = Math.hypot(dx, dy);
	const angleRad = Math.abs(arcAngle) * (Math.PI / 180.0);

	if (chord === 0 || angleRad === 0 || Math.sin(angleRad / 2) === 0) {
		return { cx: (startX + endX) / 2, cy: (startY + endY) / 2, radius: 0, ccw: arcAngle >= 0 };
	}

	const radius = chord / (2 * Math.sin(angleRad / 2));
	const midX = (startX + endX) / 2;
	const midY = (startY + endY) / 2;
	const h = radius * Math.cos(angleRad / 2);
	const nx = -dy / chord;
	const ny = dx / chord;

	const ccw = arcAngle >= 0;
	const sign = ccw ? 1 : -1;
	return {
		cx: midX + sign * nx * h,
		cy: midY + sign * ny * h,
		radius,
		ccw,
	};
}

function approximateArc(
	startX: number,
	startY: number,
	endX: number,
	endY: number,
	arcAngle: number,
	steps = 16,
): Array<{ x: number; y: number }> {
	const { cx, cy, radius, ccw } = computeArcCenter(startX, startY, endX, endY, arcAngle);
	if (radius === 0) {
		return [{ x: startX, y: startY }, { x: endX, y: endY }];
	}

	const startAngle = Math.atan2(startY - cy, startX - cx);
	const endAngle = Math.atan2(endY - cy, endX - cx);
	let sweep = endAngle - startAngle;

	if (ccw && sweep < 0)
		sweep += 2 * Math.PI;
	if (!ccw && sweep > 0)
		sweep -= 2 * Math.PI;

	const points: Array<{ x: number; y: number }> = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const angle = startAngle + sweep * t;
		points.push({
			x: cx + radius * Math.cos(angle),
			y: cy + radius * Math.sin(angle),
		});
	}
	return points;
}

async function collectBoardData() {
	const layers = await eda.pcb_Layer.getAllLayers();
	const nets = await eda.pcb_Net.getAllNetsName();
	const allComponents = await eda.pcb_PrimitiveComponent.getAll();
	const allVias = await eda.pcb_PrimitiveVia.getAll();
	const allLines = await eda.pcb_PrimitiveLine.getAll();
	const allArcs = await eda.pcb_PrimitiveArc.getAll();
	const allPads = await eda.pcb_PrimitivePad.getAll();
	const outlineLines = await eda.pcb_PrimitiveLine.getAll(undefined, LAYER_BOARD_OUTLINE);
	const outlineArcs = await eda.pcb_PrimitiveArc.getAll(undefined, LAYER_BOARD_OUTLINE);

	const copperLayers: LayerInfo[] = [];
	for (const l of layers) {
		const info: LayerInfo = {
			id: l.id as number,
			name: l.name,
			type: l.type as string,
		};
		if (isCopperLayer(info)) {
			copperLayers.push(info);
		}
	}
	copperLayers.sort((a, b) => a.id - b.id);
	const copperLayerIds = copperLayers.map(l => l.id);

	const components: ComponentInfo[] = [];
	for (const comp of allComponents) {
		components.push({
			primitiveId: comp.getState_PrimitiveId(),
			designator: comp.getState_Designator() || '',
			name: comp.getState_Name() || 'Unknown',
			x: comp.getState_X(),
			y: comp.getState_Y(),
			rotation: comp.getState_Rotation(),
			layer: comp.getState_Layer() as number,
			pads: comp.getState_Pads() || [],
		});
	}

	const padStacks: PadStackEntry[] = [];
	const padExports: PadExportInfo[] = [];

	function findOrAddPadStack(entry: Omit<PadStackEntry, 'id'>): number {
		for (const ps of padStacks) {
			if (ps.shapeId === entry.shapeId
				&& ps.sx === entry.sx && ps.sy === entry.sy
				&& ps.drill === entry.drill && ps.angle === entry.angle
				&& ps.isThrough === entry.isThrough
				&& arraysEqual(ps.layers, entry.layers)) {
				return ps.id;
			}
		}
		const id = padStacks.length;
		padStacks.push({ ...entry, id });
		return id;
	}

	for (const pad of allPads) {
		const padShape = pad.getState_Pad();
		const { sx, sy, shapeId } = parsePadShape(padShape);
		const drill = parsePadDrill(pad.getState_Hole());
		const rotation = pad.getState_Rotation() || 0;
		const angle = normalizeAngle(rotation);
		const layerId = pad.getState_Layer() as number;
		const isThrough = isThroughHolePadLayer(layerId);
		const layers = isThrough ? copperLayerIds : [layerId];

		const psId = findOrAddPadStack({
			shapeId,
			sx,
			sy,
			angle,
			drill,
			layers,
			isThrough,
		});

		const net = pad.getState_Net() || '';
		const parentId = (pad as any).getState_ParentPrimitiveId?.() || '';
		let ref = '';
		let padNumber = pad.getState_PadNumber() || '1';

		for (const comp of components) {
			const matchPad = comp.pads.find(p => p.primitiveId === pad.getState_PrimitiveId());
			if (matchPad) {
				ref = comp.designator || 'EMPTY';
				padNumber = matchPad.padNumber || padNumber;
				break;
			}
		}

		if (!ref && parentId) {
			const parentComp = components.find(c => c.primitiveId === parentId);
			if (parentComp)
				ref = parentComp.designator || 'EMPTY';
		}

		if (ref) {
			padExports.push({
				x: pad.getState_X(),
				y: pad.getState_Y(),
				net,
				ref,
				padNumber,
				padStackId: psId,
			});
		}
	}

	const vias: ViaInfo[] = [];
	for (const via of allVias) {
		const diameter = via.getState_Diameter();
		const holeDiameter = via.getState_HoleDiameter();
		const psId = findOrAddPadStack({
			shapeId: 0,
			sx: diameter,
			sy: diameter,
			angle: 0,
			drill: holeDiameter,
			layers: copperLayerIds,
			isThrough: true,
		});
		vias.push({
			primitiveId: via.getState_PrimitiveId(),
			x: via.getState_X(),
			y: via.getState_Y(),
			net: via.getState_Net(),
			padStackId: psId,
		});
	}

	const traces: TraceInfo[] = [];
	for (const line of allLines) {
		traces.push({
			primitiveId: line.getState_PrimitiveId(),
			net: line.getState_Net(),
			layer: line.getState_Layer() as number,
			startX: line.getState_StartX(),
			startY: line.getState_StartY(),
			endX: line.getState_EndX(),
			endY: line.getState_EndY(),
			width: line.getState_LineWidth(),
		});
	}

	const arcs: ArcInfo[] = [];
	for (const arc of allArcs) {
		arcs.push({
			primitiveId: arc.getState_PrimitiveId(),
			net: arc.getState_Net(),
			layer: arc.getState_Layer() as number,
			startX: arc.getState_StartX(),
			startY: arc.getState_StartY(),
			endX: arc.getState_EndX(),
			endY: arc.getState_EndY(),
			arcAngle: arc.getState_ArcAngle(),
			width: arc.getState_LineWidth(),
		});
	}

	// Collect board outline from layer 11; arcs are polygonized into segments.
	const outlineSegments: BoardOutlineSegment[] = [];
	for (const line of outlineLines) {
		outlineSegments.push({
			x1: line.getState_StartX(),
			y1: line.getState_StartY(),
			x2: line.getState_EndX(),
			y2: line.getState_EndY(),
		});
	}
	for (const arc of outlineArcs) {
		const points = approximateArc(
			arc.getState_StartX(),
			arc.getState_StartY(),
			arc.getState_EndX(),
			arc.getState_EndY(),
			arc.getState_ArcAngle(),
		);
		for (let i = 0; i < points.length - 1; i++) {
			outlineSegments.push({
				x1: points[i].x,
				y1: points[i].y,
				x2: points[i + 1].x,
				y2: points[i + 1].y,
			});
		}
	}

	return {
		copperLayers,
		nets,
		components,
		vias,
		traces,
		arcs,
		padStacks,
		padExports,
		outlineSegments,
	};
}

function writeBoardOutline(
	lines: string[],
	outlineSegments: BoardOutlineSegment[],
	allPrimitives: Array<{ x: number; y: number } | { startX: number; startY: number; endX: number; endY: number }>,
	boardName: string,
): void {
	lines.push(`{BOARD "${boardName}"`);

	if (outlineSegments.length > 0) {
		for (const seg of outlineSegments) {
			lines.push(
				`  (PERIMETER_SEGMENT X1=${fmt(seg.x1, 9)} Y1=${fmt(-seg.y1, 9)} X2=${fmt(seg.x2, 9)} Y2=${fmt(-seg.y2, 9)})`,
			);
		}
	}
	else {
		// Fallback: use a bounding box expanded by a margin.
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of allPrimitives) {
			if ('x' in p) {
				minX = Math.min(minX, p.x);
				minY = Math.min(minY, p.y);
				maxX = Math.max(maxX, p.x);
				maxY = Math.max(maxY, p.y);
			}
			else {
				minX = Math.min(minX, p.startX, p.endX);
				minY = Math.min(minY, p.startY, p.endY);
				maxX = Math.max(maxX, p.startX, p.endX);
				maxY = Math.max(maxY, p.startY, p.endY);
			}
		}
		if (!Number.isFinite(minX)) {
			minX = 0;
			minY = 0;
			maxX = 4000;
			maxY = 3000;
		}
		const margin = 200;
		const x1 = minX - margin;
		const y1 = minY - margin;
		const x2 = maxX + margin;
		const y2 = maxY + margin;
		lines.push(`  (PERIMETER_SEGMENT X1=${fmt(x1, 9)} Y1=${fmt(-y1, 9)} X2=${fmt(x2, 9)} Y2=${fmt(-y1, 9)})`);
		lines.push(`  (PERIMETER_SEGMENT X1=${fmt(x2, 9)} Y1=${fmt(-y1, 9)} X2=${fmt(x2, 9)} Y2=${fmt(-y2, 9)})`);
		lines.push(`  (PERIMETER_SEGMENT X1=${fmt(x2, 9)} Y1=${fmt(-y2, 9)} X2=${fmt(x1, 9)} Y2=${fmt(-y2, 9)})`);
		lines.push(`  (PERIMETER_SEGMENT X1=${fmt(x1, 9)} Y1=${fmt(-y2, 9)} X2=${fmt(x1, 9)} Y2=${fmt(-y1, 9)})`);
	}

	lines.push('}');
	lines.push('');
}

function writeStackup(lines: string[], copperLayers: LayerInfo[]): void {
	lines.push('{STACKUP');
	const copperThicknessInch = 0.0014; // ~35um = 1.4mil
	const dielectricThicknessInch = 0.008; // ~0.2mm
	const resistivity = 1.724e-8;
	for (let i = 0; i < copperLayers.length; i++) {
		const layer = copperLayers[i];
		const layerName = sanitizeLayerName(layer.name);
		lines.push(`  (SIGNAL T=${copperThicknessInch.toFixed(6)} P=0.000000 C=${resistivity} L="${layerName}" M=COPPER)`);
		if (i < copperLayers.length - 1) {
			lines.push(`  (DIELECTRIC T=${dielectricThicknessInch.toFixed(6)} C=4.500000 L="DE_${layerName}" M="FR4")`);
		}
	}
	lines.push('}');
	lines.push('');
}

function writeDevices(lines: string[], components: ComponentInfo[], copperLayers: LayerInfo[]): void {
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

function writePadStacks(lines: string[], padStacks: PadStackEntry[], copperLayers: LayerInfo[]): void {
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

function writeNetObjects(
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

function generateHypContent(
	data: Awaited<ReturnType<typeof collectBoardData>>,
	boardName: string,
): string {
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
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, pin, [], [], [], copperLayers);
	}
	for (const via of nullVias) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, [], [via], [], [], copperLayers);
	}
	for (const trace of nullTraces) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, [], [], [trace], [], copperLayers);
	}
	for (const arc of nullArcs) {
		writeNetObject(lines, `EmptyNet${emptyNetIdx++}`, [], [], [], [arc], copperLayers);
	}

	lines.push('{END}');
	return lines.join('\n');
}

// Helper to write a single object into its own NET section (for null nets).
function writeNetObject(
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

export async function exportHyperLynx(): Promise<void> {
	try {
		const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
		if (!doc || doc.documentType !== 3 /* EDMT_EditorDocumentType.PCB */) {
			eda.sys_Dialog.showInformationMessage(
				eda.sys_I18n.text('Please open a PCB document first'),
				eda.sys_I18n.text('Export HyperLynx'),
			);
			return;
		}

		eda.sys_Message.showToastMessage(eda.sys_I18n.text('Collecting PCB data...'));

		const data = await collectBoardData();
		const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
		const projectName = (projectInfo as any)?.friendlyName || (projectInfo as any)?.name || 'board';
		const hypContent = generateHypContent(data, projectName);
		const fileName = `${projectName}.hyp`;

		const blob = new Blob([hypContent], { type: 'application/octet-stream' });
		await eda.sys_FileSystem.saveFile(blob, fileName);

		eda.sys_Message.showToastMessage(eda.sys_I18n.text('HyperLynx export completed'));
	}
	catch (err: any) {
		eda.sys_Dialog.showInformationMessage(
			`${eda.sys_I18n.text('Export failed')}: ${err?.message || err}`,
			eda.sys_I18n.text('Export HyperLynx'),
		);
	}
}
