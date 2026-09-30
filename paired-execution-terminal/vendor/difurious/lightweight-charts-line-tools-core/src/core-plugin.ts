// /src/core-plugin.ts

import {
	IChartApiBase,
	ISeriesApi,
	SeriesType,
	IHorzScaleBehavior,
	IPaneApi,
	Coordinate,
	Time,
	BusinessDay,
	UTCTimestamp,
	ISeriesPrimitive,
	SeriesAttachedParameter,
	PrimitiveHoveredItem
} from 'lightweight-charts';

import { createDummyPluginApi } from './api/dummy-api';

import {
	ILineToolsApi,
	LineToolExport,
	LineToolPoint,
	LineToolsAfterEditEventHandler,
	LineToolsDoubleClickEventHandler,
	LineToolsDoubleClickEventParams,
	LineToolsAfterEditEventParams,
	LineToolsSingleClickEventHandler,
	LineToolsSingleClickEventParams,	
} from './api/public-api';
import { Delegate, roundPriceToStep } from './utils/helpers';
import { LineToolPartialOptionsMap, LineToolType, IChartWidgetBase, ITimeAxisView, IPriceAxisView, IPaneView  } from './types';
import { BaseLineTool } from './model/base-line-tool';
import { ToolRegistry } from './model/tool-registry';
import { InteractionManager } from './interaction/interaction-manager';
import { Point } from './utils/geometry';
import { PriceAxisLabelStackingManager } from './model/price-axis-label-stacking-manager';
import { CrosshairTimeAxisLabelView } from './views/crosshair-time-axis-label-view';

/**
 * Represents the physical layout and series mapping for a single chart pane.
 * 
 * This structure links a specific Lightweight Charts pane to its calculated 
 * screen coordinates and the data series it contains.
 */
export interface PaneLayout {
	/** The native Lightweight Charts API reference for the pane. */
	paneApi: any;
	/** The vertical pixel offset (Y-coordinate) from the top of the chart container to the start of this pane. */
	top: number;    
	/** The internal drawing height of the pane in pixels, excluding the time scale area. */
	height: number; 
	/** A collection of ISeriesApi instances currently residing within this specific pane. */
	series: any[];  
}

/**
 * A holistic, point-in-time snapshot of the entire chart's physical dimensions and pane structure.
 * 
 * This object serves as the "Single Source of Truth" for layout-dependent calculations 
 * (like hit testing and culling), ensuring that dimensions are synchronized across 
 * the entire plugin during a single render frame.
 */
export interface ChartLayoutSnapshot {
	/** The high-resolution timestamp (via performance.now()) indicating when this measurement was performed. */
	timestamp: number;
	/** The global drawing width of all chart panes in pixels, accurately excluding the width of the price axis. */
	width: number;
	/** An array containing the individual layout details for every pane currently present in the chart. */
	panes: PaneLayout[];
}

/**
 * The main implementation of the Line Tools Core Plugin.
 *
 * This class acts as the central controller for adding, managing, and interacting with line tools
 * on a Lightweight Chart. It coordinates between the chart's API, the series, and the internal
 * interaction manager to handle user input, rendering, and state management of drawing tools.
 *
 * While typically initialized via the `createLineToolsPlugin` factory, this class implements
 * the {@link ILineToolsApi} interface which defines the primary methods available to consumers.
 *
 * @typeParam HorzScaleItem - The type of the horizontal scale item (e.g., `Time`, `UTCTimestamp`, or `number`), matching the chart's configuration.
 */
export class LineToolsCorePlugin<HorzScaleItem> implements ILineToolsApi, ISeriesPrimitive<HorzScaleItem> {
	private readonly _chart: IChartApiBase<HorzScaleItem>;
	private readonly _series: ISeriesApi<SeriesType, HorzScaleItem>;
	private readonly _horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>;

	private _tools: Map<string, BaseLineTool<HorzScaleItem>> = new Map();
	private readonly _toolRegistry: ToolRegistry<HorzScaleItem>;
	private readonly _interactionManager: InteractionManager<HorzScaleItem>;
	private readonly _priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>;
	private readonly _crosshairTimeView: CrosshairTimeAxisLabelView<HorzScaleItem>;

	private _layoutSnapshot: ChartLayoutSnapshot | null = null;

	/**
	 * Retrieves a unified layout snapshot of the entire chart.
	 * 
	 * ### Performance
	 * If the snapshot is less than 16ms old (approx. 1 frame), it returns the 
	 * cached version. Otherwise, it performs a single, holistic measurement 
	 * of all panes and dimensions.
	 * 
	 * @returns The current {@link ChartLayoutSnapshot}.
	 */
	public getLayout(): ChartLayoutSnapshot {
		const now = performance.now();
		
		// If snapshot is fresh (less than 1 frame old), return it immediately.
		if (this._layoutSnapshot && (now - this._layoutSnapshot.timestamp < 100)) {
			return this._layoutSnapshot;
		}

		// --- SLOW PATH: MEASURE DOM ---
		//console.count("[Master-Layout] Measuring DOM width, height");

		// We measure the whole chart exactly once.
		const chartElement = this._chart.chartElement();
		const chartRect = chartElement.getBoundingClientRect();
		
		// Use LWC native width (the most accurate for excluding price axis)
		const drawingWidth = this._chart.paneSize().width;

		const snapshot: ChartLayoutSnapshot = {
			timestamp: now,
			width: drawingWidth,
			panes: []
		};

		try {
			// Extract dimensions for every pane currently in the chart
			const panes = (this._chart as any).panes?.();
			if (panes) {
				panes.forEach((pane: any) => {
					const paneEl = pane.getHTMLElement?.();
					if (paneEl) {
						const rect = paneEl.getBoundingClientRect();
						snapshot.panes.push({
							paneApi: pane,
							top: rect.top - chartRect.top,
							height: paneEl.clientHeight,
							series: pane.getSeries?.() || []
						});
					}
				});
			}
		} catch (e) { 
			// Fail silently; if DOM is inaccessible, return existing or empty snapshot
		}

		this._layoutSnapshot = snapshot;
		return snapshot;
	}

	/**
	 * Optional user-provided function for formatting time axis labels.
	 * @private
	 */
	private _customTimeFormatter: ((time: any) => string) | null = null;

