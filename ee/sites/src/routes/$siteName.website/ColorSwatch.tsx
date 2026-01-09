import { ui } from '@curvenote/scms-core';
import Color from 'color';

/**
 * Color swatch component with popover for visual color picking.
 *
 * **IMPORTANT:** This component must be used as a child of a `ColorPicker` component.
 * It relies on the `ColorPickerContext` provided by `ColorPicker` and will throw an error
 * with message "useColorPicker must be used within a ColorPickerProvider" if rendered
 * outside of a `ColorPicker` component.
 *
 * @example
 * ```tsx
 * <ColorPicker defaultValue="#3b82f6" onChange={handleChange}>
 *   <ColorSwatch />
 *   <ColorPickerFormat />
 *   <ColorPickerOutput />
 * </ColorPicker>
 * ```
 */
export function ColorSwatch() {
  const { hue, saturation, lightness } = ui.useColorPicker();
  const color = Color.hsl(hue, saturation, lightness);

  return (
    <ui.Popover>
      <ui.PopoverTrigger asChild>
        <button
          type="button"
          className="w-10 h-10 transition-all border-2 border-gray-200 rounded-md shadow-sm cursor-pointer hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          style={{ backgroundColor: color.hex() }}
          title={`Click to pick color (${color.hex()})`}
          aria-label="Pick color"
        />
      </ui.PopoverTrigger>
      <ui.PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <ui.ColorPickerSelection className="h-40" />
          <ui.ColorPickerHue />
        </div>
      </ui.PopoverContent>
    </ui.Popover>
  );
}
