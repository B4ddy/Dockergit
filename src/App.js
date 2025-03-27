
import './App.css';
import MotorControl from './components/Motorcontrol';
import BaseRoute from './components/Routing';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CreateUser from './components/Nutzerverwaltung/CreateUser';
import LoginUser from './components/Nutzerverwaltung/LoginUser';
import HistoryPage from './components/Datahistory/historypage';
import SessionVisualizer from './components/Datahistory/sessionvisualizer';
import UpdateUser from './components/Nutzerverwaltung/UpdateUser';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <BaseRoute>
            <MotorControl />
          </BaseRoute>
        } />
            <Route path="/createuser" element={<CreateUser></CreateUser>} />
            <Route path="/loginuser" element={<LoginUser></LoginUser>} />
            <Route path="/history" element={<HistoryPage></HistoryPage>} />
            <Route path="/sessiondemo" element={<SessionVisualizer></SessionVisualizer>} />
            <Route path="/update_user" element={<UpdateUser></UpdateUser>} />
      </Routes>
    </Router>

  );
}

export default App;



