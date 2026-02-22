import { useState, useEffect } from 'react';

export interface FinOpsReport {
    totalMonthlyEstimate: string;
    totalPotentialSavings: string;
    wastePercent: string | number;
    cloudPreset: string;
    containers: Array<{
        containerId: string;
        name: string;
        monthlyEstimate: number;
        avgCPUPercent: number | null;
        avgMemPercent: number | null;
        wasteClass: 'healthy' | 'idle' | 'over-provisioned' | 'zombie';
        potentialSavingsMonthly: number;
        recommendation: string;
    }>;
}

export function useFinOps(preset: string = 'aws') {
    const [data, setData] = useState<FinOpsReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchFinOps = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/finops/summary?preset=${preset}`, { signal });
            if (!res.ok) throw new Error('Failed to fetch FinOps data');
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchFinOps(controller.signal);
        return () => controller.abort();
    }, [preset]);

    return { data, loading, error, refetch: fetchFinOps };
}
