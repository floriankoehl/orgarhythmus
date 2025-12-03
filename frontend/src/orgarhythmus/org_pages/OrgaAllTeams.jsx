
import TextField from '@mui/material/TextField';
import ColorPickerPanel from '../org_components/ColorPickerPanel';
import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { HexColorPicker } from "react-colorful";
import Button from '@mui/material/Button';
import { BASE_URL } from "../../config/api"
import { useLoaderData } from 'react-router-dom';
import { useRevalidator } from "react-router-dom";
import SmTeamCard from '../org_components/SmTeamCard';
import { fetch_all_teams } from "../org_API"




export default function OrgaAllTeams() {
    const revalidator = useRevalidator();
    const loader_teams = useLoaderData()
    const [all_teams, setAll_Teams] = useState(loader_teams);
    const [showColorPickerPanel, setShowColorPickerPanel] = useState(false);

    const [teamName, setTeamName] = useState("");
    const [teamColor, setTeamColor] = useState("#facc15");

    useEffect(() => {
        setAll_Teams(loader_teams);
    }, [loader_teams]);



   




    async function create_team() {
        console.log("Calling Create Team API from React...");

        const res = await fetch(`${BASE_URL}/api/orgarhythmus/create_team/`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                name: teamName,
                color: teamColor
            })
        });

        if (!res.ok) {
            console.log("REACT didnt receive correct response while creating team")
            return
        }


        console.log("Team Sucesfully created!")

        revalidator.revalidate();


    }


















    return (
        <>
            <div className="bg-black/4 h-screen h-full w-full lg:p-20">
                <div className="h-full w-full">
                    <div className="h-1/2 flex justify-center items-center">
                        <div className="h-70 w-80  bg-white p-5 shadow-xl shadow-black/20 
                        rounded-lg border border-black/20 rounded-lg flex flex-col gap-5 relative">

                            <h1 className='text-center font-bold text-xl mb-2'>Create a Team</h1>

                            <TextField
                                onChange={(e) => { setTeamName(e.target.value) }}
                                className='flex' id="outlined-basic" label="Name" variant="outlined" size="small" />

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
                                <Button
                                    onClick={() => { create_team() }}
                                    className='absolute bottom-0 w-[100px]' variant="contained" color="success">Create</Button>
                            </div>

                        </div>
                    </div>
                    <div className="h-1/2 w-full lg:p-10 p-1">
                        <div className="h-full w-full  grid md:grid-cols-3 lg:grid-cols-4 gap-3 p-2 place-items-center">

                            {all_teams.map((team) => {
                                return (
                                    <SmTeamCard key={team.id} team={team} setAll_Teams={setAll_Teams}/>
                           
                                );
                            })}


                        </div>
                    </div>
                </div>

            </div>
        </>
    )
}

















