import * as extensionConfig from '../extension.json';
import { collectBoardData } from './collect';
import { generateHypContent } from './generate';

export function activate(_status?: 'onStartupFinished', _arg?: string): void {}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		`Export HyperLynx v${extensionConfig.version}\n\n${
			eda.sys_I18n.text('Export PCB to HyperLynx format')}`,
		eda.sys_I18n.text('About'),
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
