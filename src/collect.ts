import type {
	ArcInfo,
	BoardData,
	BoardOutlineSegment,
	ComponentInfo,
	LayerInfo,
	PadExportInfo,
	PadStackEntry,
	PolygonFillInfo,
	PolygonSegment,
	PourPolygonInfo,
	PourSpoke,
	TraceInfo,
	ViaInfo,
} from './types';
import {
	COPPER_LAYER_IDS,
	copperStackIndex,
	LAYER_BOARD_OUTLINE,
	LAYER_MULTI,
} from './types';
import {
	approximateArc,
	arraysEqual,
	normalizeAngle,
	parsePadDrill,
	parsePadShape,
	parsePolygonSource,
	parsePolygonSourceSegments,
	POUR_UNIT_TO_MIL,
} from './utils';

function isThroughHolePadLayer(layerId: number, drill = 0): boolean {
	// 独立通孔焊盘可能不在 LAYER_MULTI 上，但只要带孔就按通孔处理。
	return layerId === LAYER_MULTI || drill > 0;
}

/**
 * 仅保留实际启用的铜层，并按物理层叠顺序（顶层 → 内层 → 底层）排列。
 */
async function collectCopperLayers(): Promise<LayerInfo[]> {
	const layers = await eda.pcb_Layer.getAllLayers();
	const copperLayers: LayerInfo[] = [];

	for (const l of layers) {
		const id = l.id as number;
		if (!COPPER_LAYER_IDS.includes(id))
			continue;
		// layerStatus 为 0 表示该层未启用，不应出现在层叠中。
		if ((l.layerStatus as number) === 0)
			continue;
		copperLayers.push({ id, name: l.name, type: l.type as string });
	}

	copperLayers.sort((a, b) => copperStackIndex(a.id) - copperStackIndex(b.id));
	return copperLayers;
}

/**
 * 板框可能以折线、直线或圆弧的形式存放在板框层，需要全部收集并离散为线段。
 */
async function collectOutlineSegments(): Promise<BoardOutlineSegment[]> {
	const segments: BoardOutlineSegment[] = [];

	const pushPoints = (points: Array<{ x: number; y: number }>): void => {
		if (points.length < 2)
			return;
		for (let i = 0; i < points.length - 1; i++) {
			segments.push({ x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y });
		}
		const first = points[0];
		const last = points[points.length - 1];
		if (first.x !== last.x || first.y !== last.y)
			segments.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y });
	};

	const polylines = await eda.pcb_PrimitivePolyline.getAll(undefined, LAYER_BOARD_OUTLINE);
	for (const pl of polylines) {
		const polygon = pl.getState_Polygon();
		if (polygon)
			pushPoints(parsePolygonSource(polygon.getSource()));
	}

	const lines = await eda.pcb_PrimitiveLine.getAll(undefined, LAYER_BOARD_OUTLINE);
	for (const line of lines) {
		segments.push({
			x1: line.getState_StartX(),
			y1: line.getState_StartY(),
			x2: line.getState_EndX(),
			y2: line.getState_EndY(),
		});
	}

	const arcs = await eda.pcb_PrimitiveArc.getAll(undefined, LAYER_BOARD_OUTLINE);
	for (const arc of arcs) {
		const points = approximateArc(
			arc.getState_StartX(),
			arc.getState_StartY(),
			arc.getState_EndX(),
			arc.getState_EndY(),
			arc.getState_ArcAngle(),
		);
		for (let i = 0; i < points.length - 1; i++) {
			segments.push({ x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y });
		}
	}

	return segments;
}

/**
 * 覆铜填充路径坐标单位为 0.01 inch，需换算到 mil；
 * 复杂多边形的首个子多边形为外轮廓，其余为挖空区域。
 */
