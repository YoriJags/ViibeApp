import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import ApiDocs from "@/pages/ApiDocs";
import PitchDeck from "@/pages/PitchDeck";

function App() {
  return (
    <div className="film-grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<ApiDocs />} />
          <Route path="/pitch" element={<PitchDeck />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
