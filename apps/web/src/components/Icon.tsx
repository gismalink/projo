type IconName =
  | 'building'
  | 'upload'
  | 'plus'
  | 'refresh'
  | 'edit'
  | 'calendar'
  | 'user-plus'
  | 'arrow-up'
  | 'arrow-down'
  | 'chevron-up'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'check'
  | 'x'
  | 'copy'
  | 'users'
  | 'clock'
  | 'coins'
  | 'alert'
  | 'door'
  | 'grid'
  | 'settings';

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 16, className }: IconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg
      className={className ? `ui-icon ${className}` : 'ui-icon'}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {name === 'building' ? (
        <>
          <path {...common} d="M4 20h16" />
          <path {...common} d="M6 20V6l6-2 6 2v14" />
          <path {...common} d="M9 9h.01M12 9h.01M15 9h.01M9 12h.01M12 12h.01M15 12h.01" />
          <path {...common} d="M11 20v-3h2v3" />
        </>
      ) : null}

      {name === 'upload' ? (
        <>
          <path {...common} d="M12 16V5" />
          <path {...common} d="M8.5 8.5 12 5l3.5 3.5" />
          <path {...common} d="M5 19h14" />
        </>
      ) : null}

      {name === 'plus' ? (
        <>
          <path {...common} d="M12 5v14" />
          <path {...common} d="M5 12h14" />
        </>
      ) : null}

      {name === 'refresh' ? (
        <>
          <path {...common} d="M20 7v5h-5" />
          <path {...common} d="M4 17v-5h5" />
          <path {...common} d="M6.8 9.2A7 7 0 0 1 18.5 7" />
          <path {...common} d="M17.2 14.8A7 7 0 0 1 5.5 17" />
        </>
      ) : null}

      {name === 'edit' ? (
        <>
          <path {...common} d="M4 20h4l10-10-4-4L4 16v4z" />
          <path {...common} d="m12.5 7.5 4 4" />
        </>
      ) : null}

      {name === 'calendar' ? (
        <>
          <rect {...common} x="4" y="6" width="16" height="14" rx="2" />
          <path {...common} d="M8 4v4M16 4v4M4 10h16" />
        </>
      ) : null}

      {name === 'user-plus' ? (
        <>
          <circle {...common} cx="9" cy="8" r="3" />
          <path {...common} d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
          <path {...common} d="M18 9v6M15 12h6" />
        </>
      ) : null}

      {name === 'arrow-up' ? (
        <path {...common} d="m12 5-5 5M12 5l5 5M12 5v14" />
      ) : null}

      {name === 'arrow-down' ? (
        <path {...common} d="m12 19-5-5M12 19l5-5M12 5v14" />
      ) : null}

      {name === 'chevron-up' ? <path {...common} d="m6 14 6-6 6 6" /> : null}

      {name === 'chevron-down' ? <path {...common} d="m6 10 6 6 6-6" /> : null}

      {name === 'chevron-left' ? <path {...common} d="m14 6-6 6 6 6" /> : null}

      {name === 'chevron-right' ? <path {...common} d="m10 6 6 6-6 6" /> : null}

      {name === 'check' ? <path {...common} d="m5 13 4 4 10-10" /> : null}

      {name === 'x' ? <path {...common} d="m6 6 12 12M18 6 6 18" /> : null}

      {name === 'copy' ? (
        <>
          <rect {...common} x="9" y="9" width="10" height="10" rx="2" />
          <path {...common} d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
        </>
      ) : null}

      {name === 'users' ? (
        <>
          <circle {...common} cx="9" cy="9" r="3" />
          <circle {...common} cx="16" cy="8" r="2.5" />
          <path {...common} d="M3.5 19c0-2.6 2.2-4.5 5.5-4.5s5.5 1.9 5.5 4.5" />
          <path {...common} d="M13 18.5c.5-1.7 2-3 4.2-3 1.5 0 2.6.5 3.3 1.4" />
        </>
      ) : null}

      {name === 'clock' ? (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 8v4l3 2" />
        </>
      ) : null}

      {name === 'coins' ? (
        <>
          <ellipse {...common} cx="12" cy="7" rx="6" ry="2.5" />
          <path {...common} d="M6 7v6c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7" />
          <path {...common} d="M6 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" />
        </>
      ) : null}

      {name === 'alert' ? (
        <>
          <path {...common} d="M12 4 3.8 18h16.4L12 4z" />
          <path {...common} d="M12 9v4" />
          <path {...common} d="M12 16h.01" />
        </>
      ) : null}

      {name === 'door' ? (
        <>
          <path {...common} d="M6 20V5.5c0-.8.6-1.5 1.4-1.6L16 3v17" />
          <path {...common} d="M10.5 12h.01" />
          <path {...common} d="M3 20h18" />
        </>
      ) : null}

      {name === 'grid' ? (
        <>
          <rect {...common} x="4" y="4" width="7" height="7" rx="1.4" />
          <rect {...common} x="13" y="4" width="7" height="7" rx="1.4" />
          <rect {...common} x="4" y="13" width="7" height="7" rx="1.4" />
          <rect {...common} x="13" y="13" width="7" height="7" rx="1.4" />
        </>
      ) : null}

      {name === 'settings' ? (
        <>
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.1-1.1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-.2a1 1 0 0 0-.9.6Z" />
        </>
      ) : null}
    </svg>
  );
}
