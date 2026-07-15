export function mil2inch(mil: number): number {
	return mil / 1000.0;
}

export function fmt(value: number, decimals: number): string {
	return mil2inch(value).toFixed(decimals);
}

export function sanitizeLayerName(name: string): string {
	return name.replace(/[^\w.]/g, '_').substring(0, 20);
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

export function normalizeAngle(rotation: number): number {
	let angle = 180.0 - rotation;
	while (angle < 0.0) angle += 360.0;
	while (angle >= 360.0) angle -= 360.0;
	return angle;
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