	/**
	 * The pixel tolerance for the magnetic snapping engine (0 = disabled).
	 * This value acts as the global default for all line tools.
	 * @private
	 */
	private _magnetThreshold: number = 0;

	// Delegates for broadcasting V3.8-compatible events
	private readonly _doubleClickDelegate = new Delegate<LineToolsDoubleClickEventParams>();
	private readonly _afterEditDelegate = new Delegate<LineToolsAfterEditEventParams>();
	private readonly _selectSingleClickDelegate = new Delegate<LineToolsSingleClickEventParams>();

	// Throttled Stacking Update
	private _stackingUpdateScheduled: boolean = false;
	private _isDestroyed: boolean = false; // Flag to block logic after destruction

	public constructor(
		chart: IChartApiBase<HorzScaleItem>,
		series: ISeriesApi<SeriesType, HorzScaleItem>,
		horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
	) {
		this._chart = chart;
		this._series = series;
		this._horzScaleBehavior = horzScaleBehavior;
		this._toolRegistry = new ToolRegistry<HorzScaleItem>();
		this._interactionManager = new InteractionManager<HorzScaleItem>(this, this._chart, this._series, this._tools, this._toolRegistry);
		this._priceAxisLabelStackingManager = new PriceAxisLabelStackingManager<HorzScaleItem>(this._chart, this._series);

		// Initialize the supplemental crosshair view
		this._crosshairTimeView = new CrosshairTimeAxisLabelView<HorzScaleItem>(this._chart);

		// Attach the plugin itself to the series as a primitive so its views are rendered
		this._series.attachPrimitive(this);

		console.log('Line Tools Core Plugin initialized.');
	}

	/**
	 * Requests a redraw of the chart.
	 *
	 * This method is the primary mechanism for internal components (like the {@link InteractionManager} or individual tools)
	 * to trigger a render cycle after state changes (e.g., hovering, selecting, or modifying a tool).
	 * It effectively calls `chart.applyOptions({})` to signal that the primitives need repainting.
	 *
	 * @internal
	 * @returns void
	 */
	public requestUpdate(): void {
		// Applying empty options is a lightweight way to tell the chart
		// that something has changed and it needs to re-render.
		this._chart.applyOptions({});

		// Centralized control now relies on the BaseLineTool to call the
		// Stacking Manager at the right time. The Core Plugin should no longer manage
		// the throttle here to avoid the premature call.
	}	

	/**
	 * Registers a custom line tool class with the plugin.
	 *
	 * Before a specific tool type (e.g., 'Rectangle', 'FibRetracement') can be created via
	 * {@link addLineTool} or {@link importLineTools}, its class constructor must be registered here.
	 * This maps a string identifier to the actual class implementation.
	 *
	 * @param type - The unique string identifier for the tool type (e.g., 'Rectangle').
	 * @param toolClass - The class constructor for the tool, which must extend {@link BaseLineTool}.
	 * @returns void
	 *
	 * @example
	 * import { LineToolRectangle } from './my-tools/rectangle';
	 * plugin.registerLineTool('Rectangle', LineToolRectangle);
	 */
	public registerLineTool(type: LineToolType, toolClass: new (...args: any[]) => BaseLineTool<HorzScaleItem>): void {
		this._toolRegistry.registerTool(type, toolClass);
		console.log(`Registered line tool: ${type}`);
	}

	// #region ILineToolsApi Implementation


	/**
	 * Adds a new line tool to the chart.
	 *
	 * If `points` is provided, the tool is drawn immediately at those coordinates.
	 * If `points` is an empty array, `null`, or undefined, the plugin enters
	 * **interactive creation mode**, allowing the user to click on the chart to draw the tool.
	 *
	 * @param type - The type of line tool to create (e.g., 'TrendLine', 'Rectangle').
	 * @param points - An array of logical points (timestamp/price) to define the tool. Pass `[]` to start interactive drawing.
	 * @param options - Optional configuration object to customize the tool's appearance (line color, width, etc.).
	 * @returns The unique string ID of the newly created tool.
	 *
	 * @example
	 * // Start drawing a Trend Line interactively (user clicks to place points)
	 * plugin.addLineTool('TrendLine');
	 *
	 * @example
	 * // Programmatically add a Rectangle at specific coordinates
	 * plugin.addLineTool('Rectangle', [
	 *   { timestamp: 1620000000, price: 100 },
	 *   { timestamp: 1620086400, price: 120 }
	 * ], {
	 *   line: { color: '#ff0000', width: 2 },
	 *   background: { color: 'rgba(255, 0, 0, 0.2)' }
	 * });
	 */
	public addLineTool<T extends LineToolType>(type: T, points?: LineToolPoint[] | null, options?: LineToolPartialOptionsMap[T] | undefined): string {
		try {
			// Check if points are provided and signal interactive creation if they are empty
			const initiateInteractive = (points === null || points === undefined || points.length === 0);
			const tool = this._createAndAddTool(type, points || [], options, undefined, initiateInteractive);
			return tool.id();
		} catch (e: any) {
			console.error(e.message);
			return '';
		}
	}

	/**
	 * Creates a new line tool with a specific ID, or updates it if that ID already exists.
	 *
	 * Unlike `addLineTool`, this method requires a specific ID. It is primarily used for
	 * state synchronization (e.g., `importLineTools`) where preserving the original tool ID is critical.
	 *
	 * @param type - The type of the line tool.
	 * @param points - The points defining the tool.
	 * @param options - The configuration options.
	 * @param id - The unique ID to assign to the tool (or the ID of the tool to update).
	 * @returns void
	 */
	public createOrUpdateLineTool<T extends LineToolType>(type: T, points: LineToolPoint[], options: LineToolPartialOptionsMap[T], id: string): void {
		const existingTool = this._tools.get(id);
		if (existingTool) {
			// Update existing tool
			existingTool.setPoints(points);
			existingTool.applyOptions(options);
			//console.log(`Updated line tool with ID: ${id}`);
		} else {
			// Create new tool with specified ID
			try {
				this._createAndAddTool(type, points, options, id);
			} catch (e: any) {
				console.error(e.message);
			}
		}
	}

