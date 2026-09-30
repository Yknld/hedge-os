// /src/api/public-api.ts

/**
 * This file defines the public-facing API for the Lightweight Charts Line Tools Core plugin.
 * It specifies the interfaces and types that users will interact with, ensuring data structures
 * remain consistent with the original V3.8 line tools build for drop-in replacement compatibility.
 */

import { IChartApiBase, ISeriesApi, SeriesType } from 'lightweight-charts';
import { LineToolOptionsInternal, LineToolPartialOptionsMap, LineToolType } from '../types';

// #region Data Structures

/**
 * Represents a single anchor point for a line tool in logical space.
 *
 * This structure is the fundamental way of defining a tool's position. It is compatible
 * with the original V3.8 line tools build's data format.
 *
 * @property timestamp - The time component of the point, typically a UNIX timestamp in seconds (or a date string if the chart is configured for `BusinessDay`).
 * @property price - The price component of the point (a floating-point number).
 *
 * @example
 * const point: LineToolPoint = {
 *   timestamp: 1672531200, // January 1, 2023, 00:00:00 UTC
 *   price: 1500.50
 * };
 */
export interface LineToolPoint {
	timestamp: number;
	price: number;
}

/**
 * Represents the full serializable state of a line tool for export, import, or event payloads.
 *
 * This object is used to transfer the complete definition of a tool between the plugin's API
 * and a consumer's application (e.g., when saving tool state to a database). The structure
 * is designed for compatibility with the V3.8 line tools export format.
 *
 * @template T - The specific string identifier type of the line tool (e.g., `'TrendLine'`).
 * @property id - The unique identifier of the tool.
 * @property toolType - The specific type of the tool (must match a registered type).
 * @property points - The array of {@link LineToolPoint}s defining the tool's geometry.
 * @property options - The complete, current configuration object for the tool.
 *
 * @example
 * // Example structure returned by `exportLineTools()`
 * const exportedData: LineToolExport<'Rectangle'>[] = [{
 *   id: 'rect-a1b2c3d4',
 *   toolType: 'Rectangle',
 *   points: [{ timestamp: 1672531200, price: 100 }, { timestamp: 1672534800, price: 120 }],
 *   options: { ... } // Full configuration options
 * }];
 */
export interface LineToolExport<T extends LineToolType> {
	id: string;
	toolType: T;
	points: LineToolPoint[];
	options: LineToolOptionsInternal<T>;
}

// #endregion Data Structures


// #region Event Structures

/**
 * Defines the structured data payload passed to listeners when a double-click event occurs on a line tool.
 *
 * This structure is kept identical to the original V3.8 event output for drop-in compatibility.
 *
 * @property selectedLineTool - The full {@link LineToolExport} data of the tool that was double-clicked.
 */
export interface LineToolsDoubleClickEventParams {
	selectedLineTool: LineToolExport<LineToolType>;
}

/**
 * Defines the structured data payload passed to listeners after a line tool has been edited or created.
 *
 * This is a crucial event for applications that need to persist tool state immediately after user interaction.
 *
 * @property selectedLineTool - The full {@link LineToolExport} data of the tool after the modification is complete.
 * @property stage - A string indicating the context of the edit completion:
 * - `'lineToolEdited'`: A point was moved, or the entire tool was dragged.
 * - `'pathFinished'`: (Deprecated/Path-Tool-Specific) A path tool creation has finished.
 * - `'lineToolFinished'`: A fixed-point tool creation (e.g., TrendLine, Rectangle) has finished.
 */
export interface LineToolsAfterEditEventParams {
	selectedLineTool: LineToolExport<LineToolType>;
	stage: 'lineToolEdited' | 'pathFinished' | 'lineToolFinished';
}

/**
 * Defines the structured data payload passed to listeners when a line tool selection changes.
 * 
 * This object is schema-stable; all keys are always present, but points and options 
 * will be null when the state is 'deselected' to keep the payload lightweight.
 */
