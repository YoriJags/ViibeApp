import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import ApiDocs from "@/pages/ApiDocs";

function App() {
  return (
    <div className="film-grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<ApiDocs />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
