import { useEffect, useRef } from "react";
import echarts from "../lib/echarts";

/**
 * Thin ECharts wrapper: init on mount, dispose on unmount,
 * re-apply option on change, forward chart events.
 */
export default function EChart({ option, onEvents, className, style }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    // Expose the instance on the DOM node (useful for debugging/tests).
    containerRef.current.__echartsInstance = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      if (containerRef.current) {
        containerRef.current.__echartsInstance = null;
      }
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return undefined;
    const entries = Object.entries(onEvents);
    entries.forEach(([eventName, handler]) => chart.on(eventName, handler));
    return () => {
      entries.forEach(([eventName, handler]) => chart.off(eventName, handler));
    };
  }, [onEvents]);

  return <div ref={containerRef} className={className} style={style} />;
}