export interface LineToolsSingleClickEventParams {
	// Indicates the new state of the interaction
	selectionState: 'selected' | 'deselected';
	// The tool data associated with this state change
	selectedLineTool: {
		id: string;
		toolType: LineToolType;
		// Points and options are provided only during selection
		points: LineToolPoint[] | null;
		options: LineToolOptionsInternal<any> | null;
	};
}

/**
 * The function signature required for handlers subscribing to the single-click selection event.
 *
 * @param param - The event data containing the tool identity and its new selection state.
 */
export type LineToolsSingleClickEventHandler = (param: LineToolsSingleClickEventParams) => void;

/**
 * The function signature required for handlers subscribing to the double-click event.
 *
 * @param param - The event data containing the details of the double-clicked tool.
 */
export type LineToolsDoubleClickEventHandler = (param: LineToolsDoubleClickEventParams) => void;

/**
 * The function signature required for handlers subscribing to the after-edit event.
 *
 * This handler is essential for applications that need to save the final state of a tool
 * immediately after its creation or modification by the user.
 *
 * @param param - The event data containing the updated tool export and the stage of the edit.
 */
export type LineToolsAfterEditEventHandler = (param: LineToolsAfterEditEventParams) => void;

// #endregion Event Structures


// #region Main API Interface

/**
 * The public-facing interface for the Line Tools Core Plugin.
 *
 * This object serves as the main point of interaction for managing, querying, and configuring
 * drawing tools on a Lightweight Charts instance. All methods here are callable by the consumer
 * and are designed to be compatible with the API of the V3.8 line tools build.
 */
export interface ILineToolsApi {

	/**
	 * Programmatically adds a new line tool to the chart.
	 *
	 * If `points` is an empty array, `null`, or omitted, this method initiates the
	 * **interactive creation mode**, allowing the user to click on the chart to define the tool's points.
	 *
	 * @param type - The specific {@link LineToolType} to add (e.g., `'TrendLine'`).
	 * @param points - Optional. The initial {@link LineToolPoint}s for the tool. Pass `[]` to start interactive drawing.
	 * @param options - Optional. Partial configuration options to override the tool's defaults.
	 * @returns The unique ID string of the newly created line tool, or an empty string on error.
	 *
	 * @example
	 * // Start interactive drawing mode for a Rectangle
	 * plugin.addLineTool('Rectangle');
	 *
	 * @example
	 * // Add a horizontal line at a specific price immediately
	 * plugin.addLineTool('HorizontalLine', [
	 *   { timestamp: 1672531200, price: 150.50 }
	 * ]);
	 */
	addLineTool<T extends LineToolType>(type: T, points?: LineToolPoint[], options?: LineToolPartialOptionsMap[T]): string;

	/**
	 * Creates a new line tool with a specific ID, or updates the existing tool if the ID is found.
	 *
	 * This method is idempotent and is typically used for state management operations like imports,
	 * ensuring that data is synchronized reliably without user interaction.
	 *
	 * @param type - The {@link LineToolType} of the tool. Must match the existing tool's type if updating.
	 * @param points - The full array of {@link LineToolPoint}s to set for the tool.
	 * @param options - The partial configuration options to apply or merge.
	 * @param id - The unique ID of the tool to create or update.
	 * @returns void
	 */
	createOrUpdateLineTool<T extends LineToolType>(type: T, points: LineToolPoint[], options: LineToolPartialOptionsMap[T], id: string): void;

	/**
	 * Removes one or more line tools from the chart by their unique IDs.
	 *
	 * @param ids - An array of unique string IDs of the tools to remove.
	 * @returns void
	 */
	removeLineToolsById(ids: string[]): void;

	/**
	 * Removes all line tools whose IDs match a given regular expression pattern.
	 *
	 * @param regex - The regular expression (e.g., `^temp-`) to test against all current tool IDs.
	 * @returns void
	 *
	 * @example
	 * // Remove all tools whose ID starts with 'old-tool'
	 * plugin.removeLineToolsByIdRegex(/^old-tool/);
	 */
	removeLineToolsByIdRegex(regex: RegExp): void;

