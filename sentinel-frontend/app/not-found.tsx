'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

/**
 * Custom 404 Not Found Page
 * 
 * This component is rendered when a user navigates to a route that does not exist.
 * It provides a user-friendly UI with Sentinel branding and navigation options
 * to guide the user back to valid parts of the application.
 */
export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="relative mb-8">
                    <h1 className="text-[150px] font-bold text-muted/20 leading-none select-none">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-6xl" role="img" aria-label="Sentinel Shield">🛡️</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-4">
                    Page Not Found
                </h2>

                <p className="text-muted-foreground mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    Sentinel couldn&apos;t locate this resource.
                </p>

                <div className="flex flex-col gap-4 justify-center items-center">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Link
                            href="/dashboard"
                            aria-label="Return to Dashboard"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
                        >
                            <Home size={20} />
                            Go to Dashboard
                        </Link>

                        <button
                            onClick={() => window.history.back()}
                            aria-label="Go back to previous page"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
                        >
                            <ArrowLeft size={20} />
                            Go Back
                        </button>
                    </div>
                    {/* Fallback to Home if Dashboard is broken */}
                    <Link
                        href="/"
                        className="text-sm text-muted-foreground hover:text-primary transition-colors hover:underline"
                        aria-label="Return to Home Page"
                    >
                        Or return to Home
                    </Link>
                </div>

                <p className="text-sm text-muted-foreground mt-8">
                    Need help? Check the{' '}
                    <Link href="/docs" className="text-primary hover:underline" aria-label="View Documentation">
                        documentation
                    </Link>
                </p>
            </div>
        </div>
    );
}
