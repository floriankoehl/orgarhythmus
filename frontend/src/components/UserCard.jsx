import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Link } from "react-router-dom"


const bull = (
  <Box
    component="span"
    sx={{ display: 'inline-block', mx: '2px', transform: 'scale(0.8)' }}
  >
    •
  </Box>
);

export default function UserCard({id, name}) {
  return (
    <Card className='w-70'>
      <CardContent>
        {name}
      </CardContent>
      <CardActions>
        <Link to={`/profile/${id}`}><Button size="small">Learn More</Button></Link>
        
      </CardActions>
    </Card>
  );
}