	/**
	 * Removes the currently selected line tool(s) from the chart.
	 *
	 * This utility method is useful for implementing quick user interactions, such as binding
	 * the deletion of selected tools to the 'Delete' key.
	 *
	 * @returns void
	 */
	removeSelectedLineTools(): void;

	/**
	 * Removes every single line tool managed by this plugin instance from the chart.
	 *
	 * This performs a complete cleanup and resource release for all drawing primitives.
	 *
	 * @returns void
	 */
	removeAllLineTools(): void;

	/**
	 * Retrieves the full export data for all line tools currently marked as selected.
	 *
	 * @returns A JSON string representing an array of {@link LineToolExport} data. Returns `[]` if no tools are selected.
	 *
	 * @remarks
	 * The returned JSON string must be parsed (e.g., `JSON.parse(result)`) to access the tool data.
	 */
	getSelectedLineTools(): string;

	/**
	 * Retrieves the full export data for a single line tool identified by its unique ID.
	 *
	 * @param id - The unique identifier of the tool.
	 * @returns A JSON string representing an array with the single {@link LineToolExport} data, or an empty array `[]` if the ID is not found.
	 *
	 * @remarks
	 * The return value is a JSON string containing an array (even for a single result) for consistency with the V3.8 API.
	 */
	getLineToolByID(id: string): string;

	/**
	 * Retrieves the full export data for a collection of line tools whose IDs match a given regular expression.
	 *
	 * @param regex - The regular expression to test against all tool IDs.
	 * @returns A JSON string representing an array of matching {@link LineToolExport} data.
	 */
	getLineToolsByIdRegex(regex: RegExp): string;

	/**
	 * Applies new points and/or partial options to an existing line tool defined by its ID.
	 *
	 * This is the primary method for modifying a tool's visual style or location programmatically
	 * *after* it has been created.
	 *
	 * @param toolData - An object containing the tool's ID, type, and the partial options/points to apply.
	 * @returns `true` if the tool was found and successfully updated, otherwise `false`.
	 */
	applyLineToolOptions<T extends LineToolType>(toolData: LineToolExport<T>): boolean;

	/**
	 * Serializes the complete state of all currently drawn line tools into a JSON string.
	 *
	 * This function is essential for state persistence (e.g., saving tools to local storage or a database)
	 * as the returned format is fully compatible with {@link importLineTools}.
	 *
	 * @returns A JSON string representing an array of all {@link LineToolExport} data.
	 *
	 * @example
	 * const state = plugin.exportLineTools();
	 * localStorage.setItem('chartToolsState', state);
	 */
	exportLineTools(): string;

	/**
	 * Imports a collection of line tools from a JSON string, typically a payload from {@link exportLineTools}.
	 *
	 * The import logic is non-destructive: it uses {@link createOrUpdateLineTool} to update existing tools
	 * with matching IDs and create new ones for non-existent IDs.
	 *
	 * @param json - A JSON string containing an array of {@link LineToolExport} data.
	 * @returns `true` if the JSON was valid and the import process was initiated, `false` otherwise.
	 */
	importLineTools(json: string): boolean;

	/**
	 * Retrieves the raw series data rows within a specified time range.
	 *
	 * @param range - An object containing the 'from' and 'to' timestamps or date strings.
	 * @returns An array of native series data objects (e.g., OHLC) found within the requested range.
	 */
	getDataInRange(range: { from: number | string; to: number | string }): any[];

	/**
	 * Retrieves a single data row at a specific timestamp.
	 *
	 * @param time - The timestamp or business day string to look up.
	 * @returns The data object if an exact match is found, otherwise `null`.
	 */
	getBarAtTime(time: number | string): any | null;

