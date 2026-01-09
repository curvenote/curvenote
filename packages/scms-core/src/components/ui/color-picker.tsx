'use client';

import Color from 'color';
import { PipetteIcon } from 'lucide-react';
import { Slider } from 'radix-ui';
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from './button.js';
import { Input } from './input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select.js';
import { cn } from '../../utils/cn.js';

interface ColorPickerContextValue {
  hue: number;
  saturation: number;
  lightness: number;
  mode: string;
  setHue: (hue: number) => void;
  setSaturation: (saturation: number) => void;
  setLightness: (lightness: number) => void;
  setMode: (mode: string) => void;
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(undefined);

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error('useColorPicker must be used within a ColorPickerProvider');
  }

  return context;
};

export type ColorPickerProps = HTMLAttributes<HTMLDivElement> & {
  value?: Parameters<typeof Color>[0];
  defaultValue?: Parameters<typeof Color>[0];
  onChange?: (value: Parameters<typeof Color.rgb>[0]) => void;
};

export const ColorPicker = ({
  value,
  defaultValue = '#000000',
  onChange,
  className,
  ...props
}: ColorPickerProps) => {
  // Helper to safely get hue (handles NaN for grayscale colors)
  const getHue = (color: ReturnType<typeof Color>) => {
    const h = color.hue();
    return isNaN(h) ? 0 : h;
  };

  // Initialize state only once - don't recalculate Color objects on every render
  const [hue, setHue] = useState(() => {
    try {
      if (value) return getHue(Color(value));
      return getHue(Color(defaultValue));
    } catch {
      return 0;
    }
  });
  const [saturation, setSaturation] = useState(() => {
    try {
      if (value) return Color(value).saturationl();
      return Color(defaultValue).saturationl();
    } catch {
      return 0;
    }
  });
  const [lightness, setLightness] = useState(() => {
    try {
      if (value) return Color(value).lightness();
      return Color(defaultValue).lightness();
    } catch {
      return 0;
    }
  });
  const [mode, setMode] = useState('hex');

  // Track the last value/defaultValue to detect external updates
  const lastValueRef = useRef(value);
  const lastDefaultValueRef = useRef(defaultValue);
  const isInitialMountRef = useRef(true);
  const initialColorHexRef = useRef<string | null>(null);

  // Store initial color hex to prevent onChange on mount
  useEffect(() => {
    if (isInitialMountRef.current) {
      try {
        const initialColor = value ? Color(value) : Color(defaultValue);
        initialColorHexRef.current = initialColor.hex();
      } catch {
        initialColorHexRef.current = null;
      }
      isInitialMountRef.current = false;
    }
  }, [value, defaultValue]);

  // Update color when controlled value changes from parent
  useEffect(() => {
    if (value && value !== lastValueRef.current) {
      lastValueRef.current = value;
      try {
        const color = Color(value);
        const [h, s, l] = color.hsl().array();
        if (s > 0 && l > 0 && l < 100) {
          setHue(h);
        }
        setSaturation(s);
        setLightness(l);
      } catch (error) {
        console.error('Invalid color value:', value, error);
      }
    }
  }, [value]);

  // Update color when defaultValue changes (for uncontrolled mode)
  useEffect(() => {
    if (!value && defaultValue !== lastDefaultValueRef.current) {
      lastDefaultValueRef.current = defaultValue;
      try {
        const color = Color(defaultValue);
        const [h, s, l] = color.hsl().array();
        if (s > 0 && l > 0 && l < 100) {
          setHue(h);
        }
        setSaturation(s);
        setLightness(l);
        // Update initial color hex when defaultValue changes
        initialColorHexRef.current = color.hex();
      } catch (error) {
        console.error('Invalid color defaultValue:', defaultValue, error);
      }
    }
  }, [defaultValue, value]);

  // Notify parent of changes when user interacts with the picker
  useEffect(() => {
    if (!onChange) return;

    const color = Color.hsl(hue, saturation, lightness);
    const colorHex = color.hex();

    // Don't call onChange on initial mount (prevents unnecessary updates)
    if (initialColorHexRef.current && colorHex === initialColorHexRef.current) {
      return;
    }

    // Don't call onChange if this matches the current value prop
    // This prevents circular updates when parent updates value after our onChange
    try {
      if (value && Color(value).hex() === colorHex) return;
    } catch {
      // If value is invalid, continue with onChange
    }

    const rgb = color.rgb().array();
    onChange([rgb[0], rgb[1], rgb[2]]);
  }, [hue, saturation, lightness, onChange, value]);

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        mode,
        setHue,
        setSaturation,
        setLightness,
        setMode,
      }}
    >
      <div className={cn('flex flex-col gap-4 size-full', className)} {...props} />
    </ColorPickerContext.Provider>
  );
};

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSelection = memo(({ className, ...props }: ColorPickerSelectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { hue, saturation, lightness, setSaturation, setLightness } = useColorPicker();

  // Initialize position based on current saturation/lightness values
  const [positionX, setPositionX] = useState(() => saturation / 100);
  const [positionY, setPositionY] = useState(() => 1 - lightness / 100);

  const backgroundGradient = useMemo(() => {
    return `linear-gradient(0deg, rgba(0,0,0,1) 0%, transparent 50%, rgba(255,255,255,1) 100%),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`;
  }, [hue]);

  // Update position when saturation/lightness changes externally (not from dragging)
  useEffect(() => {
    if (!isDragging) {
      const x = saturation / 100;
      // Convert lightness to Y position: lightness 100% = Y 0, lightness 0% = Y 1
      const y = 1 - lightness / 100;
      setPositionX(x);
      setPositionY(y);
    }
  }, [saturation, lightness, isDragging]);

  const updateColorFromPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      setPositionX(x);
      setPositionY(y);
      setSaturation(x * 100);
      // Y position: 0 = top (light), 1 = bottom (dark)
      // Convert Y to lightness: 0 = 100% lightness, 1 = 0% lightness
      const newLightness = (1 - y) * 100;
      setLightness(newLightness);
    },
    [setSaturation, setLightness],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDragging) return;
      updateColorFromPosition(event.clientX, event.clientY);
    },
    [isDragging, updateColorFromPosition],
  );

  useEffect(() => {
    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, handlePointerMove]);

  return (
    <div
      className={cn('relative rounded size-full cursor-crosshair', className)}
      onPointerDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
        updateColorFromPosition(e.clientX, e.clientY);
      }}
      ref={containerRef}
      style={{
        background: backgroundGradient,
      }}
      {...props}
    >
      <div
        className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full pointer-events-none"
        style={{
          left: `${positionX * 100}%`,
          top: `${positionY * 100}%`,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
});

