// /src/views/line-tool-time-axis-label-view.ts

import {
	TimeAxisViewRendererData,
	ITimeAxisViewRenderer,
	ITimeAxisView, // Our internal interface
	TextWidthCache, // Needed for TimeAxisViewRendererOptions type
	TimeAxisViewRendererOptions, // NEW: For height method parameters
} from '../types';
import { BaseLineTool } from '../model/base-line-tool';
import { LineToolPoint } from '../api/public-api';
import { generateContrastColors } from '../utils/helpers';
import { IChartApiBase, Coordinate, Time, ITimeScaleApi, UTCTimestamp, isBusinessDay, isUTCTimestamp, InternalHorzScaleItem, ISeriesPrimitiveAxisView, Logical } from 'lightweight-charts';
import { interpolateLogicalIndexFromTime, logicalIndexToCoordinate } from '../utils/geometry';


// Assume TimeAxisViewRenderer is a class as defined in src/rendering/time-axis-view-renderer.ts
import { TimeAxisViewRenderer } from '../rendering/time-axis-view-renderer';

/**
 * A concrete implementation of a Time Axis View for a specific anchor point of a Line Tool.
 * 
 * This class manages the lifecycle of a single label on the X-axis (Time Scale). 
 * Unlike standard views, it implements specialized logic to render labels in the "blank space" 
 * (future dates) by using logical index interpolation, ensuring tools can be drawn 
 * beyond the last existing data bar.
 * 
 * @typeParam HorzScaleItem - The type of the horizontal scale item (e.g., `Time` or `UTCTimestamp`).
 */
export class LineToolTimeAxisLabelView<HorzScaleItem> implements ITimeAxisView {
	private readonly _tool: BaseLineTool<HorzScaleItem>;
	private readonly _pointIndex: number;
	private readonly _chart: IChartApiBase<HorzScaleItem>; // Reference to chart for timescale & formatting
	private readonly _timeScale: ITimeScaleApi<HorzScaleItem>; // Direct reference to timeScaleAPI for convenience

	private readonly _renderer: ITimeAxisViewRenderer;
	private readonly _rendererData: TimeAxisViewRendererData = {
		visible: false,
		background: '#4c525e', // Default background, will be overridden
		color: 'white', // Default text color, will be overridden
		text: '',
		width: 0, // Will be filled by updateImpl
		coordinate: 0 as Coordinate, // X-coordinate will be filled by updateImpl
	};

	private _invalidated: boolean = true;

	/**
     * Initializes the time axis label view.
     * 
     * @param tool - The parent line tool instance.
     * @param pointIndex - The index of the point in the tool's data array that this label represents.
     * @param chart - The chart API instance (used for time scale access and formatting).
     */
	public constructor(tool: BaseLineTool<HorzScaleItem>, pointIndex: number, chart: IChartApiBase<HorzScaleItem>) {
		this._tool = tool;
		this._pointIndex = pointIndex;
		this._chart = chart;
		this._timeScale = chart.timeScale(); // Initialize timeScale reference
		this._renderer = new TimeAxisViewRenderer(); // Instantiate the renderer
		// No need to setData in constructor; _updateRendererDataIfNeeded will call it later.
	}

	// -------------------------------------------------------------------
	// Implementation of ITimeAxisView / ISeriesPrimitiveAxisView methods
	// -------------------------------------------------------------------

	/**
     * Marks the view as invalidated.
     * 
     * This signals that the internal data (text, coordinate, color) needs to be recalculated 
     * before the next render cycle. This is typically called when the tool moves or options change.
     */
	public update(): void {
		this._invalidated = true;
	}

	/**
     * Retrieves the renderer responsible for drawing the label.
     * 
     * This method ensures the renderer's data is up-to-date by triggering a recalculation 
     * (`_updateImpl`) if the view is invalidated.
     * 
     * @returns The {@link ITimeAxisViewRenderer} instance.
     */
	public getRenderer(): ITimeAxisViewRenderer {
		// Ensure renderer data is up-to-date before returning the renderer
		this._updateRendererDataIfNeeded();
		this._renderer.setData(this._rendererData); // setData is now a required method.
		return this._renderer;
	}

	/**
     * Retrieves the formatted text content for the label.
     * 
     * @returns The formatted date/time string based on the chart's localization settings.
     */
	public text(): string {
		this._updateRendererDataIfNeeded();
		return this._rendererData.text;
	}

	/**
     * Retrieves the X-coordinate of the label's center.
     * 
     * @returns The screen coordinate in pixels.
     */
	public coordinate(): Coordinate {
		this._updateRendererDataIfNeeded();
		return this._rendererData.coordinate as Coordinate;
	}

	/**
     * Retrieves the text color.
     * 
     * @returns A CSS color string (usually calculated for high contrast against the background).
     */
	public textColor(): string {
		this._updateRendererDataIfNeeded();
		return this._rendererData.color;
	}

	/**
     * Retrieves the background color of the label tag.
     * 
     * @returns A CSS color string (derived from the tool's styling options).
     */
	public backColor(): string {
		this._updateRendererDataIfNeeded();
		return this._rendererData.background;
	}

	/**
     * Checks if the label should be currently visible.
     * 
     * Visibility depends on:
     * 1. The tool's global visibility.
     * 2. The `showTimeAxisLabels` option.
     * 3. The tool's interaction state (selected/hovered) vs. `timeAxisLabelAlwaysVisible`.
     * 
     * @returns `true` if the label should be drawn.
     */
	public visible(): boolean {
		this._updateRendererDataIfNeeded();
		return this._rendererData.visible;
	}

