import { useEffect } from "react";

interface MetaOptions {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function useDocumentMeta({ title, description, image, url, type = "website" }: MetaOptions) {
  useEffect(() => {
    // Update document title
    const previousTitle = document.title;
    document.title = title;

    // Helper to update or create meta tag
    const setMetaTag = (property: string, content: string, isOg = true) => {
      const attribute = isOg ? "property" : "name";
      let element = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Set Open Graph tags
    if (title) {
      setMetaTag("og:title", title);
      setMetaTag("twitter:title", title, false);
    }

    if (description) {
      setMetaTag("og:description", description);
      setMetaTag("twitter:description", description, false);
      setMetaTag("description", description, false);
    }

    if (image) {
      setMetaTag("og:image", image);
      setMetaTag("twitter:image", image, false);
    }

    if (url) {
      setMetaTag("og:url", url);
    }

    setMetaTag("og:type", type);

    // Cleanup - restore previous title
    return () => {
      document.title = previousTitle;
    };
  }, [title, description, image, url, type]);
}
