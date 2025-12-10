"use client";

import { HealthSummary } from "@/components/dashboard/HealthSummary";
import { ServiceGrid } from "@/components/dashboard/ServiceGrid";
import { MetricsCharts } from "@/components/dashboard/MetricsCharts";
import { mockMetrics, mockServices } from "@/lib/mockData";
import { useMetrics } from "@/hooks/useMetrics";
import { useEffect, useState } from "react";

export default function DashboardPage() {
    const { metrics } = useMetrics();
    const [liveServices, setLiveServices] = useState(mockServices);

    // Merge real-time metrics into services
    useEffect(() => {
        setLiveServices(prev => prev.map(service => {
            const realTime = metrics[service.id];
            if (realTime) {
                // Update specific fields from real-time source
                // Also update trend array by taking last 12 points from history or shifting
                const newTrend = realTime.history.length > 0
                    ? realTime.history.slice(-12).map(p => p.value) // take last 12 points
                    : service.trend;

                return {
                    ...service,
                    latency: realTime.currentResponseTime,
                    cpu: realTime.currentCpu,
                    // If error rate high -> degraded
                    status: realTime.currentErrorRate > 1 ? "degraded" : (realTime.currentErrorRate > 5 ? "down" : "healthy"),
                    trend: newTrend.length > 0 ? newTrend : service.trend,
                };
            }
            return service;
        }));
    }, [metrics]);

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Dashboard</h1>
                <p className="text-muted-foreground">Real-time overview of your system health and agent activities.</p>
            </div>

            <HealthSummary
                uptime={mockMetrics.uptime}
                servicesUp={liveServices.filter(s => s.status === "healthy").length}
                totalServices={liveServices.length}
                activeIncidents={mockMetrics.activeIncidents}
            />

            <MetricsCharts metrics={metrics} />

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">Monitored Services</h2>
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Live Updates
                    </span>
                </div>
                <ServiceGrid services={liveServices} />
            </div>
        </div>
    );
}
