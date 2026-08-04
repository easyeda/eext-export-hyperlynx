import type { LayerInfo } from '../types';
import { sanitizeLayerName } from '../utils';

/** 铜箔厚度（inch），约 35um = 1.4mil */
const COPPER_THICKNESS_INCH = 0.0014;
/** 介质层厚度（inch） */
const DIELECTRIC_THICKNESS_INCH = 0.008;
/** 铜的体电阻率（ohm-m） */
const COPPER_RESISTIVITY = 1.724e-8;
/** FR4 相对介电常数 */
const FR4_EPSILON_R = 4.5;

export function writeStackup(lines: string[], copperLayers: LayerInfo[]): void {
	lines.push('{STACKUP');

	for (let i = 0; i < copperLayers.length; i++) {
		const layerName = sanitizeLayerName(copperLayers[i].name);
		lines.push(
			`  (SIGNAL T=${COPPER_THICKNESS_INCH.toFixed(6)} P=0.000000 C=${COPPER_RESISTIVITY} L="${layerName}" M=COPPER)`,
		);
		// 介质层位于相邻两个铜层之间，因此最后一层之后不再输出。
		if (i < copperLayers.length - 1) {
			lines.push(
				`  (DIELECTRIC T=${DIELECTRIC_THICKNESS_INCH.toFixed(6)} C=${FR4_EPSILON_R.toFixed(6)} L="DE_${layerName}" M="FR4")`,
			);
		}
	}

	lines.push('}');
	lines.push('');
}
