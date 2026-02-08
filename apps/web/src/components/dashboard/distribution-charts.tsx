"use client";

import { useCallback, useEffect, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { api } from "@/lib/api";
import { WOW_CLASSES, WOW_RACES, FACTION_COLORS } from "@repo/shared";
import type { DistributionData } from "@repo/shared";

export function DistributionCharts() {
  const [data, setData] = useState<DistributionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<DistributionData>(
        "/server/stats/distribution",
      );
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totalChars =
    data?.classes.reduce((sum, c) => sum + c.count, 0) ?? 0;

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex h-[280px] items-center justify-center rounded-xl glass"
          >
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ))}
      </div>
    );
  }

  if (!data || totalChars === 0) {
    return null;
  }

  const classChartOptions: Highcharts.Options = {
    chart: {
      type: "pie",
      backgroundColor: "transparent",
      height: 260,
      style: { fontFamily: "inherit" },
    },
    title: { text: undefined },
    credits: { enabled: false },
    tooltip: {
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      style: { color: "#e5e7eb", fontSize: "12px" },
      pointFormat: "<b>{point.y}</b> characters ({point.percentage:.1f}%)",
    },
    plotOptions: {
      pie: {
        innerSize: "55%",
        borderWidth: 0,
        dataLabels: { enabled: false },
        showInLegend: true,
      },
    },
    legend: {
      layout: "vertical",
      align: "right",
      verticalAlign: "middle",
      itemStyle: { color: "#9ca3af", fontSize: "11px", fontWeight: "400" },
      itemHoverStyle: { color: "#e5e7eb" },
      symbolRadius: 2,
    },
    series: [
      {
        type: "pie",
        name: "Class",
        data: data.classes
          .sort((a, b) => b.count - a.count)
          .map((c) => ({
            name: WOW_CLASSES[c.id]?.name ?? `Class ${c.id}`,
            y: c.count,
            color: WOW_CLASSES[c.id]?.color ?? "#888",
          })),
      },
    ],
  };

  // Group races by faction
  const factionCounts = { Alliance: 0, Horde: 0 };
  const racesByFaction: {
    name: string;
    y: number;
    color: string;
  }[] = [];

  for (const r of data.races) {
    const race = WOW_RACES[r.id];
    if (!race) continue;
    factionCounts[race.faction] += r.count;
    racesByFaction.push({
      name: race.name,
      y: r.count,
      color:
        race.faction === "Alliance"
          ? `rgba(0, 120, 255, ${0.4 + 0.6 * (r.count / Math.max(...data.races.map((x) => x.count), 1))})`
          : `rgba(179, 0, 0, ${0.4 + 0.6 * (r.count / Math.max(...data.races.map((x) => x.count), 1))})`,
    });
  }

  const raceChartOptions: Highcharts.Options = {
    chart: {
      type: "pie",
      backgroundColor: "transparent",
      height: 260,
      style: { fontFamily: "inherit" },
    },
    title: { text: undefined },
    credits: { enabled: false },
    tooltip: {
      backgroundColor: "#1f2937",
      borderColor: "#374151",
      style: { color: "#e5e7eb", fontSize: "12px" },
      pointFormat: "<b>{point.y}</b> characters ({point.percentage:.1f}%)",
    },
    plotOptions: {
      pie: {
        innerSize: "55%",
        borderWidth: 0,
        dataLabels: { enabled: false },
        showInLegend: true,
      },
    },
    legend: {
      layout: "vertical",
      align: "right",
      verticalAlign: "middle",
      itemStyle: { color: "#9ca3af", fontSize: "11px", fontWeight: "400" },
      itemHoverStyle: { color: "#e5e7eb" },
      symbolRadius: 2,
    },
    series: [
      {
        type: "pie",
        name: "Race",
        data: racesByFaction.sort((a, b) => b.y - a.y),
      },
    ],
  };

  const alliancePct =
    totalChars > 0
      ? Math.round((factionCounts.Alliance / totalChars) * 100)
      : 0;
  const hordePct = totalChars > 0 ? 100 - alliancePct : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl glass p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Class Distribution
          </h2>
          <span className="text-xs text-muted-foreground">
            {totalChars} characters
          </span>
        </div>
        <HighchartsReact highcharts={Highcharts} options={classChartOptions} />
      </div>

      <div className="rounded-xl glass p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Faction / Race
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: FACTION_COLORS.Alliance }}>
              Alliance {alliancePct}%
            </span>
            <span style={{ color: FACTION_COLORS.Horde }}>
              Horde {hordePct}%
            </span>
          </div>
        </div>
        <HighchartsReact highcharts={Highcharts} options={raceChartOptions} />
      </div>
    </div>
  );
}
