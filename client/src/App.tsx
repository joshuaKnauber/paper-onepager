import { DotGrid } from "@paper-design/shaders-react";
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
        <DotGrid
          className="absolute inset-0 -z-10"
          colorBack="#F0EFEB"
          colorFill="#CECBBF"
          colorStroke="hsl(40, 100%, 50%)"
          size={1}
          gapX={24}
          gapY={24}
          strokeWidth={0}
          sizeRange={0}
          opacityRange={0}
          shape="circle"
          scale={1}
          rotation={0}
        />
      </div>
    </>
  );
}
