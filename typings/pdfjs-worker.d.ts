declare module "pdfjs-dist/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: {
    setup(handler: unknown, port: unknown): void;
  };
}