ColorPickerSelection.displayName = 'ColorPickerSelection';

export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerHue = ({ className, ...props }: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker();

  return (
    <Slider.Root
      className={cn('flex relative w-full h-4 touch-none', className)}
      max={360}
      onValueChange={([newHue]) => setHue(newHue)}
      step={1}
      value={[hue]}
      {...props}
    >
      <Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <Slider.Range className="absolute h-full" />
      </Slider.Track>
      <Slider.Thumb className="block w-4 h-4 transition-colors border rounded-full shadow border-primary/50 bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  );
};

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>;

export const ColorPickerEyeDropper = ({ className, ...props }: ColorPickerEyeDropperProps) => {
  const { setHue, setSaturation, setLightness } = useColorPicker();

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const color = Color(result.sRGBHex);
      const [h, s, l] = color.hsl().array();
      // Only update hue if the color has meaningful hue (not grayscale, not pure black/white)
      if (s > 0 && l > 0 && l < 100) {
        setHue(h);
      }
      setSaturation(s);
      setLightness(l);
    } catch (error) {
      console.error('EyeDropper failed:', error);
    }
  };

  return (
    <Button
      className={cn('shrink-0 text-muted-foreground', className)}
      onClick={handleEyeDropper}
      size="icon"
      variant="outline"
      type="button"
      {...props}
    >
      <PipetteIcon size={16} />
    </Button>
  );
};

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>;

const formats = ['hex', 'rgb', 'hsl'];

