'use client';

import { Inter } from 'next/font/google';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'] });

/**
 * Global Error Boundary
 * 
 * This component catches errors that happen in the root layout or template.
 * It replaces the entire HTML document as a fallback.
 */
export default function GlobalError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body className={`${inter.className} bg-background text-foreground`}>
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
                            <span className="text-5xl" role="img" aria-label="Sentinel Shield">🛡️</span> Sentinel Error
                        </h1>
                        <p className="text-muted-foreground mb-8">
                            A critical error occurred. Please try again.
                        </p>
                        <div className="flex flex-col gap-4 justify-center items-center">
                            <button
                                onClick={reset}
                                aria-label="Reload the application"
                                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
                            >
                                Reload Application
                            </button>
                            {/* Fallback to Home */}
                            <Link
                                href="/"
                                className="text-sm text-muted-foreground hover:text-primary transition-colors hover:underline"
                                aria-label="Return to Home Page"
                            >
                                Or return to Home
                            </Link>
                        </div>


                    </div>
                </div>
            </body>
        </html>
    );
}
