import type { PluginContext } from '@unbound-app/api/native';

import { startMultiSelect, stopMultiSelect } from './src/start';

export function start(context?: PluginContext) {
	startMultiSelect(context);
}

export function stop() {
	stopMultiSelect();
}
