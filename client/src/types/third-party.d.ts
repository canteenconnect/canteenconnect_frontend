declare module "framer-motion";

declare module "@hookform/resolvers/zod" {
  export function zodResolver(...args: any[]): any;
}

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: {
          client_id: string;
          callback: (response: { credential?: string }) => void;
        }) => void;
        renderButton: (
          parent: HTMLElement,
          options: Record<string, string | number | boolean>,
        ) => void;
      };
    };
  }
}