	/**
	 * Finds the data row closest to a target timestamp based on the provided search mode.
	 * 
	 * This is essential for cross-timeframe synchronization (e.g., syncing a 1m chart to a 15m chart).
	 *
	 * @param time - The target timestamp or business day string.
	 * @param mode - The search strategy: 
	 * - 'exact': Only returns data if the time matches perfectly.
	 * - 'floor': Returns the nearest data point at or BEFORE the target time (Best for 1m -> 15m sync).
	 * - 'ceil': Returns the nearest data point at or AFTER the target time.
	 * - 'nearest': Returns the absolute closest data point in either direction.
	 * @returns The data object matching the search criteria, or `null`.
	 */
	getClosestBar(time: number | string, mode: 'exact' | 'floor' | 'ceil' | 'nearest'): any | null;

	/**
	 * Retrieves the data row located at a specific pixel coordinate on the chart.
	 *
	 * @param x - The X-coordinate (in pixels) relative to the chart canvas.
	 * @returns The data object corresponding to the bar under the coordinate, or `null`.
	 */
	getBarAtCoordinate(x: number): any | null;

	/**
	 * Retrieves the first (earliest) data row currently loaded in the series.
	 *
	 * @returns The earliest data object, or `null` if the series is empty.
	 */
	getEarliestBar(): any | null;

	/**
	 * Retrieves the last (most recent) data row currently loaded in the series.
	 *
	 * @returns The most recent data object, or `null` if the series is empty.
	 */
	getLatestBar(): any | null;

	/**
	 * Retrieves the full time range covered by the currently loaded series data.
	 *
	 * @returns An object with 'from' and 'to' timestamps, or `null` if the series is empty.
	 */
	getFullTimeRange(): { from: any; to: any } | null;

	/**
	 * Subscribes a handler function to the event that fires when a line tool is double-clicked.
	 *
	 * @param handler - The callback function to execute. It receives a {@link LineToolsDoubleClickEventParams} object.
	 * @returns void
	 */
	subscribeLineToolsDoubleClick(handler: LineToolsDoubleClickEventHandler): void;

	/**
	 * Unsubscribes a handler function from the double-click event.
	 *
	 * @param handler - The previously subscribed handler function.
	 * @returns void
	 */
	unsubscribeLineToolsDoubleClick(handler: LineToolsDoubleClickEventHandler): void;

	/**
	 * Subscribes a handler function to the event that fires after a line tool is created or edited by the user.
	 *
	 * This is the critical event for persisting user-drawn changes.
	 *
	 * @param handler - The callback function to execute. It receives a {@link LineToolsAfterEditEventParams} object.
	 * @returns void
	 */
	subscribeLineToolsAfterEdit(handler: LineToolsAfterEditEventHandler): void;

	/**
	 * Unsubscribes a handler function from the after-edit event.
	 *
	 * @param handler - The previously subscribed handler function.
	 * @returns void
	 */
	unsubscribeLineToolsAfterEdit(handler: LineToolsAfterEditEventHandler): void;

	/**
	 * Subscribes a handler function to the event that fires when a line tool is selected or deselected.
	 * 
	 * This event is "State-Aware" and will only fire when the selection actually changes.
	 *
	 * @param handler - The callback function to execute. It receives a {@link LineToolsSingleClickEventParams} object.
	 * @returns void
	 */
	subscribeLineToolsSingleClick(handler: LineToolsSingleClickEventHandler): void;

	/**
	 * Unsubscribes a handler function from the single-click selection event.
	 *
	 * @param handler - The previously subscribed handler function.
	 * @returns void
	 */
	unsubscribeLineToolsSingleClick(handler: LineToolsSingleClickEventHandler): void;	
	
	/**
	 * Programmatically positions the chart's crosshair at a specific screen pixel coordinate.
	 *
	 * @param x - The x-coordinate (in pixels) relative to the chart's canvas.
	 * @param y - The y-coordinate (in pixels) relative to the chart's canvas.
	 * @param visible - Controls visibility.
	 * @param providedTime - Optional. Logical time value.
	 * @param providedPrice - Optional. Logical price value.
	 * @returns void
	 */
    setCrossHairXY(x: number | null, y: number | null, visible: boolean, providedTime?: any, providedPrice?: number): void;

