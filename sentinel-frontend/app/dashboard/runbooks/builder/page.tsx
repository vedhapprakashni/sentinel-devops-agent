<<<<<<< HEAD
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Use env-var so the builder works in non-local deployments.
 * Fixes: hardcoded localhost:4000.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeType = "trigger" | "action";

interface RunbookNode {
    id: string;          // uuid — non-colliding even on rapid clicks
    type: NodeType;
    label: string;
    actionType: string;
    parameters: Record<string, unknown>;
    position: { x: number; y: number };
}

/** Edge connecting two nodes (IF source → THEN target). */
interface RunbookEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

const ACTION_TYPES = [
    { value: "restart_service", label: "Restart Service" },
    { value: "scale_service", label: "Scale Service" },
    { value: "send_alert", label: "Send Alert" },
    { value: "create_jira", label: "Create Jira Ticket" },
    { value: "http_request", label: "HTTP Request" },
    { value: "run_command", label: "Run Command" },
];

const TRIGGER_TYPES = [
    { value: "webhook", label: "Webhook" },
    { value: "schedule", label: "Schedule" },
    { value: "threshold", label: "Threshold Alert" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a stable unique node ID using uuid instead of Date.now(). */
function newNodeId(): string {
    return crypto.randomUUID();
}

function defaultPosition(index: number): { x: number; y: number } {
    return { x: 120 + index * 220, y: 80 };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RunbookBuilderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("id");

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [nodes, setNodes] = useState<RunbookNode[]>([]);
    const [edges, setEdges] = useState<RunbookEdge[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // For edge drawing: track which node is the "source" of an in-progress connection
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);

    // ── Load existing runbook when editing ──────────────────────────────────
    useEffect(() => {
        if (!editId) return;
        axios
            .get<{
                id: string;
                name: string;
                description: string;
                triggers: RunbookNode[];
                actions: RunbookNode[];
                connections: RunbookEdge[];
            }>(`${API_URL}/api/runbooks/${editId}`)
            .then(({ data }) => {
                setName(data.name || "");
                setDescription(data.description || "");
                // Restore nodes (triggers + actions merged)
                const triggerNodes: RunbookNode[] = (data.triggers || []).map((t, i) => ({
                    ...t,
                    type: "trigger" as const,
                    position: (t as RunbookNode).position || defaultPosition(i),
                }));
                const actionNodes: RunbookNode[] = (data.actions || []).map((a, i) => ({
                    ...a,
                    type: "action" as const,
                    position: (a as RunbookNode).position || defaultPosition(triggerNodes.length + i),
                }));
                setNodes([...triggerNodes, ...actionNodes]);
                // Restore edges (IF→THEN relationships)
                setEdges(data.connections || []);
            })
            .catch(() => setError("Failed to load runbook for editing."));
    }, [editId]);

    // ── Add nodes ────────────────────────────────────────────────────────────
    const addTrigger = useCallback(() => {
        setNodes(prev => [
            ...prev,
            {
                id: newNodeId(),   // uuid — collision-free on rapid clicks
                type: "trigger",
                label: "Webhook",
                actionType: "webhook",
                parameters: {},
                position: defaultPosition(prev.length),
            },
        ]);
    }, []);

    const addAction = useCallback(() => {
        setNodes(prev => [
            ...prev,
            {
                id: newNodeId(),
                type: "action",
                label: "Restart Service",
                actionType: "restart_service",
                parameters: {},
                position: defaultPosition(prev.length),
            },
        ]);
    }, []);

    const removeNode = useCallback((id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        // Also remove any edges that reference this node
        setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
    }, []);

    // ── Edge drawing ─────────────────────────────────────────────────────────
    const startConnect = useCallback((sourceId: string) => {
        setConnectingFrom(sourceId);
    }, []);

    const finishConnect = useCallback(
        (targetId: string) => {
            if (!connectingFrom || connectingFrom === targetId) {
                setConnectingFrom(null);
                return;
            }
            // Avoid duplicate edges
            setEdges(prev => {
                const exists = prev.some(
                    e => e.source === connectingFrom && e.target === targetId
                );
                if (exists) return prev;
                return [
                    ...prev,
                    { id: crypto.randomUUID(), source: connectingFrom, target: targetId },
                ];
            });
            setConnectingFrom(null);
        },
        [connectingFrom]
    );

    // ── Update node fields ───────────────────────────────────────────────────
    const updateNode = useCallback(
        (id: string, patch: Partial<RunbookNode>) => {
            setNodes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
        },
        []
    );

    // ── Save ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!name.trim()) {
            setError("Runbook name is required.");
            return;
        }

        const triggers = nodes.filter(n => n.type === "trigger");
        const actions = nodes.filter(n => n.type === "action");

        /**
         * Bug fix: include edges so IF→THEN relationships are persisted.
         * Previously handleSave only sent triggers/actions and lost all connections.
         */
        const connections: RunbookEdge[] = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? null,
            targetHandle: e.targetHandle ?? null,
        }));

        setSaving(true);
        setError(null);

        try {
            if (editId) {
                await axios.put(`${API_URL}/api/runbooks/${editId}`, {
                    name: name.trim(),
                    description,
                    triggers,
                    actions,
                    connections,
                });
            } else {
                await axios.post(`${API_URL}/api/runbooks`, {
                    name: name.trim(),
                    description,
                    triggers,
                    actions,
                    connections,
                });
            }
            router.push("/dashboard/runbooks");
        } catch (err: unknown) {
            const message =
                axios.isAxiosError(err)
                    ? (err.response?.data as { error?: string })?.error || err.message
                    : err instanceof Error
                        ? err.message
                        : "Failed to save runbook";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    const triggers = nodes.filter(n => n.type === "trigger");
    const actions = nodes.filter(n => n.type === "action");

    return (
        <div className="space-y-6 px-4 lg:px-6 py-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    {editId ? "Edit Runbook" : "New Runbook"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Define triggers and actions, then connect them to build a healing workflow.
                </p>
            </div>

            {/* Name + description */}
            <div className="space-y-3">
                <div>
                    <label className="block text-xs uppercase text-muted-foreground mb-1">Name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Restart on high CPU"
                        maxLength={255}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
                <div>
                    <label className="block text-xs uppercase text-muted-foreground mb-1">Description</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                </div>
            </div>

            {/* Canvas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Triggers */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Triggers</h2>
                        <button
                            onClick={addTrigger}
                            className="text-xs text-primary hover:underline"
                        >
                            + Add Trigger
                        </button>
                    </div>
                    {triggers.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No triggers yet.</p>
                    )}
                    {triggers.map(node => (
                        <NodeCard
                            key={node.id}
                            node={node}
                            typeOptions={TRIGGER_TYPES}
                            onUpdate={updateNode}
                            onRemove={removeNode}
                            onStartConnect={startConnect}
                            onFinishConnect={finishConnect}
                            isConnecting={connectingFrom !== null}
                            isSource={connectingFrom === node.id}
                        />
                    ))}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Actions</h2>
                        <button
                            onClick={addAction}
                            className="text-xs text-primary hover:underline"
                        >
                            + Add Action
                        </button>
                    </div>
                    {actions.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No actions yet.</p>
                    )}
                    {actions.map(node => (
                        <NodeCard
                            key={node.id}
                            node={node}
                            typeOptions={ACTION_TYPES}
                            onUpdate={updateNode}
                            onRemove={removeNode}
                            onStartConnect={startConnect}
                            onFinishConnect={finishConnect}
                            isConnecting={connectingFrom !== null}
                            isSource={connectingFrom === node.id}
                        />
                    ))}
                </div>
            </div>

            {/* Connections summary */}
            {edges.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h2 className="text-sm font-semibold text-foreground mb-2">Connections ({edges.length})</h2>
                    <ul className="space-y-1">
                        {edges.map(edge => {
                            const src = nodes.find(n => n.id === edge.source);
                            const tgt = nodes.find(n => n.id === edge.target);
                            return (
                                <li key={edge.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        <span className="text-foreground">{src?.label || edge.source}</span>
                                        {" → "}
                                        <span className="text-foreground">{tgt?.label || edge.target}</span>
                                    </span>
                                    <button
                                        onClick={() => setEdges(prev => prev.filter(e => e.id !== edge.id))}
                                        className="text-red-400 hover:text-red-300 ml-4"
                                    >
                                        ✕
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {saving ? "Saving…" : editId ? "Update Runbook" : "Save Runbook"}
                </button>
                <button
                    onClick={() => router.push("/dashboard/runbooks")}
                    className="rounded-lg border border-white/10 px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ─── NodeCard sub-component ──────────────────────────────────────────────────

interface NodeCardProps {
    node: RunbookNode;
    typeOptions: { value: string; label: string }[];
    onUpdate: (id: string, patch: Partial<RunbookNode>) => void;
    onRemove: (id: string) => void;
    onStartConnect: (id: string) => void;
    onFinishConnect: (id: string) => void;
    isConnecting: boolean;
    isSource: boolean;
}

function NodeCard({
    node,
    typeOptions,
    onUpdate,
    onRemove,
    onStartConnect,
    onFinishConnect,
    isConnecting,
    isSource,
}: NodeCardProps) {
    return (
        <div
            className={`rounded-xl border p-4 space-y-3 transition-colors ${isSource
                ? "border-primary/60 bg-primary/10"
                : "border-white/10 bg-white/5"
                }`}
            onClick={() => {
                if (isConnecting && !isSource) onFinishConnect(node.id);
            }}
        >
            {/* Type selector */}
            <div className="flex items-center justify-between gap-2">
                <select
                    value={node.actionType}
                    onChange={e =>
                        onUpdate(node.id, {
                            actionType: e.target.value,
                            label: typeOptions.find(t => t.value === e.target.value)?.label || e.target.value,
                        })
                    }
                    className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    {typeOptions.map(t => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
                <div className="flex gap-1">
                    <button
                        title={isSource ? "Cancel connection" : "Connect to another node"}
                        onClick={e => {
                            e.stopPropagation();
                            isSource ? onFinishConnect("") : onStartConnect(node.id);
                        }}
                        className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/30 transition-colors"
                    >
                        {isSource ? "✕" : "→"}
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); onRemove(node.id); }}
                        className="rounded px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-white/10 hover:border-red-400/30 transition-colors"
                    >
                        🗑
                    </button>
                </div>
            </div>

            {/* Custom label */}
            <input
                type="text"
                value={node.label}
                onChange={e => onUpdate(node.id, { label: e.target.value })}
                placeholder="Label"
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />

            {/* Node ID (for debugging) */}
            <p className="text-[10px] text-muted-foreground font-mono truncate opacity-50">
                id: {node.id}
            </p>
=======
'use client';

import { useState, useCallback } from 'react';
import { Node, Edge, Connection, addEdge, useNodesState, useEdgesState } from '@xyflow/react';
import { Plus, Save, ChevronLeft, Zap } from 'lucide-react';
import Link from 'next/link';
import { RuleCanvas } from '../../../components/runbooks/RuleCanvas';
import { RuleEditor } from '../../../components/runbooks/RuleEditor';
import { Runbook, RunbookTrigger, RunbookAction } from '../../../lib/runbook-types';
import axios from 'axios';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function RunbookBuilderPage() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [name, setName] = useState('Untitled Runbook');
    const [description, setDescription] = useState('');
    const [editingItem, setEditingItem] = useState<{ node: Node; type: 'condition' | 'action' } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const addCondition = () => {
        const id = `node_${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'condition',
            position: { x: 50, y: 50 },
            data: {
                condition: { type: 'high_cpu', threshold: 90, window: 30 },
                onEdit: () => setEditingItem({ node: newNode, type: 'condition' }),
            },
        };
        // Re-create the node with the onEdit callback bound to the actual node reference
        newNode.data.onEdit = () => setEditingItem({ node: newNode, type: 'condition' });
        setNodes((nds) => nds.concat(newNode));
    };

    const addAction = () => {
        const id = `node_${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'action',
            position: { x: 300, y: 50 },
            data: {
                action: { type: 'restart_container', parameters: {} },
                onEdit: () => setEditingItem({ node: newNode, type: 'action' }),
            },
        };
        newNode.data.onEdit = () => setEditingItem({ node: newNode, type: 'action' });
        setNodes((nds) => nds.concat(newNode));
    };

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        if (node.type === 'condition' || node.type === 'action') {
            setEditingItem({ node, type: node.type as 'condition' | 'action' });
        }
    };

    const saveEditedItem = (updatedData: any) => {
        if (!editingItem) return;

        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === editingItem.node.id) {
                    const newData = { ...node.data };
                    if (editingItem.type === 'condition') {
                        newData.condition = updatedData;
                    } else {
                        newData.action = updatedData;
                    }
                    return { ...node, data: newData };
                }
                return node;
            })
        );
        setEditingItem(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const triggers = nodes
                .filter((n) => n.type === 'condition')
                .map((n) => n.data.condition);

            const actions = nodes
                .filter((n) => n.type === 'action')
                .map((n) => n.data.action);

            await axios.post('http://localhost:4000/api/runbooks', {
                name,
                description,
                triggers,
                actions,
            });
            alert('Runbook saved and deployed!');
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save runbook');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/runbooks" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-transparent text-xl font-bold focus:outline-none border-b border-transparent focus:border-blue-500 text-white"
                        />
                        <input
                            placeholder="Add description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-transparent text-sm block w-full text-slate-400 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={addCondition}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/20 transition-all font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add IF
                    </button>
                    <button
                        onClick={addAction}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/20 transition-all font-medium"
                    >
                        <Plus className="w-4 h-4" /> Add THEN
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-500 hover:to-indigo-500 transition-all font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        {isSaving ? 'Deploying...' : <><Zap className="w-4 h-4" /> Save & Deploy</>}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative">
                <RuleCanvas
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                />

                {editingItem && (
                    <RuleEditor
                        item={editingItem.type === 'condition' ? editingItem.node.data.condition : editingItem.node.data.action}
                        onSave={saveEditedItem}
                        onCancel={() => setEditingItem(null)}
                    />
                )}
            </main>
>>>>>>> parent of 15ab4b9 (Revert "feat: Implement runbook builder with frontend UI, backend API, and database schema.")
        </div>
    );
}
