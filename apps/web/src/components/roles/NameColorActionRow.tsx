import { Icon } from '../Icon';
import { CustomColorPicker } from './CustomColorPicker';

type NameColorActionRowProps = {
  placeholder: string;
  nameValue: string;
  colorValue: string;
  fallbackHex: string;
  actionTitle: string;
  actionLabel: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onAction: () => void;
  actionDisabled?: boolean;
  rowClassName: string;
  actionClassName: string;
  actionIcon: 'plus' | 'x';
  nameAriaLabel?: string;
  colorLabel: string;
  copyHexLabel: string;
};

export function NameColorActionRow({
  placeholder,
  nameValue,
  colorValue,
  fallbackHex,
  actionTitle,
  actionLabel,
  onNameChange,
  onColorChange,
  onAction,
  actionDisabled = false,
  rowClassName,
  actionClassName,
  actionIcon,
  nameAriaLabel,
  colorLabel,
  copyHexLabel,
}: NameColorActionRowProps) {
  return (
    <div className={rowClassName}>
      <input
        className="department-manage-input"
        value={nameValue}
        placeholder={placeholder}
        aria-label={nameAriaLabel ?? placeholder}
        onChange={(event) => onNameChange(event.target.value)}
      />
      <div className="role-color-editor">
        <CustomColorPicker
          value={colorValue}
          label={colorLabel}
          copyLabel={copyHexLabel}
          fallbackHex={fallbackHex}
          onChange={onColorChange}
        />
      </div>
      <button
        type="button"
        className={actionClassName}
        disabled={actionDisabled}
        onClick={onAction}
        title={actionTitle}
        aria-label={actionLabel}
      >
        <Icon name={actionIcon} />
      </button>
    </div>
  );
}
