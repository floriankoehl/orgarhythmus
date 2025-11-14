import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Input from '@mui/material/Input';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

import CircularProgress from '@mui/material/CircularProgress';


import { useNavigate } from 'react-router-dom';


import { BASE_URL } from '../config/api';
// const BASE_URL = import.meta.env.VITE_API_BASE_URL;


export default function InputAdornments() {
    const [showPassword, setShowPassword] = useState(false);
    const [password_first, setPassword_first] = useState("...");
    const [password_second, setPassword_second] = useState("...");
    const [username, setUsername] = useState("...");
    const [submitflag, setSubmitflag] = useState(false);
    const [mes, setMes] = useState("");

    const navigate = useNavigate();


    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event) => {
        event.preventDefault();
    };
    const handleMouseUpPassword = (event) => {
        event.preventDefault();
    };



    async function submit() {

        setSubmitflag(true)
        await new Promise(resolve => setTimeout(resolve, 1000))

        try {


            const data = { username, password_first, password_second }

            const response = await fetch(`${BASE_URL}/api/users/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                let serverMsg = "";
                try {
                    console.log("Caught FORSOIHJKDJHHDF it here")
                    const errJson = await response.json();
                    console.log(errJson)
                    console.log(errJson.error)
                    serverMsg = errJson.error
                } catch {
                    console.log("Caught it here")
                    serverMsg = await response.text()
                }
                const thisistheproblem = `(${response.status}) ${serverMsg || "Request failed"}`
                console.log("Caught this error!!!!!!!!", thisistheproblem)
                throw new Error(thisistheproblem)
            }

            const result = await response.json();
            setMes("Created Sucesfully")



            setSubmitflag(false)
            console.log("THIS IS THE RESULT WHERE IT IS CORRECT", result)

            navigate(`/profile/${result.user_id}/`)
        } catch (err) {
            console.log("This should be the errror", JSON.stringify(err))
            setMes(err.message)
        } finally {
            setSubmitflag(false)
        }
    }








    return (

        <div className='h-250 w-full flex flex-col items-center'>
            <div className='h-50 flex gap-10 m-5'>
                {/* <div className='bg-black/5 rounded p-2 m-2 w-40'>
                    <h2>Words: </h2>
                    <h2>username: {username}</h2>
                    <h2>Password_first: {password_first}</h2>
                    <h2>Password_second: {password_second}</h2>
                </div>
                <div className='bg-black/5 rounded p-2 m-2 w-40'>
                    <h2>Flags: </h2>
                    <h2>submitflag: {JSON.stringify(submitflag)}</h2>
                    <h2>Message: {JSON.stringify(mes)}</h2>
                </div> */}
                
                {mes ? <div className='h-40 w-80 bg-black/5 rounded-xl mt-5'> {mes} </div> : null}


            </div>

            <div className='h-120 w-100 bg-black/5 rounded-lg flex flex-col justify-evenly items-center'>

                <div className='flex flex-col justify-center'>
                    <TextField onChange={(e) => { setUsername(e.target.value) }} sx={{ m: 1, width: '25ch' }} id="outlined-basic" label="Username" variant="standard" />
                    <FormControl sx={{ m: 1, width: '25ch' }} variant="standard">
                        <InputLabel htmlFor="standard-adornment-password">Password</InputLabel>
                        <Input
                            id="standard-adornment-password"
                            type={showPassword ? 'text' : 'password'}
                            onChange={(e) => { setPassword_first(e.target.value) }}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={
                                            showPassword ? 'hide the password' : 'display the password'
                                        }

                                        onClick={handleClickShowPassword}
                                        onMouseDown={handleMouseDownPassword}
                                        onMouseUp={handleMouseUpPassword}
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            }
                        />
                    </FormControl>
                    <FormControl sx={{ m: 1, width: '25ch' }} variant="standard">
                        <InputLabel htmlFor="standard-adornment-password">Password</InputLabel>
                        <Input
                            id="standard-adornment-password"
                            type={showPassword ? 'text' : 'password'}
                            onChange={(e) => { setPassword_second(e.target.value) }}
                            endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label={
                                            showPassword ? 'hide the password' : 'display the password'
                                        }
                                        onClick={handleClickShowPassword}
                                        onMouseDown={handleMouseDownPassword}
                                        onMouseUp={handleMouseUpPassword}
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            }
                        />
                    </FormControl>
                </div>
                <Button onClick={() => { submit() }} variant="contained">Submit</Button>
            </div>

            {submitflag ? <CircularProgress className='m-5' disableShrink /> : null}

        </div>

    );
}