	/**
	 * Removes one or more line tools from the chart based on their unique IDs.
	 *
	 * @param ids - An array of unique string IDs representing the tools to remove.
	 * @returns void
	 *
	 * @example
	 * plugin.removeLineToolsById(['tool-id-1', 'tool-id-2']);
	 */
	public removeLineToolsById(ids: string[]): void {
		//console.log(`[CorePlugin] Removing tools. Current tool count: ${this._tools.size}`);
		let needsUpdate = false;
		ids.forEach(id => {
			const tool = this._tools.get(id);
			if (tool) {
				this._interactionManager.detachTool(tool); // DETACH FROM LWCHARTS FIRST
				tool.destroy(); // Then call our plugin's internal cleanup
				this._tools.delete(id); // Then remove from plugin's map
				needsUpdate = true;
				//console.log(`Removed line tool with ID: ${id}`);
			}
		});
		if (needsUpdate) {
			this._chart.applyOptions({}); // Trigger a chart update
		}
	}

	/**
	 * Removes all line tools whose IDs match the provided Regular Expression.
	 *
	 * This allows for bulk deletion of tools based on naming patterns (e.g., removing all tools tagged with 'temp-').
	 *
	 * @param regex - The Regular Expression to match against tool IDs.
	 * @returns void
	 *
	 * @example
	 * // Remove all tools starting with "drawing-"
	 * plugin.removeLineToolsByIdRegex(/^drawing-/);
	 */
	public removeLineToolsByIdRegex(regex: RegExp): void {
		const idsToRemove: string[] = [];
		this._tools.forEach(tool => {
			if (regex.test(tool.id())) {
				idsToRemove.push(tool.id());
			}
		});
		if (idsToRemove.length > 0) {
			this.removeLineToolsById(idsToRemove);
		}
	}

	/**
	 * Removes the currently selected line tool(s) from the chart.
	 *
	 * This is typically wired to a keyboard shortcut (like the Delete key) or a UI button
	 * to allow users to delete the specific tool they are interacting with.
	 *
	 * @returns void
	 */
	public removeSelectedLineTools(): void {
		const selectedIds: string[] = [];
		this._tools.forEach(tool => {
			if (tool.isSelected()) {
				selectedIds.push(tool.id());
			}
		});
		if (selectedIds.length > 0) {
			this.removeLineToolsById(selectedIds);
		}
	}

	/**
	 * Removes all line tools managed by this plugin from the chart.
	 *
	 * This performs a full cleanup, detaching every tool from the chart's series and
	 * releasing associated resources.
	 *
	 * @returns void
	 */
	public removeAllLineTools(): void {
		const allIds = Array.from(this._tools.keys());
		if (allIds.length > 0) {
			this.removeLineToolsById(allIds);
		}
		console.log(`[CorePlugin] All tools removed. Final total tool count: ${this._tools.size}`);
	}

	/**
	 * Retrieves the data for all line tools that are currently selected by the user.
	 *
	 * @returns A JSON string representing an array of the selected tools' data.
	 *
	 * @example
	 * const selected = JSON.parse(plugin.getSelectedLineTools());
	 * console.log(`User has selected ${selected.length} tools.`);
	 */
	public getSelectedLineTools(): string {
		const selectedTools: LineToolExport<LineToolType>[] = [];
		this._tools.forEach(tool => {
			if (tool.isSelected()) {
				selectedTools.push(tool.getExportData());
			}
		});
		return JSON.stringify(selectedTools);
	}

	/**
	 * Retrieves the data for a specific line tool by its unique ID.
	 *
	 * @param id - The unique identifier of the tool to retrieve.
	 * @returns A JSON string representing an array containing the single tool's data, or an empty array `[]` if the ID was not found.
	 *
	 * @remarks
	 * The return type is a JSON string to maintain compatibility with the V3.8 API structure.
	 * You will typically need to `JSON.parse()` the result to work with the data programmatically.
	 */
	public getLineToolByID(id: string): string {
		const tool = this._tools.get(id);
		return tool ? JSON.stringify([tool.getExportData()]) : JSON.stringify([]);
	}

	/**
	 * Retrieves a list of line tools whose IDs match a specific Regular Expression.
	 *
	 * This is useful for grouping tools by naming convention (e.g., fetching all tools with IDs starting with 'trend-').
	 *
	 * @param regex - The Regular Expression to match against tool IDs.
	 * @returns A JSON string representing an array of all matching line tools.
	 *
	 * @example
	 * // Get all tools with IDs starting with "fib-"
	 * const tools = plugin.getLineToolsByIdRegex(/^fib-/);
	 */
	public getLineToolsByIdRegex(regex: RegExp): string {
		const matchingTools: LineToolExport<LineToolType>[] = [];
		this._tools.forEach(tool => {
			if (regex.test(tool.id())) {
				matchingTools.push(tool.getExportData());
			}
		});
		return JSON.stringify(matchingTools);
	}

	/**
	 * Applies new configuration options or points to an existing line tool.
	 *
	 * This method is used to dynamically update a tool's appearance or position after it
	 * has been created. It performs a partial merge, so you only need to provide the properties
	 * you wish to change.
	 *
	 * Note: If the tool is currently selected, it will be deselected upon update to ensure visual consistency.
	 *
	 * @param toolData - An object containing the tool's `id`, `toolType`, and the `options` or `points` to update.
	 * @returns `true` if the tool was found and updated, `false` otherwise (e.g., ID not found or type mismatch).
	 *
	 * @example
	 * // Change the color of an existing tool to blue
	 * plugin.applyLineToolOptions({
	 *   id: 'existing-tool-id',
	 *   toolType: 'TrendLine',
	 *   options: {
	 *     line: { color: 'blue' }
	 *   },
	 *   points: [] // Points can be omitted if not changing
	 * });
	 */
	public applyLineToolOptions<T extends LineToolType>(toolData: LineToolExport<T>): boolean {
		const tool = this._tools.get(toolData.id);
		if (!tool || tool.toolType !== toolData.toolType) {
			console.error(`Cannot apply options: Tool with ID "${toolData.id}" not found or type mismatch.`);
			return false;
		}

		// Behavioral change: Deselect the tool after applying options, matching V3.8
		if (tool.isSelected()) {
			tool.setSelected(false);
			// Notify frontend that selection was lost due to option update ---
			this.fireSingleClickEvent(tool, 'deselected');
		}

		if (toolData.options) {
			tool.applyOptions(toolData.options);
		}
		if (toolData.points) {

			// --- ROUNDING INJECTION: Sanitize programmatic point updates ---
			const seriesOptions = this._series.options() as any;
			const minMove = seriesOptions?.priceFormat?.minMove || 0.01;
			
			const sanitizedPoints = toolData.points.map(p => ({
				...p,
				price: roundPriceToStep(p.price, minMove)
			}));

			tool.setPoints(sanitizedPoints);
		}
 
		this._chart.applyOptions({}); // Trigger update
		return true;
	}