async function collectPours(copperLayerIds: number[]): Promise<PourPolygonInfo[]> {
	const pours = await eda.pcb_PrimitivePour.getAll();
	const poured = await eda.pcb_PrimitivePoured.getAll();

	// 把「0.01 inch 单位」的源数组换算为 mil 的线段序列。
	function scale(src: Array<string | number>): PolygonSegment[] {
		return parsePolygonSourceSegments(src).map((seg) => {
			if (seg.type === 'line') {
				return {
					type: 'line' as const,
					x1: seg.x1 * POUR_UNIT_TO_MIL,
					y1: seg.y1 * POUR_UNIT_TO_MIL,
					x2: seg.x2 * POUR_UNIT_TO_MIL,
					y2: seg.y2 * POUR_UNIT_TO_MIL,
				};
			}
			return {
				type: 'arc' as const,
				x1: seg.x1 * POUR_UNIT_TO_MIL,
				y1: seg.y1 * POUR_UNIT_TO_MIL,
				x2: seg.x2 * POUR_UNIT_TO_MIL,
				y2: seg.y2 * POUR_UNIT_TO_MIL,
				cx: seg.cx * POUR_UNIT_TO_MIL,
				cy: seg.cy * POUR_UNIT_TO_MIL,
				radius: seg.radius * POUR_UNIT_TO_MIL,
				ccw: seg.ccw,
			};
		});
	}

	// 覆铜边框源为 mil 单位，直接解析。
	function parseBoundary(src: Array<string | number>): PolygonSegment[] {
		return parsePolygonSourceSegments(src);
	}

	const meta = new Map<string, { net: string; layer: number; boundary: PolygonSegment[] }>();
	for (const p of pours) {
		const raw = p.getState_ComplexPolygon().getSource();
		const src = Array.isArray(raw[0]) ? raw[0] : raw;
		meta.set(p.getState_PrimitiveId(), {
			net: p.getState_Net() || '',
			layer: p.getState_Layer() as number,
			boundary: parseBoundary(src),
		});
	}

	const result: PourPolygonInfo[] = [];
	for (const fillGroup of poured) {
		const info = meta.get(fillGroup.getState_PourPrimitiveId());
		if (!info || !copperLayerIds.includes(info.layer))
			continue;

		const fills = fillGroup.getState_PourFills();
		const spokes: PourSpoke[] = [];
		const mainFills: Array<{ outline: PolygonSegment[]; holes: PolygonSegment[][]; lineWidth: number }> = [];

		for (const fill of fills) {
			const rings = fill.path
				.getSourceStrictComplex()
				.map(scale);

			// EasyEDA 未给出宽度时，使用 HyperLynx 常见的 1 mil 轮廓线宽。
			const rawWidth = Number(fill.lineWidth) || 0;
			const lineWidth = rawWidth > 0 ? rawWidth * POUR_UNIT_TO_MIL : 1;

			// 热焊辐条是开放的 1 段线段（fill=false），需单独收集，否则会被按闭合环过滤丢弃。
			const closedRings = rings.filter(ring => ring.length >= 3);
			if (closedRings.length === 0) {
				for (const ring of rings) {
					for (const seg of ring) {
						// 辐条为直线；若出现圆弧则近似为直线段。
						if (seg.type === 'arc') {
							const pts = approximateArc(seg.x1, seg.y1, seg.x2, seg.y2, seg.ccw ? 1 : -1);
							for (let i = 0; i < pts.length - 1; i++) {
								spokes.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y, width: lineWidth });
							}
						}
						else {
							spokes.push({ x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, width: lineWidth });
						}
					}
				}
				continue;
			}

			mainFills.push({ outline: closedRings[0], holes: closedRings.slice(1), lineWidth });
		}

		for (const mf of mainFills) {
			result.push({
				net: info.net,
				layer: info.layer,
				lineWidth: mf.lineWidth,
				boundary: info.boundary,
				outline: mf.outline,
				holes: mf.holes,
				spokes,
			});
		}
	}

	return result;
}

function parsePolygonSourceToRings(src: Array<string | number>[]): PolygonSegment[][] {
	const rings: PolygonSegment[][] = [];
	for (const ringSrc of src) {
		const segs = parsePolygonSourceSegments(ringSrc);
		if (segs.length > 0)
			rings.push(segs);
	}
	return rings;
}

async function collectPolygonFills(copperLayerIds: number[]): Promise<PolygonFillInfo[]> {
	const allFills = await eda.pcb_PrimitiveFill.getAll();
	const result: PolygonFillInfo[] = [];
	for (const fill of allFills) {
		const layer = fill.getState_Layer() as number;
		if (!copperLayerIds.includes(layer))
			continue;
		const poly = fill.getState_ComplexPolygon();
		const src = poly.getSource();
		const sources = Array.isArray(src[0]) ? (src as Array<Array<string | number>>) : [src as Array<string | number>];
		const rings = parsePolygonSourceToRings(sources);
		if (rings.length === 0)
			continue;
		const rawWidth = Number(fill.getState_LineWidth()) || 0;
		result.push({
			net: fill.getState_Net() || '',
			layer,
			lineWidth: rawWidth,
			rings,
		});
	}
	return result;
}

