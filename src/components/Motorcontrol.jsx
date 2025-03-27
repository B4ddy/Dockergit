import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../axiosApi';
import useWebSocket, { ReadyState } from "react-use-websocket";
import Motion from './MotionKinetic';
import "../css/motorcontrol.css";
import TripleToggleSwitch from './threewayswitch/triple';
import SessionVisualizer from './Datahistory/sessionvisualizer';


const MotorControl = () => {
    const [voltageLogic, setVoltageLogic] = useState('');
    const [cardtemp, setCardTemp] = useState('');
    const [temp, setTemp] = useState('');
    const [actualPosition, setPosition] = useState('');
    const [filtered_current, setFilteredCurrent] = useState('');
    const [phaseCurrent, setPhaseCurrent] = useState('');
    const [actualVelocity, setActualVelocity] = useState('');
    const [timeStamp, setTimeStamp] = useState('');
    const [connectionStatus, setConnection] = useState("Disconnected");
    const [activeMode, setActiveMode] = useState(null);
    const [currentUser, setCurrentUser] = useState("-");
    const [currentUserID, setCurrentUserID] = useState(0)
    const [currentSession, setCurrentSession] = useState("-");
    const [targetVelocity, setTargetVelocity] = useState(0);
    const [targetCurrent, setTargetCurrent] = useState(0);
    const navigate = useNavigate();
    const [isLogging, setIsLogging] = useState(false);
    const [tripleToggleValue, setTripleToggleValue] = useState("center"); // New state to track triple toggle value


    const socketUrl = 'ws://' + window.location.hostname + ':8000/ws/motor_control/';
    const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
        onOpen: () => { console.log('WebSocket opened'); setConnection("Connected"); },
        shouldReconnect: (closeEvent) => true,
        share: true,
        onMessage: (event) => {
            const data = JSON.parse(event.data);
            if (!data) return;
            if (data.voltage_logic !== undefined) setVoltageLogic(data.voltage_logic);
            if (data.phase_current !== undefined) setPhaseCurrent(data.phase_current);
            if (data.actual_velocity !== undefined) setActualVelocity(data.actual_velocity);
            if (data.actual_position !== undefined) setPosition(data.actual_position);
            if (data.temp_com_card !== undefined) setCardTemp(data.temp_com_card);
            if (data.temp_power_stage !== undefined) setTemp(data.temp_power_stage);
            if (data.timestamp !== undefined) setTimeStamp(data.timestamp);
            if (data.filtered_current !== undefined) setFilteredCurrent(data.filtered_current);
            if (data.type === "logging_status" && data.status === "failed") {
                console.warn(`Logging failed: ${data.reason}`);
                setIsLogging(false);  // Update state to reflect that logging failed
            }
        },
        onClose: () => { console.log('WebSocket closed'); setConnection("Disconnected"); setActiveMode(null); },
        onError: (error) => { console.error('WebSocket error:', error); setConnection("Error"); }
    });

    const labels = {
        center: {  title: "OFF",  value: "center",
        },
        left: {    title: "V",   value: "left",
        },
        right: {      title: "C",      value: "right",
    },};


    const connectionStatusText = {
        [ReadyState.CONNECTING]: 'Connecting',
        [ReadyState.OPEN]: 'Connected',
        [ReadyState.CLOSING]: 'Closing',
        [ReadyState.CLOSED]: 'Disconnected',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    }[readyState];
    useEffect(() => { setConnection(connectionStatusText) }, [readyState])
    useEffect(() => { setUser(); setSession(); }, []);
   

    useEffect(() => {
        if (currentSession !== "-" && !isLogging) {
            startLogging();
        }
        return () => { if (isLogging) stopLogging(); };
    }, [currentSession]);


    const sendCommand = (command) => {
        sendMessage(JSON.stringify({ type: 'command', command }));
        setActiveMode(command === 'velocity_mode' ? 'velocity' : command === 'current_mode' ? 'current' : command === 'f' ? 'forward' : command === 'r' ? 'reverse' : null);
    };

    const sendCustomType = (type, message) => { sendMessage(JSON.stringify({ type: type, message })); }

    const setSession = async () => {
        try {  
            const response = await axiosInstance.get("get_active_session");
            setCurrentSession(response.data.id)
        }
        catch (error) {
            console.log(error)
        }
    }


    const setUser = async () => {
        try {
            const response = await axiosInstance.get("get_current_user");
            const responseuser = response.data;
            if (response.status === 401) {
               await setCurrentUser("-")
            }
            else {
               await setCurrentUser(responseuser.username);
               await  setCurrentUserID(responseuser.id);
            }

           
        }
        catch (error) {
            console.log(error)
        }
    }

    const startLogging = () => {
        sendCustomType('start_logging', currentUserID);
        setIsLogging(true);
    };

    const stopLogging = () => {
        sendCustomType('stop_logging', currentUserID);
        setIsLogging(false);
    };


    const startSession = async () => {
        try {
            const response = await axiosInstance.post("start_session")
            if (response.status === 201) {
                const newSessionId = response.data.session_id;
                setCurrentSession(newSessionId);
                localStorage.currentSession = newSessionId;
                // Remove startLogging() call since useEffect will handle it
            }
        }
        catch (error) {
            console.log(error)
        }
    }

    const endSession = async () => {
        try {
            const response = await axiosInstance.post(`stop_session/${currentSession}/`)
            if (response.status === 200) {
                setCurrentSession("-")
                localStorage.currentSession = null
                stopLogging();
            }
        }
        catch (error) {
            console.log(error)
        }
    }



    const handleToggleChange = (value) => {
        setTripleToggleValue(value); // Update the state with the current toggle value
        switch (value) {
            case "left":
                sendCommand("velocity_mode");
                break;
            case "right":
                sendCommand("current_mode");
                break;
            case "center":
                sendCommand("x");
                break;
            default:
                console.warn("Unexpected TripleToggleSwitch value:", value); // Handle unexpected values
                break;
        }
    };


    return (
        <div className="motor-control-dashboard">
            <header className="dashboard-header">



                {currentUser !== "-" ? (<div id='sessiondiv'>

                    {currentSession !== "-" ? <button className="system-button session" onClick={endSession}> End Session</button> : (<button className="system-button session" onClick={startSession}> Start Session</button>)}



                    <button className="system-button user" onClick={() => navigate("/history")}> Session View</button>

                    <button className="system-button user" onClick={() => navigate("/update_user")}> Update User</button>

                </div>) : <div> <p> Loggen sie sich ein um eine Session zu starten</p></div>}


                <div className="user-connection-container">
                <button id="bootbuddne" onClick={() => { sendCustomType("boot"); }}></button>
                <button id="resetbuddne" onClick={() => { sendCommand("set_position_0"); }}> set0</button>
                    <div id='Nutzeranzeige'> Nutzer: {currentUser}</div>
                    <div id='Sessionanzeige'> Session: {currentSession}</div>
                    <div className={`connection-indicator ${connectionStatus.toLowerCase()}`}>
                        <span className="status-dot"></span>
                        <span className="status-text">{connectionStatus}</span>


                        <div>    {currentUser !== "-" ? (<button onClick={() => { localStorage.access = null; localStorage.refresh = null; navigate("/LoginUser") }} > Logout </button>) : (<button onClick={() => navigate("/LoginUser")} > Login</button>)


                        }  </div>
                    </div>
                </div>
            </header>
            <div className="dashboard-content">
                <div className="metrics-panel">
                    <div className="metric-card"> <div className="metric-title">Voltage Logic</div><div className="metric-value">{voltageLogic || "—"}</div></div>
                    <div className="metric-card"> <div className="metric-title">Position</div><div className="metric-value">{actualPosition || "0"}</div></div>
                    <div className="metric-card"> <div className="metric-title">Phase Current</div><div className="metric-value">{phaseCurrent || "—"} {filtered_current}</div></div>
                    <div className="metric-card"> <div className="metric-title">Velocity</div><div className="metric-value">{actualVelocity || "—"}</div></div>
                    <div className="metric-card"> <div className="metric-title">Temperatur</div><div className="metric-value">N{cardtemp || "—"} M{temp || "—"}</div></div>
                </div>
                <div className="visualization-panel">


                    <div className="motion-container">


                        {currentSession !== "-" ? (
                            <div
                                id="session-visualizer">
                                <div> <SessionVisualizer sessionid={currentSession} is_active={true} /> </div>
                                

                            </div>
                        ) : (
                            <div id="session-visualizer"> .</div>)}
                        <Motion id="motion" actualPosition={actualPosition} setPosition={setPosition} />

                    </div>



                </div>
                <div className="control-panel">

                    <div className="control-section">
                        <TripleToggleSwitch
                            value={tripleToggleValue}
                            labels={labels}
                            onChange={handleToggleChange}
                        />

                        {tripleToggleValue === "left" && (
                            <div className="slider-control">
                                <div className="slider-header">
                                    <label htmlFor="velocity">Velocity</label>
                                    <output id="velocity-output">{targetVelocity}</output>
                                </div>
                                <div className="slider-with-buttons">
                                    <button className="decrement" onClick={() => { const newVelocity = Math.max(-5000, targetVelocity - 100); setTargetVelocity(newVelocity); sendMessage(JSON.stringify({ type: 'set_velocity', velocity: newVelocity })); }}> − </button>


                                    <input type="range" id="velocity" name="velocity" value={targetVelocity} list="ticks" min="-5000" max="5000" step={5} onChange={(e) => { const newVelocity = parseInt(e.target.value); setTargetVelocity(newVelocity); sendMessage(JSON.stringify({ type: 'set_velocity', velocity: newVelocity })); }} />

                                    <button className="increment" onClick={() => { const newVelocity = Math.min(5000, targetVelocity + 100); setTargetVelocity(newVelocity); sendMessage(JSON.stringify({ type: 'set_velocity', velocity: newVelocity })); }}> + </button>
                                </div>
                            </div>
                        )}

                        {tripleToggleValue === "right" && (
                            <div className="slider-control">
                                <div className="slider-header">
                                    <label htmlFor="current">Current</label>
                                    <output id="current-output">{targetCurrent}</output>
                                </div>
                                <div className="slider-with-buttons">
                                    <button className="decrement" onClick={() => { const newCurrent = Math.max(-5000, targetCurrent - 100); setTargetCurrent(newCurrent); sendMessage(JSON.stringify({ type: 'set_current', current: newCurrent })); }}> − </button>
                                    <input type="range" id="current" name="current" value={targetCurrent} min="-5000" max="5000" step={50} onChange={(e) => { const newCurrent = parseInt(e.target.value); setTargetCurrent(newCurrent); sendMessage(JSON.stringify({ type: 'set_current', current: newCurrent })); }} />
                                    <button className="increment" onClick={() => { const newCurrent = Math.min(5000, targetCurrent + 100); setTargetCurrent(newCurrent); sendMessage(JSON.stringify({ type: 'set_current', current: newCurrent })); }}> + </button>
                                </div>
                            </div>
                        )}



                        {tripleToggleValue === "center" && (
                            <div className="slider-control">
                                <div className="slider-header">
                                    <label htmlFor="current">Current</label>
                                    <output id="current-output">{targetCurrent}</output>
                                </div>
                                <div className="slider-with-buttons">
                                    <button className="decrement"> − </button>
                                    <input type="range" id="current" name="current" value={0} min="0" max="3000" disabled />
                                    <button className="increment" > + </button>

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MotorControl;