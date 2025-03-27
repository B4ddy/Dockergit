// HistoryPage.js
import React, { useEffect, useState, useCallback } from 'react';
import { axiosInstance } from "../../axiosApi";
import "../../css/historypage.css";
import SessionVisualizer from './sessionvisualizer';
import { useNavigate } from 'react-router-dom';

const HistoryPage = () => {
    const [sessions, setSessions] = useState([]); // Initialize as an empty array
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const navigate = useNavigate()
    //Wrap the fetch session with useCallBack, so you only need to render when its necessary.
    const fetchSessions = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get("get_session");
            console.log(response.data);
            setSessions(response.data); // Assuming data is already sorted in the desired order by the backend
            setError(null);
        } catch (err) { // Use 'err' as the variable name
            console.error("Error fetching sessions:", err);
            setError("Failed to load sessions. Please try again later.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    useEffect(() => {
        if (sessions.length > 0) {
            //If there are sessions but no session id is selected, pick the most recent one to display.
            const initialSession = sessions[0];
            setSelectedSessionId(initialSession.id);
            setIsActive(initialSession.is_active);

        } else {
            setSelectedSessionId(null);
            setIsActive(false);
        }

    }, [sessions]);

    const handleSessionChange = (e) => {
        const newSessionId = parseInt(e.target.value, 10);
        setSelectedSessionId(newSessionId);

        const selectedSession = sessions.find(session => session.id === newSessionId);
        if (selectedSession) {
            setIsActive(selectedSession.is_active);
        }
    };

    return (
        <div className="history-container">
            <div className="history-header">
                <h1 className="history-title">Session History</h1>
                <button onClick={() => { navigate("/") }}>Zurück</button>
            </div>

            <div className="session-selector">
                {loading ? (
                    <div className="loading-message">Loading sessions...</div>
                ) : error ? (
                    <div className="error-message">{error}</div>
                ) : sessions.length > 0 ? (
                    <div className="session-dropdown-container">
                        <label htmlFor="sessiondropdown" className="session-dropdown-label">Select Session:</label>
                        <select
                            name="Session"
                            id="sessiondropdown"
                            className="session-dropdown"
                            value={selectedSessionId || ''}
                            onChange={handleSessionChange}
                        >
                            {sessions.reverse().map(session => (
                                <option key={session.id} value={session.id}>
                                    Session {session.id} - {session.is_active ? "Active" : "Inactive"}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="no-session-message">No sessions available.</div>
                )}
            </div>

            {selectedSessionId !== null ? (
                <SessionVisualizer sessionid={selectedSessionId} is_active={isActive} selected={selectedSessionId} />
            ) : (
                <div className="no-session-message">No session selected.</div>
            )}
        </div>
    );
};

export default HistoryPage;