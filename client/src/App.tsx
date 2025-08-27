import { ditheringFragmentShader, ShaderMount } from "@paper-design/shaders";
import { DotGrid } from "@paper-design/shaders-react";
import { useLayoutEffect, useState } from "react";

import { Canvas } from "./components/Canvas";
import page from "./content.html?raw";

export function App() {
  const [history, setHistory] = useState<string[]>([page]);
  const currentState = history[history.length - 1] || "";

  useLayoutEffect(() => {
    const editContainer = document.getElementById("edit-cta");
    if (!editContainer) return;
    const hasCanvas = editContainer.querySelector("canvas");
    if (hasCanvas) return;

    new ShaderMount(
      editContainer,
      ditheringFragmentShader,
      {
        u_colorBack: [0.9375, 0.933, 0.917, 1.0],
        u_colorFront: [0.804, 0.792, 0.746, 1.0],
        u_shape: 0.0,
        u_type: 1.0,
        u_pxSize: 9.0,
        u_offsetX: 0.0,
        u_offsetY: 0.0,
        u_scale: 1.0,
        u_rotation: 0.0,
      },
      undefined,
      1.0
    );
  }, []);

  return (
    <>
      <div className="w-screen h-[100dvh]" id="viewport">
        <Canvas
          currentHtml={currentState}
          setCurrentState={(newHtml) => setHistory([...history, newHtml])}
        />
        <div
          id="page"
          className="w-full h-full overflow-y-auto pb-[4.5rem] md:pb-0"
        >
          <div dangerouslySetInnerHTML={{ __html: currentState }}></div>
        </div>
        <DotGrid
          className="absolute top-0 left-0 w-full h-[100dvh] -z-10"
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
