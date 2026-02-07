import React from 'react'
import '@testing-library/jest-dom'
// Mock Next.js router
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
    }),
    usePathname: () => '/',
}))

vi.mock('next/link', () => {
    return {
        __esModule: true,
        default: ({ children, href, ...props }: { children: React.ReactNode; href: string;[key: string]: unknown }) => {
            return (
                <a href={href} {...props}>
                    {children}
                </a>
            );
        },
    };
});
