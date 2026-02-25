class SentinelError extends Error {
    constructor(code, message, reason, solution) {
        super(message);
        this.name = 'SentinelError';
        this.code = code;
        this.reason = reason;
        this.solution = solution;
    }

    toJSON() {
        return {
            error: {
                message: this.message,
                reason: this.reason,
                solution: this.solution
            }
        };
    }
}

const ERRORS = {
    DOCKER_CONNECTION: () => new SentinelError(
        'DOCKER_CONNECTION',
        'Docker daemon is not running.',
        'Sentinel cannot connect to the Docker socket at /var/run/docker.sock.',
        'Start Docker Desktop or run the docker daemon command.'
    ),
    API_TIMEOUT: () => new SentinelError(
        'API_TIMEOUT',
        'The API request timed out.',
        'The backend is taking too long to respond.',
        'Check your network connection or verify if the backend service is under high load.'
    ),
    SERVICE_NOT_FOUND: (service) => new SentinelError(
        'SERVICE_NOT_FOUND',
        'The requested service could not be found.',
        `The service '${service || 'provided'}' does not match any registered services.`,
        'Verify the service name and try again.'
    ),
    UNAUTHORIZED_ACCESS: () => new SentinelError(
        'UNAUTHORIZED_ACCESS',
        'Action not authorized.',
        'You do not have the required permissions to perform this action.',
        'Authenticate with valid credentials or contact an administrator.'
    ),
    INVALID_PARAMETERS: () => new SentinelError(
        'INVALID_PARAMETERS',
        'Invalid parameters provided.',
        'One or more parameters passed to the command are incorrect or missing.',
        'Review the command documentation and ensure all required parameters are correctly formatted.'
    ),
    BACKEND_UNAVAILABLE: () => new SentinelError(
        'BACKEND_UNAVAILABLE',
        'Could not connect to Sentinel Backend.',
        'The Sentinel backend service is not running or unreachable.',
        'Ensure the backend is started (e.g., running on port 4000) and reachable from your network.'
    ),
    CONTAINER_NOT_FOUND: () => new SentinelError(
        'CONTAINER_NOT_FOUND',
        'Container not found.',
        'No active container matches the provided ID.',
        'Use the status command to list active containers and verify the ID.'
    ),
    RATE_LIMIT_EXCEEDED: () => new SentinelError(
        'RATE_LIMIT_EXCEEDED',
        'Rate limit exceeded.',
        'Too many requests have been made in a short period.',
        'Wait a few moments before trying your request again.'
    ),
    ACTION_FAILED: (details) => new SentinelError(
        'ACTION_FAILED',
        'The requested action failed.',
        details || 'The service encountered an error while attempting to execute the action.',
        'Check the backend logs for more details on the failure.'
    ),
    MAX_RESTARTS_EXCEEDED: () => new SentinelError(
        'MAX_RESTARTS_EXCEEDED',
        'Maximum restart attempts exceeded.',
        'The container has been restarted too many times within the grace period.',
        'Investigate the root cause of the container failure before attempting manual restarts.'
    )
};

module.exports = {
    SentinelError,
    ERRORS
};
