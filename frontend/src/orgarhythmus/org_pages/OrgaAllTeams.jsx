
import TextField from '@mui/material/TextField';
import ColorPickerPanel from '../org_components/ColorPickerPanel';
import { useState } from 'react';
import { Palette } from 'lucide-react';




export default function OrgaAllTeams(){
    const [showColorPickerPanel, setShowColorPickerPanel] = useState(false)
    const [teamColor, setTeamColor] = useState("#facc15");




    return (
        <>
            <div className="bg-black/4 h-screen h-full w-full lg:p-20">
                <div className="h-full w-full">
                    <div className="h-1/2 flex justify-center items-center">
                        <div className="h-70 w-80 bg-white p-5 shadow-xl shadow-black/20 
                        rounded-lg border border-black/20 rounded-lg flex flex-col gap-5">
                            
                            <h1 className='text-center font-bold text-xl mb-2'>Create a Team</h1>

                            <TextField className='flex' id="outlined-basic" label="Name" variant="outlined" size="small" />
                            
                            <div className='flex justify-between  px-3 py-1 border border-black/20 rounded'>
                                <div className='flex gap-2 items-center relative'>
                                    <h2 className=''>Pick Color</h2>
                                <button 
                                type="button"
                                className='w-8 h-8
                                flex justify-center items-center rounded-full 
                                shadow-xl shadow-black/20 border border-black/20
                                bg-yellow-200 
                                hover:bg-orange-300 
                                transition-colors duration-300
                                hover:animate-spin
                                '>
                                    
                                    
                                    <Palette size={18} 
                                onClick={()=>{
                                    if (showColorPickerPanel) {
                                        setShowColorPickerPanel(false)
                                    } else {
                                        setShowColorPickerPanel(true)
                                    }
                                }}
                                /></button>
                                
                                </div>
                                
                                <div  style={{ backgroundColor: teamColor }}
                                        className={`h-8 w-20  rounded-full align`}>

                                </div>
                            </div>
                            
                            
                            {showColorPickerPanel && <ColorPickerPanel update_color_function={setTeamColor}/>}
                            
                            
                        </div>
                    </div>
                    <div className="h-1/2 w-full lg:p-10 p-1">
                        <div className="h-full w-full  grid lg:grid-cols-3 gap-3 p-2">
                            <div className="h-full w-full bg-white shadow-xl shadow-black/20 rounded-lg border border-black/20">
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>
        </>
    )
}

















