#!/usr/bin/env -S node --enable-source-maps --experimental-loader @mo36924/babel-loader
import { pathToFileURL } from "url";
await import(pathToFileURL(process.argv[2]).href);
