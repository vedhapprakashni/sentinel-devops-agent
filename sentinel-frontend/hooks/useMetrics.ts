"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";

export type TimeSeriesPoint = {
    timestamp: string;
    value: number;
    [key: string]: any; // Allow dynamic keys for multi-line charts
};

export type ServiceMetrics = {
    id: string;
    name: string;
    currentResponseTime: number;
    currentErrorRate: number;
    currentCpu: number;
    history: TimeSeriesPoint[]; // Last 60 points (1 hour view typically)
};

/**
 * useMetrics Hook
 * 
 * Manages the state of metrics for the dashboard.
 * Consumes the WebSocket stream and appends new data points to the history.
 */
export function useMetrics(timeRange: "1h" | "6h" | "24h" = "1h") {
    const [metrics, setMetrics] = useState<Record<string, ServiceMetrics>>({
        "api-gateway": { id: "api-gateway", name: "API Gateway", currentResponseTime: 45, currentErrorRate: 0.1, currentCpu: 32, history: [] },
        "auth-service": { id: "auth-service", name: "Auth Service", currentResponseTime: 85, currentErrorRate: 0.05, currentCpu: 22, history: [] },
        "primary-db": { id: "primary-db", name: "Primary DB", currentResponseTime: 120, currentErrorRate: 0.01, currentCpu: 48, history: [] },
        "payments-worker": { id: "payments-worker", name: "Payments Worker", currentResponseTime: 210, currentErrorRate: 0.2, currentCpu: 18, history: [] },
    });

    const [connectionStatus, setConnectionStatus] = useState<string>("disconnected");

    // Handle incoming WebSocket messages
    const handleMessage = useCallback((msg: any) => {
        if (msg.type === "metrics_update") {
            const payload = msg.payload;
            const timestamp = new Date().toLocaleTimeString();

            setMetrics((prev) => {
                const next = { ...prev };

                Object.keys(payload.services).forEach((serviceId) => {
                    if (next[serviceId]) {
                        const update = payload.services[serviceId];

                        // Update current values
                        next[serviceId] = {
                            ...next[serviceId],
                            currentResponseTime: Math.round(update.responseTime),
                            currentErrorRate: Number(update.errorRate.toFixed(2)),
                            currentCpu: Math.round(update.cpu),
                        };

                        // Append to history
                        const newPoint: TimeSeriesPoint = {
                            timestamp,
                            value: next[serviceId].currentResponseTime, // Default to response time for simple history
                            responseTime: next[serviceId].currentResponseTime,
                            errorRate: next[serviceId].currentErrorRate,
                            cpu: next[serviceId].currentCpu,
                        };

                        // Keep only last 30 points for performance in this demo
                        const history = [...next[serviceId].history, newPoint];
                        if (history.length > 30) history.shift();

                        next[serviceId].history = history;
                    }
                });

                return next;
            });
        }
    }, []);

    const { status } = useWebSocket("/api/stream", {
        onMessage: handleMessage,
        simulationInterval: 1000, // Update every second for smooth demo
    });

    useEffect(() => {
        setConnectionStatus(status);
    }, [status]);

    return { metrics, status: connectionStatus };
}
