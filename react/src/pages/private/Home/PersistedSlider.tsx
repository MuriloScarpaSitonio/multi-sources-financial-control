import { type ReactNode } from "react";

import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Slider from "@mui/material/Slider";

import { sliderSx } from "./consts";
import { usePersistedValue } from "./usePersistedValue";

type SliderMark = { value: number; label?: string };

type PersistedSliderProps = {
  /** Committed value (parent state / persisted preference). */
  value: number;
  /** Commit handler — updates parent state and persists. Debounced when enabled. */
  onChange: (value: number) => void;
  /** Renders the label/readout. Receives the live (raw) value so it tracks the thumb. */
  renderLabel: (value: number) => ReactNode;
  /**
   * When true, the change persists via an API call: drag stays smooth, the
   * commit is debounced, and while the recompute + save are in flight the
   * label + slider are replaced by a skeleton. When false (inactive strategy /
   * pure what-if), changes pass through immediately with no debounce or skeleton.
   */
  enabled?: boolean;
  /** Mutation pending flag from the page; keeps the skeleton up until the save settles. */
  isPersisting?: boolean;
  debounceMs?: number;
  min: number;
  max: number;
  step?: number;
  marks?: boolean | SliderMark[];
  disabled?: boolean;
  /** Optional Resetar button; rendered next to the slider when `showReset` is true. */
  showReset?: boolean;
  onReset?: () => void;
};

const PersistedSlider = ({
  value,
  onChange,
  renderLabel,
  enabled = false,
  isPersisting = false,
  debounceMs,
  min,
  max,
  step,
  marks,
  disabled,
  showReset = false,
  onReset,
}: PersistedSliderProps) => {
  const { raw, commit, cancel, showSkeleton } = usePersistedValue(value, onChange, {
    enabled,
    isPersisting,
    debounceMs,
  });

  if (showSkeleton) {
    return <Skeleton variant="rounded" width={200} height={24} />;
  }

  return (
    <>
      {renderLabel(raw)}
      <Slider
        value={raw}
        onChange={(_, next) => commit(next as number)}
        min={min}
        max={max}
        step={step}
        marks={marks}
        size="medium"
        sx={sliderSx}
        disabled={disabled}
      />
      {showReset && onReset && (
        <Button
          variant="brand-text"
          size="small"
          onClick={() => {
            cancel();
            onReset();
          }}
        >
          Resetar
        </Button>
      )}
    </>
  );
};

export default PersistedSlider;
