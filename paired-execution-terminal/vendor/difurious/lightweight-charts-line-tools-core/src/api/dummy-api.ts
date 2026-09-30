import { ILineToolsPlugin } from '../index';

/**
 * Creates a no-op (dummy) implementation of the plugin API.
 *
 * This is used internally as a fallback when the plugin fails to initialize,
 * or as a "Self-Neuter" transformation when a plugin instance is destroyed.
 *
 * @returns A safe, non-functional `ILineToolsPlugin` object.
 */
export function createDummyPluginApi(): any {
	const dummyFn = () => { console.error('Line Tools Plugin: Method called on a destroyed or uninitialized instance.'); };
	const dummyFnString = () => { console.error('Line Tools Plugin: Method called on a destroyed or uninitialized instance.'); return '[]'; };
	const dummyFnBoolean = () => { console.error('Line Tools Plugin: Method called on a destroyed or uninitialized instance.'); return false; };
	const dummyFnNull = () => { console.error('Line Tools Plugin: Method called on a destroyed or uninitialized instance.'); return null; };
	const dummyFnArray = () => { console.error('Line Tools Plugin: Method called on a destroyed or uninitialized instance.'); return []; };

	return {
		registerLineTool: dummyFn,
		addLineTool: () => { console.error('Line Tools Plugin: Method called on a destroyed or uninitialized instance.'); return ''; },
		createOrUpdateLineTool: dummyFn,
		removeLineToolsById: dummyFn,
		removeLineToolsByIdRegex: dummyFn,
		removeSelectedLineTools: dummyFn,
		removeAllLineTools: dummyFn,
		getSelectedLineTools: dummyFnString,
		getLineToolByID: dummyFnString,
		getLineToolsByIdRegex: dummyFnString,
		applyLineToolOptions: dummyFnBoolean,
		exportLineTools: dummyFnString,
		importLineTools: dummyFnBoolean,
		getDataInRange: dummyFnArray,
		getBarAtTime: dummyFnNull,
		getClosestBar: dummyFnNull,
		getBarAtCoordinate: dummyFnNull,
		getEarliestBar: dummyFnNull,
		getLatestBar: dummyFnNull,
		getFullTimeRange: dummyFnNull,
		subscribeLineToolsDoubleClick: dummyFn,
		unsubscribeLineToolsDoubleClick: dummyFn,
		subscribeLineToolsAfterEdit: dummyFn,
		unsubscribeLineToolsAfterEdit: dummyFn,
		subscribeLineToolsSingleClick: dummyFn,
		unsubscribeLineToolsSingleClick: dummyFn,		
		setCrossHairXY: dummyFn,
		clearCrossHair: dummyFn,
		setMagnetThreshold: dummyFn,
		setTimeFormatter: dummyFn,
		setLocked: dummyFn,
		isLocked: dummyFnBoolean,		
		destroy: dummyFn,
	};
}