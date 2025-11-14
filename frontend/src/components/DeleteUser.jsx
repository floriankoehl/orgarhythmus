
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';



// const BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { BASE_URL } from '../config/api';

export default function DeleteUser({id}){
    const navigate = useNavigate();

    

    async function delete_user(){
        const delete_this_id = {id}

        const res = await fetch(`${BASE_URL}/api/users/delete/`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(delete_this_id)
        })

        if (!res.ok){
            try {
                const server_an = await res.json()
                if (server_an.error) {
                    throw new Error(`Server: ${server_an.error}`)
                } 
            } catch (err) {
                throw new Error(err.message)
            }
        };

        const data = await res.json() 
        console.log(data)
        navigate("/network")
    }



    return (
        <>
            <Button onClick={delete_user} variant="outlined" color="error">Delete</Button>
        </>
    )
}