	/**
	 * Serializes the state of all currently drawn line tools into a JSON string.
	 *
	 * This export format is compatible with `importLineTools` and the V3.8 line tools plugin,
	 * making it suitable for saving chart state to a database or local storage.
	 *
	 * @returns A JSON string representing an array of all line tools and their current state.
	 *
	 * @example
	 * const savedState = plugin.exportLineTools();
	 * localStorage.setItem('my-chart-tools', savedState);
	 */
	public exportLineTools(): string {
		const allToolsData = Array.from(this._tools.values()).map(tool => tool.getExportData());
		console.log('Exporting all line tools:', allToolsData);
		return JSON.stringify(allToolsData);
	}

	/**
	 * Imports a set of line tools from a JSON string.
	 *
	 * This method parses the provided JSON (typically generated by {@link exportLineTools}) and
	 * creates or updates the tools on the chart.
	 *
	 * **Note:** This is a non-destructive import. It will not remove existing tools unless
	 * the imported data overwrites them by ID. It creates new tools if the IDs do not exist
	 * and updates existing ones if they do.
	 *
	 * @param json - A JSON string containing an array of line tool export data.
	 * @returns `true` if the import process completed successfully, `false` if the JSON was invalid.
	 */
	public importLineTools(json: string): boolean {
		// Behavioral change: Do NOT removeAll() first, just use createOrUpdate
		// Ensure it's synchronous and returns boolean
		try {
			const parsedTools = JSON.parse(json);
			if (!Array.isArray(parsedTools)) {
				throw new Error('Import data is not a valid array of line tools.');
			}
			parsedTools.forEach((toolData: LineToolExport<LineToolType>) => {
				// Use createOrUpdateLineTool to handle updating existing or creating new
				this.createOrUpdateLineTool(toolData.toolType, toolData.points, toolData.options, toolData.id);
			});
			//console.log(`Imported ${parsedTools.length} line tools.`);
			this.requestUpdate(); // Trigger a single update after all imports
			return true;
		} catch (e: any) {
			console.error('Failed to import line tools:', e.message);
			return false;
		}
	}

	/**
	 * Retrieves the series data rows within a specified time range.
	 *
	 * @param range - An object containing the 'from' and 'to' timestamps or date strings.
	 * @returns An array of native series data objects (e.g., OHLC) found within the requested range.
	 */
	public getDataInRange(range: { from: number | string; to: number | string }): any[] {
		const seriesData = this._series.data();
		if (seriesData.length === 0) return [];

		const fromKey = typeof range.from === 'number' ? range.from : this._horzScaleBehavior.key(range.from as any);
		const toKey = typeof range.to === 'number' ? range.to : this._horzScaleBehavior.key(range.to as any);

		const startIndex = this._findBarIndex(fromKey as number, 'ceil');
		const endIndex = this._findBarIndex(toKey as number, 'floor');

		if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return [];

		return seriesData.slice(startIndex, endIndex + 1) as any[];
	}

	/**
	 * Retrieves a single data row at a specific timestamp.
	 *
	 * @param time - The timestamp or business day string to look up.
	 * @returns The data object if an exact match is found, otherwise `null`.
	 */
	public getBarAtTime(time: number | string): any | null {
		const targetKey = typeof time === 'number' ? time : this._horzScaleBehavior.key(time as any);
		const index = this._findBarIndex(targetKey as number, 'exact');
		
		// PERFORMANCE FIX: Use dataByIndex instead of data()[index]
		// Calling .data() creates a full copy of the chart array. dataByIndex is O(1) 
		// and points directly to the existing object in memory.
		return index !== -1 ? this._series.dataByIndex(index as any, 0) : null;
	}

	/**
	 * Finds the data row closest to a target timestamp based on the provided search mode.
	 * Useful for cross-timeframe syncing (e.g., finding a 15m candle from a 1m timestamp).
	 *
	 * @param time - The target timestamp or business day string.
	 * @param mode - The search strategy ('exact', 'floor', 'ceil', or 'nearest').
	 * @returns The data object matching the criteria, or `null`.
	 */
	public getClosestBar(time: number | string, mode: 'exact' | 'floor' | 'ceil' | 'nearest'): any | null {
		const targetKey = typeof time === 'number' ? time : this._horzScaleBehavior.key(time as any);
		const index = this._findBarIndex(targetKey as number, mode);
		
		// PERFORMANCE FIX: Use dataByIndex to avoid massive array allocations during high-frequency lookups
		return index !== -1 ? this._series.dataByIndex(index as any, 0) : null;
	}	

	/**
	 * Retrieves the data row located at a specific pixel coordinate on the chart.
	 *
	 * @param x - The X-coordinate (in pixels) relative to the chart canvas.
	 * @returns The data object corresponding to the bar under the coordinate, or `null`.
	 */
	public getBarAtCoordinate(x: number): any | null {
		const timeScale = this._chart.timeScale();
		const logical = timeScale.coordinateToLogical(x as Coordinate);
		if (logical === null) return null;

		// Convert logical index to a timestamp key using our scale behavior
		const time = timeScale.logicalToCoordinate(logical); // get timestamp if exists
		// In v5, dataByIndex is the official way to bridge Logical Index -> Data Row
		return this._series.dataByIndex(Math.round(logical) as any) || null;
	}

