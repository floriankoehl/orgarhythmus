import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import Button from '@mui/material/Button';

export default function ColorPickerPanel({ update_color_function }) {
  const [color, setColor] = useState("#1e90ff"); // hex string

  const handleChange = (newColor) => {
    setColor(newColor);             // local preview
    update_color_function?.(newColor); // send hex string to parent
  };

  return (
    <div className="p-4 bg-slate-900 rounded-xl shadow-xl relative">
      <HexColorPicker color={color} onChange={handleChange} />

      <div
        className="mt-4 h-10 w-full rounded-lg border border-white/20"
        style={{ backgroundColor: color }}
      />

      <p className="mt-2 text-xs text-slate-200">{color}</p>
      
    </div>
  );
}
