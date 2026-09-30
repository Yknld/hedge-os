import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";

export interface LineToolsPlugin {
  registerLineTool(type: string, toolClass: new (...args: any[]) => any): void;
  addLineTool(type: string, points?: Array<{ timestamp: number; price: number }>, options?: Record<string, unknown>): string;
  removeAllLineTools(): void;
  removeSelectedLineTools(): void;
  exportLineTools(): string;
  importLineTools(json: string): boolean;
  createOrUpdateLineTool(type: string, points: Array<{ timestamp: number; price: number }>, options: Record<string, unknown>, id: string): void;
  removeLineToolsById(ids: string[]): void;
  subscribeLineToolsAfterEdit(handler: (event: { selectedLineTool: { id: string; points: Array<{ timestamp: number; price: number }> }; stage: string }) => void): void;
  unsubscribeLineToolsAfterEdit(handler: (event: { selectedLineTool: { id: string; points: Array<{ timestamp: number; price: number }> }; stage: string }) => void): void;
  destroy(): void;
}

export function createLineToolsPlugin(chart: IChartApi, series: ISeriesApi<SeriesType>): LineToolsPlugin;
export function registerLinesPlugin(plugin: LineToolsPlugin): void;
export function registerFibRetracementPlugin(plugin: LineToolsPlugin): void;
export function registerPriceRangePlugin(plugin: LineToolsPlugin): void;
export class LineToolRectangle {}
