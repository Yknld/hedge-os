// /src/views/crosshair-time-axis-label-view.ts

import { 
	IChartApiBase, 
	Coordinate, 
	ITimeScaleApi 
} from 'lightweight-charts';
import { 
	ITimeAxisView, 
	TimeAxisViewRendererData, 
	ITimeAxisViewRenderer 
} from '../types';
import { TimeAxisViewRenderer } from '../rendering/time-axis-view-renderer';
import { generateContrastColors } from '../utils/helpers';

/**
 * A supplemental Time Axis View used to render the crosshair label in the "blank space".
 * 
 * Lightweight Charts v5 natively hides the crosshair time label if the timestamp 
 * does not exist in the series data. This class allows the Core Plugin to 
 * manually inject a label that looks identical to the native one, ensuring 
 * a seamless experience when drawing tools into the future.
 * 
 * @typeParam HorzScaleItem - The type of the horizontal scale item used by the chart.
 */
export class CrosshairTimeAxisLabelView<HorzScaleItem> implements ITimeAxisView {
	private readonly _chart: IChartApiBase<HorzScaleItem>;
	private readonly _timeScale: ITimeScaleApi<HorzScaleItem>;
	private readonly _renderer: ITimeAxisViewRenderer;

	// Internal state storage for the renderer
	private readonly _rendererData: TimeAxisViewRendererData = {
		visible: false,
		background: '#4c525e',
		color: 'white',
		text: '',
		width: 0,
		coordinate: 0 as Coordinate,
		// Disable the vertical tick mark for the supplemental crosshair 
		// label to ensure it matches the native chart's clean aesthetic.
		tickVisible: false,
	};

	private _invalidated: boolean = true;

	/**
	 * Initializes the crosshair time axis label view.
	 * 
	 * @param chart - The chart API instance for accessing options and formatting.
	 */
	public constructor(chart: IChartApiBase<HorzScaleItem>) {
		this._chart = chart;
		this._timeScale = chart.timeScale();
		this._renderer = new TimeAxisViewRenderer();
	}

	/**
	 * Updates the visual state of the supplemental label.
	 * 
	 * @param text - The formatted date/time string to display.
	 * @param coordinate - The pixel X-coordinate where the label should be centered.
	 * @param visible - Whether the supplemental label should be drawn.
	 */
	public updateState(text: string, coordinate: Coordinate, visible: boolean): void {
		const data = this._rendererData;

		// --- Short-circuit if nothing visually changed ---
		if (data.visible === visible && data.text === text && data.coordinate === coordinate) {
			return; 
		}

		data.visible = visible;
		data.text = text;
		data.coordinate = coordinate;

		if (visible) {
			// 1. Pull the background color directly from the native crosshair options
			const chartOptions = this._chart.options();
			const backgroundColor = chartOptions.crosshair.vertLine.labelBackgroundColor;
			
			// 2. Generate the high-contrast foreground color (black or white)
			const colors = generateContrastColors(backgroundColor);
			data.background = colors.background;
			data.color = colors.foreground;

			// 3. Sync the width with the current timescale width
			data.width = this._timeScale.width();
		}
		
		this._invalidated = true;
	}

    /**
	 * Defines the Z-Order for this specific view.
	 * By returning 'top', we ensure the supplemental crosshair label sits 
	 * above line tools and series data, matching the native crosshair behavior.
	 */
	public zOrder(): 'top' | 'normal' | 'bottom' {
		return 'top';
	}	

	/**
	 * Implementation of ITimeAxisView. Returns the renderer.
	 */
	public getRenderer(): ITimeAxisViewRenderer {
		// Ensure the renderer is synchronized with our local data payload
		this._renderer.setData(this._rendererData);
		return this._renderer;
	}

	/**
	 * Implementation of ITimeAxisView. Notifies the view that data is dirty.
	 */
	public update(): void {
		this._invalidated = true;
	}

	// #region ISeriesPrimitiveAxisView Requirements

	/**
	 * Returns the current text content of the label.
	 */
	public text(): string {
		return this._rendererData.text;
	}

	/**
	 * Returns the X-coordinate of the label.
	 */
	public coordinate(): Coordinate {
		return this._rendererData.coordinate as Coordinate;
	}

	/**
	 * Returns the calculated text color.
	 */
	public textColor(): string {
		return this._rendererData.color;
	}

	/**
	 * Returns the background color of the label tag.
	 */
	public backColor(): string {
		return this._rendererData.background;
	}

	/**
	 * Returns whether the supplemental label is currently visible.
	 */
	public visible(): boolean {
		return this._rendererData.visible;
	}

	// #endregion
}