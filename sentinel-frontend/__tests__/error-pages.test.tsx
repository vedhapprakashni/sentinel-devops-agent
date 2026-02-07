import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NotFound from '@/app/not-found'
import ErrorPage from '@/app/error'
import { logger } from '@/lib/logger'

// Mock logger
vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

describe('Not Found Page', () => {
    it('renders 404 heading and shield emoji', () => {
        render(<NotFound />)
        expect(screen.getByText('404')).toBeDefined()
        expect(screen.getByText('Page Not Found')).toBeDefined()
        expect(screen.getByRole('img', { name: /Sentinel Shield/i })).toBeDefined()
    })

    it('contains navigation links', () => {
        render(<NotFound />)
        expect(screen.getByRole('link', { name: /Return to Dashboard/i })).toBeDefined()
        expect(screen.getByRole('button', { name: /Go back to previous page/i })).toBeDefined()
        expect(screen.getByRole('link', { name: /Return to Home Page/i })).toBeDefined()
    })
})

describe('Error Page', () => {
    it('renders error message', () => {
        const error = new Error('Test error')
        const reset = vi.fn()
        render(<ErrorPage error={error} reset={reset} />)

        expect(screen.getByText('Something Went Wrong')).toBeDefined()
        expect(screen.getByText('Try Again')).toBeDefined()
    })

    it('logs error on mount', () => {
        const error = new Error('Test log error')
        const reset = vi.fn()
        render(<ErrorPage error={error} reset={reset} />)

        expect(logger.error).toHaveBeenCalledWith(error, expect.anything())
    })

    it('calls reset function when Try Again is clicked', () => {
        const error = new Error('Test error')
        const reset = vi.fn()
        render(<ErrorPage error={error} reset={reset} />)

        fireEvent.click(screen.getByRole('button', { name: /Try to recover/i }))
        expect(reset).toHaveBeenCalled()
    })

    it('contains fallback home link', () => {
        const error = new Error('Test error')
        const reset = vi.fn()
        render(<ErrorPage error={error} reset={reset} />)

        expect(screen.getByRole('link', { name: /Return to Home Page/i })).toBeDefined()
    })
})
