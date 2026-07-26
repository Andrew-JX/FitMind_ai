import { useTheme } from "../theme/ThemeContext";

export interface SegmentedControlOption<TValue extends string> {
  label: string;
  value: TValue;
}

export interface SegmentedControlProps<TValue extends string> {
  /** Accessible name for the group. */
  label: string;
  onChange: (value: TValue) => void;
  options: SegmentedControlOption<TValue>[];
  value: TValue;
}

/** Design: 8px gap between segments, 5px padding around them. */
const SEGMENT_GAP = 8;
const TRACK_PADDING = 5;

/**
 * Design's segmented control: a glass pill that slides to the active segment.
 *
 * @param props - Options, selected value, and change handler
 * @returns Segmented control element
 */
export function SegmentedControl<TValue extends string>(
  props: SegmentedControlProps<TValue>,
) {
  const { theme } = useTheme();
  const segmentCount = props.options.length;
  const activeIndex = Math.max(
    0,
    props.options.findIndex((option) => option.value === props.value),
  );

  return (
    <div
      aria-label={props.label}
      role="tablist"
      style={trackStyle(theme, segmentCount)}
    >
      <div
        aria-hidden="true"
        style={pillStyle(theme, segmentCount, activeIndex)}
      />
      {props.options.map((option) => {
        const isActive = option.value === props.value;

        return (
          <button
            aria-selected={isActive}
            key={option.value}
            onClick={() => props.onChange(option.value)}
            role="tab"
            style={segmentStyle(theme, isActive)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function trackStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  segmentCount: number,
): React.CSSProperties {
  return {
    background: `${theme.gradients.card}, ${theme.colors.surf}`,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 14,
    display: "grid",
    gap: SEGMENT_GAP,
    gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))`,
    padding: TRACK_PADDING,
    position: "relative",
  };
}

/**
 * Sliding glass pill behind the active segment.
 *
 * Width subtracts the inter-segment gaps and the track padding so the pill
 * lines up with one column; the translate adds one gap per column crossed.
 *
 * @param theme - Active theme tokens
 * @param segmentCount - Number of segments in the track
 * @param activeIndex - Index of the selected segment
 * @returns Absolutely positioned pill style
 */
function pillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  segmentCount: number,
  activeIndex: number,
): React.CSSProperties {
  const inset = (segmentCount - 1) * SEGMENT_GAP + TRACK_PADDING * 2;

  return {
    background: `linear-gradient(180deg, ${theme.colors.glassA}, ${theme.colors.glassB})`,
    border: `1px solid ${theme.colors.glassA}`,
    borderRadius: 10,
    boxShadow: `inset 0 1px 0 ${theme.colors.glassC}, 0 6px 14px ${theme.colors.sh40}`,
    height: `calc(100% - ${TRACK_PADDING * 2}px)`,
    left: TRACK_PADDING,
    pointerEvents: "none",
    position: "absolute",
    top: TRACK_PADDING,
    transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * SEGMENT_GAP}px))`,
    transition: "transform 0.5s cubic-bezier(0.3, 1.4, 0.4, 1)",
    width: `calc((100% - ${inset}px) / ${segmentCount})`,
  };
}

function segmentStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderRadius: 10,
    color: isActive ? theme.colors.tx : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: isActive ? 700 : 500,
    padding: "8px 0",
    // Keep labels above the sliding glass pill.
    position: "relative",
    transition: "color 0.3s ease",
  };
}
