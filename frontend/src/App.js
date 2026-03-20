import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import ApiDocs from "@/pages/ApiDocs";
import PitchDeck from "@/pages/PitchDeck";
import Receipt from "@/pages/Receipt";
import Report from "@/pages/Report";
import Press from "@/pages/Press";

function App() {
  return (
    <div className="film-grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<ApiDocs />} />
          <Route path="/pitch" element={<PitchDeck />} />
          <Route path="/receipt" element={<Receipt />} />
          <Route path="/report" element={<Report />} />
          <Route path="/press" element={<Press />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
