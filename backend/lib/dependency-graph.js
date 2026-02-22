// backend/lib/dependency-graph.js
class DependencyGraph {
    constructor() {
        this.dependencies = new Map(); // containerId -> Set of dependencies
    }

    // Not fully populated from the snippet, but initialized for future use.
    addDependency(container, dependency) {
        if (!this.dependencies.has(container)) {
            this.dependencies.set(container, new Set());
        }
        this.dependencies.get(container).add(dependency);
    }

    getDependencies(containerId) {
        return this.dependencies.get(containerId) ? Array.from(this.dependencies.get(containerId)) : [];
    }
}

module.exports = new DependencyGraph();
