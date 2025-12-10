"use client";

import { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
} from "recharts";
import { ServiceMetrics } from "@/hooks/useMetrics";

interface MetricsChartsProps {
    metrics: Record<string, ServiceMetrics>;
}

export function MetricsCharts({ metrics }: MetricsChartsProps) {
    const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h">("1h");
    const [activeTab, setActiveTab] = useState<"response" | "error" | "resources">("response");

    // Transform metrics dictionary into array for charting if needed
    // But for multi-line charts, we usually iterate over the keys to create multiple Lines
    const serviceIds = Object.keys(metrics);

    // Helper to get color for service
    const getServiceColor = (id: string) => {
        switch (id) {
            case "api-gateway": return "#22d3ee"; // Cyan
            case "auth-service": return "#818cf8"; // Indigo
            case "primary-db": return "#f472b6"; // Pink
            case "payments-worker": return "#34d399"; // Emerald
            default: return "#94a3b8";
        }
    };

    // Prepare data for the charts
    // We need to synchronize the history arrays. 
    // In a real app we'd fetch structured time-series. 
    // For this mock, we'll take the history of the first service and map others to it by index.
    const chartData = metrics["api-gateway"]?.history.map((point, index) => {
        const combinedPoint: any = { timestamp: point.timestamp };
        serviceIds.forEach(id => {
            const historyPoint = metrics[id]?.history[index];
            if (historyPoint) {
                combinedPoint[`${id}_response`] = historyPoint.responseTime;
                combinedPoint[`${id}_error`] = historyPoint.errorRate;
                combinedPoint[`${id}_cpu`] = historyPoint.cpu;
            }
        });
        return combinedPoint;
    }) || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">System Metrics</h3>
                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                    {(["1h", "6h", "24h"] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === range
                                ? "bg-primary/20 text-primary shadow-sm"
                                : "text-muted-foreground hover:text-white"
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-white/10 pb-2">
                <button
                    onClick={() => setActiveTab("response")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "response"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-white"
                        }`}
                >
                    Response Time (ms)
                </button>
                <button
                    onClick={() => setActiveTab("error")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "error"
                        ? "border-destructive text-destructive"
                        : "border-transparent text-muted-foreground hover:text-white"
                        }`}
                >
                    Error Rate (%)
                </button>
                <button
                    onClick={() => setActiveTab("resources")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "resources"
                        ? "border-secondary text-secondary-foreground"
                        : "border-transparent text-muted-foreground hover:text-white"
                        }`}
                >
                    CPU Usage (%)
                </button>
            </div>

            {/* Chart Container */}
            <div className="h-[300px] w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 shadow-xl">
                <ResponsiveContainer width="100%" height="100%">
                    {activeTab === "resources" ? (
                        // Bar Chart for Resources (Snapshot of current state or history avg could be better, but let's stick to trend for consistency)
                        // Actually, for consistency let's use LineChart for all trends for now, or Bar for current state. 
                        // Let's stick to LineChart for consistency in this real-time view
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="timestamp"
                                stroke="#64748b"
                                tick={{ fill: "#64748b", fontSize: 12 }}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#64748b"
                                tick={{ fill: "#64748b", fontSize: 12 }}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", color: "#f1f5f9" }}
                                itemStyle={{ color: "#f1f5f9" }}
                            />
                            <Legend wrapperStyle={{ paddingTop: "20px" }} />
                            {serviceIds.map((id) => (
                                <Line
                                    key={id}
                                    type="monotone"
                                    dataKey={`${id}_cpu`}
                                    name={metrics[id].name}
                                    stroke={getServiceColor(id)}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            ))}
                        </LineChart>
                    ) : activeTab === "error" ? (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                            <YAxis stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", color: "#f1f5f9" }}
                            />
                            <Legend wrapperStyle={{ paddingTop: "20px" }} />
                            {serviceIds.map((id) => (
                                <Line
                                    key={id}
                                    type="monotone"
                                    dataKey={`${id}_error`}
                                    name={metrics[id].name}
                                    stroke={getServiceColor(id)}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            ))}
                        </LineChart>
                    ) : (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                            <YAxis stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", color: "#f1f5f9" }}
                            />
                            <Legend wrapperStyle={{ paddingTop: "20px" }} />
                            {serviceIds.map((id) => (
                                <Line
                                    key={id}
                                    type="monotone"
                                    dataKey={`${id}_response`}
                                    name={metrics[id].name}
                                    stroke={getServiceColor(id)}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            ))}
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
