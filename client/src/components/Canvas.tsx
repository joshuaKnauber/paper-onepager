import { PulsingBorder } from "@paper-design/shaders-react";
import html2canvas from "html2canvas-pro";
import { CheckIcon, EraserIcon, XIcon } from "lucide-react";
import getStroke from "perfect-freehand";
import { useEffect, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import useSWRMutation from "swr/mutation";
import { twMerge } from "tailwind-merge";
import { useMousePosition } from "../hooks/useMousePosition";
import { getSvgPathFromStroke } from "./getSvgPathFromStroke";

async function postUpdate(
  url: string,
  {
    arg,
  }: {
    arg: {
      body: {
        html: string;
        drawoverUrl: string;
        pageUrl: string;
      };
    };
  }
) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(arg.body),
  });
  const text = await res.text();
  return text;
}

export function Canvas(props: {
  currentHtml: string;
  setCurrentState: (value: string) => void;
}) {
  const [active, setActive] = useState(false);

  const [isScreenshotting, setIsScreenshotting] = useState(false);
  const { trigger: updateUi, isMutating } = useSWRMutation(
    "/api/refactor",
    postUpdate
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
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
    setIsScreenshotting(true);
    setActive(false);
    try {
      const canvas = await html2canvas(document.querySelector("#viewport")!);
      document.body.appendChild(canvas);
      const canvasDataURL = canvas.toDataURL("image/jpeg", 0.8);
      document.body.removeChild(canvas);

      const canvasPage = await html2canvas(document.querySelector("#page")!);
      document.body.appendChild(canvasPage);
      const canvasPageDataURL = canvasPage.toDataURL("image/jpeg", 0.8);
      document.body.removeChild(canvasPage);

      const newHtml = await updateUi({
        body: {
          html: props.currentHtml,
          drawoverUrl: canvasDataURL,
          pageUrl: canvasPageDataURL,
        },
      });

      props.setCurrentState(newHtml);
    } catch (error) {
      console.error(error);
    } finally {
      setIsScreenshotting(false);
    }
  };

  return (
    <>
      <DrawingSurface
        active={active}
        setActive={setActive}
        onAccept={onAccept}
      />
      {(isMutating || isScreenshotting) && (
        <PulsingBorder
          className={twMerge(
            "fixed top-0 left-0 w-full bottom-0 pointer-events-none z-20"
          )}
          colorBack="rgba(0, 0, 0, 0)"
          roundness={0}
          thickness={0.1}
          softness={0.8}
          intensity={0.2}
          bloom={0.45}
          spots={3}
          spotSize={0.4}
          pulse={0.2}
          smoke={0.35}
          smokeSize={0.6}
          scale={1}
          rotation={0}
          offsetX={0}
          offsetY={0}
          speed={1}
          colors={[
            "hsl(347, 89%, 55%)",
            "hsl(205, 75%, 60%)",
            "hsl(39, 100%, 50%)",
          ]}
        />
      )}
    </>
  );
}

function DrawingSurface(props: {
  active: boolean;
  setActive: (value: boolean) => void;
  onAccept: () => Promise<void>;
}) {
  const [strokes, setStrokes] = useState<string[]>([]);
  const [currentPoints, setCurrentPoints] = useState<
    [number, number, number][]
  >([]);
  const [isDrawing, setIsDrawing] = useState(false);

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (!props.active) return;
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

  return (
    <>
      {createPortal(
        <CanvasToolbar
          visible={props.active}
          isDrawing={isDrawing}
          hasStrokes={strokes.length > 0 || currentPoints.length > 0}
          onClear={() => setStrokes([])}
          onDiscard={() => props.setActive(false)}
          onAccept={async () => {
            await props.onAccept();
            setStrokes([]);
            setCurrentPoints([]);
          }}
          onEdit={() => props.setActive(true)}
        />,
        document.querySelector("#root")!
      )}
      <svg
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={twMerge(
          "fixed z-10 top-0 cursor-crosshair left-0 w-full h-full transition-all duration-150 touch-none",
          props.active
            ? "bg-black/50 pointer-events-auto opacity-100"
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
        <>
          <img
            src="/edit.svg"
            className={twMerge(
              props.visible ? "opacity-100" : "opacity-0",
              "fixed hidden md:block transition-all top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[80vw] max-w-[700px] pointer-events-none"
            )}
          />
          <img
            src="/edit-mobile.svg"
            className={twMerge(
              props.visible ? "opacity-100" : "opacity-0",
              "fixed md:hidden transition-all top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-[700px] pointer-events-none"
            )}
          />
        </>
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
          className={twMerge(
            "md:bg-transparent fixed top-4 rounded-sm right-4 z-20 cursor-pointer bg-white p-2",
            props.isDrawing && "pointer-events-none"
          )}
        >
          <XIcon className="md:size-5 size-6" />
        </button>
      )}
      <button
        onClick={props.onEdit}
        className={twMerge(
          "fixed z-10 bottom-6 left-1/2 -translate-x-1/2 w-fit px-8 shadow-lg bg-white rounded-4xl h-12 md:hidden flex items-center justify-center transition-all",
          !props.visible ? "translate-y-0 scale-100" : "translate-y-20 scale-50"
        )}
      >
        <span className="font-semibold">Edit the page</span>
      </button>
    </>
  );
}
