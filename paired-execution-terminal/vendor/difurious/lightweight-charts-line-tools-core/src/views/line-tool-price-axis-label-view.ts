// /src/views/line-tool-price-axis-label-view.ts

import { PriceAxisView } from './price-axis-view';
import {
	PriceAxisViewRendererCommonData,
	PriceAxisViewRendererData,
	PriceAxisViewRendererOptions
} from '../types';
import { BaseLineTool } from '../model/base-line-tool';
import { LineToolPoint } from '../api/public-api';
import { generateContrastColors } from '../utils/helpers';
import { IChartApiBase, Coordinate, ISeriesApi, SeriesType, ISeriesPrimitiveAxisView } from 'lightweight-charts';
import { PriceAxisLabelStackingManager } from '../model/price-axis-label-stacking-manager';
import { PriceAxisViewRenderer } from '../rendering/price-axis-view-renderer';

/**
 * A concrete implementation of a Price Axis View for a specific anchor point of a Line Tool.
 * 
 * This class manages the lifecycle of a single price label on the Y-axis. It is responsible for:
 * 1. formatting the price value based on the series configuration.
 * 2. determining visibility based on the tool's interaction state (selected, hovered).
 * 3. interacting with the {@link PriceAxisLabelStackingManager} to prevent label overlaps.
 * 
 * @typeParam HorzScaleItem - The type of the horizontal scale item.
 */
export class LineToolPriceAxisLabelView<HorzScaleItem> extends PriceAxisView implements ISeriesPrimitiveAxisView {
	private readonly _tool: BaseLineTool<HorzScaleItem>;
	private readonly _pointIndex: number;
	private readonly _chart: IChartApiBase<HorzScaleItem>;
	private readonly _priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>;

	// NEW: Store the fixed coordinate provided by the stacking manager
    private _fixedCoordinate: Coordinate | undefined = undefined;

    private _isRegistered: boolean = false; 

	/**
     * Initializes the price axis label view.
     * 
     * @param tool - The parent line tool instance.
     * @param pointIndex - The index of the point in the tool's data array that this label represents.
     * @param chart - The chart API instance.
     * @param priceAxisLabelStackingManager - The manager instance to register this label with for collision resolution.
     */
	public constructor(tool: BaseLineTool<HorzScaleItem>, pointIndex: number, chart: IChartApiBase<HorzScaleItem>, priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>) {
		super();
		this._tool = tool;
		this._pointIndex = pointIndex;
		this._chart = chart;
		this._priceAxisLabelStackingManager = priceAxisLabelStackingManager;
	}

    /**
     * Retrieves the index of the point this label is associated with.
     * 
     * Used primarily by the {@link PriceAxisLabelStackingManager} to generate a unique ID 
     * for this label (e.g., `ToolID-pIndex`).
     * 
     * @returns The zero-based point index.
     */
    public getPointIndex(): number {
        return this._pointIndex;
    }

    /**
     * Callback method used by the {@link PriceAxisLabelStackingManager} to update the label's vertical position.
     * 
     * If the stacking manager detects a collision, it calls this method with a new, adjusted Y-coordinate.
     * This method then triggers an immediate chart update to ensure the label is drawn at the new position
     * in the same render frame, preventing visual jitter.
     * 
     * @param coordinate - The calculated collision-free Y-coordinate, or `undefined` to use the natural position.
     */
    public setFixedCoordinateFromManager(coordinate: Coordinate | undefined): void {
        if (this._fixedCoordinate !== coordinate) {
            this._fixedCoordinate = coordinate;
            this.update(); // Mark view as dirty

            // *** AGGRESSIVE FIX: Force a chart update to read the new fixed coordinate ***
            // This should eliminate the visual flicker during drag/scale by forcing the coordinate
            // to be read by the renderer within the same frame it was calculated.
            this._tool._triggerChartUpdate(); 
        }
    }    

