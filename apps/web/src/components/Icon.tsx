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
  | 'check'
  | 'x';

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

      {name === 'check' ? <path {...common} d="m5 13 4 4 10-10" /> : null}

      {name === 'x' ? <path {...common} d="m6 6 12 12M18 6 6 18" /> : null}
    </svg>
  );
}
