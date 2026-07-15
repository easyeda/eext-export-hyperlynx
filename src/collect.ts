import type {
	ArcInfo,
	BoardData,
	BoardOutlineSegment,
	ComponentInfo,
	LayerInfo,
	PadExportInfo,
	PadStackEntry,
	TraceInfo,
	ViaInfo,
} from './types';
import {
	COPPER_LAYER_IDS,
	LAYER_BOARD_OUTLINE,
	LAYER_MULTI,
} from './types';
import {
	approximateArc,
	arraysEqual,
	normalizeAngle,
	parsePadDrill,
	parsePadShape,
} from './utils';

function isCopperLayer(layer: LayerInfo): boolean {
	return COPPER_LAYER_IDS.includes(layer.id);
}

function isThroughHolePadLayer(layerId: number): boolean {
	return layerId === LAYER_MULTI;
}

export async function collectBoardData(): Promise<BoardData> {
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
