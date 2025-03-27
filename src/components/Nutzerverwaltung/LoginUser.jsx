import React, { useEffect, useState } from 'react';
import { axiosInstanceWithoutAuth } from "../../axiosApi";
import { useNavigate } from 'react-router-dom';
import '../../css/LoginUser.css'; // Make sure to import the CSS file
import UserRouteKnopf from './UserRouteKnopf';

const GetUsers = () => {
    const [userData, setUserData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchdata = async () => {
            try {
                const userdata = await axiosInstanceWithoutAuth.get("/get_users");
                setUserData(userdata.data);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };

        fetchdata();
    }, []);

    return (
        <div className="get-users-container">
            <button
                className="system-button admin"
                onClick={() => navigate("/createuser")}
            >
                CreateUser
            </button>
            <h1>Wählen sie ihren Nutzer</h1>

            {userData && Array.isArray(userData) ? (
                <div className="user-buttons-grid">


                    {userData.map(user => (
                        <div>

                            <UserRouteKnopf username={user.username}></UserRouteKnopf>
                        </div>

                    ))}



                </div>
            ) : (
                <p className="loading-text">Loading users...</p>
            )}
        </div>
    );
};

export default GetUsers;