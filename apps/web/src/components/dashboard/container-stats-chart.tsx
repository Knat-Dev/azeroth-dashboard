"use client";

import { useCallback, useEffect, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { ContainerStatsPoint } from "@repo/shared";
import { api } from "@/lib/api";
import { parseUTC } from "@/lib/utils";

const RANGES = ["1m", "5m", "15m", "30m", "1h", "6h", "24h", "7d"] as const;
type Range = (typeof RANGES)[number];

const REFRESH_MS = 10_000;

const WORLD_COLOR = "#f5a623";
const AUTH_COLOR = "#3b82f6";
const SYSTEM_COLOR = "#ffffff";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
}

function loadSetting<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v !== null ? (JSON.parse(v) as T) : fallback;
}

export function ContainerStatsChart() {
  const [range, setRange] = useState<Range>(() => loadSetting("cs-range", "5m" as Range));
  const [data, setData] = useState<ContainerStatsPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const handleRangeChange = (r: Range) => {
    setRange(r);
    localStorage.setItem("cs-range", JSON.stringify(r));
  };

  const fetchData = useCallback(async (r: Range, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const result = await api.get<ContainerStatsPoint[]>(
        `/server/container-stats?range=${r}`,
      );
      setData(result);
    } catch {
      if (!isRefresh) setData([]);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    void fetchData(range);

    const tick = () => {
      timer = setTimeout(async () => {
        if (cancelled) return;
        await fetchData(range, true);
        if (!cancelled) tick();
      }, REFRESH_MS);
    };
    tick();

    return () => { cancelled = true; clearTimeout(timer); };
  }, [range, fetchData]);

  const worldCpu = data
    .filter((p) => p.container === "ac-worldserver")
    .map((p) => [parseUTC(p.timestamp).getTime(), p.cpuPercent] as [number, number]);
  const authCpu = data
    .filter((p) => p.container === "ac-authserver")
    .map((p) => [parseUTC(p.timestamp).getTime(), p.cpuPercent] as [number, number]);
  const systemCpu = data
    .filter((p) => p.container === "system")
    .map((p) => [parseUTC(p.timestamp).getTime(), p.cpuPercent] as [number, number]);

  const worldMem = data
    .filter((p) => p.container === "ac-worldserver")
    .map((p) => [parseUTC(p.timestamp).getTime(), p.memoryUsageMB] as [number, number]);
  const authMem = data
    .filter((p) => p.container === "ac-authserver")
    .map((p) => [parseUTC(p.timestamp).getTime(), p.memoryUsageMB] as [number, number]);
  const systemMem = data
    .filter((p) => p.container === "system")
    .map((p) => [parseUTC(p.timestamp).getTime(), p.memoryUsageMB] as [number, number]);

  // Build a lookup for memory limits (for tooltip)
  const memLimits: Record<string, number> = {};
  for (const p of data) {
    if (p.memoryLimitMB > 0) {
      memLimits[p.container] = p.memoryLimitMB;
    }
  }

  const sharedAxisConfig: Highcharts.XAxisOptions = {
    type: "datetime",
    lineColor: "#374151",
    tickColor: "#374151",
    labels: { style: { color: "#9ca3af", fontSize: "11px" } },
    gridLineWidth: 0,
  };

  const cpuOptions: Highcharts.Options = {
    chart: {
      type: "areaspline",
      backgroundColor: "transparent",
      height: 180,
      spacing: [10, 10, 5, 5],
      style: { fontFamily: "inherit" },
      animation: false,
    },
    title: { text: "CPU Usage (%)", align: "left", style: { color: "#9ca3af", fontSize: "12px", fontWeight: "600" } },
    credits: { enabled: false },
    legend: {
      enabled: true,
      align: "right",
      verticalAlign: "top",
      floating: true,
      itemStyle: { color: "#9ca3af", fontSize: "11px", fontWeight: "400" },
      itemHoverStyle: { color: "#e5e7eb" },
    },
    xAxis: sharedAxisConfig,
    yAxis: {
      title: { text: undefined },
      min: 0,
      gridLineColor: "#1f2937",
      labels: { style: { color: "#9ca3af", fontSize: "11px" }, format: "{value}%" },
    },
    tooltip: {
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      style: { color: "#e5e7eb", fontSize: "12px" },
      xDateFormat: "%b %e, %H:%M:%S",
      shared: true,
      pointFormat: '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:.1f}%</b><br/>',
    },
    plotOptions: {
      areaspline: {
        lineWidth: 2,
        animation: false,
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4 } } },
      },
    },
    series: [
      {
        type: "areaspline",
        name: "System",
        data: systemCpu,
        color: SYSTEM_COLOR,
        lineWidth: 1,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, `rgba(${hexToRgb(SYSTEM_COLOR)}, 0.07)`], [1, `rgba(${hexToRgb(SYSTEM_COLOR)}, 0.0)`]],
        },
        dashStyle: "ShortDot",
      },
      {
        type: "areaspline",
        name: "Worldserver",
        data: worldCpu,
        color: WORLD_COLOR,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, `rgba(${hexToRgb(WORLD_COLOR)}, 0.2)`], [1, `rgba(${hexToRgb(WORLD_COLOR)}, 0.0)`]],
        },
      },
      {
        type: "areaspline",
        name: "Authserver",
        data: authCpu,
        color: AUTH_COLOR,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, `rgba(${hexToRgb(AUTH_COLOR)}, 0.2)`], [1, `rgba(${hexToRgb(AUTH_COLOR)}, 0.0)`]],
        },
      },
    ],
  };

  const memOptions: Highcharts.Options = {
    chart: {
      type: "areaspline",
      backgroundColor: "transparent",
      height: 180,
      spacing: [10, 10, 5, 5],
      style: { fontFamily: "inherit" },
      animation: false,
    },
    title: { text: "Memory Usage (MB)", align: "left", style: { color: "#9ca3af", fontSize: "12px", fontWeight: "600" } },
    credits: { enabled: false },
    legend: {
      enabled: true,
      align: "right",
      verticalAlign: "top",
      floating: true,
      itemStyle: { color: "#9ca3af", fontSize: "11px", fontWeight: "400" },
      itemHoverStyle: { color: "#e5e7eb" },
    },
    xAxis: sharedAxisConfig,
    yAxis: {
      title: { text: undefined },
      min: 0,
      gridLineColor: "#1f2937",
      labels: {
        style: { color: "#9ca3af", fontSize: "11px" },
        formatter: function (this: { value: string | number }) {
          const v = Number(this.value);
          return v >= 1024
            ? `${Math.ceil(v / 1024)} GB`
            : `${Math.ceil(v)} MB`;
        },
      },
    },
    tooltip: {
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      style: { color: "#e5e7eb", fontSize: "12px" },
      xDateFormat: "%b %e, %H:%M:%S",
      shared: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: function (this: any) {
        const points = this.points ?? [];
        let s = `<span style="font-size:10px">${Highcharts.dateFormat("%b %e, %H:%M:%S", this.x as number)}</span><br/>`;
        for (const point of points) {
          const name = point.series.name as string;
          const containerKey =
            name === "Worldserver" ? "ac-worldserver" :
            name === "Authserver" ? "ac-authserver" : "system";
          const limit = memLimits[containerKey];
          const fmtMB = (v: number) => v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${v.toFixed(0)} MB`;
          const pct = limit ? ((point.y / limit) * 100).toFixed(1) : "?";
          s += `<span style="color:${point.color}">\u25CF</span> ${name}: <b>${fmtMB(point.y)}</b>`;
          if (limit) s += ` / ${fmtMB(limit)} (${pct}%)`;
          s += "<br/>";
        }
        return s;
      },
    },
    plotOptions: {
      areaspline: {
        lineWidth: 2,
        animation: false,
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4 } } },
      },
    },
    series: [
      {
        type: "areaspline",
        name: "System",
        data: systemMem,
        color: SYSTEM_COLOR,
        lineWidth: 1,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, `rgba(${hexToRgb(SYSTEM_COLOR)}, 0.07)`], [1, `rgba(${hexToRgb(SYSTEM_COLOR)}, 0.0)`]],
        },
        dashStyle: "ShortDot",
      },
      {
        type: "areaspline",
        name: "Worldserver",
        data: worldMem,
        color: WORLD_COLOR,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, `rgba(${hexToRgb(WORLD_COLOR)}, 0.2)`], [1, `rgba(${hexToRgb(WORLD_COLOR)}, 0.0)`]],
        },
      },
      {
        type: "areaspline",
        name: "Authserver",
        data: authMem,
        color: AUTH_COLOR,
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, `rgba(${hexToRgb(AUTH_COLOR)}, 0.2)`], [1, `rgba(${hexToRgb(AUTH_COLOR)}, 0.0)`]],
        },
      },
    ],
  };

  const hasData = data.length > 0;

  return (
    <div className="rounded-xl glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Container Resources
        </h2>
        <div className="flex gap-1">
          {RANGES.map((r) => {
            const mobile = ["5m", "1h", "24h"].includes(r);
            return (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  !mobile ? "hidden sm:block" : ""
                } ${
                  range === r
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-secondary border border-transparent"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {loading && !hasData ? (
        <div className="flex h-[180px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading stats...</p>
        </div>
      ) : !hasData ? (
        <div className="flex h-[180px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No container stats yet. Data is recorded every 10 seconds.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          <HighchartsReact highcharts={Highcharts} options={cpuOptions} />
          <HighchartsReact highcharts={Highcharts} options={memOptions} />
        </div>
      )}
    </div>
  );
}
