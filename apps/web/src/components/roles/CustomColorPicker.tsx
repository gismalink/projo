import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../Icon';

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export const normalizeHex = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (HEX_COLOR_PATTERN.test(normalized)) return normalized;
  if (/^[0-9A-F]{6}$/.test(normalized)) return `#${normalized}`;
  return null;
};

const sanitizeHexDraft = (value: string) => {
  const upper = value.toUpperCase();
  const hasHash = upper.includes('#');
  const onlyHex = upper.replace(/[^0-9A-F]/g, '').slice(0, 6);
  return `${hasHash || onlyHex.length > 0 ? '#' : ''}${onlyHex}`;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const HUE_MAX = 359;

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);
  return { red, green, blue };
};

const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

const rgbToHsv = (red: number, green: number, blue: number) => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;
  return { hue, saturation, value };
};

const hsvToRgb = (hue: number, saturation: number, value: number) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp01(saturation);
  const v = clamp01(value);
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = chroma;
    g = x;
  } else if (h < 120) {
    r = x;
    g = chroma;
  } else if (h < 180) {
    g = chroma;
    b = x;
  } else if (h < 240) {
    g = x;
    b = chroma;
  } else if (h < 300) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  return {
    red: (r + m) * 255,
    green: (g + m) * 255,
    blue: (b + m) * 255,
  };
};

type CustomColorPickerProps = {
  value: string;
  label: string;
  copyLabel: string;
  fallbackHex: string;
  onChange: (nextHex: string) => void;
};

export function CustomColorPicker(props: CustomColorPickerProps) {
  const { value, label, copyLabel, fallbackHex, onChange } = props;
  const pickerId = useId();
  const validHex = normalizeHex(value) ?? fallbackHex;
  const rgb = hexToRgb(validHex) ?? { red: 122, green: 138, blue: 154 };
  const hsv = rgbToHsv(rgb.red, rgb.green, rgb.blue);
  const [hexDraft, setHexDraft] = useState(validHex);
  const svRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setHexDraft(validHex);
  }, [validHex]);

  useEffect(() => {
    const handlePickerOpened = (event: Event) => {
      const custom = event as CustomEvent<{ id: string }>;
      if (custom.detail.id !== pickerId) {
        setIsOpen(false);
      }
    };
    window.addEventListener('custom-color-picker-opened', handlePickerOpened as EventListener);
    return () => {
      window.removeEventListener('custom-color-picker-opened', handlePickerOpened as EventListener);
    };
  }, [pickerId]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hueRgb = hsvToRgb(hsv.hue, 1, 1);
  const hueColor = rgbToHex(hueRgb.red, hueRgb.green, hueRgb.blue);

  const copyHex = (nextValue: string) => {
    const normalized = normalizeHex(nextValue);
    if (!normalized || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(normalized);
  };

  const updateFromSvPoint = (clientX: number, clientY: number) => {
    const panel = svRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const saturation = clamp01((clientX - rect.left) / rect.width);
    const valueFromTop = clamp01((clientY - rect.top) / rect.height);
    const nextValue = 1 - valueFromTop;
    const nextRgb = hsvToRgb(hsv.hue, saturation, nextValue);
    onChange(rgbToHex(nextRgb.red, nextRgb.green, nextRgb.blue));
  };

  const updateFromHuePoint = (clientX: number, track: HTMLDivElement) => {
    const rect = track.getBoundingClientRect();
    const progress = clamp01((clientX - rect.left) / rect.width);
    const nextHue = progress * HUE_MAX;
    const nextRgb = hsvToRgb(nextHue, hsv.saturation, hsv.value);
    onChange(rgbToHex(nextRgb.red, nextRgb.green, nextRgb.blue));
  };

  return (
    <div ref={rootRef} className="color-picker-dropdown">
      <button
        type="button"
        className="color-picker-trigger"
        aria-label={label}
        title={label}
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            if (next) {
              window.dispatchEvent(new CustomEvent('custom-color-picker-opened', { detail: { id: pickerId } }));
            }
            return next;
          });
        }}
      >
        <span className="color-picker-trigger-swatch" style={{ background: validHex }} />
      </button>
      {isOpen ? <div className="color-picker-popover">
        <input
          className="color-hex-input"
          value={hexDraft}
          onChange={(event) => {
            const next = sanitizeHexDraft(event.target.value);
            setHexDraft(next);
            const normalized = normalizeHex(next);
            if (normalized) onChange(normalized);
          }}
          onBlur={() => {
            const normalized = normalizeHex(hexDraft);
            if (normalized) {
              onChange(normalized);
              setHexDraft(normalized);
            } else {
              setHexDraft(validHex);
            }
          }}
        />
        <button
          type="button"
          className="department-manage-action"
          title={copyLabel}
          aria-label={copyLabel}
          onClick={() => copyHex(validHex)}
        >
          <Icon name="copy" />
        </button>

        <div
          ref={svRef}
          className="custom-color-sv"
          style={{ backgroundColor: hueColor }}
          onMouseDown={(event) => {
            event.preventDefault();
            updateFromSvPoint(event.clientX, event.clientY);

            const handleMouseMove = (moveEvent: MouseEvent) => {
              updateFromSvPoint(moveEvent.clientX, moveEvent.clientY);
            };
            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <span
            className="custom-color-sv-pointer"
            style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.value) * 100}%` }}
          />
        </div>

        <div
          className="custom-color-hue"
          onMouseDown={(event) => {
            event.preventDefault();
            const track = event.currentTarget as HTMLDivElement;
            updateFromHuePoint(event.clientX, track);

            const handleMouseMove = (moveEvent: MouseEvent) => {
              updateFromHuePoint(moveEvent.clientX, track);
            };
            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove);
              window.removeEventListener('mouseup', handleMouseUp);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <span className="custom-color-hue-pointer" style={{ left: `${(Math.min(HUE_MAX, hsv.hue) / HUE_MAX) * 100}%` }} />
        </div>
      </div> : null}
    </div>
  );
}
