import type { BoardOutlineSegment } from '../types';
import { coord } from '../utils';

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
				`  (PERIMETER_SEGMENT X1=${coord(seg.x1)} Y1=${coord(seg.y1)} X2=${coord(seg.x2)} Y2=${coord(seg.y2)})`,
			);
		}
	}
	else {
		// 板框层为空时退化为图元包围盒，保证文件仍可被读取。
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
		lines.push(`  (PERIMETER_SEGMENT X1=${coord(x1)} Y1=${coord(y1)} X2=${coord(x2)} Y2=${coord(y1)})`);
		lines.push(`  (PERIMETER_SEGMENT X1=${coord(x2)} Y1=${coord(y1)} X2=${coord(x2)} Y2=${coord(y2)})`);
		lines.push(`  (PERIMETER_SEGMENT X1=${coord(x2)} Y1=${coord(y2)} X2=${coord(x1)} Y2=${coord(y2)})`);
		lines.push(`  (PERIMETER_SEGMENT X1=${coord(x1)} Y1=${coord(y2)} X2=${coord(x1)} Y2=${coord(y1)})`);
	}

	lines.push('}');
	lines.push('');
}
