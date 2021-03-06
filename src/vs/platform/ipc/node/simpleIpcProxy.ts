/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IChannel, IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { revive } from 'vs/base/common/marshalling';

//
// Use both `SimpleServiceProxyChannel` and `createSimpleChannelProxy`
// for a very basic process <=> process communication over methods.
//

export type AddContextToFunctions<Target, Context> = {
	//  For every property: IF property is a FUNCTION				ADD context as first parameter and original parameters afterwards with same return type, otherwise preserve as is
	[K in keyof Target]: Target[K] extends (...args: any) => any ? (context: Context, ...args: Parameters<Target[K]>) => ReturnType<Target[K]> : Target[K]
};

interface ISimpleChannelProxyContext {
	__$simpleIPCContextMarker: boolean;
	proxyContext: unknown;
}

function serializeContext(proxyContext?: unknown): ISimpleChannelProxyContext | undefined {
	if (proxyContext) {
		return { __$simpleIPCContextMarker: true, proxyContext };
	}

	return undefined;
}

function deserializeContext(candidate?: ISimpleChannelProxyContext | undefined): unknown | undefined {
	if (candidate && candidate.__$simpleIPCContextMarker === true) {
		return candidate.proxyContext;
	}

	return undefined;
}

export class SimpleServiceProxyChannel implements IServerChannel {

	private service: { [key: string]: unknown };

	constructor(service: unknown) {
		this.service = service as { [key: string]: unknown };
	}

	listen<T>(_: unknown, event: string): Event<T> {
		throw new Error(`Events are currently unsupported by SimpleServiceProxyChannel: ${event}`);
	}

	call(_: unknown, command: string, args?: any[]): Promise<any> {
		const target = this.service[command];
		if (typeof target === 'function') {
			if (Array.isArray(args)) {

				// Deserialize context if any
				const context = deserializeContext(args[0]);
				if (context) {
					args[0] = context;
				}

				// Revive: handles URIs and RegExp
				for (let i = 0; i < args.length; i++) {
					args[i] = revive(args[i]);
				}
			}

			return target.apply(this.service, args);
		}

		throw new Error(`Method not found: ${command}`);
	}
}

export function createSimpleChannelProxy<T>(channel: IChannel, context?: unknown): T {
	const serializedContext = serializeContext(context);

	return new Proxy({}, {
		get(_target, propKey, _receiver) {
			if (typeof propKey === 'string') {
				return async function (...args: any[]) {

					// Serialize context if any
					let methodArgs: any[];
					if (serializedContext) {
						methodArgs = [context, ...args];
					} else {
						methodArgs = args;
					}

					// Revive: handles URIs and RegExp
					return revive(await channel.call(propKey, methodArgs));
				};
			}

			throw new Error(`Unable to provide main channel proxy implementation for: ${String(propKey)}`);
		}
	}) as T;
}
