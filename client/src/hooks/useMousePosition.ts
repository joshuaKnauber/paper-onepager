import { useEffect, useState } from "react";

export function useMousePosition() {
  const [position, setPosition] = useState<null | [number, number]>(null);

  useEffect(() => {
    const onPointerMove = (e: MouseEvent) => {
      setPosition([e.clientX, e.clientY]);
    };

    const onPointerUp = () => {
      setPosition(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return position;
}
