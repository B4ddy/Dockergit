import { axiosInstanceWithoutAuth } from "../../axiosApi"
import { useNavigate, useParams } from "react-router-dom"
import '../../css/UserRouteKnopf.css';
const UserRouteKnopf = ({ username }) => {
    const navigate = useNavigate()
    const getKeys = () => {

        axiosInstanceWithoutAuth.get("/userkeys", { params: { username: username } })
            .then(Response => {

                localStorage.access = Response.data.access
                localStorage.refresh = Response.data.refresh

                console.log(localStorage)

                navigate("/")
            })
    }



    return <div>
        
        <button className="Nutzer" onClick={getKeys}>{username}</button>
    </div>


}
export default UserRouteKnopf