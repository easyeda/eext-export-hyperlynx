import type { BoardOutlineSegment } from '../types';
import { fmt } from '../utils';

type PrimitivePoint = { x: number; y: number } | { startX: number; startY: number; endX: number; endY: number };

export function writeBoardOutline(
	lines: string[],
	outlineSegments: BoardOutlineSegment[],
	allPrimitives: PrimitivePoint[],
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
