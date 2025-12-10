"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
    data: { value: number }[];
    color?: string;
    width?: number | string;
    height?: number;
}

export function Sparkline({ data, color = "#22d3ee", width = "100%", height = 40 }: SparklineProps) {
    // If no data, show a flat line
    const safeData = data.length > 0 ? data : [{ value: 0 }, { value: 0 }];

    return (
        <div style={{ width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={safeData}>
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false} // Disable animation for real-time performance in lists
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
