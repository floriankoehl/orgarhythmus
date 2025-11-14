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


import { redirect, useNavigate } from 'react-router-dom';


import { BASE_URL } from '../config/api';
// const BASE_URL = import.meta.env.VITE_API_BASE_URL;


export default function Register() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
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



    async function submit_login() {
        const res = await fetch(`${BASE_URL}/api/users/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // VERY IMPORTANT
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok){
            console.log(res)
            return
        }

        navigate("/");

    }







    return (

        <div className='h-250 w-full flex flex-col items-center'>
            <div className='h-50 flex gap-10 m-5'>

                
                {mes ? <div className='h-40 w-80 bg-black/5 rounded-xl mt-5'> {mes} </div> : null}


            </div>

            <div className='h-120 w-100 bg-black/5 rounded-lg flex flex-col justify-evenly items-center'>

                <div className='flex flex-col justify-center'>
                    <h2>U: {username}</h2>
                    <h2>P: {password}</h2>
                    <TextField onChange={(e) => { setUsername(e.target.value) }} sx={{ m: 1, width: '25ch' }} id="outlined-basic" label="Username" variant="standard" />
                    
                    <FormControl sx={{ m: 1, width: '25ch' }} variant="standard">
                        <InputLabel htmlFor="standard-adornment-password">Password</InputLabel>
                        <Input
                            id="standard-adornment-password"
                            type={showPassword ? 'text' : 'password'}
                            onChange={(e)=>{setPassword(e.target.value)}}
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
                <Button onClick={()=>{submit_login()}} variant="contained">Submit</Button>
            </div>

            {submitflag ? <CircularProgress className='m-5' disableShrink /> : null}

        </div>

    );
}