	/**
	 * Retrieves the first (earliest) data row currently loaded in the series.
	 * 
	 * ### Performance Note:
	 * Uses $O(1)$ lookup via `dataByIndex` with `MismatchDirection.NearestRight` (1).
	 * This completely avoids loading the series data array into memory, maintaining 144+ FPS.
	 *
	 * @returns The earliest data object, or `null` if the series is empty.
	 */
	public getEarliestBar(): any | null {
		// Ask for index negative infinity, return the nearest actual bar to its right.
		return this._series.dataByIndex(-Number.MAX_SAFE_INTEGER, 1) || null;
	}

	/**
	 * Retrieves the last (most recent) data row currently loaded in the series.
	 * 
	 * ### Performance Note:
	 * Uses $O(1)$ lookup via `dataByIndex` with `MismatchDirection.NearestLeft` (-1).
	 *
	 * @returns The most recent data object, or `null` if the series is empty.
	 */
	public getLatestBar(): any | null {
		// Ask for index positive infinity, return the nearest actual bar to its left.
		return this._series.dataByIndex(Number.MAX_SAFE_INTEGER, -1) || null;
	}

	/**
	 * Retrieves the full time range covered by the currently loaded series data.
	 * 
	 * ### Performance Note:
	 * Uses the optimized endpoint lookups to instantly determine the bounds 
	 * without iterating or allocating the dataset.
	 *
	 * @returns An object with 'from' and 'to' timestamps, or `null` if the series is empty.
	 */
	public getFullTimeRange(): { from: any; to: any } | null {
		const firstBar = this.getEarliestBar();
		const lastBar = this.getLatestBar();
		
		if (!firstBar || !lastBar) return null;
		
		return {
			from: firstBar.time,
			to: lastBar.time,
		};
	}

	/**
	 * Subscribes a callback function to the "Double Click" event.
	 *
	 * This event fires whenever a user double-clicks on an existing line tool.
	 * It is often used to open custom settings modals or perform specific actions on the tool.
	 *
	 * @param handler - The function to execute when the event fires. Receives {@link LineToolsDoubleClickEventParams}.
	 * @returns void
	 */
	public subscribeLineToolsDoubleClick(handler: LineToolsDoubleClickEventHandler): void {
		this._doubleClickDelegate.subscribe(handler);
	}

	/**
	 * Unsubscribes a previously registered callback from the "Double Click" event.
	 *
	 * @param handler - The specific callback function that was passed to {@link subscribeLineToolsDoubleClick}.
	 * @returns void
	 */
	public unsubscribeLineToolsDoubleClick(handler: LineToolsDoubleClickEventHandler): void {
		this._doubleClickDelegate.unsubscribe(handler);
	}

	/**
	 * Subscribes a callback function to the "After Edit" event.
	 *
	 * This event fires whenever a line tool is:
	 * 1. Modified (points moved or properties changed).
	 * 2. Finished creating (the final point was placed).
	 *
	 * @param handler - The function to execute when the event fires. Receives {@link LineToolsAfterEditEventParams}.
	 * @returns void
	 *
	 * @example
	 * plugin.subscribeLineToolsAfterEdit((params) => {
	 *   console.log('Tool edited:', params.selectedLineTool.id);
	 *   console.log('Edit stage:', params.stage);
	 * });
	 */
	public subscribeLineToolsAfterEdit(handler: LineToolsAfterEditEventHandler): void {
		this._afterEditDelegate.subscribe(handler);
	}

	/**
	 * Unsubscribes a previously registered callback from the "After Edit" event.
	 *
	 * Use this to stop listening for tool creation or modification events, typically during
	 * component cleanup or when the chart is being destroyed.
	 *
	 * @param handler - The specific callback function that was passed to {@link subscribeLineToolsAfterEdit}.
	 * @returns void
	 */
	public unsubscribeLineToolsAfterEdit(handler: LineToolsAfterEditEventHandler): void {
		this._afterEditDelegate.unsubscribe(handler);
	}

	/**
	 * Subscribes a callback function to the "Single Click" selection event.
	 * 
	 * This event fires when a tool is selected or when the current selection is cleared.
	 *
	 * @param handler - The function to execute when the event fires. Receives {@link LineToolsSingleClickEventParams}.
	 * @returns void
	 */
	public subscribeLineToolsSingleClick(handler: LineToolsSingleClickEventHandler): void {
		this._selectSingleClickDelegate.subscribe(handler);
	}

	/**
	 * Unsubscribes a previously registered callback from the "Single Click" selection event.
	 *
	 * @param handler - The specific callback function that was passed to {@link subscribeLineToolsSingleClick}.
	 * @returns void
	 */
	public unsubscribeLineToolsSingleClick(handler: LineToolsSingleClickEventHandler): void {
		this._selectSingleClickDelegate.unsubscribe(handler);
	}

	/**
	 * Sets the crosshair position to a specific pixel coordinate (x, y) on the chart.
	 *
	 * @param x - The x-coordinate (in pixels).
	 * @param y - The y-coordinate (in pixels).
	 * @param visible - Controls the visibility.
	 * @param providedTime - Optional. The logical time value.
	 * @param providedPrice - Optional. The logical price value.
	 * @returns void
	 */
	public setCrossHairXY(x: number | null, y: number | null, visible: boolean, providedTime?: HorzScaleItem, providedPrice?: number): void {
		if (!visible) {
			this.clearCrossHair();
			return;
		}

		const chart = this._chart;
		const mainSeries = this._series;

		// 1. DIRECT SYNC BYPASS: If logical values are provided, use them immediately.
		// This bypasses the InteractionManager entirely for the Slave chart.
		if (providedTime !== undefined && providedPrice !== undefined) {
			chart.setCrosshairPosition(
				providedPrice, 
				providedTime, 
				mainSeries as ISeriesApi<SeriesType, HorzScaleItem> 
			);
			
			// Update our supplemental time label if x is provided
			if (x !== null) {
				this._crosshairTimeView.update();
			}
			return;
		}

		// 2. STANDARD MOUSE LOGIC: Use conversion and magnet snapping
		if (x !== null && y !== null) {
			const lineToolPoint = this._interactionManager.screenPointToLineToolPoint(new Point(x as Coordinate, y as Coordinate));

			if (lineToolPoint) {
				const horizontalPosition: HorzScaleItem = providedTime 
					? providedTime 
					: lineToolPoint.timestamp as unknown as HorzScaleItem;

				chart.setCrosshairPosition(
					lineToolPoint.price, 
					horizontalPosition, 
					mainSeries as ISeriesApi<SeriesType, HorzScaleItem> 
				);
			} else {
				this.clearCrossHair();
			}
		}
	}	



