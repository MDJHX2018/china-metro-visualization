// Modular ECharts setup: only register the charts/components the app needs,
// keeping the bundle small.
import * as echarts from "echarts/core";
import { BarChart, LineChart, LinesChart, ScatterChart } from "echarts/charts";
import {
  GeoComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  LinesChart,
  ScatterChart,
  GeoComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export default echarts;
