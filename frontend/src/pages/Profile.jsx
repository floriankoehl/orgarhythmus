import { useLoaderData } from "react-router-dom"
import DeleteUser from "../components/DeleteUser"
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useState } from "react";
import ModeEditIcon from '@mui/icons-material/ModeEdit';


const BASE_URL = "http://192.168.178.200:8000"

export async function profile_loader(object){
    



    const id = object.params.id
    console.log(object.params.id)
    const res = await fetch(`${BASE_URL}/api/users/${id}/`)
    if (!res.ok) {
        throw new Error("No user found")
    }
    return res.json()

}






export default function Profile(){
    const data = useLoaderData();
    console.log(data.id)
    const [edit, setEdit] = useState(false);
    const [newName, setNewName] = useState("")

  

    function change_edit() {
        if (edit) {
            setEdit(false)
        } else {
            setEdit(true)
        }
    }


    async function change_name(){
        setEdit(false)
        const this_name = {id: data.id, newName}

        const res = await fetch(`${BASE_URL}/api/users/change_name/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }, 
            body: JSON.stringify(this_name)
        });

        if (!res.ok) {
            console.log(res)
        }



        const answer = await res.json()
        window.location.reload();
        return answer
        
    }


    return (
        <>  
        <div className=" w-screen flex justify-center items-center">
            <div className="relative w-200 h-100 flex flex-col gap-5 justify-center items-center bg-black/5 rounded-xl">
                {edit ? <ModeEditIcon className="absolute top-0 left-0 z-[100] w-[50px] h-[50px] text-gray-600"/> : null}
                

                {edit ? <TextField onChange={(e)=> {setNewName(e.target.value)}} id="outlined-helperText" label="New Name" defaultValue={data.user} /> : <h1 className="text-6xl font-bold">{data.user}</h1> }
                <DeleteUser id={data.id}/>

                {edit ? null : <Button onClick={()=>{change_edit()}} color="secondary">Edit</Button>}
                
                {edit ? <Button onClick={()=> {change_name()}} variant="contained">Save Changes</Button> : null}
            </div>
            
            
            
            
        </div>
        </>
    )
}
