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
}

export const LAYER_TOP = 1;
export const LAYER_BOTTOM = 2;
export const LAYER_BOARD_OUTLINE = 11;
export const LAYER_MULTI = 12;

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
