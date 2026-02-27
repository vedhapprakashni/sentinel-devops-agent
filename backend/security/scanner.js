const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Cache scan results to avoid redundant scanning
// Map<imageId, { timestamp: number, result: Object }>
const scanCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function scanImage(imageId) {
  // Check cache
  const cached = scanCache.get(imageId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log(`[Security] Serving cached scan results for ${imageId}`);
    return cached.result;
  }

  console.log(`[Security] Starting scan for image: ${imageId}`);
  
  try {
    // Run Trivy via Docker
    // --format json: Output in JSON format
    // --quiet: Suppress progress bar
    // --severity: Scan for all severities but we filter later if needed
    const { stdout } = await execAsync(
      `docker run --rm aquasec/trivy image --format json --quiet ${imageId}`,
      { maxBuffer: 10 * 1024 * 1024 } // Increase buffer for large outputs
    );
    
    const results = JSON.parse(stdout);
    const vulns = [];

    if (results.Results) {
      for (const result of results.Results) {
        if (result.Vulnerabilities) {
          vulns.push(...result.Vulnerabilities.map(v => ({
            id: v.VulnerabilityID,
            package: v.PkgName,
            severity: v.Severity,
            cvssScore: v.CVSS?.nvd?.V3Score || v.CVSS?.redhat?.V3Score || 0,
            title: v.Title,
            description: v.Description,
            fixedVersion: v.FixedVersion,
            reference: v.PrimaryURL
          })));
        }
      }
    }

    // Deduplicate vulnerabilities (sometimes same vuln reported for different layers/paths)
    const uniqueVulns = Array.from(new Map(vulns.map(v => [v.id + v.package, v])).values());

    const summary = {
      imageId,
      scannedAt: new Date(),
      criticalCount: uniqueVulns.filter(v => v.severity === 'CRITICAL').length,
      highCount: uniqueVulns.filter(v => v.severity === 'HIGH').length,
      mediumCount: uniqueVulns.filter(v => v.severity === 'MEDIUM').length,
      lowCount: uniqueVulns.filter(v => v.severity === 'LOW' || v.severity === 'UNKNOWN').length,
      vulnerabilities: uniqueVulns.sort((a, b) => b.cvssScore - a.cvssScore), // Sort by CVSS desc
    };

    // Update cache
    scanCache.set(imageId, {
      timestamp: Date.now(),
      result: summary
    });

    return summary;
  } catch (err) {
    console.error(`[Security] Scan failed for ${imageId}:`, err.message);
    return { 
      imageId, 
      error: err.message,
      scannedAt: new Date(),
      vulnerabilities: []
    };
  }
}

function getCachedScan(imageId) {
  const cached = scanCache.get(imageId);
  return cached ? cached.result : null;
}

function clearCache() {
    scanCache.clear();
}

module.exports = { scanImage, getCachedScan, clearCache };
