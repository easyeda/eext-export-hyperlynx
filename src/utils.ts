function mil2inch(mil: number): number {
	return mil / 1000.0;
}

/**
 * 覆铜填充路径的坐标单位为 0.01 inch，与其它图元的 mil 不一致，需换算。
 */
export const POUR_UNIT_TO_MIL = 10;

/**
 * 坐标与尺寸的输出精度。
 *
 * EasyEDA 的 mil 数值最多带 4 位小数（如 826.7717），换算为英寸需 7 位小数才不丢精度。
 */
const COORD_DECIMALS = 7;

/** 将 mil 数值格式化为英寸字符串。 */
export function coord(mil: number): string {
	return mil2inch(mil).toFixed(COORD_DECIMALS);
}

/**
 * HyperLynx 层名被双引号包裹，允许空格，仅需去掉引号并截断到 20 字符。
 */
export function sanitizeLayerName(name: string): string {
	return name.replace(/["\r\n]/g, '').trim().substring(0, 20);
}

export function arraysEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i])
			return false;
	}
	return true;
}

/**
 * 归一化焊盘旋转角到 [0, 360)。
 *
 * KiCad 用 `180 - angle` 是为了补偿其 Y 轴翻转；EasyEDA 数据层 Y 轴与 HyperLynx 同向，
 * 不做翻转，因此不能再做镜像换算，否则角度会与源数据不符。
 */
export function normalizeAngle(rotation: number): number {
	const angle = rotation % 360.0;
	return angle < 0.0 ? angle + 360.0 : angle;
}

export function parsePadShape(padShape: unknown): { sx: number; sy: number; shapeId: number } {
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

export function parsePadDrill(hole: unknown): number {
	if (!Array.isArray(hole) || hole.length < 2)
		return 0;
	return Number(hole[1]) || 0;
}

export function computeArcCenter(
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

export interface Point {
	x: number;
	y: number;
}

/**
 * 解析 EasyEDA 单多边形源数组为顶点序列，圆弧与贝塞尔曲线会被离散化。
 *
 * 源数组格式见 TPCB_PolygonSourceArray：支持 L / ARC / CARC / C 模式，
 * 以及 R（矩形，x,y 为左上点）与 CIRCLE 两种整体形状。
 */
export function parsePolygonSource(src: Array<string | number>, arcSteps = 16): Point[] {
	if (!Array.isArray(src) || src.length === 0)
		return [];

	const head = typeof src[0] === 'string' ? src[0].toUpperCase() : '';

	if (head === 'R') {
		const x = Number(src[1]);
		const y = Number(src[2]);
		const w = Number(src[3]);
		const h = Number(src[4]);
		const rotation = Number(src[5]) || 0;
		const corners: Point[] = [
			{ x, y },
			{ x: x + w, y },
			{ x: x + w, y: y - h },
			{ x, y: y - h },
		];
		if (!rotation)
			return corners;
		const cx = x + w / 2;
		const cy = y - h / 2;
		const rad = rotation * (Math.PI / 180.0);
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		return corners.map((p) => {
			const dx = p.x - cx;
			const dy = p.y - cy;
			return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
		});
	}

	if (head === 'CIRCLE') {
		const cx = Number(src[1]);
		const cy = Number(src[2]);
		const r = Number(src[3]);
		const steps = Math.max(arcSteps, 8) * 2;
		const pts: Point[] = [];
		for (let i = 0; i < steps; i++) {
			const a = (i / steps) * 2 * Math.PI;
			pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
		}
		return pts;
	}

	const pts: Point[] = [];
	let i = 0;
	if (typeof src[0] === 'number' && typeof src[1] === 'number') {
		pts.push({ x: Number(src[0]), y: Number(src[1]) });
		i = 2;
	}

	let mode = 'L';
	while (i < src.length) {
		const token = src[i];
		if (typeof token === 'string') {
			mode = token.toUpperCase();
			i++;
			continue;
		}

		const last = pts[pts.length - 1];

		if (mode === 'ARC' || mode === 'CARC') {
			const angle = Number(src[i]);
			const ex = Number(src[i + 1]);
			const ey = Number(src[i + 2]);
			i += 3;
			if (last) {
				const arcPts = approximateArc(last.x, last.y, ex, ey, angle, arcSteps);
				for (let k = 1; k < arcPts.length; k++)
					pts.push(arcPts[k]);
			}
			else {
				pts.push({ x: ex, y: ey });
			}
		}
		else if (mode === 'C') {
			const c1x = Number(src[i]);
			const c1y = Number(src[i + 1]);
			const c2x = Number(src[i + 2]);
			const c2y = Number(src[i + 3]);
			const ex = Number(src[i + 4]);
			const ey = Number(src[i + 5]);
			i += 6;
			if (last) {
				const steps = 8;
				for (let k = 1; k <= steps; k++) {
					const t = k / steps;
					const mt = 1 - t;
					pts.push({
						x: mt * mt * mt * last.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * ex,
						y: mt * mt * mt * last.y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ey,
					});
				}
			}
			else {
				pts.push({ x: ex, y: ey });
			}
		}
		else {
			pts.push({ x: Number(src[i]), y: Number(src[i + 1]) });
			i += 2;
		}
	}

	return pts;
}

export function approximateArc(
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
