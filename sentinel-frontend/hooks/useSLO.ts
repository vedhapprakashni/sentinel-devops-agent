"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface SLOBudget {
    targetAvailability: number;
    currentAvailability: number;
    trackingWindow: string;
    windowMinutes: number;
    allowedDowntimeMinutes: number;
    usedDowntimeMinutes: number;
    remainingMinutes: number;
    budgetPercent: number;
    burndownRatePerDay: number;
    projectedExhaustionDate: string | null;
    incidentCount: number;
    status: "healthy" | "warning" | "critical" | "exhausted";
}

export interface SLODefinition {
    id: string;
    serviceId: string;
    serviceName: string;
    targetAvailability: number;
    trackingWindow: string;
    includeScheduledMaintenance: boolean;
    alertThreshold: number;
    createdAt: string;
    updatedAt: string;
    budget: SLOBudget;
}

export interface SLOSummary {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
}

export interface BurndownPoint {
    timestamp: string;
    budgetPercent: number;
    usedMinutes: number;
}

export interface SLODetail extends SLODefinition {
    burndown: BurndownPoint[];
    incidents: Array<{
        id: string;
        serviceId: string;
        downtimeMinutes: number;
        description: string;
        resolvedAt: number;
        createdAt: number;
    }>;
}

/**
 * Safely parse a fetch response. Handles non-JSON error bodies gracefully
 * and preserves meaningful HTTP status/message for the UI.
 */
async function safeFetchJSON<T>(res: Response): Promise<T> {
    if (!res.ok) {
        // Try to extract error message from JSON body, fall back to status text
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (body?.error) message = `${message}: ${body.error}`;
        } catch {
            // Response body is not JSON (e.g. HTML error page, empty body)
            const text = await res.text().catch(() => "");
            if (text) message = `${message}: ${text.slice(0, 200)}`;
        }
        throw new Error(message);
    }
    // Even successful responses may not be valid JSON in edge cases
    try {
        return await res.json();
    } catch {
        throw new Error(`Expected JSON response from ${res.url} but received non-JSON content`);
    }
}

export function useSLO(refreshInterval = 30000) {
    const [slos, setSlos] = useState<SLODefinition[]>([]);
    const [summary, setSummary] = useState<SLOSummary>({
        total: 0,
        healthy: 0,
        warning: 0,
        critical: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Abort controller ref for cancelling stale list requests
    const abortRef = useRef<AbortController | null>(null);

    const fetchSLOs = useCallback(async () => {
        // Cancel any in-flight list request to avoid stale data
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(`${API_URL}/slo`, { signal: controller.signal });
            const data = await safeFetchJSON<{ slos: SLODefinition[]; summary: SLOSummary }>(res);
            // Only update state if this request was not aborted
            if (!controller.signal.aborted) {
                setSlos(data.slos || []);
                setSummary(data.summary || { total: 0, healthy: 0, warning: 0, critical: 0 });
                setError(null);
            }
        } catch (err) {
            // Silently ignore aborted requests — they are intentional
            if (err instanceof DOMException && err.name === "AbortError") return;
            if (!controller.signal.aborted) {
                setError(err instanceof Error ? err.message : "Failed to fetch SLOs");
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchSLOs();
        const interval = setInterval(fetchSLOs, refreshInterval);
        return () => {
            clearInterval(interval);
            // Abort any outstanding request on unmount
            abortRef.current?.abort();
        };
    }, [fetchSLOs, refreshInterval]);

    const fetchSLODetail = useCallback(async (id: string): Promise<SLODetail | null> => {
        const controller = new AbortController();
        try {
            const res = await fetch(`${API_URL}/slo/${id}`, { signal: controller.signal });
            return await safeFetchJSON<SLODetail>(res);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return null;
            return null;
        }
    }, []);

    const createSLO = useCallback(
        async (data: {
            serviceId: string;
            serviceName?: string;
            targetAvailability: number;
            trackingWindow: string;
            alertThreshold?: number;
        }) => {
            const res = await fetch(`${API_URL}/slo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const result = await safeFetchJSON<SLODefinition>(res);
            await fetchSLOs();
            return result;
        },
        [fetchSLOs]
    );

    const deleteSLO = useCallback(
        async (id: string) => {
            const res = await fetch(`${API_URL}/slo/${id}`, { method: "DELETE" });
            await safeFetchJSON<{ success: boolean }>(res);
            await fetchSLOs();
        },
        [fetchSLOs]
    );

    const recordDowntime = useCallback(
        async (id: string, downtimeMinutes: number, description?: string) => {
            const res = await fetch(`${API_URL}/slo/${id}/downtime`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ downtimeMinutes, description }),
            });
            const result = await safeFetchJSON<{ event: unknown; budget: SLOBudget }>(res);
            await fetchSLOs();
            return result;
        },
        [fetchSLOs]
    );

    return {
        slos,
        summary,
        loading,
        error,
        refresh: fetchSLOs,
        fetchSLODetail,
        createSLO,
        deleteSLO,
        recordDowntime,
    };
}
