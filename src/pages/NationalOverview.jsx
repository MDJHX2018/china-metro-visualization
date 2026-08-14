import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import echarts from "../lib/echarts";
import EChart from "../components/EChart";
import cities from "../../data/cities.json";

function totalStats(list) {
  return list.reduce(
    (acc, c) => ({
      lineCount: acc.lineCount + c.lineCount,
      stationCount: acc.stationCount + c.stationCount,
      estimatedNetworkKm: acc.estimatedNetworkKm + c.estimatedNetworkKm,
    }),
    { lineCount: 0, stationCount: 0, estimatedNetworkKm: 0 },
  );
}

export default function NationalOverview() {
  const navigate = useNavigate();
  const [geo, setGeo] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    document.title = "全国地铁概览 · 全国城市地铁可视化系统";
    import("../../data/maps/china.json")
      .then((mod) => {
        const mapJson = mod.default ?? mod;
        if (!cancelled) {
          echarts.registerMap("china", mapJson);
          setGeo(mapJson);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => totalStats(cities), []);

  const option = useMemo(() => {
    if (!geo) return null;
    const stationCounts = cities.map((c) => c.stationCount);
    const minStation = Math.min(...stationCounts);
    const maxStation = Math.max(...stationCounts);

    return {
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "rgba(31,42,68,0.92)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter(params) {
          const d = params.data;
          if (!d) return "";
          return [
            `<b>${d.name}</b>`,
            `线路：${d.lineCount} 条`,
            `站点：${d.stationCount} 个`,
            `换乘站：${d.transferCount} 个`,
            `估算里程：约 ${d.estimatedNetworkKm.toFixed(0)} km`,
            `<span style="color:#9db4d8;font-size:11px">点击查看该城市线网 →</span>`,
          ].join("<br/>");
        },
      },
      visualMap: {
        show: true,
        type: "continuous",
        min: minStation,
        max: maxStation,
        dimension: 2,
        orient: "horizontal",
        left: 20,
        bottom: 24,
        itemWidth: 12,
        itemHeight: 110,
        text: ["站点多", "站点少"],
        textStyle: { color: "#64708c", fontSize: 11 },
        inRange: { color: ["#cfe6ff", "#5b9cf5", "#1e3a8a"] },
        calculable: true,
      },
      geo: {
        map: "china",
        roam: true,
        zoom: 1.15,
        center: [104.5, 36.2],
        scaleLimit: { min: 1, max: 10 },
        label: { show: false },
        itemStyle: {
          areaColor: "#eef3fa",
          borderColor: "#c3d1e4",
          borderWidth: 0.9,
        },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: "#dbe9fb" },
        },
        select: {
          disabled: true,
        },
      },
      series: [
        {
          name: "城市",
          type: "scatter",
          coordinateSystem: "geo",
          cursor: "pointer",
          // Draw smaller bubbles first so larger cities stay clickable in
          // dense metropolitan clusters (Bohai/Yangtze/Pearl River deltas).
          data: [...cities]
            .sort((a, b) => a.lineCount - b.lineCount)
            .map((c) => ({
              name: c.name,
              value: [c.lng, c.lat, c.stationCount, c.lineCount],
              pinyin: c.pinyin,
              lineCount: c.lineCount,
              stationCount: c.stationCount,
              transferCount: c.transferCount,
              estimatedNetworkKm: c.estimatedNetworkKm,
            })),
          // Bubble size reflects the number of metro lines.
          symbolSize: (val) => 8 + Math.sqrt(val[3] || 1) * 2.8,
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 1.5,
            shadowBlur: 8,
            shadowColor: "rgba(30,58,138,0.35)",
          },
          emphasis: {
            scale: 1.45,
            itemStyle: {
              shadowBlur: 18,
              shadowColor: "rgba(30,58,138,0.55)",
            },
          },
          zlevel: 2,
        },
      ],
    };
  }, [geo]);

  const onEvents = useMemo(
    () => ({
      click(params) {
        const pinyin = params?.data?.pinyin;
        if (pinyin) navigate(`/city/${pinyin}`);
      },
    }),
    [navigate],
  );

  return (
    <div className="page">
      <section className="card page-intro">
        <h1>全国地铁概览</h1>
        <p>
          展示全国 41 个已开通地铁的城市分布。气泡大小反映线路数量，颜色反映站点规模；
          支持拖拽平移、滚轮缩放，点击城市气泡可下钻查看详细线网。
        </p>
        <div className="stat-chips">
          <span className="chip">
            已开通城市 <b>{cities.length}</b>
          </span>
          <span className="chip">
            线路总数 <b>{stats.lineCount}</b>
          </span>
          <span className="chip">
            站点总数 <b>{stats.stationCount}</b>
          </span>
          <span className="chip">
            估算总里程 <b>≈{stats.estimatedNetworkKm.toFixed(0)} km</b>
          </span>
        </div>
      </section>

      <section className="card map-card">
        {loadError ? (
          <div className="placeholder-box map-placeholder">
            <span>地图数据加载失败</span>
            <small>请检查网络后刷新页面重试</small>
          </div>
        ) : !geo ? (
          <div className="placeholder-box map-placeholder">
            <span>正在加载中国地图…</span>
          </div>
        ) : (
          <EChart option={option} onEvents={onEvents} className="map-chart" />
        )}
      </section>
    </div>
  );
}
