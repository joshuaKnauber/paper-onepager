import { useEffect, useState } from "react";

export function useMousePosition() {
  const [position, setPosition] = useState<null | [number, number]>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setPosition([e.clientX, e.clientY]);
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return position;
}
