/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { IWindowsService } from 'vs/platform/windows/common/windows';
import { reviveWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { URI } from 'vs/base/common/uri';
import { IRecent, isRecentFile, isRecentFolder } from 'vs/platform/history/common/history';

export class WindowsChannel implements IServerChannel {

	private readonly onWindowOpen: Event<number>;
	private readonly onWindowFocus: Event<number>;
	private readonly onWindowBlur: Event<number>;
	private readonly onWindowMaximize: Event<number>;
	private readonly onWindowUnmaximize: Event<number>;
	private readonly onRecentlyOpenedChange: Event<void>;

	constructor(private readonly service: IWindowsService) {
		this.onWindowOpen = Event.buffer(service.onWindowOpen, true);
		this.onWindowFocus = Event.buffer(service.onWindowFocus, true);
		this.onWindowBlur = Event.buffer(service.onWindowBlur, true);
		this.onWindowMaximize = Event.buffer(service.onWindowMaximize, true);
		this.onWindowUnmaximize = Event.buffer(service.onWindowUnmaximize, true);
		this.onRecentlyOpenedChange = Event.buffer(service.onRecentlyOpenedChange, true);
	}

	listen(_: unknown, event: string): Event<any> {
		switch (event) {
			case 'onWindowOpen': return this.onWindowOpen;
			case 'onWindowFocus': return this.onWindowFocus;
			case 'onWindowBlur': return this.onWindowBlur;
			case 'onWindowMaximize': return this.onWindowMaximize;
			case 'onWindowUnmaximize': return this.onWindowUnmaximize;
			case 'onRecentlyOpenedChange': return this.onRecentlyOpenedChange;
		}

		throw new Error(`Event not found: ${event}`);
	}

	call(_: unknown, command: string, arg?: any): Promise<any> {
		switch (command) {
			case 'addRecentlyOpened': return this.service.addRecentlyOpened(arg.map((recent: IRecent) => {
				if (isRecentFile(recent)) {
					recent.fileUri = URI.revive(recent.fileUri);
				} else if (isRecentFolder(recent)) {
					recent.folderUri = URI.revive(recent.folderUri);
				} else {
					recent.workspace = reviveWorkspaceIdentifier(recent.workspace);
				}
				return recent;
			}));
			case 'removeFromRecentlyOpened': return this.service.removeFromRecentlyOpened(arg.map(URI.revive));
			case 'clearRecentlyOpened': return this.service.clearRecentlyOpened();
			case 'getRecentlyOpened': return this.service.getRecentlyOpened(arg);
			case 'isFocused': return this.service.isFocused(arg);
			case 'openExtensionDevelopmentHostWindow': return (this.service as any).openExtensionDevelopmentHostWindow(arg[0], arg[1]); // TODO@Isidor move
		}

		throw new Error(`Call not found: ${command}`);
	}
}
