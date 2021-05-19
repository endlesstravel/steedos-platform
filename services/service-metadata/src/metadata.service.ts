"use strict";

"use strict";
import { ActionHandlers, started, stopped } from './actionsHandler';
import * as _ from 'underscore';
const SERVICE_NAME = 'metadata';

const counter = {
	get: 0,
	add: 0,
	filter: 0,
	addServiceMetadata: 0,
	delete: 0,
	refreshServiceMetadatas: 0,
	getServiceMetadatas: 0,
	getServiceMetadata: 0,
}
let printed = true;
setInterval(() => {
	if (printed && (console as any).aaa ) {
		printed = false;
		console.log("metadata counter", counter);
	}
}, 100)

module.exports = {
	name: SERVICE_NAME,
	namespace: "steedos",
	/**
	 * Settings
	 */
	settings: {

	},
	async started() {
		await started(this.broker)
	},
	/**
	   * Methods
	   */
	methods: {
		refreshServiceMetadatas:async function (ctx) {
			return await ActionHandlers.refreshServiceMetadatas(ctx)
		}
	},

	events: {
		"$services.changed"(ctx) {
			this.refreshServiceMetadatas(ctx);
		}
	},
	/**
	   * Actions
	   */
	actions: {
		get: {
			async handler(ctx) {
				counter.get++;
				return await ActionHandlers.get(ctx);
			}
		},
		filter: {
			async handler(ctx) {
				counter.filter++;
				return await ActionHandlers.filter(ctx);
			}
		},
		add: {
			async handler(ctx) {
				counter.add++;
				return await ActionHandlers.add(ctx);
			}
		},
		addServiceMetadata: {
			async handler(ctx) {
				counter.addServiceMetadata++;
				return await ActionHandlers.addServiceMetadata(ctx);
			}
		},
		delete: {
			async handler(ctx) {
				counter.delete++;
				return await ActionHandlers.delete(ctx);
			}
		},
		refreshServiceMetadatas: {
			params: {
                offlinePackageServices: { type: "array", items: "string" },
            },
			async handler(ctx) {
				counter.refreshServiceMetadatas++;
				return await ActionHandlers.refreshServiceMetadatas(ctx);
			}
		},
		getServiceMetadatas: {
			async handler(ctx) {
				counter.getServiceMetadatas++;
				return await ActionHandlers.getServiceMetadatas(ctx);
			}
		},
		getServiceMetadata: {
			params: {
				serviceName: { type: "string"},
				metadataType: { type: "string"},
				metadataApiName: { type: "string"},
			},
			async handler(ctx) {
				counter.getServiceMetadata++;
				return await ActionHandlers.getServiceMetadata(ctx);
			}
		}
	},
	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {
		await stopped(this.broker)
	}
}
