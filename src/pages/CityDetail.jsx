import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EChart from "../components/EChart";
import { cityLoaders } from "../data/cityLoaders";
import cities from "../../data/cities.json";

const cityMeta = Object.fromEntries(cities.map((c) => [c.pinyin, c]));

function computeBounds(city) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const line of city.lines) {
    for (const [x, y] of line.path) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
  }
  const padX = (maxX - minX) * 0.05 + 20;
  const padY = (maxY - minY) * 0.05 + 20;
  return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

export default function CityDetail() {
  const { pinyin } = useParams();
  const [city, setCity] = useState(null);
  const [loadError, setLoadError] = useState(false);
  // null = show all lines; otherwise a Set of highlighted line ids.
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCity(null);
    setLoadError(false);
    setActive(null);
    const loader = cityLoaders[pinyin];
    if (!loader) {
      setLoadError(true);
      return undefined;
    }
    loader()
      .then((mod) => {
        if (!cancelled) setCity(mod.default ?? mod);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pinyin]);

  useEffect(() => {
    document.title = city
      ? `${city.name}地铁线路图 · 全国城市地铁可视化系统`
      : "城市地铁线路图 · 全国城市地铁可视化系统";
  }, [city]);

  const bounds = useMemo(() => (city ? computeBounds(city) : null), [city]);

  const option = useMemo(() => {
    if (!city || !bounds) return null;
    const dimmed = (lineId) => active !== null && !active.has(lineId);

    const lineData = city.lines.map((line) => ({
      coords: line.path,
      lineId: line.id,
      lineName: line.name,
      stationCount: line.stationIds.length,
      lineStyle: {
        color: line.color,
        width: dimmed(line.id) ? 1 : 4,
        opacity: dimmed(line.id) ? 0.12 : 1,
      },
    }));

    const stationData = city.stations.map((st) => ({
      value: [st.x, st.y],
      name: st.name,
      transfer: st.transfer,
      lng: st.lng,
      lat: st.lat,
      lineIds: st.lineIds,
      lineNames: st.lineNames,
      lineColors: st.lineIds.map((id) => {
        const found = city.lines.find((ln) => ln.id === id);
        return found ? found.color : "#888";
      }),
      dimmed: active !== null && !st.lineIds.some((id) => active.has(id)),
    }));

    return {
      animationDuration: 250,
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: {
        type: "value",
        min: bounds.minX,
        max: bounds.maxX,
        show: false,
      },
      yAxis: {
        type: "value",
        min: bounds.minY,
        max: bounds.maxY,
        show: false,
        inverse: true, // schematic coordinates are y-down, like the source map
      },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          yAxisIndex: 0,
          filterMode: "none",
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          zoomLock: false,
        },
      ],
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "rgba(31,42,68,0.94)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter(params) {
          if (params.seriesType === "scatter") {
            const d = params.data;
            const lineChips = d.lineNames
              .map(
                (n, i) =>
                  `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.lineColors[i]};margin-right:5px"></span>${n}`,
              )
              .join("<br/>");
            return [
              `<b style="font-size:13px">${d.name}</b>`,
              d.transfer ? '<span style="color:#fcd34d">换乘站</span>' : "普通站",
              `所属线路：<br/>${lineChips}`,
              `坐标：${d.lng?.toFixed(4)}, ${d.lat?.toFixed(4)}`,
              '<span style="color:#9db4d8;font-size:11px">点击高亮该站所属线路</span>',
            ].join("<br/>");
          }
          if (params.seriesType === "lines") {
            const d = params.data;
            return [
              `<b style="font-size:13px">${d.lineName}</b>`,
              `站点数：${d.stationCount}`,
              '<span style="color:#9db4d8;font-size:11px">点击高亮该线路</span>',
            ].join("<br/>");
          }
          return "";
        },
      },
      series: [
        {
          name: "线路",
          type: "lines",
          coordinateSystem: "cartesian2d",
          polyline: true,
          silent: false,
          data: lineData,
          zlevel: 1,
          emphasis: {
            lineStyle: { width: 7, opacity: 1 },
          },
        },
        {
          name: "站点",
          type: "scatter",
          coordinateSystem: "cartesian2d",
          data: stationData,
          symbol: "circle",
          symbolSize: (val, params) => (params.data?.transfer ? 7 : 4.5),
          itemStyle: {
            color: "#ffffff",
            borderColor: (params) => {
              const st = params.data;
              return st && !st.transfer && st.lineColors[0] ? st.lineColors[0] : "#3f4a63";
            },
            borderWidth: 1.4,
            opacity: (params) => (params.data?.dimmed ? 0.25 : 1),
          },
          label: {
            show: true,
            position: "right",
            distance: 5,
            fontSize: 10,
            color: "#33415e",
            fontWeight: (params) => (params.data?.transfer ? 700 : 400),
            formatter: (params) => params.data?.name ?? "",
          },
          labelLayout: { hideOverlap: true },
          zlevel: 2,
          emphasis: {
            scale: 1.6,
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 700,
              color: "#1e293b",
              backgroundColor: "rgba(255,255,255,0.85)",
              padding: [2, 5],
              borderRadius: 4,
            },
            itemStyle: {
              shadowBlur: 12,
              shadowColor: "rgba(30,58,138,0.5)",
            },
          },
        },
      ],
    };
  }, [city, bounds, active]);

  const onEvents = useMemo(
    () => ({
      click(params) {
        if (!params) return;
        if (params.seriesType === "scatter" && params.data?.lineIds?.length) {
          setActive(new Set(params.data.lineIds));
        } else if (params.seriesType === "lines" && params.data?.lineId) {
          setActive(new Set([params.data.lineId]));
        } else {
          setActive(null);
        }
      },
    }),
    [],
  );

  const toggleLine = (id) => {
    setActive((prev) => {
      if (prev === null || !prev.has(id) || prev.size > 1) {
        return new Set([id]);
      }
      return null; // clicking the active line again resets to all
    });
  };

  const meta = cityMeta[pinyin];
  const stats = city?.stats;

  return (
    <div className="page">
      <section className="card page-intro">
        <div className="intro-row">
          <div>
            <h1>{city ? `${city.name}地铁线路图` : "城市地铁线路图"}</h1>
            <p>
              {city
                ? `${city.name}（${city.pinyin}）· 悬停站点查看信息，点击站点高亮其所属线路`
                : "正在加载城市数据…"}
            </p>
          </div>
          <Link to="/" className="btn-back">
            ← 返回全国概览
          </Link>
        </div>
        {stats && (
          <div className="stat-chips">
            <span className="chip">
              线路总数 <b>{stats.lineCount}</b>
            </span>
            <span className="chip">
              站点总数 <b>{stats.stationCount}</b>
            </span>
            <span className="chip">
              换乘站 <b>{stats.transferCount}</b>
            </span>
            <span className="chip">
              估算里程 <b>≈{stats.estimatedNetworkKm.toFixed(0)} km</b>
            </span>
          </div>
        )}
      </section>

      {loadError ? (
        <section className="card map-card">
          <div className="placeholder-box map-placeholder">
            <span>未找到城市「{pinyin}」或数据加载失败</span>
            <Link to="/" className="btn-back">
              ← 返回全国概览
            </Link>
          </div>
        </section>
      ) : !city ? (
        <section className="card map-card">
          <div className="placeholder-box map-placeholder">
            <span>正在加载 {meta?.name || pinyin} 的地铁线网…</span>
          </div>
        </section>
      ) : (
        <>
          <section className="card line-legend-card">
            <button
              type="button"
              className={`line-chip${active === null ? " active" : ""}`}
              onClick={() => setActive(null)}
            >
              全部线路
            </button>
            {city.lines.map((line) => {
              const isActive = active !== null && active.has(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  className={`line-chip${isActive ? " active" : ""}`}
                  onClick={() => toggleLine(line.id)}
                >
                  <span className="line-dot" style={{ background: line.color }} />
                  {line.name}
                </button>
              );
            })}
          </section>

          <section className="card map-card">
            <EChart option={option} onEvents={onEvents} className="city-map-chart" />
          </section>
        </>
      )}
    </div>
  );
}
