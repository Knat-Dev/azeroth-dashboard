"use client";

import { useCallback, useEffect, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { api } from "@/lib/api";

interface PlayerHistoryPoint {
  timestamp: string;
  count: number;
}

const RANGES = ["24h", "7d", "30d"] as const;
type Range = typeof RANGES[number];

export function PlayerChart() {
  const [range, setRange] = useState<Range>("24h");
  const [data, setData] = useState<PlayerHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const result = await api.get<PlayerHistoryPoint[]>(
        `/server/player-history?range=${r}`
      );
      setData(result);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  const chartOptions: Highcharts.Options = {
    chart: {
      type: "areaspline",
      backgroundColor: "transparent",
      height: 220,
      spacing: [10, 0, 10, 0],
      style: { fontFamily: "inherit" },
    },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    xAxis: {
      type: "datetime",
      lineColor: "#374151",
      tickColor: "#374151",
      labels: {
        style: { color: "#9ca3af", fontSize: "11px" },
      },
      gridLineWidth: 0,
    },
    yAxis: {
      title: { text: undefined },
      min: 0,
      allowDecimals: false,
      gridLineColor: "#1f2937",
      labels: {
        style: { color: "#9ca3af", fontSize: "11px" },
      },
    },
    tooltip: {
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      style: { color: "#e5e7eb", fontSize: "12px" },
      xDateFormat: "%b %e, %H:%M",
      pointFormat: "<b>{point.y}</b> players",
    },
    plotOptions: {
      areaspline: {
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, "rgba(245, 166, 35, 0.3)"],
            [1, "rgba(245, 166, 35, 0.0)"],
          ],
        },
        lineColor: "#f5a623",
        lineWidth: 2,
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true,
              fillColor: "#f5a623",
              lineColor: "#f5a623",
              radius: 4,
            },
          },
        },
      },
    },
    series: [
      {
        type: "areaspline",
        name: "Players",
        data: data.map((p) => [new Date(p.timestamp).getTime(), p.count]),
      },
    ],
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Player Count
        </h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-secondary border border-transparent"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading chart data...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No player history data yet. Data is recorded every 5 minutes.
          </p>
        </div>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      )}
    </div>
  );
}
