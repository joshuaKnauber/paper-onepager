import { useState } from "react";
import { Canvas } from "./components/Canvas";
import page from "./content.html?raw";

export function App() {
  const [history, setHistory] = useState<string[]>([page]);
  const currentState = history[history.length - 1] || "";

  return (
    <>
      <div className="w-screen h-screen overflow-y-auto" id="capture">
        <Canvas
          currentHtml={currentState}
          setCurrentState={(newHtml) => setHistory([...history, newHtml])}
        />
        <div dangerouslySetInnerHTML={{ __html: currentState }}></div>
      </div>
    </>
  );
}
