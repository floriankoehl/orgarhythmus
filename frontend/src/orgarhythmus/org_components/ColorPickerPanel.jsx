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
    <div className="p-4 rounded-xl shadow-xl relative flex flex-col justify-center items-center">
      <HexColorPicker className="flex" color={color} onChange={handleChange} />

 
      
    </div>
  );
}
