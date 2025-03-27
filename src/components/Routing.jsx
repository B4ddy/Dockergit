import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const BaseRoute = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const accessToken = localStorage.getItem('access');
      
      if (accessToken) {
        // User has an access token
        setIsAuthorized(true);
        setIsLoading(false);
      } else {
        // No access token, redirect to login and don't update loading state
        // This will prevent the component from rendering null before redirect completes
        navigate("/LoginUser", { replace: true });
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Only show loading state or children if we're still in this component
  if (isLoading) {
    return null; // Or a loading spinner component
  }

  // We'll only reach this point if isAuthorized is true
  return children;
};

export default BaseRoute;