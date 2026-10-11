import { forwardRef, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * An <img> that fades in once it has loaded instead of popping in line by line.
 * Pictures already in the browser cache show at once.
 */
export const FadeInImage = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(function FadeInImage(
  { className, onLoad, onError, ...props },
  forwardedRef,
) {
  const [loaded, setLoaded] = useState(false);

  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth > 0) setLoaded(true);
      if (typeof forwardedRef === "function") forwardedRef(img);
      else if (forwardedRef) forwardedRef.current = img;
    },
    [forwardedRef],
  );

  return (
    <img
      ref={ref}
      decoding="async"
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        // Show whatever the browser has (broken-image icon) rather than an empty box.
        setLoaded(true);
        onError?.(e);
      }}
      className={cn("transition-opacity duration-500 ease-out", loaded ? "opacity-100" : "opacity-0", className)}
    />
  );
});
