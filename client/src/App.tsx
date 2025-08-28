import { ShaderMount, simplexNoiseFragmentShader } from "@paper-design/shaders";
import { DotGrid } from "@paper-design/shaders-react";
import { useLayoutEffect, useState } from "react";

import { Canvas } from "./components/Canvas";
import page from "./content.html?raw";

export function App() {
  const [history, setHistory] = useState<string[]>([page]);
  const [newHtml, setNewHtml] = useState<null | string>(null);
  const currentState = history.at(-1) || "";

  useLayoutEffect(() => {
    const editContainer = document.getElementById("edit-cta");
    if (!editContainer) return;
    const hasCanvas = editContainer.querySelector("canvas");
    if (hasCanvas) return;

    new ShaderMount(
      editContainer,
      simplexNoiseFragmentShader,
      {
        u_fit: 2,
        u_scale: 2,
        u_rotation: 0,
        u_originX: 0,
        u_originY: 0,
        u_offsetX: 0,
        u_offsetY: 0,
        u_worldWidth: 0,
        u_worldHeight: 0,
        u_colors: [[1, 0.48, 0, 1.0]],
        u_colorsCount: 3,
        u_stepsPerColor: 3,
        u_softness: 4,
      },
      undefined,
      1.0
    );
  }, [history]);

  const canUndo = history.length > 1;

  const onUndo = () => {
    if (!canUndo) return;
    setHistory((h) => h.slice(0, -1));
  };

  return (
    <>
      <div className="w-screen h-[100dvh]" id="viewport">
        <Canvas
          currentHtml={currentState}
          setCurrentState={(newHtml) => {
            setNewHtml(newHtml);
            setTimeout(() => {
              setHistory([...history, newHtml]);
              setNewHtml(null);
            }, 1000);
          }}
          onUndoPage={canUndo ? onUndo : null}
        />
        <div
          id="page"
          className="w-full h-full relative overflow-y-auto pb-[5.5rem] md:pb-0"
        >
          {newHtml && (
            <div
              className="fade-in absolute top-0 left-0 z-10 w-full"
              dangerouslySetInnerHTML={{ __html: newHtml }}
            ></div>
          )}
          <div
            className={newHtml ? "fade-out" : undefined}
            dangerouslySetInnerHTML={{ __html: currentState }}
          ></div>
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
