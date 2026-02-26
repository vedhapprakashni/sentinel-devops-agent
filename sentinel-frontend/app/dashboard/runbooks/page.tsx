<<<<<<< HEAD
"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Link from "next/link";

/**
 * Use an env-var for the API base URL so the app works in non-local deployments.
 * Fixes: hardcoded localhost:4000 in three places (fetch list, toggleEnabled, deleteRunbook).
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Runbook {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    triggers: unknown[];
    actions: unknown[];
    created_at: string;
    updated_at: string;
}
=======
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Zap, Trash2, Clock, Edit3, Activity } from 'lucide-react';
import axios from 'axios';
import { Runbook } from '../../../lib/runbook-types';
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")

export default function RunbooksPage() {
    const [runbooks, setRunbooks] = useState<Runbook[]>([]);
    const [loading, setLoading] = useState(true);
<<<<<<< HEAD
    const [error, setError] = useState<string | null>(null);

    const fetchRunbooks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await axios.get<{ runbooks: Runbook[] }>(`${API_URL}/api/runbooks`);
            setRunbooks(res.data.runbooks || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load runbooks";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRunbooks();
    }, [fetchRunbooks]);

    const toggleEnabled = async (id: string, current: boolean) => {
        try {
            await axios.put(`${API_URL}/api/runbooks/${id}`, { enabled: !current });
            setRunbooks(prev =>
                prev.map(r => (r.id === id ? { ...r, enabled: !current } : r))
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update runbook";
            alert(message);
=======

    const fetchRunbooks = async () => {
        try {
            const response = await axios.get('http://localhost:4000/api/runbooks');
            setRunbooks(response.data);
        } catch (error) {
            console.error('Failed to fetch runbooks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRunbooks();
    }, []);

    const toggleEnabled = async (id: string, current: boolean) => {
        try {
            await axios.put(`http://localhost:4000/api/runbooks/${id}`, {
                enabled: !current
            });
            fetchRunbooks();
        } catch (error) {
            alert('Failed to update runbook status');
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
        }
    };

    const deleteRunbook = async (id: string) => {
<<<<<<< HEAD
        if (!confirm("Delete this runbook?")) return;
        try {
            await axios.delete(`${API_URL}/api/runbooks/${id}`);
            setRunbooks(prev => prev.filter(r => r.id !== id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete runbook";
            alert(message);
=======
        if (!confirm('Are you sure you want to delete this runbook?')) return;
        try {
            await axios.delete(`http://localhost:4000/api/runbooks/${id}`);
            fetchRunbooks();
        } catch (error) {
            alert('Failed to delete runbook');
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
        }
    };

    return (
<<<<<<< HEAD
        <div className="space-y-6 px-4 lg:px-6 py-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Runbooks</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Automated healing workflows triggered by incidents or schedules.
                    </p>
                </div>
                <Link
                    href="/dashboard/runbooks/builder"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    + New Runbook
=======
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Healing Runbooks</h1>
                    <p className="text-slate-400 mt-1">Automated remediation rules for system incidents</p>
                </div>
                <Link
                    href="/dashboard/runbooks/builder"
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25"
                >
                    <Plus className="w-5 h-5" /> Create Runbook
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
                </Link>
            </div>

            {loading ? (
<<<<<<< HEAD
                <p className="text-muted-foreground text-sm">Loading runbooks…</p>
            ) : error ? (
                <p className="text-red-400 text-sm">{error}</p>
            ) : runbooks.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                    <p className="text-muted-foreground text-sm">No runbooks yet.</p>
                    <Link
                        href="/dashboard/runbooks/builder"
                        className="mt-4 inline-block text-primary text-sm hover:underline"
                    >
                        Create your first runbook →
                    </Link>
                </div>
            ) : (
                <ul className="space-y-3">
                    {runbooks.map(rb => (
                        <li
                            key={rb.id}
                            className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground truncate">{rb.name}</span>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${rb.enabled
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-neutral-500/20 text-neutral-400"
                                            }`}
                                    >
                                        {rb.enabled ? "enabled" : "disabled"}
                                    </span>
                                </div>
                                {rb.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{rb.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {rb.triggers.length} trigger{rb.triggers.length !== 1 ? "s" : ""} ·{" "}
                                    {rb.actions.length} action{rb.actions.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Link
                                    href={`/dashboard/runbooks/builder?id=${rb.id}`}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Edit
                                </Link>
                                <button
                                    onClick={() => toggleEnabled(rb.id, rb.enabled)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {rb.enabled ? "Disable" : "Enable"}
                                </button>
                                <button
                                    onClick={() => deleteRunbook(rb.id)}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
=======
                <div className="flex justify-center p-20">
                    <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : runbooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30 text-center">
                    <Zap className="w-12 h-12 text-slate-600 mb-4" />
                    <h3 className="text-xl font-bold text-white">No runbooks yet</h3>
                    <p className="text-slate-500 mt-2 max-w-xs">Define your first automated healing rule to keep your services healthy.</p>
                    <Link
                        href="/dashboard/runbooks/builder"
                        className="mt-6 text-blue-400 hover:text-blue-300 font-semibold"
                    >
                        Get Started →
                    </Link>
                </div>
            ) : (
                <div className="grid gap-6">
                    {runbooks.map((runbook) => (
                        <div
                            key={runbook.id}
                            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold text-white">{runbook.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-heavy font-black tracking-widest ${runbook.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                                            {runbook.enabled ? 'Active' : 'Paused'}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-sm line-clamp-2">{runbook.description}</p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleEnabled(runbook.id, runbook.enabled)}
                                        className={`p-2 rounded-lg transition-colors ${runbook.enabled ? 'hover:bg-amber-500/10 text-amber-500' : 'hover:bg-emerald-500/10 text-emerald-500'}`}
                                        title={runbook.enabled ? "Pause" : "Activate"}
                                    >
                                        <Zap className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => deleteRunbook(runbook.id)}
                                        className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-3 h-3" /> {runbook.triggers.length} Triggers
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Play className="w-3 h-3" /> {runbook.actions.length} Actions
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> v{runbook.version}
                                    </div>
                                </div>
                                <div>
                                    Updated {new Date(runbook.updated_at || '').toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
            )}
        </div>
    );
}
<<<<<<< HEAD
=======

function Search(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
}

function Play(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg>
}
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