export const ColorPickerOutput = ({ ...props }: ColorPickerOutputProps) => {
  const { mode, setMode } = useColorPicker();

  return (
    <Select onValueChange={setMode} value={mode}>
      <SelectTrigger className="w-20 h-8 text-xs shrink-0" {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {formats.map((format) => (
          <SelectItem className="text-xs" key={format} value={format}>
            {format.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerFormat = ({ className, ...props }: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, mode, setHue, setSaturation, setLightness } =
    useColorPicker();
  const color = Color.hsl(hue, saturation, lightness);

  // State for validation and previous values
  const [hexValue, setHexValue] = useState(color.hex().slice(1)); // Store without #
  const [rgbValues, setRgbValues] = useState(() => {
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value));
    return rgb.map(String);
  });
  const [hslValues, setHslValues] = useState(() => {
    const hsl = color
      .hsl()
      .array()
      .map((value) => Math.round(value));
    return hsl.map(String);
  });

  // Validation states for all modes
  const [isHexValid, setIsHexValid] = useState(true);
  const [isRgbValid, setIsRgbValid] = useState([true, true, true]);
  const [isHslValid, setIsHslValid] = useState([true, true, true]);

  // Update local values when color changes externally
  useEffect(() => {
    const newColor = Color.hsl(hue, saturation, lightness);
    setHexValue(newColor.hex().slice(1)); // Store without #
    const rgb = newColor
      .rgb()
      .array()
      .map((value) => Math.round(value));
    setRgbValues(rgb.map(String));
    const hsl = newColor
      .hsl()
      .array()
      .map((value) => Math.round(value));
    setHslValues(hsl.map(String));
  }, [hue, saturation, lightness]);

  // Reset validation when switching modes
  useEffect(() => {
    setIsHexValid(true);
    setIsRgbValid([true, true, true]);
    setIsHslValid([true, true, true]);
  }, [mode]);

  if (mode === 'hex') {
    // Remove # from display value for editing
    const displayValue = hexValue.startsWith('#') ? hexValue.slice(1) : hexValue;

    return (
      <div
        className={cn(
          'flex relative items-center -space-x-px w-full rounded-md shadow-sm',
          className,
        )}
        {...props}
      >
        <div className="relative flex w-full">
          {/* Non-editable # prefix */}
          <div className="flex items-center h-8 px-2 text-xs bg-white border border-r-0 rounded-l-md border-input text-muted-foreground">
            #
          </div>
          <Input
            className={cn(
              'h-8 px-2 text-xs rounded-l-none rounded-r-none shadow-none bg-white border-l-0',
              !isHexValid && 'border-red-500 focus:border-red-500',
            )}
            type="text"
            value={displayValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setHexValue(newValue);

              if (newValue === '') {
                setIsHexValid(true); // Allow empty state
                return;
              }
              if (newValue.length !== 3 && newValue.length !== 6) {
                setIsHexValid(false);
                return;
              }

              try {
                const newColor = Color('#' + newValue);
                const [h, s, l] = newColor.hsl().array();
                if (newValue.length === 6) {
                  // Only update hue if the color has meaningful hue (not grayscale, not pure black/white)
                  if (s > 0 && l > 0 && l < 100) {
                    setHue(h);
                  }
                  setSaturation(s);
                  setLightness(l);
                  setHexValue(newColor.hex().slice(1));
                }
                setIsHexValid(true);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (error) {
                setIsHexValid(false);
              }
            }}
            onBlur={() => {
              if (!isHexValid || displayValue === '') {
                // Restore previous valid value
                const currentColor = Color.hsl(hue, saturation, lightness);
                setHexValue(currentColor.hex().slice(1)); // Remove # for display
                setIsHexValid(true);
              } else if (hexValue.length === 3) {
                const newColor = Color('#' + hexValue);
                const [h, s, l] = newColor.hsl().array();
                // Only update hue if the color has meaningful hue (not grayscale, not pure black/white)
                if (s > 0 && l > 0 && l < 100) {
                  setHue(h);
                }
                setSaturation(s);
                setLightness(l);
                setHexValue(newColor.hex().slice(1));
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (mode === 'rgb') {
    return (
      <div
        className={cn('flex items-center -space-x-px rounded-md shadow-sm', className)}
        {...props}
      >
        {rgbValues.map((value, index) => (
          <Input
            className={cn(
              'h-8 rounded-r-none bg-white px-2 text-xs shadow-none',
              index && 'rounded-l-none',
              !isRgbValid[index] && 'border-red-500 focus:border-red-500',
            )}
            key={`rgb-${index}`}
            type="text"
            value={value}
            onChange={(e) => {
              const newValue = e.target.value;
              const newRgbValues = [...rgbValues];
              newRgbValues[index] = newValue;
              setRgbValues(newRgbValues);

              if (newValue === '') {
                setIsRgbValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = true;
                  return newValid;
                });
                return;
              }

              // Validate RGB values: 0-255, only digits
              const rgbRegex = /^[0-9]{1,3}$/;
              if (!rgbRegex.test(newValue)) {
                setIsRgbValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = false;
                  return newValid;
                });
                return;
              }

              const numValue = Number(newValue);
              if (numValue < 0 || numValue > 255) {
                setIsRgbValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = false;
                  return newValid;
                });
                return;
              }

              try {
                const newRgb = newRgbValues.map((v) => Number(v) || 0);
                const newColor = Color.rgb(newRgb[0], newRgb[1], newRgb[2]);
                const [h, s, l] = newColor.hsl().array();
                // Only update hue if the color has meaningful hue (not grayscale, not pure black/white)
                if (s > 0 && l > 0 && l < 100) {
                  setHue(h);
                }
                setSaturation(s);
                setLightness(l);
                setIsRgbValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = true;
                  return newValid;
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (error) {
                setIsRgbValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = false;
                  return newValid;
                });
              }
            }}
            onBlur={() => {
              if (!isRgbValid[index] || rgbValues[index] === '') {
                // Restore previous valid value
                const currentColor = Color.hsl(hue, saturation, lightness);
                const rgb = currentColor
                  .rgb()
                  .array()
                  .map((val) => Math.round(val));
                setRgbValues(rgb.map(String));
                setIsRgbValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = true;
                  return newValid;
                });
              }
            }}
          />
        ))}
      </div>
    );
  }

  if (mode === 'hsl') {
    return (
      <div
        className={cn('flex items-center -space-x-px rounded-md shadow-sm', className)}
        {...props}
      >
        {hslValues.map((value, index) => (
          <Input
            className={cn(
              'h-8 rounded-r-none bg-white px-2 text-xs shadow-none',
              index && 'rounded-l-none',
              !isHslValid[index] && 'border-red-500 focus:border-red-500',
            )}
            key={`hsl-${index}`}
            type="text"
            value={value}
            onChange={(e) => {
              const newValue = e.target.value;
              const newHslValues = [...hslValues];
              newHslValues[index] = newValue;
              setHslValues(newHslValues);

              if (newValue === '') {
                setIsHslValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = true;
                  return newValid;
                });
                return;
              }

              // Validate HSL values: H (0-360), S/L (0-100), only digits
              const maxValue = index === 0 ? 360 : 100;
              const hslRegex = index === 0 ? /^[0-9]{1,3}$/ : /^[0-9]{1,3}$/;
              if (!hslRegex.test(newValue)) {
                setIsHslValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = false;
                  return newValid;
                });
                return;
              }

              const numValue = Number(newValue);
              if (numValue < 0 || numValue > maxValue) {
                setIsHslValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = false;
                  return newValid;
                });
                return;
              }

              try {
                const newHsl = newHslValues.map((v) => Number(v) || 0);
                const newColor = Color.hsl(newHsl[0], newHsl[1], newHsl[2]);
                const [h, s, l] = newColor.hsl().array();
                if (s > 0 && l > 0 && l < 100) {
                  setHue(h);
                }
                setSaturation(s);
                setLightness(l);
                setIsHslValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = true;
                  return newValid;
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (error) {
                setIsHslValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = false;
                  return newValid;
                });
              }
            }}
            onBlur={() => {
              if (!isHslValid[index] || hslValues[index] === '') {
                // Restore previous valid value
                const currentColor = Color.hsl(hue, saturation, lightness);
                const hsl = currentColor
                  .hsl()
                  .array()
                  .map((val) => Math.round(val));
                setHslValues(hsl.map(String));
                setIsHslValid((prev) => {
                  const newValid = [...prev];
                  newValid[index] = true;
                  return newValid;
                });
              }
            }}
          />
        ))}
      </div>
    );
  }

  return null;
};
