"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Incident } from "@/lib/mockData";
import { TraceTimeline, TraceLike } from "@/components/traces/TraceTimeline";
import { FailurePoint } from "@/components/traces/FailurePoint";
import { ArrowLeft } from "lucide-react";

interface TraceResponse {
    service: string;
    from: number;
    to: number;
    incidentTimestamp?: number | null;
    windowMs?: number;
    rootCause?: {
        operation?: string | null;
        service?: string | null;
        errorMessage?: string | null;
        duration?: number | null;
        spanId?: string | null;
        traceId?: string | null;
    } | null;
    traces: TraceLike[];
}

export default function IncidentDetailsPage() {
    const router = useRouter();
    const { id: incidentId } = useParams<{ id: string }>();

    const [incident, setIncident] = useState<Incident | null>(null);
    const [traceData, setTraceData] = useState<TraceResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!incidentId) {
            setError("Missing incident identifier");
            setIsLoading(false);
            return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

        async function loadIncidentAndTrace() {
            try {
                setIsLoading(true);
                setError(null);

                // Fetch all insights and pick the one matching this incident
                const res = await fetch(`${apiUrl}/insights`);
                if (!res.ok) throw new Error("Failed to fetch incident");
                const data = await res.json();

                const incidents: Incident[] = (data.insights || []).map((insight: any) => {
                    // Reuse backend payload and structure through the existing parser on the dashboard
                    // For now, keep shape minimal and fallback to mock incident parsing
                    return {
                        id: String(insight.id),
                        title: insight.summary || "Incident",
                        serviceId: insight.serviceId || insight.service || insight.service_name || "system",
                        status: "failed",
                        severity: "warning",
                        timestamp: insight.timestamp || new Date().toISOString(),
                        duration: "Unknown",
                        rootCause: "Service failure detected",
                        agentAction: "Monitoring",
                        agentPredictionConfidence: 0,
                        timeline: [],
                        reasoning: insight.analysis || insight.summary,
                    };
                });

                const found = incidents.find(i => i.id === incidentId);
                if (!found) {
                    throw new Error("Incident not found");
                }

                setIncident(found);

                let ts = Date.parse(found.timestamp);
                if (Number.isNaN(ts)) {
                    console.warn("Invalid incident timestamp, falling back to current time");
                    ts = Date.now();
                }
                const traceRes = await fetch(
                    `${apiUrl}/traces?service=${encodeURIComponent(found.serviceId)}&timestamp=${ts}`
                );

                if (traceRes.ok) {
                    const traceJson: TraceResponse = await traceRes.json();
                    setTraceData(traceJson);
                } else {
                    setTraceData(null);
                }
            } catch (e: any) {
                console.error(e);
                setError(e.message || "Failed to load incident");
            } finally {
                setIsLoading(false);
            }
        }

        void loadIncidentAndTrace();
    }, [incidentId]);

    const primaryTrace = useMemo<TraceLike | null>(() => {
        if (!traceData || !traceData.traces || traceData.traces.length === 0) return null;
        return traceData.traces[0];
    }, [traceData]);

    return (
        <div className="space-y-8 pb-20">
            <div>
                <DashboardHeader />
                <div className="px-4 lg:px-6 py-6 space-y-8 max-w-5xl mx-auto">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Back to Incidents
                    </button>

                    {isLoading ? (
                        <p className="text-muted-foreground">Loading incident details…</p>
                    ) : error ? (
                        <p className="text-red-400 text-sm">{error}</p>
                    ) : !incident ? (
                        <p className="text-muted-foreground">Incident not found.</p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <h1 className="text-2xl font-bold text-foreground">{incident.title}</h1>
                                <p className="text-sm text-muted-foreground">
                                    ID: <span className="font-mono">{incident.id}</span> ·{" "}
                                    {new Date(incident.timestamp).toLocaleString()}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-xs uppercase text-muted-foreground mb-1">Status</div>
                                    <div className="text-lg font-semibold text-foreground capitalize">
                                        {incident.status.replace("-", " ")}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-xs uppercase text-muted-foreground mb-1">Severity</div>
                                    <div className="text-lg font-semibold text-foreground capitalize">
                                        {incident.severity}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="text-xs uppercase text-muted-foreground mb-1">Duration</div>
                                    <div className="text-lg font-semibold text-foreground">
                                        {incident.duration}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold text-foreground">Distributed Trace</h2>
                                {traceData ? (
                                    <>
                                        <FailurePoint context={traceData.rootCause || null} />
                                        <div className="mt-4">
                                            <TraceTimeline trace={primaryTrace} />
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No distributed tracing data available for this incident.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

