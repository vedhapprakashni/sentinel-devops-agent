# Sentinel CLI

A powerful command-line interface for the Sentinel autonomous DevOps monitoring system.

## Installation

```bash
cd cli
npm install
npm link  # Makes 'sentinel' command available globally
```

## Commands

### 📊 Check System Status
```bash
sentinel status
```
Displays real-time health status of all services with color-coded indicators.

### 🚑 Heal a Service
```bash
sentinel heal auth
sentinel heal payment
sentinel heal notification
```
Triggers auto-healing for a specific service.

### 💥 Simulate Failures
```bash
sentinel simulate auth down
sentinel simulate payment slow
sentinel simulate notification healthy
```
Test the autonomous healing system by simulating various failure modes.

### 📝 Generate Incident Report
```bash
sentinel report
```
Creates a timestamped Markdown report with all AI insights and incident analysis.

## Architecture

The CLI communicates with the Sentinel backend (port 4000) to:
- Query real-time service health
- Trigger manual healing actions
- Retrieve AI analysis logs
- Generate automated reports

## Example Workflow

```bash
# Check current status
sentinel status

# Simulate a failure
sentinel simulate auth down

# Wait for auto-healing (or trigger manually)
sentinel heal auth

# Generate incident report
sentinel report
```

## Requirements

- Node.js 18+
- Sentinel backend running on localhost:4000
- Services running in Docker containers