    /**
	 * Clears the chart's crosshair, making it invisible.
	 *
	 * This acts as a proxy for the underlying Lightweight Charts API `clearCrosshairPosition()`.
	 * Use this to programmatically hide the crosshair (e.g., when the mouse leaves a custom container).
	 *
	 * @returns void
	 */
	/*
    public clearCrossHair(): void {
        this._chart.clearCrosshairPosition();
    }
	*/

    public clearCrossHair(): void {
        this._chart.clearCrosshairPosition();
		// Ensure our supplemental label is reset and hidden
		this._crosshairTimeView.updateState('', 0 as Coordinate, false);
    }
	
	/**
	 * Updates the state of the supplemental crosshair time axis label.
	 * 
	 * This is used internally by the InteractionManager to draw the crosshair 
	 * label in the "blank space" where Lightweight Charts natively hides it.
	 * 
	 * @param text - The formatted time string.
	 * @param x - The X coordinate in pixels.
	 * @param visible - Whether the supplemental label should be shown.
	 * @internal
	 */
	public updateCrosshairTimeLabel(text: string, x: Coordinate, visible: boolean): void {
		this._crosshairTimeView.updateState(text, x, visible);
	}

	/**
	 * Sets the magnet threshold in pixels for snapping to price data.
	 * 
	 * This value serves as the global default. Setting this will trigger a redraw 
	 * to ensure any active ghost points or crosshairs immediate reflect the new 
	 * snapping strength.
	 *
	 * @param pixels - The snapping tolerance in pixels.
	 */
	public setMagnetThreshold(pixels: number): void {
		this._magnetThreshold = pixels;
		this.requestUpdate();
	}

	/**
	 * Retrieves the current global magnet threshold.
	 * 
	 * This is used by the InteractionManager to determine the default 
	 * snapping behavior when a tool does not provide its own override.
	 * 
	 * @internal
	 * @returns The threshold in pixels.
	 */
	public getMagnetThreshold(): number {
		return this._magnetThreshold;
	}
	
	/**
	 * Converts screen coordinates to logical time and price using the plugin's
	 * internal interpolation and snapping engine.
	 * 
	 * @param x - Pixel X.
	 * @param y - Pixel Y.
	 * @returns The logical point.
	 */
	public getLogicalPoint(x: number, y: number): LineToolPoint | null {
		return this._interactionManager.screenPointToLineToolPoint(new Point(x as Coordinate, y as Coordinate));
	}

	/**
	 * Configures a custom formatter for the time labels.
	 * 
	 * [v1.1 MASTER SETTER]
	 * This method acts as a synchronization proxy. It updates the chart's native 
	 * localization while storing the formatter for the plugin's internal 
	 * "Gap Repair" engine. By updating both, we ensure that the crosshair 
	 * looks identical over data candles (handled by the chart) and in the 
	 * blank space (handled by the plugin).
	 * 
	 * @param formatter - The formatting function, or null to revert to defaults.
	 */
	public setTimeFormatter(formatter: ((time: any) => string) | null): void {
		this._customTimeFormatter = formatter;

		// 1. Synchronize the native chart options.
		// Providing a formatter here causes LWC v5 to go "silent" in the 
		// blank space, which our InteractionManager is designed to repair.
		// We use 'as any' to force the reset signal (null) through the 
		// TypeScript definitions, as 'null' is the runtime trigger for 
		// LWC to clear its internal override and return to stock defaults.
		this._chart.applyOptions({
			localization: {
				timeFormatter: formatter as any,
			},
		});

		// 2. Trigger an update to refresh all tool labels and the crosshair immediately.
		this.requestUpdate();
	}

	/**
	 * Retrieves the currently active custom time formatter.
	 * 
	 * @internal
	 * @returns The formatter function, or `null` if none is set.
	 */
	public getTimeFormatter(): ((time: any) => string) | null {
		return this._customTimeFormatter;
	}

	/**
	 * Sets the global interaction lock state for the plugin.
	 * 
	 * This implementation delegates the state management to the InteractionManager. 
	 * If the chart is being locked, the manager will also handle the safety cleanup 
	 * of any currently selected tools or active drawing gestures to ensure the 
	 * UI doesn't get "stuck."
	 * 
	 * @param locked - `true` to disable all drawing and editing, `false` to restore interaction.
	 */
	public setLocked(locked: boolean): void {
		this._interactionManager.setLocked(locked);
	}

	/**
	 * Returns the current interaction lock state of the plugin.
	 * 
	 * @returns `true` if drawings are currently in read-only mode.
	 */
	public isLocked(): boolean {
		return this._interactionManager.isLocked();
	}

