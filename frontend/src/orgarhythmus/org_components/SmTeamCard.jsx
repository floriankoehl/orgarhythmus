
import Button from '@mui/material/Button';
import { BASE_URL } from "../../config/api"

export default function SmTeamCard({ team, setAll_Teams }) {



    async function delete_team(id) {
        console.log("Trying to delete team...")

        const res = await fetch(`${BASE_URL}/api/orgarhythmus/delete_team/`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({ id })
        });

        if (!res.ok) {
            console.log("Couldnt Delete Team")
            return
        };

        setAll_Teams((prevTeams) => prevTeams.filter(team => team.id !== id))

        console.log("Team deleted sucesfully")
    };




    return (
        <>
            <div
                key={team.id}
                style={{ backgroundColor: team.color }}
                className="h-full w-full bg-white shadow-xl 
                                        shadow-black/20 rounded-lg border border-black/20
                                        min-h-55 min-w-40 max-w-80
                                        p-3
                                        "
            >
                <div className='h-1/6 w-ful flex flex-col text-md'>
                    <h1 className='text-lg'>{team.name}</h1>
                    

                </div>
                <div className='h-5/6 w-full text-md relative flex flex-col gap-2'>
                    <ul className='flex flex-col gap-2'>
                        {team.tasks.map(task => (
                            <li className='bg-white p-1 rounded' key={task.id}>{task.name}</li>
                        ))}
                    </ul>


                    <div className='absolute bottom-0 flex h-10 w-full justify-center mb-2'>
                        <Button
                            onClick={() => { delete_team(team.id) }}
                            variant="contained" color="error" size='small'>Delete</Button>

                    </div>
                </div>

            </div>
        </>
    )
}










