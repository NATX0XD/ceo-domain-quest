type VideoControlIconName = 'play' | 'pause' | 'replay' | 'skip'

export function VideoControlIcon({ name, size = 24 }: { name: VideoControlIconName; size?: number }) {
  if (name === 'pause') {
    return (
      <svg aria-hidden="true" className="video-control-icon" viewBox="0 0 24 24" width={size} height={size}>
        <rect x="6.5" y="5.2" width="4.2" height="13.6" rx="1.5" fill="currentColor" />
        <rect x="13.3" y="5.2" width="4.2" height="13.6" rx="1.5" fill="currentColor" />
      </svg>
    )
  }

  if (name === 'replay') {
    return (
      <svg aria-hidden="true" className="video-control-icon" viewBox="0 0 24 24" width={size} height={size}>
        <path d="M19.5 10.5A7.7 7.7 0 1 0 19 15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M4.4 4.7v5h5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (name === 'skip') {
    return (
      <svg aria-hidden="true" className="video-control-icon" viewBox="0 0 24 24" width={size} height={size}>
        <path d="M4.8 5.8v12.4L13.2 12 4.8 5.8Z" fill="currentColor" />
        <path d="M13.2 5.8v12.4l6-6.2-6-6.2Z" fill="currentColor" />
        <rect x="19.1" y="5.8" width="1.8" height="12.4" rx=".9" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="video-control-icon" viewBox="0 0 24 24" width={size} height={size}>
      <path d="M9.8 5.4v13.2a1 1 0 0 0 1.55.83l9.05-6.6a1 1 0 0 0 0-1.66l-9.05-6.6a1 1 0 0 0-1.55.83Z" fill="currentColor" />
    </svg>
  )
}