	/**
	 * Completely destroys the line tools plugin instance and cleans up all associated memory.
	 * 
	 * This orchestrates a "Full Uninstall" sequence:
	 * 1. Safely removes all active drawing tools and clears their individual states.
	 * 2. Unbinds all internal mouse/keyboard event listeners in the Interaction Manager.
	 * 3. Clears all event delegates to release user-provided callbacks from memory.
	 * 4. Detaches the core plugin itself from the rendering engine.
	 * 5. Transforms the instance into a no-op dummy by overwriting its own API methods.
	 * 6. Severs all internal references to the chart and series to allow garbage collection.
	 * 
	 * @returns void
	 */
	public destroy(): void {
		if (this._isDestroyed) { return; }
		console.log('[CorePlugin] Initiating logical destruction...');
		
		// 1. Mark as destroyed immediately to prevent re-entry
		this._isDestroyed = true;

		// 2. Clean up all drawn tools (triggers their individual destroy methods)
		this.removeAllLineTools();
		this._tools.clear();

		// 3. Kill the Interaction Manager (removes all listeners and severs its guts)
		this._interactionManager.destroy();

		// 4. Kill the Delegates
		// This releases any user-provided callback functions from memory to prevent closure leaks.
		this._doubleClickDelegate.destroy();
		this._afterEditDelegate.destroy();
		this._selectSingleClickDelegate.destroy();

		// 5. Clean up the core plugin's primitive from the series (crosshair view)
		try {
			// Officially tell Lightweight Charts to stop using this plugin
			this._series.detachPrimitive(this);
		} catch (e: any) {
			// Fail silently if already detached or series is gone
		}

		// 6. SELF-NEUTERING: Transform into a Dummy
		// We obtain a fresh set of no-op functions from our dummy API factory.
		const dummyApi = createDummyPluginApi();

		// We iterate over every key in the dummy API and overwrite our own methods.
		// This ensures that any external code still holding a reference to this 
		// specific plugin instance will call "do nothing" functions instead of crashing.
		Object.keys(dummyApi).forEach((key) => {
			const member = (dummyApi as any)[key];
			if (typeof member === 'function') {
				(this as any)[key] = member;
			}
		});

		// 7. SEVER THE GUTS
		// Now that the methods are swapped, they no longer reference 'this._chart'.
		// We can safely null out these references so the browser can reclaim the memory.
		(this._chart as any) = null;
		(this._series as any) = null;
		(this._horzScaleBehavior as any) = null;
		(this._priceAxisLabelStackingManager as any) = null;
		(this._crosshairTimeView as any) = null;
		(this._customTimeFormatter as any) = null;

		console.log('[CorePlugin] Plugin has been fully uninstalled and destroyed.');
	}	

	// #endregion

	/**
	 * Broadcasts an event indicating that a line tool has been double-clicked.
	 *
	 * This method is called internally by the {@link InteractionManager} upon detecting a double-click
	 * interaction on a tool. It triggers listeners subscribed via {@link subscribeLineToolsDoubleClick}.
	 *
	 * @internal
	 * @param tool - The tool instance that was double-clicked.
	 * @returns void
	 */
	public fireDoubleClickEvent(tool: BaseLineTool<HorzScaleItem>): void {
		//console.log(`[CorePlugin] Firing DoubleClick event for tool: ${tool.id()}`);
		const eventParams: LineToolsDoubleClickEventParams = {
			selectedLineTool: tool.getExportData(),
		};
		this._doubleClickDelegate.fire(eventParams);
	}

	/**
	 * Broadcasts an event indicating that a line tool's selection state has changed.
	 * 
	 * This method constructs a predictive payload where keys are always present,
	 * but geometric and style data is set to null during a 'deselected' state 
	 * to ensure the payload remains lightweight.
	 *
	 * @internal
	 * @param tool - The tool instance whose state changed.
	 * @param selectionState - The new state of the tool ('selected' or 'deselected').
	 * @returns void
	 */
	public fireSingleClickEvent(tool: BaseLineTool<HorzScaleItem>, selectionState: 'selected' | 'deselected'): void {
		//console.log(`[CorePlugin] Firing SingleClick event: ${tool.id()} is now ${selectionState}`);

		// Build the predictive payload
		const eventParams: LineToolsSingleClickEventParams = {
			selectionState: selectionState,
			selectedLineTool: {
				id: tool.id(),
				toolType: tool.toolType,
				// Include points and options only if the tool is being selected
				points: selectionState === 'selected' ? tool.points() : null,
				options: selectionState === 'selected' ? tool.options() : null,
			}
		};

		// --- NEW: Detailed inspection log for testing ---
		// This will show you the exact object that the frontend will eventually receive.
		//console.log('[CorePlugin] Selection Payload Payload:', JSON.parse(JSON.stringify(eventParams)));

		this._selectSingleClickDelegate.fire(eventParams);
	}

	/**
	 * Broadcasts an event indicating that a line tool has been modified or created.
	 *
	 * This method is primarily called internally by the {@link InteractionManager} when a user
	 * finishes drawing or editing a tool. It triggers any listeners subscribed via
	 * {@link subscribeLineToolsAfterEdit}.
	 *
	 * @internal
	 * @param tool - The tool instance that was edited.
	 * @param stage - The stage of the edit action (e.g., 'lineToolEdited' for modification, 'lineToolFinished' for creation).
	 * @returns void
	 */
	public fireAfterEditEvent(tool: BaseLineTool<HorzScaleItem>, stage: 'lineToolEdited' | 'pathFinished' | 'lineToolFinished'): void {
		//console.log(`[CorePlugin] Firing AfterEdit event for tool: ${tool.id()} with stage: ${stage}`);
		const eventParams: LineToolsAfterEditEventParams = {
			selectedLineTool: tool.getExportData(),
			stage: stage,
		};
		this._afterEditDelegate.fire(eventParams);
	}

	/**
	 * Retrieves the instance of the Price Axis Label Stacking Manager.
	 *
	 * This manager is responsible for preventing overlap between the price labels of different tools
	 * on the Y-axis. This accessor is primarily used internally by {@link BaseLineTool} to register its labels.
	 *
	 * @internal
	 * @returns The shared {@link PriceAxisLabelStackingManager} instance.
	 */
	public getPriceAxisLabelStackingManager(): PriceAxisLabelStackingManager<HorzScaleItem> {
		return this._priceAxisLabelStackingManager;
	}

	/**
	 * Implementation of ISeriesPrimitive. Returns the views for the time axis.
	 */
	public timeAxisViews(): readonly ITimeAxisView[] {
		// Only return the view if the chart is visible
		//console.log(`[CrosshairDebug] LWC requested timeAxisViews. View Visible: ${this._crosshairTimeView.visible()}`);
		return [this._crosshairTimeView];
	}

    /**
	 * Optional Z-Order implementation for the plugin primitive.
	 * This ensures our injected crosshair label stays on the topmost layer.
	 */
	public zOrder(): 'top' | 'normal' | 'bottom' {
		return 'top';
	}

	/**
	 * Implementation of ISeriesPrimitive. We don't render anything on the price axis for the core itself.
	 */
	public priceAxisViews(): readonly IPriceAxisView[] {
		return [];
	}

	/**
	 * Implementation of ISeriesPrimitive. We don't render anything on the main pane.
	 */
	public paneViews(): readonly IPaneView[] {
		return [];
	}

