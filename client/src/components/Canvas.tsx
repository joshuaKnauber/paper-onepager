import html2canvas from "html2canvas-pro";
import { CheckIcon, EraserIcon, XIcon } from "lucide-react";
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
    const canvas = await html2canvas(document.querySelector("#viewport")!);
    document.body.appendChild(canvas);
    const canvasDataURL = canvas.toDataURL("image/jpeg", 0.8);
    document.body.removeChild(canvas);

    const canvasPage = await html2canvas(document.querySelector("#page")!);
    document.body.appendChild(canvasPage);
    const canvasPageDataURL = canvasPage.toDataURL("image/jpeg", 0.8);
    document.body.removeChild(canvasPage);

    const res = await fetch("/api/refactor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: props.currentHtml,
        drawoverUrl: canvasDataURL,
        pageUrl: canvasPageDataURL,
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
          hasStrokes={strokes.length > 0 || currentPoints.length > 0}
          onClear={() => setStrokes([])}
          onDiscard={() => setActive(false)}
          onAccept={onAccept}
          onEdit={() => setActive(true)}
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
            ? "bg-black/10 pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        {strokes.map((pathData, index) => (
          <path key={index} d={pathData} fill="#FF2A00" />
        ))}
        {isDrawing && currentPoints.length > 0 && (
          <path d={currentPathData} fill="#FF2A00" />
        )}
      </svg>
    </>
  );
}

function CanvasToolbar(props: {
  visible: boolean;
  isDrawing: boolean;
  hasStrokes: boolean;
  onEdit: () => void;
  onClear: () => void;
  onDiscard: () => void;
  onAccept: () => void;
}) {
  const mousePosition = useMousePosition();
  const isInLowerMiddle =
    mousePosition && window.innerHeight - mousePosition[1] < 300;

  return (
    <>
      {!props.hasStrokes && props.visible && (
        <img
          src="/edit.svg"
          className={twMerge(
            props.visible ? "opacity-100" : "opacity-0",
            "fixed transition-all top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[80vw] max-w-[700px] pointer-events-none"
          )}
        />
      )}
      <div
        className={twMerge(
          "fixed bottom-4 flex flex-row gap-4 transition-all left-1/2 -translate-x-1/2 z-20",
          // move in when visible
          props.visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-8 opacity-0 scale-50",
          // move out of the way for the mouse
          ((props.isDrawing && isInLowerMiddle) ||
            (props.visible && !props.hasStrokes)) &&
            "pointer-events-none translate-y-8 scale-90 opacity-50 gap-2 [&_button]:nth-of-type-[1]:-rotate-[10deg] [&_button]:nth-of-type-[2]:rotate-[10deg]"
        )}
      >
        <button
          onClick={props.onClear}
          className="bg-white rounded-sm size-16 md:size-10 active:scale-90 cursor-pointer flex items-center justify-center transition-all duration-150 origin-bottom"
        >
          <EraserIcon className="size-6 md:size-5" />
        </button>
        <button
          onClick={props.onAccept}
          disabled={!props.hasStrokes}
          className="bg-white rounded-sm size-16 md:size-10 active:scale-90 cursor-pointer flex items-center justify-center transition-all duration-150 origin-bottom"
        >
          <CheckIcon className="size-6 md:size-5" />
        </button>
      </div>
      {props.visible && (
        <button
          onClick={props.onDiscard}
          className="fixed top-6 right-6 z-10 cursor-pointer"
        >
          <XIcon className="size-5" />
        </button>
      )}
      <button
        onClick={props.onEdit}
        className={twMerge(
          "fixed z-10 bottom-4 left-1/2 -translate-x-1/2 w-[100px] bg-white rounded-4xl h-12 md:hidden flex items-center justify-center transition-all",
          !props.visible ? "translate-y-0 scale-100" : "translate-y-20 scale-50"
        )}
      >
        <span className="font-semibold">Edit</span>
      </button>
    </>
  );
}
