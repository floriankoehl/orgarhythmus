
import TextField from '@mui/material/TextField';
import ColorPickerPanel from '../org_components/ColorPickerPanel';
import { useState } from 'react';
import { Palette } from 'lucide-react';
import { HexColorPicker } from "react-colorful";
import Button from '@mui/material/Button';
import { BASE_URL } from "../../config/api"
import { useLoaderData } from 'react-router-dom';


export async function fetch_all_teams() {
    const res = await fetch(`${BASE_URL}/api/orgarhythmus/all_teams/`)

    if (!res.ok) {
        console.log("Something went wrong")
        return
    }

    const data = await res.json()

    console.log("Called sucesfully and here is data: ", data)
    return data.teams

}


export default function OrgaAllTeams() {
    const loader_teams = useLoaderData()
    const [all_teams, setAll_Teams] = useState(loader_teams);
    const [showColorPickerPanel, setShowColorPickerPanel] = useState(false)
    const [teamColor, setTeamColor] = useState("#facc15");




    return (
        <>
            <div className="bg-black/4 h-screen h-full w-full lg:p-20">
                <div className="h-full w-full">
                    <div className="h-1/2 flex justify-center items-center">
                        <div className="h-70 w-80  bg-white p-5 shadow-xl shadow-black/20 
                        rounded-lg border border-black/20 rounded-lg flex flex-col gap-5 relative">

                            <h1 className='text-center font-bold text-xl mb-2'>Create a Team</h1>

                            <TextField className='flex' id="outlined-basic" label="Name" variant="outlined" size="small" />

                            <div className='flex relative justify-between items-center h-10 px-3 py-1 border border-black/20 rounded'>
                                <div className='flex gap-2 items-center relative'>
                                    <h2 className=''>Pick Color</h2>


                                </div>

                                <div
                                    style={{ backgroundColor: teamColor }}
                                    className="relative h-7 w-20 flex justify-center items-center rounded-full"
                                    onClick={() => setShowColorPickerPanel(prev => !prev)}
                                >
                                    <button
                                        type="button"
                                        className="w-8 h-8 flex justify-center items-center rounded-full hover:animate-spin"
                                    >

                                        {!showColorPickerPanel ? <Palette size={18} /> : <p className='text-sm font-bold'>Apply</p>}


                                    </button>

                                    {showColorPickerPanel && (
                                        <div onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-2 z-50 p-2 bg-slate-900 rounded-xl shadow-xl">
                                            <div className="h-[200px] w-[200px]">
                                                <HexColorPicker
                                                    color={teamColor}
                                                    onChange={setTeamColor}
                                                    className="h-full w-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>


                            </div>
                            <div className='h-full flex justify-center items-end'>
                                <Button className='absolute bottom-0 w-[100px]' variant="contained" color="success">Create</Button>
                            </div>

                        </div>
                    </div>
                    <div className="h-1/2 w-full lg:p-10 p-1">
                        <div className="h-full w-full  grid md:grid-cols-3 lg:grid-cols-4 gap-3 p-2">
                            <div className="h-full w-full bg-white shadow-xl shadow-black/20 rounded-lg border border-black/20">
                            </div>
                            {all_teams.map((team) => {
                                return (
                                    <div
                                        key={team.id || team.name}   // ← ADD THIS
                                        className="h-full w-full bg-white shadow-xl 
                                        shadow-black/20 rounded-lg border border-black/20
                                        min-h-40 min-w-40"
                                    >
                                        {team.name}
                                    </div>
                                );
                            })}


                        </div>
                    </div>
                </div>

            </div>
        </>
    )
}

















