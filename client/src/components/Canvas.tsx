import html2canvas from "html2canvas-pro";
import getStroke from "perfect-freehand";
import { useEffect, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { useMousePosition } from "../hooks/useMousePosition";
import { getSvgPathFromStroke } from "./getSvgPathFromStroke";

export function Canvas(props: {
  currentHtml: string;
  setCurrentState: (value: string) => void;
}) {
  const [active, setActive] = useState(false);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentPoints, setCurrentPoints] = useState<
    [number, number, number][]
  >([]);
  const [isDrawing, setIsDrawing] = useState(false);

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (!active) return;
    setIsDrawing(true);
    setCurrentPoints([[e.pageX, e.pageY, e.pressure]]);
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!isDrawing || e.buttons !== 1) return;
    setCurrentPoints([...currentPoints, [e.pageX, e.pageY, e.pressure]]);
  }

  function handlePointerUp() {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 0) {
      const stroke = getStroke(currentPoints, {
        size: 8,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });
      const pathData = getSvgPathFromStroke(stroke);
      setStrokes([...strokes, pathData]);
    }

    setCurrentPoints([]);
  }

  const currentStroke = getStroke(currentPoints, {
    size: 8,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });
  const currentPathData = getSvgPathFromStroke(currentStroke);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setCurrentPoints([]);
        setStrokes([]);
        setActive((c) => !c);
      } else if (e.code === "Escape" && active) {
        e.preventDefault();
        setActive(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  const onAccept = async () => {
    const canvas = await html2canvas(document.querySelector("#capture")!);
    document.body.appendChild(canvas);
    const canvasDataURL = canvas.toDataURL("image/jpeg", 0.8);
    console.log(canvasDataURL);
    document.body.removeChild(canvas);

    const res = await fetch("/api/refactor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: props.currentHtml,
        dataUrl: canvasDataURL,
      }),
    });
    const newHtml = await res.text();
    props.setCurrentState(newHtml);
    setActive(false);
  };

  return (
    <>
      {createPortal(
        <CanvasToolbar
          visible={active}
          isDrawing={isDrawing}
          onClear={() => setStrokes([])}
          onDiscard={() => setActive(false)}
          onAccept={onAccept}
        />,
        document.querySelector("#root")!
      )}
      <svg
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={twMerge(
          "fixed z-10 top-0 cursor-crosshair left-0 w-full h-full transition-all duration-150 touch-none",
          active
            ? "bg-black/15 pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        {strokes.map((pathData, index) => (
          <path key={index} d={pathData} fill="red" />
        ))}
        {isDrawing && currentPoints.length > 0 && (
          <path d={currentPathData} fill="red" />
        )}
      </svg>
    </>
  );
}

function CanvasToolbar(props: {
  visible: boolean;
  isDrawing: boolean;
  onClear: () => void;
  onDiscard: () => void;
  onAccept: () => void;
}) {
  const mousePosition = useMousePosition();
  const isInLowerMiddle =
    mousePosition && window.innerHeight - mousePosition[1] < 200;

  return (
    <div
      className={twMerge(
        "fixed bottom-4 transition-all left-1/2 -translate-x-1/2 z-20 bg-white",
        // move in when visible
        props.visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-8 opacity-0 scale-50",
        // move out of the way for the mouse
        props.isDrawing &&
          isInLowerMiddle &&
          "pointer-events-none translate-y-8 opacity-50"
      )}
    >
      <button onClick={props.onClear}>clear</button>
      <button onClick={props.onAccept}>accept</button>
      <button onClick={props.onDiscard}>discard</button>
    </div>
  );
}
