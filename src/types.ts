export interface LayerInfo {
	id: number;
	name: string;
	type: string;
}

export interface PadStackEntry {
	id: number;
	shapeId: number;
	sx: number;
	sy: number;
	angle: number;
	drill: number;
	layers: number[];
	isThrough: boolean;
}

export interface ComponentInfo {
	primitiveId: string;
	designator: string;
	name: string;
	x: number;
	y: number;
	rotation: number;
	layer: number;
	pads: Array<{ primitiveId: string; net: string; padNumber: string }>;
}

export interface ViaInfo {
	primitiveId: string;
	x: number;
	y: number;
	net: string;
	padStackId: number;
}

export interface PadExportInfo {
	x: number;
	y: number;
	net: string;
	ref: string;
	padNumber: string;
	padStackId: number;
}

export interface TraceInfo {
	primitiveId: string;
	net: string;
	layer: number;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	width: number;
}

export interface ArcInfo {
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

export interface BoardOutlineSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface LineSegment {
	type: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface ArcSegment {
	type: 'arc';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	cx: number;
	cy: number;
	radius: number;
	ccw: boolean;
}

export type PolygonSegment = LineSegment | ArcSegment;

/** 热焊辐条：连接焊盘与铜填充外轮廓的开放线段，单位 mil */
export interface PourSpoke {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	width: number;
}

export interface PourPolygonInfo {
	net: string;
	layer: number;
	lineWidth: number;
	/** 覆铜边框（T=POUR），单位 mil */
	boundary: PolygonSegment[];
	/** 铜填充外轮廓（T=COPPER），单位 mil */
	outline: PolygonSegment[];
	/** 铜填充挖空区域（POLYVOID），单位 mil */
	holes: PolygonSegment[][];
	/** 热焊辐条（输出为布线 SEG），单位 mil */
	spokes: PourSpoke[];
}

/** 实心铜填充 / 铜皮区域（PrimitiveFill / PrimitiveRegion），单位 mil */
export interface PolygonFillInfo {
	net: string;
	layer: number;
	lineWidth: number;
	/** 多边形环，第一个为外轮廓，其余为挖空 */
	rings: PolygonSegment[][];
}

export interface BoardData {
	copperLayers: LayerInfo[];
	nets: string[];
	components: ComponentInfo[];
	vias: ViaInfo[];
	traces: TraceInfo[];
	arcs: ArcInfo[];
	padStacks: PadStackEntry[];
	padExports: PadExportInfo[];
	outlineSegments: BoardOutlineSegment[];
	pours: PourPolygonInfo[];
	fills: PolygonFillInfo[];
	regions: PolygonFillInfo[];
}

export const LAYER_TOP = 1;
export const LAYER_BOTTOM = 2;
export const LAYER_BOARD_OUTLINE = 11;
export const LAYER_MULTI = 12;
export const LAYER_INNER_1 = 15;

/** 物理层叠顺序：顶层 → 内层 1..30 → 底层 */
export function copperStackIndex(layerId: number): number {
	if (layerId === LAYER_TOP)
		return 0;
	if (layerId === LAYER_BOTTOM)
		return Number.MAX_SAFE_INTEGER;
	return layerId - LAYER_INNER_1 + 1;
}

export const COPPER_LAYER_IDS = [
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
