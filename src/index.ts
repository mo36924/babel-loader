import { transformAsync } from "@babel/core";
// @ts-ignore
import tla from "@babel/plugin-syntax-top-level-await";
import { dataToEsm } from "@rollup/pluginutils";
import enhancedResolve, { ResolveOptions } from "enhanced-resolve";
import { existsSync } from "fs";
import { dirname, join, resolve as pathResolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { promisify } from "util";

type Resolve = (
  specifier: string,
  context: { parentURL?: string; conditions: string[] },
  defaultResolve: Resolve,
) => { url: string } | Promise<{ url: string }>;

type GetFormat = (
  url: string,
  context: { format: string },
  defaultGetSource: GetFormat,
) => { format: string } | Promise<{ format: string }>;

type GetSource = (
  url: string,
  context: { format: string },
  defaultGetSource: GetSource,
) => { source: string | Uint8Array } | Promise<{ source: string | Uint8Array }>;

type TransformSource = (
  source: string | SharedArrayBuffer | Uint8Array,
  context: { format: string; url: string },
  defaultTransformSource: TransformSource,
) => { source: string | SharedArrayBuffer | Uint8Array } | Promise<{ source: string | SharedArrayBuffer | Uint8Array }>;

const base = pathResolve(existsSync("src") ? "src" : "");

const resolver: (dir: string, request: string) => Promise<string | false> = promisify(
  enhancedResolve.create({
    conditionNames: ["import", "require", "default"],
    extensions: [".tsx", ".ts", ".jsx", ".mjs", ".js", ".cjs", ".json", ".node"],
  } as ResolveOptions),
);

export const resolve: Resolve = async (specifier, context, defaultResolve) => {
  if (specifier[0] === ".") {
    const result = await resolver(dirname(fileURLToPath(context.parentURL!)), specifier);
    if (result) {
      return {
        url: pathToFileURL(result).href,
      };
    }
  }

  if (specifier.startsWith("~/") || specifier.startsWith("@/")) {
    const result = await resolver(dirname(fileURLToPath(context.parentURL!)), join(base, specifier.slice(2)));
    if (result) {
      return {
        url: pathToFileURL(result).href,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
};

export const getFormat: GetFormat = (url, context, defaultGetFormat) => {
  if (url.startsWith("file:///") && !url.includes("/node_modules/")) {
    return { format: "module" };
  }
  return defaultGetFormat(url, context, defaultGetFormat);
};

export const transformSource: TransformSource = async (source, context, defaultTransformSource) => {
  const url = context.url;
  if (url.startsWith("file:///") && !url.includes("/node_modules/")) {
    if (url.endsWith(".json")) {
      const esm = dataToEsm(JSON.parse(source.toString()), {
        compact: true,
        namedExports: true,
        preferConst: true,
      });
      return { source: esm };
    } else {
      const result = await transformAsync(source.toString(), {
        sourceMaps: "inline",
        filename: fileURLToPath(url),
        plugins: [tla],
      });
      return { source: result!.code! };
    }
  }
  return defaultTransformSource(source, context, defaultTransformSource);
};
