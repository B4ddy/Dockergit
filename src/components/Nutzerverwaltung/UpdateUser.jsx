import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../../axiosApi';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import "../../css/createUser.css";

const UpdateUser = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        height: '',
        oberschenkellänge: '',
        unterschenkel: '',
        schuhgröße: '',
        oberkörper: '',
        armlänge: '',
        gewicht: '',
        geburtsdatum: '',
        geschlecht: '',
        sessioncount: '',
        rollstuhl: false
    });

    const [activeInput, setActiveInput] = useState('');
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [formError, setFormError] = useState(null);
    const keyboard = useRef();
    const [isLoading, setIsLoading] = useState(true);

    // Fetch user data when component mounts
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setIsLoading(true);
                const response = await axiosInstance.get('get_current_user');
                
                // Convert null values to empty strings for form inputs
                const userData = Object.fromEntries(
                    Object.entries(response.data).map(([key, value]) => 
                        [key, value === null ? '' : value]
                    )
                );
                
                setFormData(userData);
                setIsLoading(false);
            } catch (error) {
                console.error('Error fetching user data:', error);
                setFormError('Failed to load user data. Please try again.');
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: type === 'checkbox' ? checked : value
        }));
    };


    const setUserValues = async ()=> {

       const response = await axiosInstance.get("get_current_user")
       console.log(response.data)

    }

    const handleFocus = (e) => {
        setActiveInput(e.target.name);
        keyboard.current.setInput(formData[e.target.name] || '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormSubmitted(true);
        setFormError(null);
        
        // Prepare data for submission - convert empty strings to null
        const submissionData = Object.fromEntries(
            Object.entries(formData).map(([key, value]) => {
                // Keep boolean values as is
                if (typeof value === 'boolean') return [key, value];
                // Convert empty strings to null
                return [key, value === '' ? null : value];
            })
        );
        
        try {
            const response = await axiosInstance.put('update_user', submissionData);
            console.log('User updated:', response.data);
            
            // Show success message
            setTimeout(() => {
                setFormSubmitted(false);
                // Optionally redirect to home after update
                // navigate('/');
            }, 3000);
        } catch (error) {
            console.error('Error updating user:', error);
            setFormError(error.response?.data?.message || 'Error updating user. Please try again.');
            setFormSubmitted(false);
        }
    };

    const onKeyboardChange = (input) => {
        // Validate input for numeric fields
        const numericFields = [
            'height',
            'oberschenkellänge',
            'unterschenkel',
            'schuhgröße',
            'oberkörper',
            'armlänge',
            'gewicht',
            'sessioncount'
        ];

        const nospaceFields = [
            'username'
        ];

        if (nospaceFields.includes(activeInput)) {
            // Don't allow spaces
            const isValidInput = /^\S*$/.test(input);
            if (!isValidInput) return;
        }

        if (numericFields.includes(activeInput)) {
            // Only allow numbers and optional decimal point
            const isValidNumber = /^\d*\.?\d*$/.test(input);
            if (!isValidNumber) return; // Don't update state if input is invalid
        }

        setFormData(prevState => ({
            ...prevState,
            [activeInput]: input
        }));
    };

    const onKeyboardKeyPress = (button) => {
        if (button === "{enter}") {
            // Move to next input field
            const formElements = document.querySelector('form').elements;
            const currentElementIndex = Array.from(formElements).findIndex(elem => elem.name === activeInput);
            
            if (currentElementIndex < formElements.length - 1) {
                const nextElement = formElements[currentElementIndex + 1];
                nextElement.focus();
            }
        }
    };

    if (isLoading) {
        return <div className="loading-message">Loading user data...</div>;
    }

    return (
        <div className="user-creation-container">
            <header className="form-header">
                <h1>Update Profile</h1>
                <button 
                    type="button" 
                    className="back-button"
                    onClick={() => navigate("/")}
                >
                    Return to Motor Control
                </button>
            </header>

            {formSubmitted && !formError && (
                <div className="form-success-message">
                    User updated successfully!
                </div>
            )}

            {formError && (
                <div className="form-error-message">
                    {formError}
                </div>
            )}

            <div className="form-content">
                <div className="user-form-panel">
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid">
                            <div className="form-group">
                                <label htmlFor="username">Username</label>
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    value={formData.username || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="height">Height (cm)</label>
                                <input
                                    id="height"
                                    type="text"
                                    name="height"
                                    value={formData.height || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Height in cm"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="oberschenkellänge">Thigh Length (cm)</label>
                                <input
                                    id="oberschenkellänge"
                                    type="text"
                                    name="oberschenkellänge"
                                    value={formData.oberschenkellänge || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Thigh length in cm"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="unterschenkel">Lower Leg (cm)</label>
                                <input
                                    id="unterschenkel"
                                    type="text"
                                    name="unterschenkel"
                                    value={formData.unterschenkel || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Lower leg in cm"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="schuhgröße">Shoe Size (EU)</label>
                                <input
                                    id="schuhgröße"
                                    type="text"
                                    name="schuhgröße"
                                    value={formData.schuhgröße || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Shoe size"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="oberkörper">Torso Length (cm)</label>
                                <input
                                    id="oberkörper"
                                    type="text"
                                    name="oberkörper"
                                    value={formData.oberkörper || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Torso length in cm"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="armlänge">Arm Length (cm)</label>
                                <input
                                    id="armlänge"
                                    type="text"
                                    name="armlänge"
                                    value={formData.armlänge || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Arm length in cm"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="gewicht">Weight (kg)</label>
                                <input
                                    id="gewicht"
                                    type="text"
                                    name="gewicht"
                                    value={formData.gewicht || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Weight in kg"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="geburtsdatum">Date of Birth</label>
                                <input
                                    id="geburtsdatum"
                                    type="date"
                                    name="geburtsdatum"
                                    value={formData.geburtsdatum || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="geschlecht">Gender</label>
                                <select
                                    id="geschlecht"
                                    name="geschlecht"
                                    value={formData.geschlecht || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                >
                                    <option value="">Select Gender</option>
                                    <option value="MANN">Male</option>
                                    <option value="FRAU">Female</option>
                                    <option value="DIVERS">Other</option>
                                </select>
                            </div>
                            
                            <div className="form-group">
                                <label htmlFor="sessioncount">Session Count</label>
                                <input
                                    id="sessioncount"
                                    type="text"
                                    name="sessioncount"
                                    value={formData.sessioncount || ''}
                                    onChange={handleChange}
                                    onFocus={handleFocus}
                                    placeholder="Number of sessions"
                                />
                            </div>
                            
                            <div className="form-group checkbox-group">
                                <label className="checkbox-container">
                                    <input
                                        type="checkbox"
                                        name="rollstuhl"
                                        checked={formData.rollstuhl || false}
                                        onChange={handleChange}
                                    />
                                    <span className="checkbox-text">Wheelchair User</span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="form-actions">
                            <button onClick={async()=> {
                                    
                                    await axiosInstance.delete("delete_user")
                                   await navigate("/")
                                   

                            }}>Delete User</button>


                            <button type="submit" className="submit-button" disabled={formSubmitted}>
                                {formSubmitted ? 'Updating...' : 'Update User Profile'}
                            </button>
                            <button type="button" className="cancel-button" onClick={() => navigate("/")}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
                
                <div className="keyboard-container">
                    <Keyboard
                        keyboardRef={r => (keyboard.current = r)}
                        onChange={onKeyboardChange}
                        onKeyPress={onKeyboardKeyPress}
                        theme="hg-theme-default hg-layout-default custom-keyboard"
                    />
                </div>
            </div>
        </div>
    );
};

export default UpdateUser;