	/**
	 * Converts a screen pixel point to a logical LineToolPoint (timestamp and price).
	 * This is essential for high-fidelity crosshair synchronization.
	 * 
	 * @param x - The x-coordinate (in pixels).
	 * @param y - The y-coordinate (in pixels).
	 * @returns A LineToolPoint containing logical timestamp and price.
	 */
	getLogicalPoint(x: number, y: number): LineToolPoint | null;

	/**
	 * Clears the crosshair position, making it invisible.
	 *
	 * This is a direct wrapper around `chart.clearCrosshairPosition()`.
	 *
	 * @returns void
	 */
    clearCrossHair(): void;

	/**
	 * Sets the magnet threshold in pixels for snapping to price data.
	 *
	 * When set to a value greater than 0, the crosshair and drawing anchors will 
	 * automatically "lock" onto the nearest Open, High, Low, or Close price of 
	 * a candle if the mouse cursor is within this pixel distance.
	 *
	 * @param pixels - The snapping tolerance in pixels. Set to 0 to disable.
	 * @returns void
	 */
	setMagnetThreshold(pixels: number): void;	

	/**
	 * Sets a custom time formatter used specifically for line tool axis labels.
	 * 
	 * If no custom formatter is set, the plugin will automatically attempt to 
	 * match the chart's global formatting by checking `localization.timeFormatter`. 
	 * If that is also unset, it falls back to the standard scale behavior.
	 * 
	 * @param formatter - A function that takes a time value and returns a formatted string.
	 * @returns void
	 */
	setTimeFormatter(formatter: (time: any) => string): void;	

	/**
	 * Sets the global interaction lock state for all drawing tools managed by this plugin instance.
	 * 
	 * When locked is set to `true`:
	 * 1. All existing drawings become "read-only" (they cannot be moved, resized, or deleted via mouse).
	 * 2. No new drawings can be initiated by the user.
	 * 3. All selection and hover interaction effects are suppressed.
	 * 4. Tools remain visible and will continue to update position if the chart scales or moves.
	 * 
	 * This is typically used to implement a "Lock Drawings" toggle in the application UI
	 * to prevent accidental modifications while the user is analyzing the chart.
	 * 
	 * @param locked - `true` to disable interactions, `false` to enable them.
	 * @returns void
	 */
	setLocked(locked: boolean): void;

	/**
	 * Retrieves the current interaction lock state of the plugin.
	 * 
	 * @returns `true` if the tools are currently in a read-only locked state, `false` otherwise.
	 */
	isLocked(): boolean;

	/**
	 * Completely destroys the line tools plugin instance and cleans up all associated memory.
	 * 
	 * After this call, the plugin instance transforms itself into a no-op dummy object.
	 * All public methods will remain callable but will do nothing and return safe values,
	 * preventing application crashes while allowing the engine to be fully garbage collected.
	 * 
	 * The destruction sequence includes:
	 * 1. Removing all currently drawn line tools from the chart.
	 * 2. Unbinding all internal mouse and keyboard event listeners from the DOM.
	 * 3. Detaching the core plugin's rendering primitives (like the crosshair label) from the series.
	 * 4. Severing all internal references to the Lightweight Charts API to allow garbage collection.
	 * 
	 * @returns void
	 */
	destroy(): void;

}

// #endregion Main Plugin Interface


// #region Factory Type

/**
 * Defines the function signature for the primary plugin factory used to initialize the core logic.
 *
 * @typeParam HorzScaleItem - The type of the horizontal scale item (e.g., `Time`, `UTCTimestamp`).
 * @param chart - The Lightweight Charts chart API instance.
 * @param series - The primary series API instance to which tools will be attached.
 * @returns The {@link ILineToolsApi} interface for tool management.
 */
export type LineToolsPluginFactory = <HorzScaleItem>(
	chart: IChartApiBase<HorzScaleItem>,
	series: ISeriesApi<SeriesType, HorzScaleItem>
) => ILineToolsApi;


// #endregion Factory Type