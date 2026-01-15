/**
 * Full-page error fallback for the app-level ErrorBoundary.
 * Displays error details and a reload button.
 */
export function AppErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="max-w-2xl p-8 border border-red-500 bg-red-50 dark:bg-red-950 rounded-lg">
        <h1 className="text-2xl font-bold text-red-700 dark:text-red-300 mb-4">
          Application Error
        </h1>
        <p className="text-red-600 dark:text-red-400 mb-4">
          An unexpected error occurred in the application.
          Please try refreshing the page.
        </p>
        <details className="text-sm text-red-600 dark:text-red-400">
          <summary className="cursor-pointer font-semibold">Error details</summary>
          <pre className="mt-2 p-3 bg-red-100 dark:bg-red-900 rounded overflow-x-auto">
            {error.toString()}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  )
}
