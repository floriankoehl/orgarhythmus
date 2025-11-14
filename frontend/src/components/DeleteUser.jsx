
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';


export default function DeleteUser({id}){
    const navigate = useNavigate();

    

    async function delete_user(){
        const delete_this_id = {id}

        const res = await fetch(`http://127.0.0.1:8000/api/users/delete/`, {
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









