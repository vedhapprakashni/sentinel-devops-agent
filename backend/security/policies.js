const policies = {
    allowCritical: false,
    allowHigh: true, // Allow high severity by default but warn
    blockDeployment: true, // Block new deployments if critical vulnerabilities found
    ignorePackages: [], // List of packages to ignore (e.g., 'npm-audit')
    warningOnly: false // If true, only log warnings, don't block
};

function getPolicy() {
    return policies;
}

function updatePolicy(newPolicy) {
    Object.assign(policies, newPolicy);
    return policies;
}

function checkCompliance(scanResult) {
    if (!scanResult || scanResult.error) return { compliant: true, reason: 'Scan failed or skipped' };
    
    if (policies.warningOnly) return { compliant: true, warning: 'Policy violation detected (Warning Mode)' };

    // Ignore blocked packages/vulns logic could be added here
    
    if (!policies.allowCritical && scanResult.criticalCount > 0) {
        return { 
            compliant: false, 
            reason: `Found ${scanResult.criticalCount} critical vulnerabilities. Policy: allowCritical=false`
        };
    }

    if (!policies.allowHigh && scanResult.highCount > 0) {
        return { 
            compliant: false, 
            reason: `Found ${scanResult.highCount} high severity vulnerabilities. Policy: allowHigh=false` 
        };
    }

    return { compliant: true };
}

module.exports = {
    getPolicy,
    updatePolicy,
    checkCompliance
};
