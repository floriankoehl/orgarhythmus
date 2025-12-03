import { BASE_URL } from "../config/api"



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








