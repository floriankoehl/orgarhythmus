import { useEffect, useState } from "react";
import { useLoaderData } from "react-router-dom"
// import { BASE_URL } from '../config/api';
import { BASE_URL } from "../../config/api"
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from "@mui/material/MenuItem";
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { ThumbsUp, ThumbsDown } from 'lucide-react';





const numbers = [1, 2, 3, 4, 5];


export async function fetch_all_tasks(){
    const res = await fetch(`${BASE_URL}/api/orgarhytmus/all_tasks/`)

    if (!res) {
        console.log("error")
        return
    }

    const data = await res.json();
    console.log("data")
    // const dummy = {"task1": "task1 data", "task2": "task2 data"}
    return data
}






export default function OrgaHome(){
    const all_tasks = useLoaderData();
    const [tasks, setTasks] = useState(all_tasks.tasks);
    const [task_create_name, setTask_Create_Name] = useState("");
    const [task_difficulty, setTask_Difficulty] = useState(0);
    const [task_priority, setTask_Priority] = useState(0);
    const [task_approval, setTask_Approval] = useState(false);


    const [alignment, setAlignment] = useState('web');
    




    const handleChange = (event, newAlignment) => {
        console.log(newAlignment)

        setAlignment(newAlignment);

        if (newAlignment === "True" ) {
            setTask_Approval(false);
            console.log("Changed to true")
        } else {
            setTask_Approval(true);
            console.log("Changed to false")
        }
        console.log(task_approval)
    };


    console.log("Tasks sucesfully updated: ", tasks)



    async function delete_task(id) {
        const res = await fetch(`${BASE_URL}/api/orgarhytmus/delete_task/`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({ id }),
        })

        if (!res) {
            console.log("Some Error")
            return
        }


        const data = await res.json();  

        setTasks(prevTasks => prevTasks.filter(task => task.id !== id));
       
        console.log(data)
    }

 



    async function create_task() {
        console.log(task_approval)
        const res = await fetch(`${BASE_URL}/api/orgarhytmus/create_task/`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                name: task_create_name,
                difficulty: task_difficulty,
                priority: task_priority,
                approval: task_approval,
            }),
        })

        if (!res) {
            console.log("something went wrong")
        }


        const data = await res.json();


        setTasks(prev => [...prev, data.task]);  

        console.log("Sucesfully created")

    }











    return (
        <>
            <div className="min-h-screen w-screen flex flex-col  items-center justify-center">
                <div className=" h-full w-full flex items-center flex-col">
                    <div className=" flex justify-center items-center">
                        <div className="h-80 w-79 bg-white rounded my-20">
                            <div className=" h-3/4 flex flex-col gap-2 p-4">
                                <h1 className="text-xl font-bold">Create Task</h1>
                                <TextField 
                                onChange={(e)=>{setTask_Create_Name(e.target.value)}}
                                id="outlined-basic" label="Name" variant="outlined" size="small"
                                        />


                                <div className="flex gap-3">
                                    <div>
                                    <TextField
                                        label="Priority"
                                        select
                                        size="small"
                                        sx={{ width: 130 }}
                                        onChange={(e) => {
                                            
                                            setTask_Priority(Number(e.target.value))

                                        }}
                                        fullWidth
                                    >
                                        {numbers.map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    
                                </div>

                                <div>
                                    <TextField
                                        label="Loops"
                                        select
                                        size="small"
                                        sx={{ width: 130 }}
                                        onChange={(e) => {
                                            
                                            setTask_Difficulty(Number(e.target.value))

                                        }}
                                        fullWidth
                                    >
                                        {numbers.map((n) => (
                                            <MenuItem key={n} value={n}>
                                                {n}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    
                                </div>
                                
                                
                                </div>

                                

                                <div className="flex items-center gap-2">
                                    <h3 >Approval Required: </h3>
                                    <ToggleButtonGroup
                                    color="primary"
                                    value={alignment}
                                    exclusive
                                    onChange={handleChange}
                                    aria-label="Platform"
                                    >
                                    <ToggleButton value="True" ><ThumbsUp size={13} /></ToggleButton>
                                    <ToggleButton  value="False"><ThumbsDown size={13}/></ToggleButton>
                                    
                                    </ToggleButtonGroup>
                                </div>
                                


                            </div>
                            <div className="w-full h-1/4 flex justify-center items-center">
                                <Button 
                                  onClick={()=>{create_task()}}
                                  className="" 
                                  variant="contained" 
                                  >Create</Button>
                            </div>
                        </div>

                    </div>
                    <div className=" w-full max-w-[800px] flex justify-center items-center ">

                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 place-items-center ">

                            { tasks.map((task)=> {
                            return (
                            
                            <div key={task.id} className="bg-white w-[80%]  p-2 h-40 m-2 rounded p-1 relative">
                                <h1 className="text-lg mb-2">{task.name}</h1>
                                <p className="text-[15px]">Diff: <span>{task.difficulty}</span></p>
                                <p className="text-[15px]">Prio: <span>{task.priority}</span></p>


                                <div className="absolute bottom-0 w-full flex justify-center p-2">
                                  <Button 
                                  onClick={() => delete_task(task.id)}
                                  className="" 
                                  variant="contained" 
                                  color="error">Delete</Button>

                                </div>
                            </div>
                            )
                        })}
                        </div>
                        
                        
                    </div>
                </div>
                
                
            </div>
        </>
    )
}



