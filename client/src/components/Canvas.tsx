import { PulsingBorder } from "@paper-design/shaders-react";
import html2canvas from "html2canvas-pro";
import { CheckIcon, MinusIcon, PlusIcon, Undo2Icon, XIcon } from "lucide-react";
import getStroke from "perfect-freehand";
import { useEffect, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import useSWRMutation from "swr/mutation";
import { twMerge } from "tailwind-merge";
import { useLocalStorage } from "../hooks/useLocalStorage";
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
    credentials: "include",
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
    "/api/edit",
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
      {(isMutating || isScreenshotting) && <LoaderShader />}
    </>
  );
}

type Tool = "modify" | "erase";
const TOOL_COLORS: Record<Tool, string> = {
  modify: "#9ef01a",
  erase: "#dc143c",
};

function DrawingSurface(props: {
  active: boolean;
  setActive: (value: boolean) => void;
  onAccept: () => Promise<void>;
}) {
  const [strokes, setStrokes] = useState<{ stroke: string; tool: Tool }[]>([]);
  const [currentPoints, setCurrentPoints] = useState<
    [number, number, number][]
  >([]);
  const [tool, setTool] = useState<Tool>("modify");
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
      setStrokes([...strokes, { stroke: pathData, tool }]);
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
          tool={tool}
          setTool={setTool}
          onUndo={() => setStrokes((c) => c.slice(0, -1))}
          onDiscard={() => {
            props.setActive(false);
            setStrokes([]);
          }}
          onAccept={async () => {
            if (strokes.length === 0) return;
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
            ? "bg-black/40 pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        {strokes.map((pathData, index) => (
          <path
            key={index}
            d={pathData.stroke}
            fill={TOOL_COLORS[pathData.tool]}
          />
        ))}
        {isDrawing && currentPoints.length > 0 && (
          <path d={currentPathData} fill={TOOL_COLORS[tool]} />
        )}
      </svg>
    </>
  );
}

function CanvasToolbar(props: {
  visible: boolean;
  isDrawing: boolean;
  hasStrokes: boolean;
  tool: Tool;
  setTool: (tool: Tool) => void;
  onEdit: () => void;
  onUndo: () => void;
  onDiscard: () => void;
  onAccept: () => void;
}) {
  const [showHint, setShowHint] = useLocalStorage("show-draw-hint", true);
  const mousePosition = useMousePosition();

  const [isLowered, setIsLowered] = useState(false);

  useEffect(() => {
    const isInLowerMiddle =
      mousePosition && mousePosition[1] / window.innerHeight > 0.6;
    if (props.isDrawing && !isLowered && isInLowerMiddle) {
      setIsLowered(true);
    } else if (!props.isDrawing && isLowered) {
      setIsLowered(false);
    }
  }, [props.isDrawing, mousePosition, isLowered]);

  return (
    <>
      {!props.hasStrokes && props.visible && showHint && (
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
              "fixed md:hidden transition-all top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[70vw] max-w-[700px] pointer-events-none"
            )}
          />
        </>
      )}
      <div
        className={twMerge(
          "fixed bottom-6 flex flex-row gap-4 transition-all left-1/2 -translate-x-1/2 z-20",
          // move in when visible
          props.visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-8 opacity-0 scale-50",
          // move out of the way for the mouse
          props.isDrawing &&
            isLowered &&
            "pointer-events-none translate-y-12 md:opacity-50 scale-75"
        )}
      >
        <button
          onClick={props.onUndo}
          className={twMerge(
            "bg-white rounded-4xl size-16 md:size-12 active:scale-90 cursor-pointer flex items-center justify-center transition-all duration-150 origin-bottom",
            !props.hasStrokes &&
              props.visible &&
              "translate-y-8 translate-x-4 scale-90 opacity-50 -rotate-12"
          )}
        >
          <Undo2Icon className="size-6 md:size-5 pointer-events-none" />
        </button>
        <div className="flex flex-row px-1 items-center gap-1 bg-white rounded-4xl">
          <button
            onClick={() => props.setTool("modify")}
            className={twMerge(
              "rounded-4xl shrink-0 hover:bg-black/10 size-14 md:size-10 active:scale-90 transition-transform duration-150 cursor-pointer flex items-center justify-center",
              props.tool === "modify" && "bg-black/10"
            )}
          >
            <PlusIcon className="size-6 md:size-5 pointer-events-none" />
          </button>
          <button
            onClick={() => props.setTool("erase")}
            className={twMerge(
              "rounded-4xl shrink-0 hover:bg-black/10 size-14 md:size-10 active:scale-90 transition-transform duration-150 cursor-pointer flex items-center justify-center",
              props.tool === "erase" && "bg-black/10"
            )}
          >
            <MinusIcon className="size-6 md:size-5 pointer-events-none" />
          </button>
        </div>
        <button
          onClick={() => {
            setShowHint(false);
            props.onAccept();
          }}
          disabled={!props.hasStrokes}
          className={twMerge(
            "bg-white rounded-4xl size-16 md:size-12 active:scale-90 cursor-pointer flex items-center justify-center transition-all duration-150 origin-bottom",
            !props.hasStrokes &&
              props.visible &&
              "translate-y-8 -translate-x-4 scale-90 opacity-50 rotate-12"
          )}
        >
          <CheckIcon className="size-6 md:size-5 pointer-events-none" />
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
          <XIcon className="md:size-5 size-6 pointer-events-none" />
        </button>
      )}
      <button
        onClick={props.onEdit}
        className={twMerge(
          "fixed z-10 bottom-6 left-1/2 -translate-x-1/2 w-fit px-8 shadow-lg bg-white rounded-4xl h-16 md:hidden flex items-center justify-center transition-all",
          !props.visible ? "translate-y-0 scale-100" : "translate-y-20 scale-50"
        )}
      >
        <span className="font-semibold">Edit the page</span>
      </button>
    </>
  );
}

function LoaderShader() {
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const onResize = () => {
      setHeight(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <PulsingBorder
      className={twMerge("fixed top-0 left-0 w-full pointer-events-none z-20")}
      style={{
        height: height,
      }}
      colorBack="rgba(0, 0, 0, 0)"
      roundness={0}
      thickness={0.05}
      softness={0.75}
      intensity={0.1}
      bloom={0.35}
      spots={3}
      spotSize={0.3}
      pulse={0.1}
      smoke={0.45}
      smokeSize={0.6}
      scale={1}
      rotation={0}
      offsetX={0}
      offsetY={0}
      speed={1}
      colors={["hsl(200, 98%, 52%)", "hsl(290, 87%, 51%)", "hsl(5, 100%, 59%)"]}
    />
  );
}
