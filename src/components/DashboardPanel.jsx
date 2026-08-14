import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import echarts from "../lib/echarts";
import EChart from "./EChart";
import StatCard from "./StatCard";
import cities from "../../data/cities.json";

const cityMeta = Object.fromEntries(cities.map((c) => [c.pinyin, c]));

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministic sample ridership series (15 days, in 万人次/日).
 * Clearly marked as demo data — not official statistics.
 */
function genTrend(seedStr, baseValue) {
  const seed = hashCode(seedStr) || 1;
  const days = 15;
  const now = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const weekday = d.getDay();
    const dowFactor = weekday === 0 || weekday === 6 ? 0.84 : 1.06;
    const rand = ((seed * 9301 + i * 49297) % 233280) / 233280;
    const noise = 0.97 + rand * 0.07;
    out.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      value: Math.round(baseValue * dowFactor * noise),
    });
  }
  return out;
}

export default function DashboardPanel() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/city\/([a-z]+)/);
  const pinyin = match ? match[1] : null;
  const isCity = Boolean(pinyin && cityMeta[pinyin]);

  const stats = useMemo(() => {
    if (isCity) {
      const c = cityMeta[pinyin];
      return {
        title: `城市：${c.name}`,
        badge: "城市数据",
        items: [
          { label: "运营里程", value: c.estimatedNetworkKm.toFixed(0), unit: "km", hint: "估算值" },
          { label: "站点总数", value: c.stationCount.toLocaleString(), unit: "个" },
          { label: "线路总数", value: c.lineCount, unit: "条" },
          { label: "换乘站", value: c.transferCount, unit: "个" },
        ],
        trendSeed: pinyin,
        trendBase: Math.round(c.stationCount * 2.8 + 30),
        trendTitle: `${c.name}客流趋势（示例）`,
      };
    }
    const totals = cities.reduce(
      (acc, c) => ({
        line: acc.line + c.lineCount,
        station: acc.station + c.stationCount,
        transfer: acc.transfer + c.transferCount,
        km: acc.km + c.estimatedNetworkKm,
      }),
      { line: 0, station: 0, transfer: 0, km: 0 },
    );
    return {
      title: "全国概览",
      badge: "全国数据",
      items: [
        { label: "运营里程", value: totals.km.toFixed(0), unit: "km", hint: "估算值" },
        { label: "站点总数", value: totals.station.toLocaleString(), unit: "个" },
        { label: "线路总数", value: totals.line, unit: "条" },
        { label: "换乘站", value: totals.transfer, unit: "个" },
      ],
      trendSeed: "national",
      trendBase: 7800,
      trendTitle: "全国客流趋势（示例）",
    };
  }, [isCity, pinyin]);

  const trend = useMemo(
    () => genTrend(stats.trendSeed, stats.trendBase),
    [stats.trendSeed, stats.trendBase],
  );

  const trendOption = useMemo(() => {
    const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#2563eb";
    return {
      animationDuration: 400,
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: "rgba(31,42,68,0.92)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 11 },
        formatter(params) {
          const p = params[0];
          return `<b>${p.name}</b> 日客流<br/>${p.value} 万人次<small style="color:#9db4d8">（示例）</small>`;
        },
      },
      grid: { left: 6, right: 8, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        type: "category",
        data: trend.map((d) => d.date),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#d5deea" } },
        axisTick: { show: false },
        axisLabel: { interval: 2, fontSize: 9, color: "#8a96ad" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#edf1f7", type: "dashed" } },
        axisLabel: { fontSize: 9, color: "#8a96ad" },
      },
      series: [
        {
          type: "line",
          data: trend.map((d) => d.value),
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: primary },
          itemStyle: { color: primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(37,99,235,0.28)" },
              { offset: 1, color: "rgba(37,99,235,0.02)" },
            ]),
          },
        },
      ],
    };
  }, [trend]);

  return (
    <section className="card dashboard-panel">
      <header className="card-header">
        <h2>数据面板</h2>
        <span className="card-badge">{stats.badge}</span>
      </header>
      <p className="panel-context">{stats.title}</p>

      <div className="stat-grid">
        {stats.items.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </div>

      <div className="card-divider" />

      <header className="card-header">
        <h3>{stats.trendTitle}</h3>
        <span className="card-badge sample">近15日</span>
      </header>
      <EChart option={trendOption} className="trend-chart" />

      <p className="panel-note">
        客流为演示用示例数据（万人次/日），非官方统计；里程为按站点间距的估算值。
      </p>
    </section>
  );
}
