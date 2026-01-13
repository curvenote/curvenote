interface UnsubscribeButtonProps {
  asBaseUrl: (path: string) => string;
  unsubscribeUrl?: string;
  className?: string;
}

export function UnsubscribeButton({
  asBaseUrl,
  unsubscribeUrl,
  className = '',
}: UnsubscribeButtonProps) {
  return (
    <div className={`text-center py-4 ${className}`}>
      <div className="text-center">
        {unsubscribeUrl && (
          <>
            <a
              href={unsubscribeUrl}
              className="inline-block px-4 py-2 text-sm text-gray-600 underline hover:text-gray-800"
              style={{ color: '#6b7280', textDecoration: 'underline' }}
            >
              One-click unsubscribe
            </a>
            <span className="mx-2 text-gray-400">•</span>
          </>
        )}
        <a
          href={asBaseUrl('/app/settings/emails')}
          className="inline-block px-4 py-2 text-sm text-gray-600 underline hover:text-gray-800"
          style={{ color: '#6b7280', textDecoration: 'underline' }}
        >
          Manage email preferences
        </a>
      </div>
    </div>
  );
}
