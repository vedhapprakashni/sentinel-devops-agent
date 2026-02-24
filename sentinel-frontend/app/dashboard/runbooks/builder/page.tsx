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
        </div>
    );
}