	/**
	 * The core logic for updating the renderer's state.
	 * 
	 * This method performs the following tasks:
	 * 1. Validates the existence of logical points and API references.
	 * 2. Determines interaction-based visibility (excluding hover states).
	 * 3. Registers the label with the PriceAxisLabelStackingManager for collision resolution.
	 * 4. Configures the final renderer data with high-contrast colors and formatted price strings.
	 * 
	 * @param axisRendererData - The data object for the main axis label.
	 * @param paneRendererData - The data object for any pane-side rendering (unused).
	 * @param commonData - Shared data (coordinates, colors) between axis and pane renderers.
	 */
	protected _updateRendererData(
		axisRendererData: PriceAxisViewRendererData,
		paneRendererData: PriceAxisViewRendererData,
		commonData: PriceAxisViewRendererCommonData
	): void {
		// Apply the shifted coordinate from the Stacking Manager if it exists.
		// This must be set first to ensure the renderer uses the collision-free Y position.
		commonData.fixedCoordinate = this._fixedCoordinate;

		// Initialize default visibility to false.
		axisRendererData.visible = false;
		paneRendererData.visible = false;

		const toolOptions = this._tool.options();
		const priceScaleApi = this._tool.priceScale();
		const series = this._tool.getSeries();
		const point = this._tool.getPoint(this._pointIndex);
		const labelId = this._tool.id() + '-p' + this._pointIndex;

		// --- 1. CULLING CHECK ---
		// If the parent tool determines it is off-screen, we must hide the label
		// and ensure it is removed from the stacking manager to prevent it from
		// pushing other visible labels out of place.
		if (this._tool.isCulled()) {
			if (this._isRegistered) {
				this._priceAxisLabelStackingManager.unregisterLabel(labelId);
				this._isRegistered = false;
				this.setFixedCoordinateFromManager(undefined);
			}
			return;
		}

		// --- 2. INTERACTION STATE CALCULATION ---
		// We define the tool as "Active" if it is Selected, being Edited (anchor drag), 
		// or currently being Created. 
		// 
		// FIX: We explicitly EXCLUDE this._tool.isHovered() here to prevent labels 
		// from appearing merely because the mouse is over the tool.
		const isToolActive = this._tool.isSelected() || this._tool.isEditing() || this._tool.isCreating();
		
		// Determine if the label should be visually active based on the tool's 
		// internal active state and the user's "Always Visible" preference.
		const isLabelVisuallyActive = toolOptions.priceAxisLabelAlwaysVisible || isToolActive;

		// Determine if the label is structurally valid.
		// It must be visible, labels must be enabled, it must have a point, 
		// and the Price Scale must be available.
		const isStructurallyValid = 
			toolOptions.visible &&
			toolOptions.showPriceAxisLabels &&
			isLabelVisuallyActive &&
			point &&
			isFinite(point.price) &&
			priceScaleApi &&
			series;

		// --- 3. HANDLE UNREGISTER/CLEAR ---
		if (!isStructurallyValid) {
			if (this._isRegistered) {
				this._priceAxisLabelStackingManager.unregisterLabel(labelId);
				this._isRegistered = false;
				this.setFixedCoordinateFromManager(undefined); // Clear old fixed coordinate
			}
			return;
		}

		// --- 4. CALCULATE DATA & HEIGHT ---
		// Registration with the stacking manager requires the label's target coordinate 
		// and its physical height.
		
		const backgroundColor = this._tool.priceAxisLabelColor();
		commonData.coordinate = series.priceToCoordinate(point!.price) as Coordinate;

		const layoutOptions = this._chart.options().layout;
		const priceScaleOptions = priceScaleApi!.options();
		
		// Construct options for height measurement.
		const currentRendererOptions: PriceAxisViewRendererOptions = {
			font: `${layoutOptions.fontSize}px ${layoutOptions.fontFamily}`,
			fontFamily: layoutOptions.fontFamily,
			color: layoutOptions.textColor,
			fontSize: layoutOptions.fontSize,
			baselineOffset: Math.round(layoutOptions.fontSize / 10),
			borderSize: priceScaleOptions.borderVisible ? 1 : 0,
			paddingBottom: Math.floor(layoutOptions.fontSize / 3.5),
			paddingTop: Math.floor(layoutOptions.fontSize / 3.5),
			paddingInner: Math.max(Math.ceil(layoutOptions.fontSize / 2 - (priceScaleOptions.ticksVisible ? 4 : 0) / 2), 0),
			paddingOuter: Math.ceil(layoutOptions.fontSize / 2 + (priceScaleOptions.ticksVisible ? 4 : 0) / 2),
			tickLength: priceScaleOptions.ticksVisible ? 4 : 0,
		};
		
		let labelHeight = 16;
		try {
			// Create a temporary renderer to measure the exact height of the label box.
			const textToMeasure = series.priceFormatter().format(point!.price) || '0';
			const tempRendererData: PriceAxisViewRendererData = { text: textToMeasure, visible: true, tickVisible: false } as any;
			const tempCommonData: PriceAxisViewRendererCommonData = { coordinate: 0 as Coordinate, background: 'black', color: 'white' } as any;
			const tempRenderer = new PriceAxisViewRenderer(tempRendererData, tempCommonData);
			labelHeight = tempRenderer.height(currentRendererOptions, false);
		} catch (e) {
			// Fallback to a default height if measurement fails.
		}

		// --- 5. REGISTER/UPDATE WITH STACKING MANAGER ---
		// We register the label with the manager to detect and resolve vertical collisions.
		this._priceAxisLabelStackingManager.registerLabel({
			id: labelId,
			toolId: this._tool.id(),
			originalCoordinate: commonData.coordinate as Coordinate,
			height: labelHeight,
			setFixedCoordinate: (coord: Coordinate | undefined) => this.setFixedCoordinateFromManager(coord),
			isVisible: () => true, // Already checked structural validity
		});

		this._isRegistered = true;

		// --- 6. FINAL RENDERER SETUP ---
		// If a valid background color is provided, configure the renderer to draw.
		if (backgroundColor !== null) {
			const colors = generateContrastColors(backgroundColor);
			commonData.background = colors.background;
			commonData.color = colors.foreground;
			axisRendererData.text = series.priceFormatter().format(point!.price);
			axisRendererData.borderColor = colors.background;
			axisRendererData.visible = true; 
		} else {
			axisRendererData.visible = false;
		}
	}

}