	/**
     * Calculates the required height of the label in the time scale area.
     * 
     * This delegates to the renderer's measurement logic to ensure consistency.
     * 
     * @param rendererOptions - Current styling options for the time axis.
     * @returns The height in pixels.
     */
	public height(rendererOptions: TimeAxisViewRendererOptions): number {
		// Delegate to the actual renderer to calculate its perceived height
		// This ensures consistency between measure and draw.
		return this._renderer.height(rendererOptions);
	}

	// -------------------------------------------------------------------
	// Private/Protected helper methods for updating data
	// -------------------------------------------------------------------

	/**
     * Internal helper to trigger data recalculation only if the view is dirty.
     * 
     * @private
     */
	private _updateRendererDataIfNeeded(): void {
		if (this._invalidated) {
			this._updateImpl();
			this._invalidated = false;
		}
	}

	/**
	 * Synchronizes the internal state of the time axis label with the tool's current logical position.
	 * 
	 * This method acts as the data-preparation engine for the renderer. It performs 
	 * visibility arbitration, tiered text formatting (matching chart localization), 
	 * high-contrast color generation, and coordinate mapping.
	 * 
	 * ### Sub-Pixel Accuracy
	 * This view utilizes fractional logical index interpolation to ensure that labels 
	 * do not "jump" between candles on higher timeframes. By calculating visual positions 
	 * manually via neighbor-probing, it avoids native API limitations that would otherwise 
	 * cause labels to stick to the left edge of the screen.
	 * 
	 * @private
	 * @returns void
	 */
	private _updateImpl(): void {
		const data = this._rendererData;

		// --- FIX: THE "HARD RESET" ---
		// We explicitly clear the renderer data at the start of every update.
		// This prevents "stale" text or positions from flickering on screen
		// when the tool is moving fast or being culled.
		data.visible = false;
		data.text = '';
		data.coordinate = 0 as Coordinate;

		// Culling Check: If the parent tool has been determined to be off-screen 
		// by the Model's geometric culling engine, we skip all label calculations.
		if (this._tool.isCulled()) {
			return;
		}

		const toolOptions = this._tool.options();

		// Determine label visibility based on options and active state.
		// Labels will now only appear if the tool is selected, being edited, 
		// or in the process of being created (hovering is excluded).
		const isToolActive = this._tool.isSelected() || this._tool.isEditing() || this._tool.isCreating();

		// Visibility Gate: The label is processed only if the tool is visible, 
		// labels are enabled in options, and the interaction state requirements are met.
		if (!toolOptions.visible || !toolOptions.showTimeAxisLabels || !(toolOptions.timeAxisLabelAlwaysVisible || isToolActive)) {
			return;
		}

		// Retrieve the specific logical point from the model associated with this view.
		const point = this._tool.getPoint(this._pointIndex);
		if (!point || !isFinite(point.timestamp)) {
			return;
		}

		// --- 1. TIERED FORMATTING LOGIC ---
		// We resolve the text label string using the highest-priority formatter available.
		// This ensures the labels match the chart's local time zone and date preferences.
		const timeAsHorzScaleItem = point.timestamp as unknown as HorzScaleItem;
		const pluginFormatter = this._tool.coreApi().getTimeFormatter();
		const chartFormatter = this._chart.options().localization.timeFormatter;

		if (pluginFormatter) {
			// Level 1: Global Plugin Override (provided via setTimeFormatter)
			data.text = pluginFormatter(timeAsHorzScaleItem);
		} else if (chartFormatter) {
			// Level 2: Chart-level localization (provided via chart options)
			data.text = chartFormatter(timeAsHorzScaleItem);
		} else {
			// Level 3: Fallback to the standard scale behavior formatting.
			const internalHorzItem = this._tool.horzScaleBehavior.convertHorzItemToInternal(timeAsHorzScaleItem);
			data.text = this._tool.horzScaleBehavior.formatHorzItem(internalHorzItem);
		}

		// --- 2. STYLE CALCULATION ---
		// Determine the background color and generate a high-contrast foreground color 
		// (black or white) to ensure the text remains readable regardless of label color.
		const backgroundColor = this._tool.timeAxisLabelColor();
		if (backgroundColor === null) return;

		const colors = generateContrastColors(backgroundColor);
		data.background = colors.background;
		data.color = colors.foreground;

		// Verify the TimeScale is ready before proceeding to coordinate math.
		if (this._timeScale.getVisibleLogicalRange() === null) return;

		// --- 3. COORDINATE RESOLUTION ---
		
		// First, resolve the fractional logical index using our robust 3-Zone engine.
		// This handles historical data, weekend gaps, and future blank space extrapolation.
		const interpolatedLogicalIndex = interpolateLogicalIndexFromTime(
			this._chart,
			this._tool.getSeries(),
			timeAsHorzScaleItem as unknown as Time
		);

		if (interpolatedLogicalIndex === null) return;

		// Use the Unified Logic Helper to convert the index into a pixel coordinate.
		// This bypasses the Lightweight Charts bug where decimals cause coordinates to reset to 0.
		const finalX = logicalIndexToCoordinate(this._timeScale, interpolatedLogicalIndex);

		// Final Validation: Ensure the calculated coordinate is a valid, drawable number.
		if (finalX === null || !isFinite(finalX) || isNaN(finalX)) {
			return;
		}

		// Update the shared renderer data with the definitive results for the paint cycle.
		data.coordinate = finalX;
		data.width = this._timeScale.width();
		data.visible = true;
	}
}