async function collectPolygonRegions(copperLayerIds: number[]): Promise<PolygonFillInfo[]> {
	const allRegions = await eda.pcb_PrimitiveRegion.getAll();
	const result: PolygonFillInfo[] = [];
	for (const region of allRegions) {
		const layer = region.getState_Layer() as number;
		if (!copperLayerIds.includes(layer))
			continue;
		// PrimitiveRegion 在 EasyEDA 中用于禁止/约束区域，不应作为铜皮导出。
		// 只保留没有规则类型（即真正的铜皮区域）的极个别情况。
		const ruleType = (region as any).getState_RuleType?.() as number | number[] | undefined;
		const isKeepout = Array.isArray(ruleType)
			? ruleType.some(t => [2, 3, 5, 6, 7, 8, 9].includes(t))
			: typeof ruleType === 'number' && [2, 3, 5, 6, 7, 8, 9].includes(ruleType);
		if (isKeepout)
			continue;
		const poly = region.getState_ComplexPolygon();
		const src = poly.getSource();
		const sources = Array.isArray(src[0]) ? (src as Array<Array<string | number>>) : [src as Array<string | number>];
		const rings = parsePolygonSourceToRings(sources);
		if (rings.length === 0)
			continue;
		const rawWidth = Number(region.getState_LineWidth()) || 0;
		result.push({
			net: '',
			layer,
			lineWidth: rawWidth,
			rings,
		});
	}
	return result;
}

export async function collectBoardData(): Promise<BoardData> {
	const nets = await eda.pcb_Net.getAllNetsName();
	const allComponents = await eda.pcb_PrimitiveComponent.getAll();
	const allVias = await eda.pcb_PrimitiveVia.getAll();
	const allLines = await eda.pcb_PrimitiveLine.getAll();
	const allArcs = await eda.pcb_PrimitiveArc.getAll();
	const allPads = await eda.pcb_PrimitivePad.getAll();

	const copperLayers = await collectCopperLayers();
	const copperLayerIds = copperLayers.map(l => l.id);
	const outlineSegments = await collectOutlineSegments();
	const pours = await collectPours(copperLayerIds);
	const fills = await collectPolygonFills(copperLayerIds);
	const regions = await collectPolygonRegions(copperLayerIds);

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

	// 焊盘图元 ID 由「器件图元 ID + 器件内焊盘 ID」拼接而成，
	// 因此不能直接用器件内焊盘 ID 与焊盘图元 ID 比较。
	const padOwner = new Map<string, { ref: string; padNumber: string; net: string }>();
	for (const comp of components) {
		const ref = comp.designator || 'EMPTY';
		for (const cp of comp.pads) {
			padOwner.set(comp.primitiveId + cp.primitiveId, {
				ref,
				padNumber: cp.padNumber || '',
				net: cp.net || '',
			});
		}
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
		const { sx, sy, shapeId } = parsePadShape(pad.getState_Pad());
		const drill = parsePadDrill(pad.getState_Hole());
		const angle = normalizeAngle(pad.getState_Rotation() || 0);
		const layerId = pad.getState_Layer() as number;
		const isThrough = isThroughHolePadLayer(layerId, drill);
		const layers = isThrough ? copperLayerIds : [layerId];

		if (!isThrough && !copperLayerIds.includes(layerId))
			continue;

		const psId = findOrAddPadStack({ shapeId, sx, sy, angle, drill, layers, isThrough });

		const owner = padOwner.get(pad.getState_PrimitiveId());
		const padNumber = owner?.padNumber || pad.getState_PadNumber() || '1';

		padExports.push({
			x: pad.getState_X(),
			y: pad.getState_Y(),
			// 优先使用焊盘图元自身的网络，组件信息仅用于位号/编号。
			net: pad.getState_Net() || owner?.net || '',
			ref: owner?.ref || 'EMPTY',
			padNumber,
			padStackId: psId,
		});
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
		const layer = line.getState_Layer() as number;
		if (!copperLayerIds.includes(layer))
			continue;
		traces.push({
			primitiveId: line.getState_PrimitiveId(),
			net: line.getState_Net(),
			layer,
			startX: line.getState_StartX(),
			startY: line.getState_StartY(),
			endX: line.getState_EndX(),
			endY: line.getState_EndY(),
			width: line.getState_LineWidth(),
		});
	}

	const arcs: ArcInfo[] = [];
	for (const arc of allArcs) {
		const layer = arc.getState_Layer() as number;
		if (!copperLayerIds.includes(layer))
			continue;
		arcs.push({
			primitiveId: arc.getState_PrimitiveId(),
			net: arc.getState_Net(),
			layer,
			startX: arc.getState_StartX(),
			startY: arc.getState_StartY(),
			endX: arc.getState_EndX(),
			endY: arc.getState_EndY(),
			arcAngle: arc.getState_ArcAngle(),
			width: arc.getState_LineWidth(),
		});
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
		pours,
		fills,
		regions,
	};
}