	/**
	 * Implementation of ISeriesPrimitive. The core itself does not capture mouse hits.
	 */
	public hitTest(): PrimitiveHoveredItem | null {
		return null;
	}

	/**
	 * Implementation of ISeriesPrimitive. Triggers when attached to a series.
	 */
	public attached(param: SeriesAttachedParameter<HorzScaleItem>): void {
		// Logic handled in constructor, but interface requires implementation
	}

	/**
	 * Implementation of ISeriesPrimitive. Triggers when detached.
	 */
	public detached(): void {
		// Logic handled in constructor, but interface requires implementation
	}

	/**
	 * Implementation of ISeriesPrimitive. Signals that views need updating.
	 */
	public updateAllViews(): void {
		this._crosshairTimeView.update();
	}	

	/**
	 * Internal factory method to instantiate and register a new tool.
	 *
	 * This handles the common logic for `addLineTool`, `createOrUpdateLineTool`, and `importLineTools`,
	 * including checking the registry, creating the instance, attaching it to the series, and
	 * managing interactive state if required.
	 *
	 * @param type - The tool type identifier.
	 * @param points - The initial points for the tool.
	 * @param options - Optional configuration options.
	 * @param id - Optional specific ID (if not provided, the tool generates its own).
	 * @param initiateInteractive - If `true`, sets the tool to "Creating" mode and updates the InteractionManager.
	 * @returns The newly created `BaseLineTool` instance.
	 * @throws Error if the tool type is not registered.
	 * @private
	 */
	private _createAndAddTool<T extends LineToolType>(
		type: T,
		points: LineToolPoint[],
		options?: LineToolPartialOptionsMap[T],
		id?: string,
		initiateInteractive: boolean = false // New parameter to signal interactive drawing initiation
	): BaseLineTool<HorzScaleItem> {
		if (!this._toolRegistry.isRegistered(type)) {
			throw new Error(`Cannot create tool: Line tool type "${type}" is not registered.`);
		}

		if (initiateInteractive) {
            this._interactionManager.deselectAllTools();
        }

		const ToolClass = this._toolRegistry.getToolClass(type);

		// --- ROUNDING INJECTION: Sanitize untrusted external point data ---
		const seriesOptions = this._series.options() as any;
		const minMove = seriesOptions?.priceFormat?.minMove || 0.01;

		const sanitizedPoints = points.map(p => ({
			...p,
			price: roundPriceToStep(p.price, minMove)
		}));

		const newTool = new ToolClass(
			this,
			this._chart,
			this._series,
			this._horzScaleBehavior,
			options,
			sanitizedPoints, // Pass sanitized array instead of raw points
			this._priceAxisLabelStackingManager,
		);

		if (id) {
			newTool.setId(id);
		}

		this._tools.set(newTool.id(), newTool);
		this._series.attachPrimitive(newTool);

		// NEW LOGIC for addLineTool's interactive initiation
		if (initiateInteractive) {
			newTool.setCreating(true); // Mark the tool as actively being created
			this._interactionManager.setCurrentToolCreating(newTool); // Set THIS tool as the target for interactive drawing
		}

		this._chart.applyOptions({}); // Trigger a chart update to render the new tool
		//console.log(`Created or updated line tool: ${type} with ID: ${newTool.id()}`);
		return newTool;
	}

	/**
	 * Core Binary Search Engine: Finds the index of a bar based on its timestamp key.
	 * 
	 * Supports optimized lookup modes for crosshair synchronization and range fetching.
	 * Time complexity: O(log n)
	 *
	 * @private
	 * @param targetKey - The numeric timestamp key to search for.
	 * @param mode - The search mode ('exact', 'floor', 'ceil', or 'nearest').
	 * @returns The index of the matching bar in the series data array, or -1 if not found.
	 */
	private _findBarIndex(targetKey: number, mode: 'exact' | 'floor' | 'ceil' | 'nearest'): number {

		// PERFORMANCE FIX: We must avoid calling this._series.data() here.
		// That method creates a full copy of the chart array, which is slow and memory intensive.
		// Instead, we resolve the chart boundaries using O(1) direct index lookups.
		const lastBar = this.getLatestBar();
		if (!lastBar) return -1;

		// We find the search ceiling by mapping the latest bar's time to its logical index.
		const timeScale = this._chart.timeScale();
		const lastLogical = timeScale.coordinateToLogical(timeScale.timeToCoordinate(lastBar.time as HorzScaleItem)!);
		
		if (lastLogical === null) return -1;

		let low = 0;
		let high = Math.round(lastLogical);
		let lastValidIndex = -1;

		// Standard Binary Search using direct index probes via dataByIndex
		while (low <= high) {
			const mid = (low + high) >> 1;
			
			// dataByIndex(mid, 0) is the efficient way to look at a candle without extracting the whole array.
			const midBar = this._series.dataByIndex(mid as any, 0);
			if (!midBar) break;

			const midKey = this._horzScaleBehavior.key(midBar.time as HorzScaleItem);

			if (midKey === targetKey) return mid;

			if (midKey < targetKey) {
				if (mode === 'floor' || mode === 'nearest') lastValidIndex = mid;
				low = mid + 1;
			} else {
				if (mode === 'ceil' || mode === 'nearest') lastValidIndex = mid;
				high = mid - 1;
			}
		}

		if (mode === 'exact' || lastValidIndex === -1) return -1;

		// Refined 'nearest' logic using direct index probes
		if (mode === 'nearest') {
			const bar1 = this._series.dataByIndex(lastValidIndex as any, 0);
			
			// NULL CHECK: Ensure the primary neighbor bar was successfully retrieved
			if (bar1) {
				const k1 = this._horzScaleBehavior.key(bar1.time as HorzScaleItem);
				const otherIndex = k1 < targetKey ? lastValidIndex + 1 : lastValidIndex - 1;

				const bar2 = this._series.dataByIndex(otherIndex as any, 0);
				if (bar2) {
					const k2 = this._horzScaleBehavior.key(bar2.time as HorzScaleItem);
					if (Math.abs(targetKey - k2) < Math.abs(targetKey - k1)) {
						return otherIndex;
					}
				}
			}
		}

		return lastValidIndex;
	}

}